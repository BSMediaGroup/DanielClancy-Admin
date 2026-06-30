import { requireAdmin } from "../../_shared/admin-accounts.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const ORDER_PREFIX = "merch:orders:";
const RECENT_INDEX_PREFIX = "merch:index:recent:";

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {})
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  let response;
  try {
    if (request.method !== "GET") {
      response = json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    } else {
      const admin = await requireAdmin(request, env);
      if (admin.error) {
        response = json({ ok: false, error: admin.error }, { status: admin.status || 403 });
      } else {
        response = await readMerchOrders(env);
      }
    }
  } catch {
    response = json({ ok: false, error: "merch_orders_unavailable" }, { status: 500 });
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function readMerchOrders(env) {
  const storage = merchOrderStorage(env);
  if (!storage) {
    return json(
      {
        ok: false,
        configured: false,
        error: "storage_not_configured",
        message: "DC_MERCH_ORDERS_KV is required before merch order visibility can load.",
        requiredBinding: "DC_MERCH_ORDERS_KV",
        orders: []
      },
      { status: 503 }
    );
  }

  const ids = await recentOrderIds(storage);
  const orders = [];
  for (const id of ids) {
    const order = await readOrder(storage, id);
    if (order) orders.push(adminOrderSummary(order));
  }

  return json({
    ok: true,
    configured: true,
    source: "DC_MERCH_ORDERS_KV",
    orders,
    count: orders.length,
    checkedAt: new Date().toISOString()
  });
}

async function recentOrderIds(storage) {
  if (typeof storage.list !== "function") return [];
  const listed = await storage.list({ prefix: RECENT_INDEX_PREFIX, limit: 100 });
  const keys = Array.isArray(listed?.keys) ? listed.keys : [];
  const ids = keys
    .map((entry) => String(entry.name || "").split(":").pop())
    .filter(Boolean)
    .reverse();
  if (ids.length) return Array.from(new Set(ids)).slice(0, 50);

  const orderList = await storage.list({ prefix: ORDER_PREFIX, limit: 50 });
  return (Array.isArray(orderList?.keys) ? orderList.keys : [])
    .map((entry) => String(entry.name || "").slice(ORDER_PREFIX.length))
    .filter(Boolean);
}

async function readOrder(storage, id) {
  const raw = await storage.get(`${ORDER_PREFIX}${id}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function adminOrderSummary(order) {
  return {
    id: cleanId(order?.id),
    createdAt: cleanText(order?.createdAt, 80),
    updatedAt: cleanText(order?.updatedAt, 80),
    customerEmail: cleanText(order?.customer?.emailMasked || maskEmail(order?.recipient?.email), 160),
    totalAmount: Number(order?.totals?.totalAmount || order?.totalAmount || ((Number(order?.cart?.subtotalAmount) || 0) + (Number(order?.shipping?.amount) || 0))) || 0,
    subtotalAmount: Number(order?.cart?.subtotalAmount) || 0,
    shippingAmount: Number(order?.shipping?.amount) || 0,
    currency: cleanText(order?.totals?.currency || order?.cart?.currency || order?.shipping?.currency, 12).toUpperCase(),
    stripeSessionId: cleanText(order?.stripe?.sessionId, 120),
    stripePaymentStatus: cleanText(order?.stripe?.paymentStatus || order?.paymentStatus, 80),
    printfulDraftOrderId: cleanText(order?.printful?.draftOrderId, 120),
    printfulConfirmedOrderId: cleanText(order?.printful?.confirmedOrderId, 120),
    printfulStatus: cleanText(order?.printful?.status || order?.printfulStatus, 80),
    status: cleanText(order?.status, 80) || "unknown",
    actionNeeded: Boolean(order?.actionNeeded),
    itemSummary: Array.isArray(order?.cart?.items)
      ? order.cart.items.map((item) => ({
          title: cleanText(item.title, 220),
          variantName: cleanText(item.variantName, 220),
          quantity: Number(item.quantity) || 0
        }))
      : [],
    errorSummary: cleanText(order?.errorSummary, 220)
  };
}

function merchOrderStorage(env) {
  const binding = env?.DC_MERCH_ORDERS_KV;
  return binding && typeof binding.get === "function" && typeof binding.put === "function" ? binding : null;
}

function maskEmail(value) {
  const email = cleanText(value, 180).toLowerCase();
  const [name, domain] = email.split("@");
  if (!name || !domain) return "";
  return `${name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***`}@${domain}`;
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 160).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 160);
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set(
    [
      env.DC_PUBLIC_SITE_ORIGIN || "https://danielclancy.net",
      env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ].filter(Boolean)
  );
  if (allowed.has(origin)) return origin;
  return env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net";
}

function corsHeaders(request, env) {
  return {
    "access-control-allow-origin": allowedOrigin(request, env),
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
