import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://kanawasoft.shop",
  "https://www.kanawasoft.shop",
  "https://kanawasoft-erp-1-0-enterprise.netlify.app",
  "http://localhost:8888",
  "http://127.0.0.1:8888"
]);
const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

function isAllowedOrigin(origin: string | null) {
  return !!origin && (allowedOrigins.has(origin) ||
    /^https:\/\/deploy-preview-\d+--kanawasoft-erp-1-0-enterprise\.netlify\.app$/.test(origin));
}
function corsHeaders(origin: string | null) {
  const headers: Record<string,string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
  if (isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin!;
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

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valor não numérico na assinatura fiscal.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (typeof value === "object") {
    const obj=value as Record<string,unknown>;
    return "{" + Object.keys(obj).filter(k=>obj[k]!==undefined).sort()
      .map(k=>JSON.stringify(k)+":"+canonicalJson(obj[k])).join(",") + "}";
  }
  throw new Error("Tipo de dado não permitido na assinatura fiscal.");
}
function b64url(bytes: Uint8Array) {
  return toB64(bytes).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
}
function pemPkcs8(value: string) {
  const normalized=value.replace(/\\r\\n/g,"\n").replace(/\\n/g,"\n").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  const clean=normalized.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
  if(!clean) throw new Error("Chave privada não configurada.");
  return fromB64(clean);
}
async function signRs256(payload: Record<string,unknown>, pem: string) {
  const key=await crypto.subtle.importKey("pkcs8",pemPkcs8(pem),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
  const header=b64url(enc.encode(canonicalJson({alg:"RS256",typ:"JWT"})));
  const body=b64url(enc.encode(canonicalJson(payload)));
  const input=header+"."+body;
  const signature=new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,enc.encode(input)));
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(canonicalJson(payload))));
  const fingerprint=new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(pem)));
  return {jws:input+"."+b64url(signature),payloadHash:Array.from(digest).map(b=>b.toString(16).padStart(2,"0")).join(""),keyFingerprint:Array.from(fingerprint).map(b=>b.toString(16).padStart(2,"0")).join("")};
}

