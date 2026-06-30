const PRINTFUL_V2_BASE = "https://api.printful.com/v2";
const PRINTFUL_V1_BASE = "https://api.printful.com";
const STORE_NAME = "Daniel Clancy";
const BASE_STORE_CURRENCY = "AUD";

export function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export function cleanText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function slugify(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function hasPrintfulToken(env) {
  return Boolean(cleanText(env?.PRINTFUL_STORE_API, 4096));
}

async function printfulFetch(env, path, options = {}) {
  const token = cleanText(env?.PRINTFUL_STORE_API, 4096);
  if (!token) {
    return {
      ok: false,
      configured: false,
      status: 503,
      error: "printful_token_missing",
      message: "PRINTFUL_STORE_API is not configured."
    };
  }

  const base = options.version === "v1" ? PRINTFUL_V1_BASE : PRINTFUL_V2_BASE;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/json"
  };
  if (options.storeId) headers["x-pf-store-id"] = String(options.storeId);
  if (options.body) headers["content-type"] = "application/json";

  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    return { ok: false, configured: true, status: 502, error: "printful_fetch_failed" };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      configured: true,
      status: response.status,
      error: "printful_api_error",
      detail: safePrintfulError(payload)
    };
  }

  return { ok: true, configured: true, status: response.status, payload };
}

function safePrintfulError(payload) {
  const raw = payload?.error?.message || payload?.message || payload?.error || "";
  return cleanText(raw, 180) || "printful_request_failed";
}

export async function resolvePrintfulStore(env) {
  const response = await printfulFetch(env, "/stores");
  if (!response.ok) return response;
  const stores = Array.isArray(response.payload?.data) ? response.payload.data : [];
  const named =
    stores.find((store) => cleanText(store.name).toLowerCase() === STORE_NAME.toLowerCase()) ||
    stores.find((store) => cleanText(store.name).toLowerCase().includes("daniel clancy")) ||
    stores[0] ||
    null;
  return {
    ok: true,
    configured: true,
    store: named,
    storeId: named?.id || null,
    stores: stores.map((store) => ({
      id: store.id ?? null,
      name: cleanText(store.name, 160),
      type: cleanText(store.type, 80)
    }))
  };
}

export async function fetchPrintfulProductList(env) {
  const store = await resolvePrintfulStore(env);
  if (!store.ok) return store;
  const response = await printfulFetch(env, "/store/products", {
    version: "v1",
    storeId: store.storeId
  });
  if (!response.ok) return response;
  const rows = Array.isArray(response.payload?.result) ? response.payload.result : [];
  return {
    ok: true,
    configured: true,
    store: store.store,
    storeId: store.storeId,
    products: await hydrateListProductDetails(env, store.storeId, rows.map((row) => normalizePrintfulProduct(row)))
  };
}

export async function fetchPrintfulProductDetail(env, lookup) {
  const list = await fetchPrintfulProductList(env);
  if (!list.ok) return list;
  const key = normalizeLookupKey(lookup);
  const product = list.products.find((item) => productLookupKeys(item).includes(key));
  if (!product) {
    return {
      ok: false,
      configured: true,
      status: 404,
      error: "product_not_found",
      store: list.store,
      storeId: list.storeId,
      products: list.products
    };
  }

  const detail = await printfulFetch(env, `/store/products/${encodeURIComponent(product.printfulProductId)}`, {
    version: "v1",
    storeId: list.storeId
  });
  if (!detail.ok) {
    return { ...detail, store: list.store, storeId: list.storeId, product };
  }

  return {
    ok: true,
    configured: true,
    store: list.store,
    storeId: list.storeId,
    product: normalizePrintfulProduct(product.raw, detail.payload?.result)
  };
}

export async function registerPrintfulFile(env, publicUrl) {
  const url = cleanText(publicUrl, 1200);
  if (!/^https:\/\//i.test(url)) {
    return {
      ok: false,
      status: 400,
      error: "public_https_url_required",
      message: "Printful file ingestion requires a public HTTPS file URL."
    };
  }
  const store = await resolvePrintfulStore(env);
  if (!store.ok) return store;
  return printfulFetch(env, "/files", {
    version: "v2",
    method: "POST",
    storeId: store.storeId,
    body: { url }
  });
}

