import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../_shared/saft-accounting.js";

const allowedOrigins = new Set([
  "https://kanawasoft-erp-1-0-enterprise.netlify.app",
  "http://localhost:8888",
  "http://127.0.0.1:8888"
]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  ...(origin && (allowedOrigins.has(origin) || /^https:\/\/deploy-preview-\d+--kanawasoft-erp-1-0-enterprise\.netlify\.app$/.test(origin))
    ? { "Access-Control-Allow-Origin": origin } : {})
});
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !(allowedOrigins.has(origin) || /^https:\/\/deploy-preview-\d+--kanawasoft-erp-1-0-enterprise\.netlify\.app$/.test(origin))) {
    return json({ error: "Origem não autorizada." }, 403, origin);
  }
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!url || !key) return json({ error: "Configuração Supabase incompleta no servidor." }, 503, origin);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sessão autenticada obrigatória." }, 401, origin);

    const client = createClient(url, key, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return json({ error: "Sessão inválida ou expirada." }, 401, origin);

    const body = await req.json();
    const companyId = String(body.companyId || "");
    const fromDate = String(body.fromDate || "");
    const toDate = String(body.toDate || "");
    if (!/^[0-9a-f-]{36}$/i.test(companyId)) return json({ error: "Empresa inválida." }, 400, origin);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
      return json({ error: "Período inválido. Seleccione datas no formato AAAA-MM-DD." }, 400, origin);
    }

    const producerNif = Deno.env.get("AGT_SOFTWARE_PRODUCER_TAX_ID") || "";
    const productId = Deno.env.get("AGT_SOFTWARE_PRODUCT_ID") || "";
    const productVersion = Deno.env.get("AGT_SOFTWARE_VERSION") || "";
    const validationNumber = Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER") || "0";
    if (!producerNif || !productId || !productVersion) {
      return json({
        error: "Configure os segredos AGT_SOFTWARE_PRODUCER_TAX_ID, AGT_SOFTWARE_PRODUCT_ID e AGT_SOFTWARE_VERSION nas Edge Function Secrets. O número de validação permanece 0 enquanto não existir validação oficial.",
        code: "AGT_SOFTWARE_METADATA_MISSING"
      }, 503, origin);
    }

    const { data, error } = await client.rpc("ks_accounting_saft_snapshot", {
      p_company_id: companyId, p_from_date: fromDate, p_to_date: toDate
    });
    if (error) return json({ error: error.message || "Não foi possível preparar os dados SAF-T." }, error.code === "42501" ? 403 : 422, origin);

    const saft = (globalThis as unknown as { KanawaSaft?: { generateAccountingSaftXml: (input: unknown) => string } }).KanawaSaft;
    if (!saft?.generateAccountingSaftXml) return json({ error: "Motor XML SAF-T indisponível no servidor." }, 500, origin);
    const xml = saft.generateAccountingSaftXml({
      ...data,
      software: {
        productCompanyTaxId: producerNif,
        productId,
        productVersion,
        softwareValidationNumber: validationNumber
      }
    });
    const filename = "SAFT_AO_CONTABILIDADE_" + fromDate + "_" + toDate + ".xml";
    return json({
      success: true, filename, xml,
      certificationStatus: validationNumber === "0" ? "pre_certification" : "validation_number_configured"
    }, 200, origin);
  } catch (error) {
    console.error("agt-saft-accounting-export", error instanceof Error ? error.message : "unknown");
    return json({ error: error instanceof Error ? error.message : "Erro ao gerar SAF-T de contabilidade." }, 500, origin);
  }
});
