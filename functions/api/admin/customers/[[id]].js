import { requireAdmin } from "../../../_shared/admin-accounts.js";
import {
  adminCustomerDetail,
  adminCustomerSummary,
  cleanId,
  cleanText,
  customerStorage,
  listCustomerIds,
  merchOrderStorage,
  putCustomerProfile,
  readCustomerOrderIds,
  readCustomerProfile,
  readMerchOrder
} from "../../../_shared/customer-records.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });

  let response;
  try {
    const admin = await requireAdmin(request, env);
    if (admin.error) {
      response = json({ ok: false, error: admin.error }, admin.status || 403);
    } else {
      const id = Array.isArray(params.id) ? params.id.join("/") : String(params.id || "");
      if (request.method === "GET" && !id) response = await listCustomers(env);
      else if (request.method === "GET" && id) response = await getCustomer(env, id);
      else if (request.method === "PATCH" && id) response = await patchCustomer(request, env, id);
      else response = json({ ok: false, error: "method_not_allowed" }, 405);
    }
  } catch {
    response = json({ ok: false, error: "customers_unavailable" }, 500);
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function listCustomers(env) {
  const storage = customerStorage(env);
  if (!storage) return storageNeeded();
  const ids = await listCustomerIds(storage);
  const ordersStorage = merchOrderStorage(env);
  const customers = [];
  for (const id of ids) {
    const profile = await readCustomerProfile(storage, id);
    if (!profile) continue;
    const orderIds = await readCustomerOrderIds(storage, profile.id);
    const orders = await readOrders(ordersStorage, orderIds);
    customers.push(adminCustomerSummary(profile, orders));
  }
  return json({ ok: true, configured: true, source: "DC_CUSTOMERS_KV", customers, count: customers.length, checkedAt: new Date().toISOString() });
}

async function getCustomer(env, id) {
  const storage = customerStorage(env);
  if (!storage) return storageNeeded();
  const profile = await readCustomerProfile(storage, cleanId(id));
  if (!profile) return json({ ok: false, error: "customer_not_found" }, 404);
  const orders = await readOrders(merchOrderStorage(env), await readCustomerOrderIds(storage, profile.id));
  return json({ ok: true, configured: true, customer: adminCustomerDetail(profile, orders) });
}

async function patchCustomer(request, env, id) {
  const storage = customerStorage(env);
  if (!storage) return storageNeeded();
  const profile = await readCustomerProfile(storage, cleanId(id));
  if (!profile) return json({ ok: false, error: "customer_not_found" }, 404);
  const payload = await request.json().catch(() => null);
  const status = cleanText(payload?.status, 40);
  const updated = await putCustomerProfile(storage, {
    ...profile,
    status: status === "disabled" ? "disabled" : "active",
    adminNotes: cleanText(payload?.adminNotes || payload?.admin_notes, 1000),
    updatedAt: new Date().toISOString()
  });
  return json({ ok: true, customer: adminCustomerDetail(updated, await readOrders(merchOrderStorage(env), await readCustomerOrderIds(storage, updated.id))) });
}

async function readOrders(storage, orderIds) {
  if (!storage) return [];
  const orders = [];
  for (const id of orderIds.slice(0, 50)) {
    const order = await readMerchOrder(storage, id);
    if (order) orders.push(order);
  }
  return orders;
}

function storageNeeded() {
  return json(
    {
      ok: false,
      configured: false,
      error: "storage_not_configured",
      message: "DC_CUSTOMERS_KV is required before Admin customer management can load.",
      requiredBinding: "DC_CUSTOMERS_KV",
      customers: []
    },
    503
  );
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
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
    "access-control-allow-methods": "GET,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