export function normalizePrintfulProduct(row, detail = null) {
  const syncProduct = detail?.sync_product || row?.sync_product || row || {};
  const variants = Array.isArray(detail?.sync_variants)
    ? detail.sync_variants
    : Array.isArray(row?.sync_variants)
      ? row.sync_variants
      : [];
  const id = cleanText(syncProduct.id || row?.id || row?.printfulProductId);
  const title = cleanText(syncProduct.name || row?.title || row?.name, 220);
  const slug = slugify(row?.slug || title || id);
  const images = uniqueStrings([
    syncProduct.thumbnail_url,
    syncProduct.thumbnail,
    row?.thumbnailUrl,
    row?.image,
    ...variants.flatMap((variant) => variantImageCandidates(variant))
  ]).filter((url) => /^https:\/\//i.test(url));
  const variantShapes = variants.map(normalizeVariant).filter(Boolean);
  const prices = [
    ...variantShapes.map((variant) => Number.parseFloat(variant.retailPrice || "")),
    ...priceCandidates(syncProduct),
    ...priceCandidates(row)
  ].filter((value) => Number.isFinite(value) && value > 0);
  const currency = normalizeCurrency(
    variantShapes.find((variant) => cleanText(variant.currency))?.currency ||
      currencyCandidate(syncProduct) ||
      currencyCandidate(row)
  );
  const priceRange = prices.length
    ? {
        min: Math.min(...prices),
        max: Math.max(...prices),
        currency,
        text: formatPriceRange(Math.min(...prices), Math.max(...prices), currency)
      }
    : null;

  return {
    id,
    printfulProductId: id,
    externalId: cleanText(syncProduct.external_id || row?.externalId, 220),
    slug,
    title,
    description: cleanText(syncProduct.description || row?.description, 4000),
    category: primaryCategoryLabel(categoryEntries(row, syncProduct, null)),
    categorySlug: primaryCategorySlug(categoryEntries(row, syncProduct, null)),
    categories: categoryEntries(row, syncProduct, null),
    thumbnailUrl: images[0] || "",
    images,
    status: normalizeStatus(syncProduct),
    availability: normalizeAvailability(syncProduct),
    priceRange,
    variantCount: Number(syncProduct.variants || variants.length || 0),
    imageCount: images.length,
    variants: variantShapes,
    updatedAt: cleanText(syncProduct.updated_at || syncProduct.updatedAt || row?.updatedAt, 80),
    source: "printful_legacy_sync_product",
    raw: detail || row
  };
}

export function mergeProductOverrides(product, overrides = []) {
  const override = findOverride(product, overrides);
  if (!override) return product;
  const heroImage = cleanText(override.heroImageOverride || override.heroImage, 1200);
  const gallery = Array.isArray(override.galleryOverride) ? override.galleryOverride.map((item) => cleanText(item, 1200)).filter(Boolean) : [];
  const imageSet = uniqueStrings([heroImage, ...gallery, ...product.images]).filter(Boolean);
  const categories = categoryEntries(product.raw || {}, product, override);
  const primary = primaryCategory(override?.primaryCategory || override?.primaryCategorySlug || override?.categoryOverride || override?.category, categories);
  return {
    ...product,
    title: cleanText(override.displayTitle || override.titleOverride, 220) || product.title,
    description: cleanText(override.descriptionOverride || override.description, 4000) || product.description,
    category: primary.label,
    categorySlug: primary.slug,
    categories,
    primaryCategory: primary.label,
    primaryCategorySlug: primary.slug,
    slug: slugify(override.slugOverride || override.slug || product.slug || product.id),
    featured: Boolean(override.featured),
    visibility: cleanText(override.visibility || "public", 80),
    sortOrder: Number.isFinite(Number(override.sortOrder)) ? Number(override.sortOrder) : 1000,
    thumbnailUrl: heroImage || product.thumbnailUrl,
    images: imageSet,
    imageCount: imageSet.length,
    altText: cleanText(override.altText || override.displayLabel, 220),
    overrideUpdatedAt: cleanText(override.updatedAt, 80)
  };
}

export function publicProducts(products, overrides = []) {
  return products
    .map((product) => mergeProductOverrides(product, overrides))
    .filter((product) => !["hidden", "private", "draft", "archived"].includes(cleanText(product.visibility || "public").toLowerCase()))
    .sort((left, right) => {
      if (Boolean(right.featured) !== Boolean(left.featured)) return Number(Boolean(right.featured)) - Number(Boolean(left.featured));
      return (left.sortOrder || 1000) - (right.sortOrder || 1000) || left.title.localeCompare(right.title);
    })
    .map((product) => sanitizePublicProduct(product));
}

export function sanitizePublicProduct(product) {
  const { raw, ...safe } = product;
  return safe;
}

export function productLookupKeys(product) {
  const categorySlugs = productCategorySlugs(product);
  return uniqueStrings([
    product.slug,
    product.id,
    product.printfulProductId,
    product.externalId,
    `all/${product.slug}`,
    ...categorySlugs.map((category) => `${category}/${product.slug}`),
    slugify(product.title)
  ])
    .map(normalizeLookupKey)
    .filter(Boolean);
}

export function normalizeLookupKey(value) {
  return String(value || "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .map((part) => slugify(part))
    .filter(Boolean)
    .join("/");
}

function findOverride(product, overrides) {
  const keys = productLookupKeys(product);
  return (
    overrides.find((override) => {
      const overrideKeys = [
        override.productId,
        override.printfulProductId,
        override.syncProductId,
        override.externalId,
        override.slug,
        override.slugOverride
      ]
        .map(normalizeLookupKey)
        .filter(Boolean);
      return overrideKeys.some((key) => keys.includes(key));
    }) || null
  );
}

function normalizeVariant(variant) {
  const id = cleanText(variant.id || variant.variant_id || variant.sync_variant_id);
  if (!id) return null;
  const retail = cleanText(firstPriceValue(variant), 40);
  const currency = normalizeCurrency(currencyCandidate(variant));
  return {
    id,
    variantId: cleanText(variant.variant_id, 80),
    name: cleanText(variant.name, 220),
    sku: cleanText(variant.sku, 120),
    retailPrice: retail,
    currency,
    status: normalizeStatus(variant),
    files: variantFiles(variant)
  };
}

function normalizeStatus(value) {
  if (value?.is_ignored === true) return "ignored";
  if (value?.synced === true || value?.is_synced === true) return "synced";
  if (value?.synced === false || value?.is_synced === false) return "unsynced";
  return cleanText(value?.status, 80) || "";
}

function normalizeAvailability(value) {
  if (value?.is_ignored === true) return "not listed";
  if (value?.synced === true || value?.is_synced === true) return "available";
  return "";
}

function variantFiles(variant) {
  const files = Array.isArray(variant.files) ? variant.files : [];
  return files
    .map((file) => ({
      id: cleanText(file.id || file.file_id, 80),
      type: cleanText(file.type, 80),
      url: cleanText(file.url || file.preview_url || file.thumbnail_url, 1200),
      filename: cleanText(file.filename, 220)
    }))
    .filter((file) => file.url || file.id);
}

function variantImageCandidates(variant) {
  return [
    variant.thumbnail_url,
    variant.preview_url,
    ...(Array.isArray(variant.files) ? variant.files.flatMap((file) => [file.preview_url, file.thumbnail_url, file.url]) : [])
  ];
}

function formatPriceRange(min, max, currency) {
  const code = normalizeCurrency(currency);
  const left = formatCurrencyAmount(min, code);
  const right = formatCurrencyAmount(max, code);
  return min === max ? `${left} ${code}` : `${left}-${right} ${code}`;
}

async function hydrateListProductDetails(env, storeId, products) {
  const needsDetail = products.filter((product) => !product.priceRange || !product.variants.length).slice(0, 36);
  if (!needsDetail.length) return products;
  const byId = new Map(products.map((product) => [product.printfulProductId, product]));
  const queue = [...needsDetail];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const product = queue.shift();
      const detail = await printfulFetch(env, `/store/products/${encodeURIComponent(product.printfulProductId)}`, {
        version: "v1",
        storeId
      });
      if (detail.ok) byId.set(product.printfulProductId, normalizePrintfulProduct(product.raw, detail.payload?.result));
    }
  });
  await Promise.all(workers);
  return products.map((product) => byId.get(product.printfulProductId) || product);
}

