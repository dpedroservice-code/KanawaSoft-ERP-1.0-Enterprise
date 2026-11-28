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
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map(key => JSON.stringify(key) + ":" + stableJson(record[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}
function sameOrder(existing: any, items: Array<{ external_id: string; quantity: number }>, customer: Record<string, unknown>, shipping: number) {
  const existingItems = Array.isArray(existing?.items) ? existing.items.map((item: any) => ({
    external_id: String(item.product_external_id || ""),
    quantity: Number(item.quantity)
  })) : [];
  return stableJson(existingItems) === stableJson(items) &&
    stableJson(existing?.customer || {}) === stableJson(customer) &&
    Number(existing?.shipping_total) === shipping;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "GET" && req.method !== "POST") return reply({ error: "Método não suportado." }, 405);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (req.method === "POST" && contentLength > 131072) return reply({ error: "Pedido demasiado grande." }, 413);
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
      if (!Array.isArray(key.scopes) || (!key.scopes.includes("catalog:read") && !key.scopes.includes("inventory:read"))) return reply({ error: "Permissão catalog:read necessária." }, 403);
      const { data, error } = await admin.from("ks_products")
        .select("external_id,sku,name,category,unit,unit_price,stock_quantity,min_stock,description,image_path")
        .eq("company_id", key.company_id).eq("is_active", true).order("name").limit(500);
      if (error) throw error;
      return reply({ companyId: key.company_id, currency: "AOA", products: data || [] });
    }

    if (action === "create_order" && req.method === "POST") {
      if (!Array.isArray(key.scopes) || !key.scopes.includes("orders:write")) return reply({ error: "Permissão orders:write necessária." }, 403);
      const body = await req.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Corpo do pedido inválido." }, 400);
      const orderNumber = String(body.orderNumber || "").trim();
      const inputItems = Array.isArray(body.items) ? body.items : [];
      if (!orderNumber || orderNumber.length > 100 || !inputItems.length || inputItems.length > 100) return reply({ error: "orderNumber e uma lista de 1 a 100 artigos são obrigatórios." }, 400);
      const normalized = inputItems.map((item: any) => ({ external_id: String(item?.productId || item?.externalId || "").trim(), quantity: Number(item?.quantity) }));
      if (normalized.some((item: any) => !item.external_id || item.external_id.length > 160 || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 100000)) {
        return reply({ error: "Artigo ou quantidade inválida." }, 400);
      }
      const customer = body.customer && typeof body.customer === "object" && !Array.isArray(body.customer) ? body.customer : {};
      if (stableJson(customer).length > 12000) return reply({ error: "Dados do cliente demasiado grandes." }, 400);
      const shipping = body.shippingTotal === undefined ? 0 : Number(body.shippingTotal);
      if (!Number.isFinite(shipping) || shipping < 0 || shipping > 1000000000) return reply({ error: "Valor de transporte inválido." }, 400);
      const { data: priorOrder, error: priorError } = await admin.from("ks_ecommerce_orders")
        .select("id,order_number,total,status,created_at,items,customer,shipping_total")
        .eq("company_id", key.company_id).eq("order_number", orderNumber).maybeSingle();
      if (priorError) throw priorError;
      if (priorOrder) {
        if (sameOrder(priorOrder, normalized, customer, shipping)) {
          const { items: _items, customer: _customer, shipping_total: _shipping, ...safeOrder } = priorOrder;
          return reply({ success: true, idempotent: true, order: safeOrder, message: "Esta encomenda já tinha sido recebida." }, 200);
        }
        return reply({ error: "O número desta encomenda já existe com conteúdo diferente." }, 409);
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
      const total = Math.round((subtotal + shipping) * 100) / 100;
      const { data, error } = await admin.from("ks_ecommerce_orders").insert({
        company_id: key.company_id, order_number: orderNumber,
        customer,
        items: lines, subtotal, shipping_total: shipping, total, status: "pending"
      }).select("id,order_number,total,status,created_at").single();
      if (error) {
        if (error.code === "23505") {
          const { data: concurrentOrder, error: concurrentError } = await admin.from("ks_ecommerce_orders")
            .select("id,order_number,total,status,created_at,items,customer,shipping_total")
            .eq("company_id", key.company_id).eq("order_number", orderNumber).maybeSingle();
          if (concurrentError) throw concurrentError;
          if (concurrentOrder && sameOrder(concurrentOrder, normalized, customer, shipping)) {
            const { items: _items, customer: _customer, shipping_total: _shipping, ...safeOrder } = concurrentOrder;
            return reply({ success: true, idempotent: true, order: safeOrder, message: "Esta encomenda já tinha sido recebida." }, 200);
          }
          return reply({ error: "O número desta encomenda já existe com conteúdo diferente." }, 409);
        }
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