// AGT HTTP client: only the official homologation host is accepted.
function resolveAgtConfig(env) {
  const rawBase=(env.AGT_API_BASE_URL||"").trim();
  if(!rawBase) throw new Error("AGT_API_BASE_URL não está configurada.");
  let parsed;
  try { parsed=new URL(rawBase); } catch { throw new Error("AGT_API_BASE_URL inválida."); }
  if(parsed.protocol!=="https:" || parsed.hostname!=="sifphml.minfin.gov.ao" ||
     parsed.pathname.replace(/\/+$/,"")!=="/sigt/fe/v1" || parsed.search || parsed.hash)
    throw new Error("Ambiente AGT bloqueado: apenas https://sifphml.minfin.gov.ao/sigt/fe/v1 é permitido nesta fase.");
  const user=(env.AGT_BASIC_AUTH_USER||"").trim(), pass=env.AGT_BASIC_AUTH_PASS||"", token=(env.AGT_BASIC_AUTH_TOKEN||"").trim();
  let encoded="";
  if(user && pass) encoded=btoa(unescape(encodeURIComponent(user+":"+pass)));
  else if(token && /^[A-Za-z0-9+/_=-]+$/.test(token)) encoded=token.replace(/^Basic\s+/i,"");
  else throw new Error("Credenciais Basic Auth da AGT ausentes ou incompletas.");
  return {baseUrl:parsed.toString().replace(/\/+$/,""),authorization:"Basic "+encoded};
}
async function agtHttpRequest(baseUrl,path,payload,authorization,fetchImpl=fetch,timeoutMs=12000) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetchImpl(baseUrl+"/"+path.replace(/^\/+/,""),{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":authorization},body:JSON.stringify(payload),signal:controller.signal});
    const raw=await response.text(); let data={};
    try { data=raw?JSON.parse(raw):{}; } catch { throw new Error("Resposta AGT não contém JSON válido."); }
    if(!response.ok) {
      const error=new Error("AGT_HTTP_"+response.status);
      Object.assign(error,{httpStatus:response.status,response:data}); throw error;
    }
    return {httpStatus:response.status,data};
  } catch(error) {
    if(error instanceof Error && (error.name==="AbortError" || error.name==="TimeoutError")) throw new Error("AGT_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); }
}
function mapAgtResult(resultCode) {
  const code=Number(resultCode);
  if(code===0) return "VALIDADO";
  if(code===1 || code===2 || code===9) return "REJEITADO";
  return "SUBMETIDO";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) return json({error:"Origem não autorizada."},403,origin);
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

    const {data:platformAdminData}=await userClient.rpc("ks_is_platform_admin");
    const isPlatformAdmin=platformAdminData===true;
    const {data:membership,error:membershipError}=await admin.from("ks_company_memberships")
      .select("role,status").eq("company_id",companyId).eq("user_id",auth.user.id)
      .eq("status","active").maybeSingle();
    if((membershipError||!membership)&&!isPlatformAdmin) return json({error:"Sem acesso a esta empresa."},403,origin);


    if(action==="registarFactura") {
      const role=String(membership?.role||"").toLowerCase();
      if(!["owner","admin","manager","gerente"].includes(role)&&!isPlatformAdmin) return json({error:"Apenas o proprietário, administrador ou gerente pode submeter documentos à AGT."},403,origin);
      let agtConfig;
      try { agtConfig=resolveAgtConfig({AGT_API_BASE_URL:Deno.env.get("AGT_API_BASE_URL")||undefined,AGT_BASIC_AUTH_USER:Deno.env.get("AGT_BASIC_AUTH_USER")||undefined,AGT_BASIC_AUTH_PASS:Deno.env.get("AGT_BASIC_AUTH_PASS")||undefined,AGT_BASIC_AUTH_TOKEN:Deno.env.get("AGT_BASIC_AUTH_TOKEN")||undefined}); }
      catch(e) { return json({error:e instanceof Error?e.message:"Configuração AGT inválida."},409,origin); }
      const documentId=String(body.documentId||"");
      if(!/^[0-9a-f-]{36}$/i.test(documentId)) return json({error:"Documento fiscal inválido."},400,origin);
      const {data:doc,error:docError}=await admin.from("ks_fiscal_documents").select("id,company_id,document_type,document_number,issued_at,created_at,issuer_snapshot,customer_snapshot,lines,subtotal,discount_total,taxable_base,tax_amount,total,agt_status,agt_request_id").eq("id",documentId).eq("company_id",companyId).maybeSingle();
      if(docError) throw docError;
      if(!doc) return json({error:"Documento fiscal não encontrado nesta empresa."},404,origin);
      const {data:secretRow,error:secretError}=await admin.from("ks_company_integration_secrets").select("credential_ciphertext,scopes").eq("company_id",companyId).eq("provider","agt").maybeSingle();
      if(secretError) throw secretError;
      if(!secretRow?.credential_ciphertext) return json({error:"Credenciais AGT da empresa não configuradas."},409,origin);
      const scopes=Array.isArray(secretRow.scopes)?secretRow.scopes:[];
      if(!scopes.includes("environment:homologation")) return json({error:"Submissão bloqueada: a empresa não está configurada em homologação."},409,origin);
      const {data:encryptionKey,error:encryptionError}=await admin.rpc("ks_get_integration_encryption_key");
      if(encryptionError||typeof encryptionKey!=="string"||!encryptionKey) return json({error:"Cofre de chaves indisponível no servidor."},503,origin);
      const taxpayerConfig=await decryptSecret(secretRow.credential_ciphertext,encryptionKey);
      const nif=String(taxpayerConfig.taxRegistrationNumber||"").trim();
      if(!/^[0-9]{9,15}$/.test(nif)) return json({error:"NIF do contribuinte ausente ou inválido na configuração AGT."},409,origin);
      const schemaVersion=(Deno.env.get("AGT_SCHEMA_VERSION")||"").trim(), softwarePrivateKey=Deno.env.get("AGT_SOFTWARE_PRIVATE_KEY")||"", softwareSignatureVersion=(Deno.env.get("AGT_SOFTWARE_SIGNATURE_VERSION")||"").trim(), softwareValidationNumber=Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER")||"", softwareVersion=Deno.env.get("AGT_SOFTWARE_VERSION")||"", productId=Deno.env.get("AGT_SOFTWARE_PRODUCT_ID")||"Kanawa Soft ERP";
      if(!schemaVersion||!softwarePrivateKey||!softwareSignatureVersion||!softwareValidationNumber||!softwareVersion) return json({error:"Configuração de assinatura/software AGT incompleta no servidor."},409,origin);
      const {data:existing,error:existingError}=await admin.from("ks_agt_submissions").select("id,status,request_id,submission_guid").eq("company_id",companyId).eq("document_id",documentId).maybeSingle();
      if(existingError) throw existingError;
      if(existing) return json({error:"Este documento já está na fila AGT. A submissão duplicada foi bloqueada.",submissionId:existing.id,status:existing.status,requestID:existing.request_id||null},409,origin);
      const {data:signatures,error:signaturesError}=await admin.from("ks_fiscal_document_signatures").select("signature_type,compact_jws").eq("company_id",companyId).eq("fiscal_document_id",documentId);
      if(signaturesError) throw signaturesError;
      const softwareJws=(signatures||[]).find((x:any)=>x.signature_type==="SOFTWARE")?.compact_jws, documentJws=(signatures||[]).find((x:any)=>x.signature_type==="DOCUMENT")?.compact_jws;
      if(!softwareJws||!documentJws) return json({error:"Assinaturas RS256 do software e do documento são obrigatórias antes da submissão."},409,origin);
      const issuer=(doc.issuer_snapshot||{}) as Record<string,unknown>, customer=(doc.customer_snapshot||{}) as Record<string,unknown>;
      const companyName=String(issuer.companyName||issuer.name||issuer.firma||"").trim();
      if(!companyName) return json({error:"Denominação do emitente ausente no snapshot fiscal."},422,origin);
      const submissionGuid=crypto.randomUUID(), submissionTimeStamp=new Date().toISOString();
      const document={documentNo:String(doc.document_number),documentStatus:"N",jwsDocumentSignature:documentJws,documentDate:new Date(doc.issued_at).toISOString().slice(0,10),documentType:String(doc.document_type),systemEntryDate:new Date(doc.created_at||doc.issued_at).toISOString(),customerTaxID:String(customer.taxId||customer.nif||"999999999"),customerCountry:String(customer.countryCode||"AO").toUpperCase().slice(0,2),companyName,lines:Array.isArray(doc.lines)?doc.lines:[],documentTotals:{taxPayable:Number(doc.tax_amount),netTotal:Number(doc.taxable_base),grossTotal:Number(doc.total)}};
      const softwareInfoDetail={productId,productVersion:softwareVersion,softwareValidationNumber,signatureVersion:softwareSignatureVersion};
      const payload={schemaVersion,submissionUUID:submissionGuid,taxRegistrationNumber:nif,submissionTimeStamp,softwareInfo:{softwareInfoDetail,jwsSoftwareSignature:softwareJws},numberOfEntries:1,documents:[document]};
      const {data:queued,error:queueError}=await admin.from("ks_agt_submissions").insert({company_id:companyId,document_id:documentId,submission_guid:submissionGuid,status:"PENDENTE",payload,attempt_count:0,created_by:auth.user.id}).select("id").single();
      if(queueError) { if(queueError.code==="23505") return json({error:"Este documento já foi colocado na fila AGT; submissão duplicada bloqueada."},409,origin); throw queueError; }
      try {
        const result=await agtHttpRequest(agtConfig.baseUrl,"registarFactura",payload,agtConfig.authorization), requestID=String(result.data.requestID||"");
        if(!requestID||requestID.length>15) throw new Error("Resposta AGT sem requestID válido.");
        const {error:updateError}=await admin.from("ks_agt_submissions").update({status:"SUBMETIDO",request_id:requestID,submitted_at:new Date().toISOString(),http_status:result.httpStatus,submission_response:result.data,last_error:null,next_retry_at:null,updated_at:new Date().toISOString()}).eq("id",queued.id);
        if(updateError) throw updateError;
        await admin.from("ks_fiscal_documents").update({agt_status:"SUBMETIDO",agt_request_id:requestID}).eq("id",documentId).eq("company_id",companyId);
        return json({success:true,submissionId:queued.id,status:"SUBMETIDO",requestID},200,origin);
      } catch(e) {
        const message=e instanceof Error?e.message:"Falha de rede AGT.", {data:current}=await admin.from("ks_agt_submissions").select("attempt_count").eq("id",queued.id).maybeSingle();
        const attempt=Number(current?.attempt_count||0)+1, retrySeconds=Math.min(3600,30*Math.pow(2,Math.min(attempt-1,7)));
        await admin.from("ks_agt_submissions").update({status:"ERRO_REDE",attempt_count:attempt,next_retry_at:new Date(Date.now()+retrySeconds*1000).toISOString(),http_status:(e as any)?.httpStatus||null,last_error:message.slice(0,500),updated_at:new Date().toISOString()}).eq("id",queued.id);
        return json({error:"A comunicação com a AGT falhou. O pedido foi registado para análise; não será reenviado automaticamente para evitar duplicação.",submissionId:queued.id,status:"ERRO_REDE",retryAfterSeconds:retrySeconds},502,origin);
      }
    }

    if(action==="obterEstado") {
      const role=String(membership?.role||"").toLowerCase();
      if(!["owner","admin","manager","gerente"].includes(role)&&!isPlatformAdmin) return json({error:"Apenas o proprietário, administrador ou gerente pode consultar o estado AGT."},403,origin);
      let agtConfig;
      try { agtConfig=resolveAgtConfig({AGT_API_BASE_URL:Deno.env.get("AGT_API_BASE_URL")||undefined,AGT_BASIC_AUTH_USER:Deno.env.get("AGT_BASIC_AUTH_USER")||undefined,AGT_BASIC_AUTH_PASS:Deno.env.get("AGT_BASIC_AUTH_PASS")||undefined,AGT_BASIC_AUTH_TOKEN:Deno.env.get("AGT_BASIC_AUTH_TOKEN")||undefined}); }
      catch(e) { return json({error:e instanceof Error?e.message:"Configuração AGT inválida."},409,origin); }
      const documentId=String(body.documentId||"");
      if(!/^[0-9a-f-]{36}$/i.test(documentId)) return json({error:"Documento fiscal inválido."},400,origin);
      const {data:submission,error:submissionError}=await admin.from("ks_agt_submissions").select("id,request_id,status,submission_guid").eq("company_id",companyId).eq("document_id",documentId).maybeSingle();
      if(submissionError) throw submissionError;
      if(!submission) return json({error:"Não existe submissão AGT para este documento."},404,origin);
      if(!submission.request_id) return json({error:"A AGT ainda não devolveu requestID. A submissão não será repetida automaticamente.",status:submission.status},409,origin);
      const {data:secretRow,error:secretError}=await admin.from("ks_company_integration_secrets").select("credential_ciphertext,scopes").eq("company_id",companyId).eq("provider","agt").maybeSingle();
      if(secretError) throw secretError;
      if(!secretRow?.credential_ciphertext) return json({error:"Credenciais AGT da empresa não configuradas."},409,origin);
      const scopes=Array.isArray(secretRow.scopes)?secretRow.scopes:[];
      if(!scopes.includes("environment:homologation")) return json({error:"Consulta bloqueada fora do ambiente de homologação."},409,origin);
      const {data:encryptionKey,error:encryptionError}=await admin.rpc("ks_get_integration_encryption_key");
      if(encryptionError||typeof encryptionKey!=="string"||!encryptionKey) return json({error:"Cofre de chaves indisponível no servidor."},503,origin);
      const taxpayerConfig=await decryptSecret(secretRow.credential_ciphertext,encryptionKey), nif=String(taxpayerConfig.taxRegistrationNumber||"").trim(), taxpayerPrivateKey=String(taxpayerConfig.taxpayerPrivateKey||"");
      const schemaVersion=(Deno.env.get("AGT_SCHEMA_VERSION")||"").trim(), softwarePrivateKey=Deno.env.get("AGT_SOFTWARE_PRIVATE_KEY")||"", softwareSignatureVersion=(Deno.env.get("AGT_SOFTWARE_SIGNATURE_VERSION")||"").trim(), softwareValidationNumber=Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER")||"", softwareVersion=Deno.env.get("AGT_SOFTWARE_VERSION")||"", productId=Deno.env.get("AGT_SOFTWARE_PRODUCT_ID")||"Kanawa Soft ERP";
      if(!nif||!taxpayerPrivateKey||!schemaVersion||!softwarePrivateKey||!softwareSignatureVersion||!softwareValidationNumber||!softwareVersion) return json({error:"Configuração criptográfica AGT incompleta para consultar o estado."},409,origin);
      const softwareInfoDetail={productId,productVersion:softwareVersion,softwareValidationNumber,signatureVersion:softwareSignatureVersion}, softwareSigned=await signRs256(softwareInfoDetail,softwarePrivateKey), statusSignature=await signRs256({taxRegistrationNumber:nif,requestID:String(submission.request_id)},taxpayerPrivateKey);
      const payload={schemaVersion,taxRegistrationNumber:nif,submissionTimeStamp:new Date().toISOString(),softwareInfo:{softwareInfoDetail,jwsSoftwareSignature:softwareSigned.jws},jwsSignature:statusSignature.jws,requestID:String(submission.request_id)};
      try {
        const result=await agtHttpRequest(agtConfig.baseUrl,"obterEstado",payload,agtConfig.authorization), status=mapAgtResult(result.data.resultCode);
        const errors={requestErrorList:Array.isArray(result.data.requestErrorList)?result.data.requestErrorList:[],documentStatusList:Array.isArray(result.data.documentStatusList)?result.data.documentStatusList:[]};
        const {error:updateError}=await admin.from("ks_agt_submissions").update({status,http_status:result.httpStatus,status_response:result.data,error_details:errors,checked_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",submission.id);
        if(updateError) throw updateError;
        await admin.from("ks_fiscal_documents").update({agt_status:status,agt_request_id:String(submission.request_id)}).eq("id",documentId).eq("company_id",companyId);
        return json({success:true,status,requestID:submission.request_id,resultCode:result.data.resultCode,errors},200,origin);
      } catch(e) {
        const message=e instanceof Error?e.message:"Falha de consulta AGT.", {data:current}=await admin.from("ks_agt_submissions").select("attempt_count").eq("id",submission.id).maybeSingle();
        const attempt=Number(current?.attempt_count||0)+1, retrySeconds=Math.min(3600,30*Math.pow(2,Math.min(attempt-1,7)));
        await admin.from("ks_agt_submissions").update({status:"ERRO_REDE",attempt_count:attempt,next_retry_at:new Date(Date.now()+retrySeconds*1000).toISOString(),http_status:(e as any)?.httpStatus||null,last_error:message.slice(0,500),updated_at:new Date().toISOString()}).eq("id",submission.id);
        return json({error:"Falha de comunicação ao consultar o estado AGT.",status:"ERRO_REDE",retryAfterSeconds:retrySeconds},502,origin);
      }
    }

    if(action==="get_status") {
      const {data:row,error}=await admin.from("ks_company_integration_secrets")
        .select("last_four,scopes,status,rotated_at,created_at,credential_ciphertext")
        .eq("company_id",companyId).eq("provider","agt").maybeSingle();
      if(error) throw error;
      const scopes=Array.isArray(row?.scopes)?row.scopes:[];
      const environmentScope=scopes.find((s:string)=>s.startsWith("environment:"))||"";
      let taxpayerPrivateKeyConfigured=false,taxpayerPublicKeyConfigured=false;
      if(row?.credential_ciphertext) {
        const {data:key,error:keyError}=await admin.rpc("ks_get_integration_encryption_key");
        if(!keyError&&typeof key==="string"&&key) {
          try {
            const config=await decryptSecret(row.credential_ciphertext,key);
            taxpayerPrivateKeyConfigured=!!config.taxpayerPrivateKey;
            taxpayerPublicKeyConfigured=!!config.taxpayerPublicKey;
          } catch(_) { /* Do not expose encrypted material or crypto errors to the client. */ }
        }
      }
      const softwarePublicKey=Deno.env.get("AGT_SOFTWARE_PUBLIC_KEY")||"";
      const softwarePrivateKeyConfigured=!!Deno.env.get("AGT_SOFTWARE_PRIVATE_KEY");
      const softwareValidationNumber=Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER")||"";
      const softwareVersion=Deno.env.get("AGT_SOFTWARE_VERSION")||"";
      const softwareSignatureVersion=(Deno.env.get("AGT_SOFTWARE_SIGNATURE_VERSION")||"").trim();
      const softwareDocumentTypes=Deno.env.get("AGT_SOFTWARE_DOCUMENT_TYPES")||"";
      const configured=!!(row&&taxpayerPrivateKeyConfigured&&taxpayerPublicKeyConfigured&&softwarePublicKey&&softwarePrivateKeyConfigured&&softwareValidationNumber&&softwareVersion&&softwareSignatureVersion&&softwareDocumentTypes);
      return json({
        configured,
        status:configured?"configured":(row?.status||"pending_certification"),
        environment:environmentScope.split(":")[1]||null,
        maskedNif:row?.last_four?"••••"+row.last_four:null,
        rotatedAt:row?.rotated_at||null,
        softwarePublicKey:softwarePublicKey||null,
        softwarePublicKeyConfigured:!!softwarePublicKey,
        softwarePrivateKeyConfigured,
        softwareValidationNumber:softwareValidationNumber||null,
        softwareValidationNumberConfigured:!!softwareValidationNumber,
        softwareVersion:softwareVersion||null,
        softwareSignatureVersion:softwareSignatureVersion||null,
        softwareSignatureVersionConfigured:!!softwareSignatureVersion,
        softwareDocumentTypes:softwareDocumentTypes||null,
        taxpayerPrivateKeyConfigured,
        taxpayerPublicKeyConfigured
      },200,origin);
    }


    if(action==="sign_document") {
      const role=String(membership?.role||"").toLowerCase();
      if(!["owner","admin","manager","gerente"].includes(role)&&!isPlatformAdmin)
        return json({error:"Apenas o proprietário, administrador ou gerente pode assinar documentos fiscais."},403,origin);
      const documentId=String(body.documentId||"");
      if(!/^[0-9a-f-]{36}$/i.test(documentId)) return json({error:"Documento fiscal inválido."},400,origin);
      const {data:doc,error:docError}=await admin.from("ks_fiscal_documents")
        .select("id,company_id,document_type,document_number,issued_at,issuer_snapshot,customer_snapshot,tax_regime,subtotal,discount_total,taxable_base,tax_amount,total,agt_status")
        .eq("id",documentId).eq("company_id",companyId).maybeSingle();
      if(docError) throw docError;
      if(!doc) return json({error:"Documento fiscal não encontrado nesta empresa."},404,origin);
      const {data:existing,error:existingError}=await admin.from("ks_fiscal_document_signatures")
        .select("signature_type").eq("fiscal_document_id",documentId);
      if(existingError) throw existingError;
      if((existing||[]).length) return json({error:"Este documento já possui assinatura registada. Não será assinado novamente."},409,origin);
      const {data:secretRow,error:secretError}=await admin.from("ks_company_integration_secrets")
        .select("credential_ciphertext,status").eq("company_id",companyId).eq("provider","agt").maybeSingle();
      if(secretError) throw secretError;
      if(!secretRow?.credential_ciphertext) return json({error:"Configure primeiro as credenciais AGT da empresa."},409,origin);
      const {data:encryptionKey,error:encryptionError}=await admin.rpc("ks_get_integration_encryption_key");
      if(encryptionError||typeof encryptionKey!=="string"||!encryptionKey)
        return json({error:"Cofre de chaves indisponível no servidor."},503,origin);
      const taxpayerConfig=await decryptSecret(secretRow.credential_ciphertext,encryptionKey);
      const softwarePrivateKey=Deno.env.get("AGT_SOFTWARE_PRIVATE_KEY")||"";
      const softwareValidationNumber=Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER")||"";
      const softwareVersion=Deno.env.get("AGT_SOFTWARE_VERSION")||"";
      const softwareSignatureVersion=(Deno.env.get("AGT_SOFTWARE_SIGNATURE_VERSION")||"").trim();
      const productId=Deno.env.get("AGT_SOFTWARE_PRODUCT_ID")||"Kanawa Soft ERP";
      if(!softwareSignatureVersion) return json({error:"AGT_SOFTWARE_SIGNATURE_VERSION não está configurada no servidor."},409,origin);
      if(!softwarePrivateKey||!softwareValidationNumber||!softwareVersion||!taxpayerConfig.taxpayerPrivateKey)
        return json({error:"Assinatura indisponível: faltam chaves privadas ou dados oficiais de validação do software no servidor."},409,origin);
      const issuer=(doc.issuer_snapshot||{}) as Record<string,unknown>;
      const customer=(doc.customer_snapshot||{}) as Record<string,unknown>;
      const nif=String(issuer.taxId||issuer.nif||taxpayerConfig.taxRegistrationNumber||"").trim();
      const companyName=String(issuer.companyName||issuer.name||issuer.firma||"").trim();
      if(!nif||!companyName) return json({error:"O snapshot fiscal do emitente não contém NIF e denominação."},422,origin);
      const softwarePayload={productId,productVersion:softwareVersion,softwareValidationNumber,signatureVersion:softwareSignatureVersion};
      const documentPayload={
        documentNo:String(doc.document_number),
        taxRegistrationNumber:nif,
        documentType:String(doc.document_type),
        documentDate:new Date(doc.issued_at).toISOString().slice(0,10),
        customerTaxID:String(customer.taxId||customer.nif||""),
        customerCountry:String(customer.countryCode||customer.country||"AO"),
        companyName,
        documentTotals:{
          taxPayable:Number(doc.tax_amount),
          netTotal:Number(doc.taxable_base),
          grossTotal:Number(doc.total)
        }
      };
      const softwareSigned=await signRs256(softwarePayload,softwarePrivateKey);
      const documentSigned=await signRs256(documentPayload,String(taxpayerConfig.taxpayerPrivateKey));
      const rows=[
        {company_id:companyId,fiscal_document_id:documentId,signature_type:"SOFTWARE",algorithm:"RS256",compact_jws:softwareSigned.jws,payload_sha256:softwareSigned.payloadHash,key_fingerprint:softwareSigned.keyFingerprint},
        {company_id:companyId,fiscal_document_id:documentId,signature_type:"DOCUMENT",algorithm:"RS256",compact_jws:documentSigned.jws,payload_sha256:documentSigned.payloadHash,key_fingerprint:documentSigned.keyFingerprint}
      ];
      const {error:insertError}=await admin.from("ks_fiscal_document_signatures").insert(rows);
      if(insertError) throw insertError;
      return json({success:true,signed:true,algorithm:"RS256",documentId,signaturesStored:2,hash4:"PENDENTE — regra oficial AGT não configurada nesta rotina",agtStatus:"PENDENTE"},200,origin);
    }

    if(action==="save_config") {
      const role=String(membership?.role||"").toLowerCase();
      if(!["owner","admin"].includes(role)&&!isPlatformAdmin) return json({error:"Apenas o proprietário ou administrador pode alterar as chaves AGT."},403,origin);

      const environment=String(body.environment||"homologation");
      const nif=String(body.taxRegistrationNumber||"").trim();
      const incomingPrivateKey=String(body.taxpayerPrivateKey||"");
      const incomingPublicKey=String(body.taxpayerPublicKey||"");
      if(!["homologation","production"].includes(environment)) return json({error:"Ambiente inválido."},400,origin);
      if(!/^[0-9]{9,15}$/.test(nif)) return json({error:"Introduza um NIF válido do contribuinte."},400,origin);
      if(incomingPrivateKey.length>24000||incomingPublicKey.length>24000) return json({error:"Uma das chaves excede o tamanho permitido."},400,origin);

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
        taxpayerPrivateKey:incomingPrivateKey||String(previous.taxpayerPrivateKey||""),
        taxpayerPublicKey:incomingPublicKey||String(previous.taxpayerPublicKey||""),
        updatedAt:new Date().toISOString()
      };
      const softwareReady=!!(Deno.env.get("AGT_SOFTWARE_PUBLIC_KEY")&&Deno.env.get("AGT_SOFTWARE_PRIVATE_KEY")&&Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER")&&Deno.env.get("AGT_SOFTWARE_VERSION")&&(Deno.env.get("AGT_SOFTWARE_SIGNATURE_VERSION")||"").trim()&&Deno.env.get("AGT_SOFTWARE_DOCUMENT_TYPES"));
      const taxpayerReady=!!(config.taxpayerPrivateKey&&config.taxpayerPublicKey);
      if(environment==="production"&&(!softwareReady||!taxpayerReady)) {
        return json({error:"Produção bloqueada: falta certificação/validação do software no servidor ou as duas chaves emitidas pela AGT para o contribuinte."},409,origin);
      }
      const scopes=[
        "environment:"+environment,
        "taxpayer_private_key:"+(config.taxpayerPrivateKey?"present":"missing"),
        "taxpayer_public_key:"+(config.taxpayerPublicKey?"present":"missing")
      ];
      const ready=softwareReady&&taxpayerReady;
      const ciphertext=await encryptSecret(config,key);
      const {error:saveError}=await admin.from("ks_company_integration_secrets").upsert({
        company_id:companyId,provider:"agt",credential_ciphertext:ciphertext,
        key_version:"aes-256-gcm-v1",last_four:nif.slice(-4),scopes,
        status:ready?"configured":"pending_certification",rotated_at:new Date().toISOString()
      },{onConflict:"company_id,provider"});
      if(saveError) throw saveError;
      return json({
        success:true,configured:ready,status:ready?"configured":"pending_certification",
        message:ready?"Chaves do contribuinte guardadas de forma cifrada. O servidor tem os elementos de certificação configurados.":"Chaves do contribuinte guardadas. A integração permanece pendente até configurar a chave do software e o número de validação AGT no servidor."
      },200,origin);
    }

    return json({error:"Acção não suportada."},400,origin);
  } catch(error) {
    console.error("agt-fiscal-config error",error instanceof Error?error.message:"unknown");
    return json({error:"Não foi possível concluir a configuração fiscal. Verifique os dados e os registos protegidos do servidor."},500,origin);
  }
});
