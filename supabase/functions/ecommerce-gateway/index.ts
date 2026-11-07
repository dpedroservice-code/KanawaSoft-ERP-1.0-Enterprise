import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const enc = new TextEncoder();
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!url || !service) return reply({ error: "Gateway não configurado." }, 503);
    const rawKey = req.headers.get("x-api-key") || (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!rawKey.startsWith("ks_live_")) return reply({ error: "Chave API obrigatória." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: key, error: keyError } = await admin.from("ks_ecommerce_api_keys")
      .select("id,company_id,scopes,status,expires_at")
      .eq("key_hash", await digest(rawKey)).maybeSingle();
    if (keyError || !key || key.status !== "active" || (key.expires_at && new Date(key.expires_at).getTime() <= Date.now())) {
      return reply({ error: "Chave inválida, revogada ou expirada." }, 401);
    }
    await admin.from("ks_ecommerce_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);
    const urlObj = new URL(req.url);
    const action = urlObj.searchParams.get("action") || (req.method === "GET" ? "catalog" : "create_order");

    if (action === "catalog" && req.method === "GET") {
      if (!key.scopes.includes("catalog:read") && !key.scopes.includes("inventory:read")) return reply({ error: "Permissão catalog:read necessária." }, 403);
      const { data, error } = await admin.from("ks_products")
        .select("external_id,sku,name,category,unit,unit_price,stock_quantity,min_stock,description,image_path")
        .eq("company_id", key.company_id).eq("is_active", true).order("name").limit(500);
      if (error) throw error;
      return reply({ companyId: key.company_id, currency: "AOA", products: data || [] });
    }

    if (action === "create_order" && req.method === "POST") {
      if (!key.scopes.includes("orders:write")) return reply({ error: "Permissão orders:write necessária." }, 403);
      const body = await req.json();
      const orderNumber = String(body.orderNumber || "").trim().slice(0, 100);
      const inputItems = Array.isArray(body.items) ? body.items : [];
      if (!orderNumber || !inputItems.length || inputItems.length > 100) return reply({ error: "orderNumber e uma lista de 1 a 100 artigos são obrigatórios." }, 400);
      const normalized = inputItems.map((item: any) => ({ external_id: String(item.productId || item.externalId || ""), quantity: Number(item.quantity) }));
      if (normalized.some((item: any) => !item.external_id || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000)) {
        return reply({ error: "Artigo ou quantidade inválida." }, 400);
      }
      const ids = [...new Set(normalized.map((item: any) => item.external_id))];
      const { data: products, error: productError } = await admin.from("ks_products")
        .select("external_id,name,unit_price,stock_quantity,is_active")
        .eq("company_id", key.company_id).in("external_id", ids).eq("is_active", true);
      if (productError) throw productError;
      const byId = new Map((products || []).map((p: any) => [p.external_id, p]));
      const lines = normalized.map((item: any) => {
        const product: any = byId.get(item.external_id);
        if (!product) throw new Error("PRODUCT_NOT_FOUND:" + item.external_id);
        if (Number(product.stock_quantity) < item.quantity) throw new Error("INSUFFICIENT_STOCK:" + item.external_id);
        const price = Number(product.unit_price) || 0;
        return { product_external_id: item.external_id, product_name: product.name, quantity: item.quantity, unit_price: price, line_total: Math.round(price * item.quantity * 100) / 100 };
      });
      const subtotal = lines.reduce((sum: number, line: any) => sum + line.line_total, 0);
      const shipping = Math.max(0, Number(body.shippingTotal) || 0);
      const total = Math.round((subtotal + shipping) * 100) / 100;
      const { data, error } = await admin.from("ks_ecommerce_orders").insert({
        company_id: key.company_id, order_number: orderNumber,
        customer: body.customer && typeof body.customer === "object" ? body.customer : {},
        items: lines, subtotal, shipping_total: shipping, total, status: "pending"
      }).select("id,order_number,total,status,created_at").single();
      if (error) {
        if (error.code === "23505") return reply({ error: "Este número de encomenda já foi recebido." }, 409);
        throw error;
      }
      return reply({ success: true, order: data, message: "Encomenda recebida e aguardando validação no Kanawa Soft." }, 201);
    }
    return reply({ error: "Rota ou método não suportado." }, 404);
  } catch (error) {
    const message = String((error as Error).message || "");
    if (message.startsWith("PRODUCT_NOT_FOUND:")) return reply({ error: "Um ou mais produtos não existem ou estão inativos." }, 422);
    if (message.startsWith("INSUFFICIENT_STOCK:")) return reply({ error: "Stock insuficiente para um ou mais artigos." }, 409);
    console.error("[ecommerce-gateway]", error);
    return reply({ error: "Erro interno ao processar pedido." }, 500);
  }
});
