import { requireAdmin } from "../../../_shared/admin-accounts.js";
import {
  fetchPrintfulProductDetail,
  fetchPrintfulProductList,
  json,
  mergeProductOverrides,
  productLookupKeys,
  registerPrintfulFile,
  resolvePrintfulStore,
  sanitizePublicProduct,
  slugify
} from "../../../_shared/printful-products.js";

const PRODUCTS_KEY = "cms:products";
const JSON_HEADERS = {
  "cache-control": "no-store"
};

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  let response;
  try {
    const admin = await requireAdmin(request, env);
    if (admin.error) {
      response = json({ ok: false, error: admin.error }, { status: admin.status || 403, headers: JSON_HEADERS });
    } else {
      response = await handleAdminProducts(context, admin.session, routeParts(params));
    }
  } catch {
    response = json({ ok: false, error: "products_api_unavailable" }, { status: 500, headers: JSON_HEADERS });
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handleAdminProducts(context, session, parts) {
  const { request, env } = context;
  const action = parts[0] || "";

  if (request.method === "GET" && action === "health") {
    return productsHealth(env);
  }
  if (request.method === "GET" && action === "detail") {
    return productDetail(env, parts.slice(1).join("/"));
  }
  if (request.method === "GET" && !action) {
    return productList(env);
  }
  if (request.method === "POST" && action === "override") {
    return saveProductOverride(request, env, session);
  }
  if (request.method === "POST" && action === "bulk") {
    return bulkUpdateProducts(request, env, session);
  }
  if (request.method === "POST" && action === "files") {
    return registerProductFile(request, env);
  }

  return json({ ok: false, error: "method_or_route_not_allowed" }, { status: 405, headers: JSON_HEADERS });
}

async function productsHealth(env) {
  const store = await resolvePrintfulStore(env);
  const storageConfigured = storageReady(env);
  return json(
    {
      ok: true,
      configured: Boolean(store.configured && store.ok),
      printful: store.ok
        ? { ok: true, store: safeStore(store.store), storeId: store.storeId }
        : { ok: false, error: store.error || "printful_unavailable", configured: Boolean(store.configured) },
      storage: {
        ok: storageConfigured,
        binding: "DC_ADMIN_KV",
        key: PRODUCTS_KEY
      },
      upload: {
        durableStorage: Boolean(env?.DC_ADMIN_ASSETS_R2),
        publicBaseUrl: Boolean(String(env?.DC_ADMIN_ASSETS_PUBLIC_BASE_URL || "").trim()),
        printfulFileRegistration: Boolean(store.configured && store.ok)
      }
    },
    { headers: JSON_HEADERS }
  );
}

async function productList(env) {
  const [printful, overrides] = await Promise.all([fetchPrintfulProductList(env), readOverrides(env)]);
  if (!printful.ok) {
    return json(
      {
        ok: false,
        configured: Boolean(printful.configured),
        error: printful.error || "printful_products_unavailable",
        message: printful.message || "Printful products are unavailable.",
        products: [],
        overrides: overrides.items,
        storageConfigured: overrides.configured
      },
      { status: printful.status || 503, headers: JSON_HEADERS }
    );
  }
  const products = printful.products.map((product) => adminProductShape(mergeProductOverrides(product, overrides.items)));
  return json(
    {
      ok: true,
      configured: true,
      source: "printful_legacy_sync_products",
      store: safeStore(printful.store),
      storeId: printful.storeId,
      products,
      overrides: overrides.items,
      storageConfigured: overrides.configured
    },
    { headers: JSON_HEADERS }
  );
}

async function productDetail(env, lookup) {
  const [detail, overrides] = await Promise.all([fetchPrintfulProductDetail(env, lookup), readOverrides(env)]);
  if (!detail.ok) {
    return json(
      {
        ok: false,
        configured: Boolean(detail.configured),
        error: detail.error || "product_not_found",
        message: detail.message || "No Printful product matches this lookup."
      },
      { status: detail.status || 404, headers: JSON_HEADERS }
    );
  }
  return json(
    {
      ok: true,
      configured: true,
      product: adminProductShape(mergeProductOverrides(detail.product, overrides.items)),
      store: safeStore(detail.store),
      storageConfigured: overrides.configured
    },
    { headers: JSON_HEADERS }
  );
}

async function saveProductOverride(request, env, session) {
  const storage = productStorage(env);
  if (!storage) {
    return json(
      {
        ok: false,
        error: "storage_not_configured",
        message: "DC_ADMIN_KV is required before product storefront overrides can be saved."
      },
      { status: 503, headers: JSON_HEADERS }
    );
  }
  const payload = await readJson(request);
  if (!payload) return json({ ok: false, error: "invalid_json" }, { status: 400, headers: JSON_HEADERS });
  const override = normalizeOverride(payload, session);
  if (!override.productId && !override.printfulProductId && !override.slug) {
    return json({ ok: false, error: "product_identity_required" }, { status: 400, headers: JSON_HEADERS });
  }
  const current = await readOverrides(env);
  const keys = overrideKeys(override);
  const items = current.items.filter((item) => !overrideKeys(item).some((key) => keys.includes(key)));
  items.push(override);
  await storage.put(PRODUCTS_KEY, JSON.stringify({ collection: "products", updatedAt: override.updatedAt, updatedBy: actor(session), items }, null, 2));
  return json({ ok: true, saved: true, item: override, items, storageConfigured: true }, { headers: JSON_HEADERS });
}

async function bulkUpdateProducts(request, env, session) {
  const storage = productStorage(env);
  if (!storage) {
    return json({ ok: false, error: "storage_not_configured", message: "DC_ADMIN_KV is required for bulk product overrides." }, { status: 503, headers: JSON_HEADERS });
  }
  const payload = await readJson(request);
  const ids = Array.isArray(payload?.ids) ? payload.ids.map(String).filter(Boolean) : [];
  const patch = payload?.patch && typeof payload.patch === "object" ? payload.patch : {};
  if (!ids.length) return json({ ok: false, error: "product_ids_required" }, { status: 400, headers: JSON_HEADERS });
  const current = await readOverrides(env);
  const byId = new Map(current.items.map((item) => [primaryOverrideKey(item), item]));
  const updatedAt = new Date().toISOString();
  ids.forEach((id) => {
    const key = slugify(id);
    const existing = byId.get(key) || { productId: id, printfulProductId: id, slug: slugify(id) };
    byId.set(key, normalizeOverride({ ...existing, ...safeBulkPatch(patch), updatedAt }, session));
  });
  const items = Array.from(byId.values());
  await storage.put(PRODUCTS_KEY, JSON.stringify({ collection: "products", updatedAt, updatedBy: actor(session), items }, null, 2));
  return json({ ok: true, saved: true, count: ids.length, items, storageConfigured: true }, { headers: JSON_HEADERS });
}

async function registerProductFile(request, env) {
  const payload = await readJson(request);
  const publicUrl = String(payload?.publicUrl || payload?.url || "").trim();
  const result = await registerPrintfulFile(env, publicUrl);
  return json(
    result.ok
      ? { ok: true, registered: true, file: result.payload?.data || result.payload }
      : { ok: false, error: result.error || "printful_file_registration_failed", message: result.message || result.detail || "Printful file registration failed." },
    { status: result.ok ? 200 : result.status || 502, headers: JSON_HEADERS }
  );
}

async function readOverrides(env) {
  const storage = productStorage(env);
  if (!storage) return { configured: false, items: [] };
  try {
    const raw = await storage.get(PRODUCTS_KEY);
    if (!raw) return { configured: true, items: [] };
    const parsed = JSON.parse(raw);
    return {
      configured: true,
      items: Array.isArray(parsed?.items) ? parsed.items.map((item) => normalizeOverride(item)).filter(Boolean) : []
    };
  } catch {
    return { configured: true, items: [] };
  }
}

function adminProductShape(product) {
  return {
    ...sanitizePublicProduct(product),
    lookupKeys: productLookupKeys(product),
    visibility: product.visibility || "public",
    featured: Boolean(product.featured),
    sortOrder: product.sortOrder || 1000,
    health: product.status || product.availability || "listed"
  };
}

function normalizeOverride(raw = {}, session = null) {
  const updatedAt = String(raw.updatedAt || new Date().toISOString());
  const visibility = cleanChoice(raw.visibility, ["public", "hidden", "private", "draft"], "public");
  return {
    productId: cleanString(raw.productId || raw.printfulProductId || raw.syncProductId),
    printfulProductId: cleanString(raw.printfulProductId || raw.syncProductId || raw.productId),
    externalId: cleanString(raw.externalId),
    slug: slugify(raw.slug || raw.slugOverride || raw.displayTitle || raw.titleOverride || raw.productId),
    slugOverride: slugify(raw.slugOverride || raw.slug),
    displayTitle: cleanString(raw.displayTitle || raw.titleOverride, 220),
    descriptionOverride: cleanString(raw.descriptionOverride || raw.description, 4000),
    categoryOverride: cleanString(raw.categoryOverride || raw.category || raw.collectionOverride, 160),
    visibility,
    featured: Boolean(raw.featured),
    heroImageOverride: cleanString(raw.heroImageOverride || raw.heroImage, 1200),
    galleryOverride: Array.isArray(raw.galleryOverride || raw.gallery)
      ? (raw.galleryOverride || raw.gallery).map((item) => cleanString(item, 1200)).filter(Boolean)
      : [],
    altText: cleanString(raw.altText || raw.displayLabel, 220),
    displayLabel: cleanString(raw.displayLabel || raw.altText, 220),
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 1000,
    updatedAt,
    updatedBy: actor(session || raw)
  };
}

function safeBulkPatch(patch) {
  const allowed = {};
  if (patch.visibility) allowed.visibility = patch.visibility;
  if (Object.prototype.hasOwnProperty.call(patch, "featured")) allowed.featured = Boolean(patch.featured);
  if (patch.categoryOverride || patch.category) allowed.categoryOverride = patch.categoryOverride || patch.category;
  return allowed;
}

function productStorage(env) {
  const binding = env?.DC_ADMIN_KV;
  return binding && typeof binding.get === "function" && typeof binding.put === "function" ? binding : null;
}

function storageReady(env) {
  return Boolean(productStorage(env));
}

function routeParts(params) {
  const raw = Array.isArray(params.path) ? params.path : params.path ? String(params.path).split("/") : [];
  return raw.map((part) => String(part || "").trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set(
    [
      env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ].filter(Boolean)
  );
  return {
    "access-control-allow-origin": allowed.has(origin) ? origin : env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function safeStore(store) {
  return store ? { id: store.id ?? null, name: cleanString(store.name, 160), type: cleanString(store.type, 80) } : null;
}

function overrideKeys(item) {
  return [item.productId, item.printfulProductId, item.externalId, item.slug, item.slugOverride].map(slugify).filter(Boolean);
}

function primaryOverrideKey(item) {
  return overrideKeys(item)[0] || slugify(item.productId || item.slug);
}

function actor(session) {
  return cleanString(session?.email || session?.id || session?.username || session?.updatedBy, 160);
}

function cleanChoice(value, choices, fallback) {
  const text = cleanString(value, 80).toLowerCase();
  return choices.includes(text) ? text : fallback;
}

function cleanString(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
