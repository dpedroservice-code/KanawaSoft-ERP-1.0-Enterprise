import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://kanawasoft-erp-1-0-enterprise.netlify.app",
  "http://localhost:8888",
  "http://127.0.0.1:8888"
]);
const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

function corsHeaders(origin: string | null) {
  const headers: Record<string,string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}
function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
async function encryptSecret(value: unknown, raw: string) {
  if (!raw) throw new Error("Cofre de cifragem indisponível.");
  const keyBytes = fromB64(raw);
  if (keyBytes.byteLength !== 32) throw new Error("Chave de cifragem inválida no servidor.");
  const key = await crypto.subtle.importKey("raw",keyBytes,"AES-GCM",false,["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(value)));
  return toB64(new Uint8Array([...iv,...new Uint8Array(cipher)]));
}
async function decryptSecret(value: string, raw: string) {
  const keyBytes = fromB64(raw);
  if (keyBytes.byteLength !== 32) throw new Error("Chave de cifragem inválida no servidor.");
  const bytes = fromB64(value);
  const iv = bytes.slice(0,12);
  const cipher = bytes.slice(12);
  const key = await crypto.subtle.importKey("raw",keyBytes,"AES-GCM",false,["decrypt"]);
  const clear = await crypto.subtle.decrypt({name:"AES-GCM",iv},key,cipher);
  return JSON.parse(dec.decode(clear));
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return json({error:"Origem não autorizada."},403,origin);
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders(origin)});
  if (req.method !== "POST") return json({error:"Método não permitido."},405,origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !anon || !service) return json({error:"Configuração do servidor incompleta."},503,origin);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i,"");
    if (!token) return json({error:"Sessão obrigatória."},401,origin);
    const userClient = createClient(url,anon,{
      global:{headers:{Authorization:"Bearer "+token}},
      auth:{persistSession:false,autoRefreshToken:false}
    });
    const {data:auth,error:authError}=await userClient.auth.getUser(token);
    if(authError||!auth.user) return json({error:"Sessão inválida ou expirada."},401,origin);

    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json();
    const companyId=String(body.companyId||"");
    const action=String(body.action||"");
    if(!/^[0-9a-f-]{36}$/i.test(companyId)) return json({error:"Empresa inválida."},400,origin);

    const {data:membership,error:membershipError}=await admin.from("ks_company_memberships")
      .select("role,status").eq("company_id",companyId).eq("user_id",auth.user.id)
      .eq("status","active").maybeSingle();
    if(membershipError||!membership) return json({error:"Sem acesso a esta empresa."},403,origin);

    if(action==="get_status") {
      const {data:row,error}=await admin.from("ks_company_integration_secrets")
        .select("last_four,scopes,status,rotated_at,created_at")
        .eq("company_id",companyId).eq("provider","agt").maybeSingle();
      if(error) throw error;
      const scopes=Array.isArray(row?.scopes)?row.scopes:[];
      const environmentScope=scopes.find((s:string)=>s.startsWith("environment:"))||"";
      const status=row?.status||"not_configured";
      return json({
        configured:status==="configured",
        status,
        environment:environmentScope.split(":")[1]||null,
        maskedNif:row?.last_four?"••••"+row.last_four:null,
        rotatedAt:row?.rotated_at||null,
        producerCredentialsConfigured:!!(Deno.env.get("AGT_PRODUCER_USERNAME")&&Deno.env.get("AGT_PRODUCER_PASSWORD")),
        softwarePrivateKeyConfigured:!!Deno.env.get("AGT_SOFTWARE_PRIVATE_KEY"),
        softwareValidationNumberConfigured:!!Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER")
      },200,origin);
    }

    if(action==="save_config") {
      const role=String(membership.role||"").toLowerCase();
      if(!["owner","admin"].includes(role)) return json({error:"Apenas o proprietário ou administrador pode alterar as chaves AGT."},403,origin);

      const environment=String(body.environment||"homologation");
      const nif=String(body.taxRegistrationNumber||"").trim();
      const softwareValidationNumber=String(body.softwareValidationNumber||"").trim();
      const incomingPrivateKey=String(body.taxpayerPrivateKey||"");
      const incomingCertificate=String(body.taxpayerCertificate||"");
      if(!["homologation","production"].includes(environment)) return json({error:"Ambiente inválido."},400,origin);
      if(!/^[0-9]{9,15}$/.test(nif)) return json({error:"Introduza um NIF válido do contribuinte."},400,origin);
      if(incomingPrivateKey.length>24000||incomingCertificate.length>24000||softwareValidationNumber.length>120) {
        return json({error:"Um dos campos excede o tamanho permitido."},400,origin);
      }
      if(environment==="production"&&(!softwareValidationNumber||!Deno.env.get("AGT_PRODUCER_USERNAME")||!Deno.env.get("AGT_PRODUCER_PASSWORD")||!Deno.env.get("AGT_SOFTWARE_PRIVATE_KEY")||!Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER"))) {
        return json({error:"Produção bloqueada: faltam credenciais do produtor, chave privada do software ou número de validação emitido pela AGT no servidor."},409,origin);
      }

      const {data:key,error:keyError}=await admin.rpc("ks_get_integration_encryption_key");
      if(keyError||typeof key!=="string"||!key) return json({error:"Cofre de cifragem não configurado no servidor."},503,origin);
      const {data:existing,error:existingError}=await admin.from("ks_company_integration_secrets")
        .select("credential_ciphertext").eq("company_id",companyId).eq("provider","agt").maybeSingle();
      if(existingError) throw existingError;
      let previous:Record<string,unknown>={};
      if(existing?.credential_ciphertext) previous=await decryptSecret(existing.credential_ciphertext,key);
      const config={
        taxRegistrationNumber:nif,
        environment,
        softwareValidationNumber:softwareValidationNumber||String(previous.softwareValidationNumber||""),
        taxpayerPrivateKey:incomingPrivateKey||String(previous.taxpayerPrivateKey||""),
        taxpayerCertificate:incomingCertificate||String(previous.taxpayerCertificate||""),
        updatedAt:new Date().toISOString()
      };
      const scopes=[
        "environment:"+environment,
        "taxpayer_private_key:"+(config.taxpayerPrivateKey?"present":"missing"),
        "taxpayer_certificate:"+(config.taxpayerCertificate?"present":"missing"),
        "software_validation_number:"+(config.softwareValidationNumber?"present":"missing")
      ];
      const ready=!!(config.taxpayerPrivateKey&&config.taxpayerCertificate&&config.softwareValidationNumber);
      const ciphertext=await encryptSecret(config,key);
      const {error:saveError}=await admin.from("ks_company_integration_secrets").upsert({
        company_id:companyId,provider:"agt",credential_ciphertext:ciphertext,
        key_version:"aes-256-gcm-v1",last_four:nif.slice(-4),scopes,
        status:ready?"configured":"pending_certification",rotated_at:new Date().toISOString()
      },{onConflict:"company_id,provider"});
      if(saveError) throw saveError;
      return json({
        success:true,configured:ready,status:ready?"configured":"pending_certification",
        message:ready?"Credenciais do contribuinte guardadas de forma cifrada no servidor.":"Dados guardados no servidor. A integração continua pendente de certificação/credenciais oficiais."
      },200,origin);
    }

    return json({error:"Acção não suportada."},400,origin);
  } catch(error) {
    console.error("agt-fiscal-config error",error instanceof Error?error.message:"unknown");
    return json({error:error instanceof Error?error.message:"Erro interno ao processar configuração AGT."},500,origin);
  }
});
