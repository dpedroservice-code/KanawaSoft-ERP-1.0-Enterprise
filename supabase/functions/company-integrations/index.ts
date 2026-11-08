import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const enc = new TextEncoder();
const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

async function encryptSecret(value: unknown, raw: string) {
  if (!raw) throw new Error("Chave de cifragem do Vault indisponível.");
  const keyBytes = fromB64(raw);
  if (keyBytes.byteLength !== 32) throw new Error("A chave de encriptação deve conter 32 bytes em base64.");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return toB64(new Uint8Array([...iv, ...new Uint8Array(cipher)]));
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
function randomKey() {
  return "ks_live_" + toB64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, "").slice(0, 43);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!url || !anon || !service) return json({ error: "Configuração do servidor incompleta." }, 503);
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sessão obrigatória." }, 401);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false } });
    const { data: auth, error: authError } = await userClient.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Sessão inválida ou expirada." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const companyId = String(body.companyId || "");
    const action = String(body.action || "");
    if (!/^[0-9a-f-]{36}$/i.test(companyId)) return json({ error: "Empresa inválida." }, 400);

    const { data: membership, error: membershipError } = await admin.from("ks_company_memberships")
      .select("role,status").eq("company_id", companyId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
    if (membershipError || !membership || !["owner", "admin", "manager", "gerente"].includes(membership.role)) {
      return json({ error: "Sem permissão para gerir integrações desta empresa." }, 403);
    }

    if (action === "save_integration") {
      const provider = String(body.provider || "");
      const allowed = ["meta", "whatsapp", "facebook", "instagram", "google", "custom", "paypal", "stripe", "paypay", "multicaixa"];
      if (!allowed.includes(provider)) return json({ error: "Fornecedor não suportado." }, 400);
      const credentials = body.credentials;
      if (!credentials || typeof credentials !== "object" || Array.isArray(credentials) || JSON.stringify(credentials).length > 24000) {
        return json({ error: "Credenciais inválidas ou demasiado grandes." }, 400);
      }
      const secretFields = Object.keys(credentials);
      const allowedCredentialFields = new Set(["appId","businessId","appSecret","accessToken","phoneNumberId","verifyToken","apiVersion","merchantId","clientId","secretKey","webhookSecret","environment"]);
      if (!secretFields.length || secretFields.some(k => !allowedCredentialFields.has(k))) return json({ error: "Campos de credenciais inválidos." }, 400);
      if (credentials.environment && !["sandbox","production"].includes(String(credentials.environment))) return json({ error: "Ambiente de integração inválido." }, 400);
      const has = (value: unknown) => typeof value === "string" && value.trim().length > 0;
      if (!secretFields.some(field => !["environment","apiVersion"].includes(field) && has(credentials[field]))) return json({ error: "Introduza pelo menos uma credencial válida." }, 400);
      const paymentRequirements: Record<string, string[]> = {
        paypal: ["clientId", "secretKey"],
        stripe: ["secretKey"],
        paypay: ["merchantId", "secretKey"],
        multicaixa: ["merchantId", "secretKey"]
      };
      const missingPaymentFields = (paymentRequirements[provider] || []).filter(field => !has(credentials[field]));
      if (missingPaymentFields.length) return json({ error: "Credenciais obrigatórias em falta: " + missingPaymentFields.join(", ") + "." }, 400);
      const { data: encryptionKey, error: keyError } = await admin.rpc("ks_get_integration_encryption_key");
      if (keyError || typeof encryptionKey !== "string" || !encryptionKey) {
        return json({ error: "Cofre de cifragem não configurado no servidor." }, 503);
      }
      const ciphertext = await encryptSecret(credentials, encryptionKey);
      const tokenValue = String(credentials.accessToken || credentials.access_token || credentials.secretKey || credentials.clientSecret || credentials.appSecret || credentials.app_secret || "");
      const lastFour = tokenValue ? tokenValue.slice(-4) : null;
      const { error } = await admin.from("ks_company_integration_secrets").upsert({
        company_id: companyId, provider, credential_ciphertext: ciphertext, key_version: "aes-256-gcm-v1",
        last_four: lastFour, environment: ["paypal","stripe","paypay","multicaixa"].includes(provider) ? credentials.environment : null, scopes: Array.isArray(body.scopes) ? body.scopes.filter((s: unknown) => typeof s === "string").slice(0, 50) : [],
        status: "configured", rotated_at: new Date().toISOString()
      }, { onConflict: "company_id,provider" });
      if (error) throw error;
      return json({ success: true, provider, masked: lastFour ? "••••" + lastFour : "guardado", message: "Credenciais guardadas no cofre do servidor. Não podem ser consultadas novamente pela interface." });
    }

    if (action === "integration_status") {
      const { data, error } = await admin.from("ks_company_integration_secrets")
        .select("provider,last_four,environment,scopes,status,rotated_at,created_at").eq("company_id", companyId);
      if (error) throw error;
      return json({ integrations: data || [] });
    }

    if (action === "revoke_integration") {
      const provider = String(body.provider || "");
      const { error } = await admin.from("ks_company_integration_secrets").delete().eq("company_id", companyId).eq("provider", provider);
      if (error) throw error;
      return json({ success: true, message: "Credencial removida do cofre." });
    }

    if (action === "create_ecommerce_key") {
      const label = String(body.label || "Integração externa").trim().slice(0, 80);
      if (!label) return json({ error: "Indique um nome para a chave." }, 400);
      const clearKey = randomKey();
      const prefix = clearKey.slice(0, 12);
      const digest = await sha256(clearKey);
      const { data, error } = await admin.from("ks_ecommerce_api_keys").insert({
        company_id: companyId, key_prefix: prefix, key_hash: digest, label,
        scopes: Array.isArray(body.scopes) ? body.scopes.filter((s: unknown) => ["catalog:read","orders:write","orders:read","inventory:read"].includes(String(s))).slice(0, 10) : ["catalog:read","orders:write"],
        created_by: auth.user.id,
        expires_at: body.expiresAt ? new Date(body.expiresAt).toISOString() : null
      }).select("id,key_prefix,label,scopes,created_at,expires_at").single();
      if (error) throw error;
      return json({ success: true, key: clearKey, record: data, warning: "Copie agora. Esta chave não será mostrada novamente." });
    }

    if (action === "list_ecommerce_keys") {
      const { data, error } = await admin.from("ks_ecommerce_api_keys")
        .select("id,key_prefix,label,scopes,status,last_used_at,expires_at,created_at,revoked_at")
        .eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return json({ keys: data || [] });
    }

    if (action === "revoke_ecommerce_key") {
      const keyId = String(body.keyId || "");
      const { error } = await admin.from("ks_ecommerce_api_keys").update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("company_id", companyId).eq("id", keyId);
      if (error) throw error;
      return json({ success: true });
    }
    return json({ error: "Ação desconhecida." }, 400);
  } catch (error) {
    console.error("[company-integrations]", error);
    return json({ error: "Não foi possível concluir a operação. Verifique a configuração do servidor." }, 500);
  }
});