function priceCandidates(value = {}) {
  return [
    firstPriceValue(value),
    value.retail_price,
    value.price,
    value.price_amount,
    value.amount,
    value.min_price,
    value.max_price,
    value.retail_price?.amount,
    value.price?.amount,
    value.pricing?.retail_price,
    value.pricing?.price,
    value.retailPrice
  ]
    .map((entry) => Number.parseFloat(cleanText(entry, 40)))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
}

function firstPriceValue(value = {}) {
  const candidates = [
    value.retail_price,
    value.price,
    value.price_amount,
    value.amount,
    value.retailPrice,
    value.retail_price?.amount,
    value.price?.amount,
    value.pricing?.retail_price,
    value.pricing?.price
  ];
  return candidates
    .map((entry) => (entry && typeof entry === "object" ? entry.amount || entry.value : entry))
    .find((entry) => cleanText(entry, 40));
}

function currencyCandidate(value = {}) {
  return (
    value.currency ||
    value.currency_code ||
    value.retail_currency ||
    value.price_currency ||
    value.retail_price?.currency ||
    value.price?.currency ||
    value.pricing?.currency
  );
}

function normalizeCurrency(value) {
  const code = cleanText(value, 12).toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : BASE_STORE_CURRENCY;
}

function formatCurrencyAmount(value, currency) {
  try {
    return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(value);
  } catch {
    return `${Number(value).toFixed(2)}`;
  }
}

