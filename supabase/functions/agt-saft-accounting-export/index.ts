import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "../_shared/saft-accounting.js";

const allowedOrigins = new Set([
  "https://kanawasoft.shop",
  "https://www.kanawasoft.shop",
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

    const exportType = String(body.exportType || "accounting").toLowerCase();
    if (exportType === "sales") {
      const endExclusive = new Date(toDate + "T00:00:00Z");
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
      const endExclusiveDate = endExclusive.toISOString().slice(0, 10);
      const [{ data: company, error: companyError }, { data: legal, error: legalError }, { data: docs, error: docsError }, { data: products, error: productsError }] = await Promise.all([
        client.from("ks_companies").select("id,legal_name,trade_name,tax_id,phone,email,country_code,currency_code,tax_regime").eq("id", companyId).single(),
        client.from("ks_company_legal_profiles").select("registered_address,province,municipality,postal_code,commercial_registry_number,commercial_entry_number,fiscal_year_start_month").eq("company_id", companyId).maybeSingle(),
        client.from("ks_fiscal_documents").select("*").eq("company_id", companyId).gte("issued_at", fromDate + "T00:00:00").lt("issued_at", endExclusiveDate + "T00:00:00").order("issued_at", { ascending: true }),
        client.from("ks_products").select("id,sku,name,category,unit,barcode").eq("company_id", companyId)
      ]);
      if (companyError || !company) return json({ error: "Não foi possível ler os dados da empresa ou não tem acesso." }, 403, origin);
      if (legalError) return json({ error: "Não foi possível ler o perfil legal da empresa." }, 403, origin);
      if (docsError) return json({ error: "Sem permissão para consultar documentos fiscais ou falha na leitura." }, 403, origin);
      if (productsError) return json({ error: "Não foi possível consultar o catálogo de produtos." }, 403, origin);
      const producerNifSales = Deno.env.get("AGT_SOFTWARE_PRODUCER_TAX_ID") || "5001588150";
      const productIdSales = Deno.env.get("AGT_SOFTWARE_PRODUCT_ID") || "Kanawa Soft/D.PEDRO SOLUÇÕES LDA";
      const productVersionSales = Deno.env.get("AGT_SOFTWARE_VERSION") || "1.0.0";
      const validationNumberSales = Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER") || "0";
      const productById = new Map((products || []).map((p: any) => [String(p.id), p]));
      const customerMap = new Map<string, any>();
      const productMap = new Map<string, any>();
      const invoices = (docs || []).map((doc: any) => {
        const snap = doc.customer_snapshot || {};
        const rawCustomerId = String(snap.customerId || snap.customer_id || snap.id || snap.externalId || "ConsumidorFinal");
        const customerId = rawCustomerId.length <= 30 ? rawCustomerId : "C" + rawCustomerId.replace(/[^A-Za-z0-9]/g, "").slice(-29);
        if (!customerMap.has(customerId)) {
          const isFinalConsumer = customerId === "ConsumidorFinal" || snap.isFinalConsumer === true;
          customerMap.set(customerId, {
            customerId, isFinalConsumer,
            customerTaxId: snap.taxId || snap.tax_id || snap.nif || (isFinalConsumer ? "999999999" : ""),
            companyName: snap.companyName || snap.legalName || snap.name || (isFinalConsumer ? "Consumidor final" : ""),
            address: snap.address || snap.billingAddress || {}
          });
        }
        const rawLines = Array.isArray(doc.lines) ? doc.lines : [];
        const lines = rawLines.map((line: any) => {
          const linked = line.productId || line.product_id ? productById.get(String(line.productId || line.product_id)) : null;
          const productCode = String(line.productCode || line.product_code || line.sku || linked?.sku || line.code || "");
          if (productCode && !productMap.has(productCode)) productMap.set(productCode, {
            productCode, productType: line.productType || linked?.productType || "P",
            productDescription: line.productDescription || line.product_name || line.name || linked?.name || "",
            productNumberCode: line.barcode || linked?.barcode || productCode,
            unit: line.unit || linked?.unit || "UN"
          });
          const tax = line.tax && typeof line.tax === "object" ? line.tax : {};
          return {
            ...line, productCode,
            productDescription: line.productDescription || line.product_name || line.name || linked?.name,
            unitOfMeasure: line.unitOfMeasure || line.unit || linked?.unit || "UN",
            unitPrice: line.unitPrice ?? line.unit_price ?? line.price,
            quantity: line.quantity ?? line.qty ?? 1,
            amount: line.amount ?? line.netAmount ?? line.line_total ?? line.total,
            taxType: tax.taxType || line.taxType || "IVA",
            taxCode: tax.taxCode || line.taxCode,
            taxPercentage: tax.taxPercentage ?? line.taxPercentage ?? line.tax_rate ?? 0,
            taxExemptionCode: tax.taxExemptionCode || line.taxExemptionCode,
            taxExemptionReason: tax.taxExemptionReason || line.taxExemptionReason
          };
        });
        const metadata = doc.metadata || {};
        return {
          invoiceNo: doc.document_number, invoiceType: doc.document_type,
          invoiceDate: String(doc.issued_at).slice(0, 10),
          systemEntryDate: String(doc.created_at || doc.issued_at).replace("Z", "").slice(0, 19),
          invoiceStatus: metadata.invoiceStatus || metadata.invoice_status || "N",
          invoiceStatusDate: metadata.invoiceStatusDate || metadata.invoice_status_date || String(doc.updated_at || doc.created_at || doc.issued_at).replace("Z", "").slice(0, 19),
          reason: metadata.cancelReason || metadata.cancel_reason || metadata.reason,
          sourceId: metadata.sourceUserCode || metadata.source_user_code || "SISTEMA",
          sourceBilling: "P", hash4: doc.hash_4_chars || "0", hashControl: metadata.hashControl || metadata.hash_control || "0",
          customerId, lines, netTotal: doc.taxable_base ?? (Number(doc.subtotal || 0) - Number(doc.discount_total || 0)),
          taxPayable: doc.tax_amount, grossTotal: doc.total,
          specialRegimes: metadata.specialRegimes || metadata.special_regimes || {}
        };
      });
      const issuer = (docs || []).find((d: any) => d.issuer_snapshot)?.issuer_snapshot || {};
      const addressText = legal?.registered_address || issuer.address || issuer.registeredAddress || "";
      const address = typeof addressText === "object" ? addressText : {
        addressDetail: addressText, city: legal?.municipality || legal?.province,
        province: legal?.province, postalCode: legal?.postal_code
      };
      const fiscalStartMonth = Number(legal?.fiscal_year_start_month || 1);
      const fiscalYear = Number(toDate.slice(0, 4)) - (Number(toDate.slice(5, 7)) < fiscalStartMonth ? 1 : 0);
      const saftSales = (globalThis as unknown as { KanawaSaft?: { generateSalesInvoicesSaftXml: (input: unknown) => string } }).KanawaSaft;
      if (!saftSales?.generateSalesInvoicesSaftXml) return json({ error: "Motor XML SAF-T de vendas indisponível no servidor." }, 500, origin);
      const xml = saftSales.generateSalesInvoicesSaftXml({
        company: {
          taxRegistrationNumber: company.tax_id || issuer.taxId || issuer.nif,
          companyId: legal?.commercial_registry_number || legal?.commercial_entry_number || company.tax_id,
          companyName: company.legal_name, businessName: company.trade_name,
          telephone: company.phone, email: company.email, address
        },
        period: { startDate: fromDate, endDate: toDate, fiscalYear },
        dateCreated: new Date().toISOString().slice(0, 10),
        software: {
          productCompanyTaxId: producerNifSales, productId: productIdSales,
          productVersion: productVersionSales, softwareValidationNumber: validationNumberSales
        },
        customers: Array.from(customerMap.values()), products: Array.from(productMap.values()), invoices
      });
      return json({
        success: true, filename: "SAFT_AO_VENDAS_" + fromDate + "_" + toDate + ".xml", xml,
        documentCount: invoices.length,
        certificationStatus: validationNumberSales === "0" ? "pre_certification" : "validation_number_configured",
        xsdValidation: "not_run"
      }, 200, origin);
    }

    const producerNif = Deno.env.get("AGT_SOFTWARE_PRODUCER_TAX_ID") || "5001588150";
    const productId = Deno.env.get("AGT_SOFTWARE_PRODUCT_ID") || "Kanawa Soft/D.PEDRO SOLUÇÕES LDA";
    const productVersion = Deno.env.get("AGT_SOFTWARE_VERSION") || "1.0.0";
    const validationNumber = Deno.env.get("AGT_SOFTWARE_VALIDATION_NUMBER") || "0";
    if (!producerNif || !productId || !productVersion) {
      return json({
        error: "Os metadados do produtor e do produto têm valores padrão do projecto; podem ser substituídos por Edge Function Secrets. O número de validação permanece 0 enquanto não existir validação oficial.",
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