function categoryEntries(row = {}, syncProduct = {}, override = null) {
  const overrideCategories = [
    override?.categoryOverride,
    override?.category,
    override?.primaryCategory,
    ...(Array.isArray(override?.categories) ? override.categories : []),
    ...(Array.isArray(override?.categoryOverrides) ? override.categoryOverrides : [])
  ];
  const printfulCategories = [
    row?.category,
    syncProduct?.category,
    row?.collection,
    syncProduct?.collection,
    row?.product_type,
    syncProduct?.product_type,
    row?.type,
    syncProduct?.type,
    ...(Array.isArray(row?.categories) ? row.categories : []),
    ...(Array.isArray(syncProduct?.categories) ? syncProduct.categories : []),
    ...(Array.isArray(row?.collections) ? row.collections : []),
    ...(Array.isArray(syncProduct?.collections) ? syncProduct.collections : []),
    ...(Array.isArray(row?.tags) ? row.tags : []),
    ...(Array.isArray(syncProduct?.tags) ? syncProduct.tags : [])
  ];
  const entries = [{ label: "All", slug: "all", source: "system" }];
  [
    ...overrideCategories.map((label) => ({ label, source: "admin" })),
    ...printfulCategories.map((label) => ({ label, source: "printful" }))
  ].forEach((entry) => {
    const label = categoryLabel(entry.label);
    const slug = slugify(label);
    if (!label || !slug || slug === "all") return;
    if (!entries.some((item) => item.slug === slug)) entries.push({ label, slug, source: entry.source });
  });
  return entries;
}

function categoryLabel(value) {
  if (value && typeof value === "object") return cleanText(value.name || value.title || value.label || value.slug || value.id, 160);
  return cleanText(value, 160);
}

function primaryCategoryLabel(categories) {
  return primaryCategory("", categories).label;
}

function primaryCategorySlug(categories) {
  return primaryCategory("", categories).slug;
}

function primaryCategory(preferred, categories) {
  const preferredSlug = slugify(preferred);
  return categories.find((entry) => entry.slug === preferredSlug && entry.slug !== "all") ||
    categories.find((entry) => entry.slug !== "all") ||
    categories[0] ||
    { label: "All", slug: "all", source: "system" };
}

function productCategorySlugs(product) {
  const slugs = Array.isArray(product.categories)
    ? product.categories.map((entry) => entry.slug || slugify(entry.label)).filter(Boolean)
    : [];
  return uniqueStrings(["all", product.categorySlug, slugify(product.category), ...slugs]);
}

function trimPrice(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => cleanText(value, 1200)).filter(Boolean)));
}
