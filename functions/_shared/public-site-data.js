import {
  extractClientOnlyIds,
  extractRequiredCompanyIds,
  normalizePositionRegistryItem,
  reconcilePositionsCollection,
  reconcileRegistryCollection
} from "./registry-reconciliation.js";

const COLLECTIONS = {
  projects: { key: "cms:projects" },
  products: { key: "cms:products" },
  companies: { key: "cms:companies" },
  platforms: { key: "cms:platforms" },
  positions: { key: "cms:positions" }
};

const PROJECTS_BASELINE_PATH = "/assets/data/public-projects-baseline.json";
const COMPANIES_BASELINE_PATH = "/assets/data/admin-companies-baseline.json";
const PLATFORMS_BASELINE_PATH = "/assets/data/admin-platforms-baseline.json";
const POSITIONS_BASELINE_PATH = "/assets/data/admin-positions-baseline.json";
const SOURCE_AUDIT_PATH = "/assets/data/source-audit-report.json";
const ASSET_CATALOG_PATH = "/assets/data/public-asset-catalog.json";
const PROJECTS_BASELINE_VERSION = "public-projects-baseline-2026-06-14";
export const PUBLISHED_SITE_DATA_KEY = "public:site-data:published";
export const PUBLISHED_SITE_DATA_META_KEY = "public:site-data:publish-meta";

const SAFE_ASSET_PREFIXES = ["/media/portfolio/thumbs/", "/media/portfolio/", "/docs/", "/assets/backgrounds/shopheroslides/"];
const INTERNAL_KEYS = new Set([
  "overlay",
  "overlaySummary",
  "excludedRows",
  "hiddenBaselineIds",
  "adminCreatedItems",
  "registryOrigin",
  "registrySourceType",
  "sourceRequired",
  "updatedBy",
  "account",
  "auth",
  "session",
  "secret",
  "kv"
]);

export async function buildPublicSiteData(context, options = {}) {
  const { request, env } = context;
  const generatedAt = new Date().toISOString();
  const warnings = [];
  const storageConfigured = Boolean(env?.DC_ADMIN_KV && typeof env.DC_ADMIN_KV.get === "function");

  const [projectsPayload, registryBaselines, assetCatalog] = await Promise.all([
    loadJsonAsset(request, env, PROJECTS_BASELINE_PATH, { meta: {}, projects: [] }, "projects"),
    loadRegistryBaselines(request, env),
    loadJsonAsset(request, env, ASSET_CATALOG_PATH, { metadata: {}, entries: [] }, "assets")
  ]);

  if (!storageConfigured) {
    warnings.push("admin_kv_unavailable_reconciled_baseline_returned");
  }

  const kv = storageConfigured ? env.DC_ADMIN_KV : null;
  const [projectsRaw, productsRaw, companiesRaw, platformsRaw, positionsRaw] = await Promise.all([
    getKvValue(kv, COLLECTIONS.projects.key, warnings),
    getKvValue(kv, COLLECTIONS.products.key, warnings),
    getKvValue(kv, COLLECTIONS.companies.key, warnings),
    getKvValue(kv, COLLECTIONS.platforms.key, warnings),
    getKvValue(kv, COLLECTIONS.positions.key, warnings)
  ]);

  const projectsStored = parseStoredCollection(projectsRaw, warnings, "projects");
  const productsStored = parseStoredCollection(productsRaw, warnings, "products");
  const companiesStored = parseStoredValue(companiesRaw, warnings, "companies");
  const platformsStored = parseStoredValue(platformsRaw, warnings, "platforms");
  const positionsStored = parseStoredValue(positionsRaw, warnings, "positions");

  const companiesResult = reconcileRegistryCollection("companies", registryBaselines.companies, companiesStored, {
    clientOnlyIds: registryBaselines.clientOnlyIds,
    requiredIds: registryBaselines.requiredCompanyIds
  });
  const platformsResult = reconcileRegistryCollection("platforms", registryBaselines.platforms, platformsStored, {
    requiredIds: new Set(registryBaselines.platforms.map((item) => item.id || item.slug).filter(Boolean))
  });
  const positionsResult = reconcilePositionsCollection(
    registryBaselines.positions,
    Array.isArray(positionsStored) ? positionsStored.map((item) => normalizePositionRegistryItem(item, (id) => companyNameById(companiesResult.items, id))) : positionsStored,
    companiesResult.items,
    (id) => companyNameById(companiesResult.items, id)
  );
  const projectsResult = mergeProjectsBaselineWithKv(projectsPayload, projectsStored.items, projectsStored.wrapper);

  warnings.push(...publicWarnings(companiesResult), ...publicWarnings(platformsResult), ...publicWarnings(positionsResult));

  const source = storageConfigured ? "live_reconciled_fallback" : "baseline_fallback";
  const payload = {
    ok: true,
    schemaVersion: "danielclancy-public-site-data.v1",
    generatedAt,
    source: options.source || source,
    revision: "",
    publishedAt: null,
    collections: {
      projects: projectsResult.items.map((item) => sanitizeProject(item)).filter(Boolean),
      products: productsStored.items.map((item) => sanitizeProductOverride(item)).filter(Boolean),
      productSettings: sanitizeProductSettings(productsStored.wrapper?.settings || {}),
      companies: companiesResult.items.map((item) => sanitizeCompany(item)).filter(Boolean),
      platforms: platformsResult.items.map((item) => sanitizePlatform(item)).filter(Boolean),
      positions: positionsResult.items.map((item) => sanitizePosition(item, companiesResult.items)).filter(Boolean)
    },
    assets: sanitizeAssetCatalog(assetCatalog),
    meta: {
      storageConfigured,
      projectsBaselineVersion: PROJECTS_BASELINE_VERSION,
      projectsBaselineCount: projectsResult.meta.baselineCount,
      projectsMergedCount: projectsResult.meta.mergedCount,
      assetCatalogGeneratedAt: assetCatalog?.metadata?.generatedAt || null
    },
    warnings: Array.from(new Set(warnings.filter(Boolean)))
  };
  payload.revision = options.revision || await publicSiteDataRevision(payload);
  return payload;
}

export async function readPublishedSiteData(context) {
  const kv = context?.env?.DC_ADMIN_KV;
  if (!kv || typeof kv.get !== "function") {
    return { payload: null, meta: null, warning: "admin_kv_unavailable_published_snapshot_unavailable" };
  }
  try {
    const [rawPayload, rawMeta] = await Promise.all([
      kv.get(PUBLISHED_SITE_DATA_KEY),
      kv.get(PUBLISHED_SITE_DATA_META_KEY)
    ]);
    if (!rawPayload) return { payload: null, meta: null, warning: "" };
    const payload = JSON.parse(rawPayload);
    const meta = rawMeta ? JSON.parse(rawMeta) : null;
    if (payload?.schemaVersion !== "danielclancy-public-site-data.v1" || payload?.ok !== true) {
      return { payload: null, meta: null, warning: "published_snapshot_invalid_fallback_used" };
    }
    return {
      payload: {
        ...payload,
        source: "published_kv_snapshot",
        revision: String(payload.revision || meta?.revision || ""),
        publishedAt: payload.publishedAt || meta?.publishedAt || null
      },
      meta,
      warning: ""
    };
  } catch {
    return { payload: null, meta: null, warning: "published_snapshot_read_failed_fallback_used" };
  }
}

export async function buildPublicSiteDataResponse(context) {
  const published = await readPublishedSiteData(context);
  if (published.payload) {
    return {
      payload: published.payload,
      source: "published_kv_snapshot",
      etag: published.payload.revision ? `"${published.payload.revision}"` : ""
    };
  }
  const payload = await buildPublicSiteData(context);
  if (published.warning) payload.warnings = Array.from(new Set([...(payload.warnings || []), published.warning]));
  return {
    payload,
    source: payload.source,
    etag: payload.revision ? `"${payload.revision}"` : ""
  };
}

export async function publishPublicSiteData(context, session = {}) {
  const kv = context?.env?.DC_ADMIN_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    return {
      ok: false,
      error: "storage_not_configured",
      message: "Cannot publish: live Admin API/KV is unavailable. Current edits are local-only.",
      status: 503
    };
  }
  const publishedAt = new Date().toISOString();
  const payload = await buildPublicSiteData(context, { source: "published_kv_snapshot" });
  const counts = collectionCounts(payload);
  const revision = await publicSiteDataRevision({
    schemaVersion: payload.schemaVersion,
    collections: payload.collections,
    assets: payload.assets,
    warnings: payload.warnings,
    publishedAt
  });
  const safeActor = String(session.email || session.id || session.providerSubject || session.username || "").trim();
  const published = {
    ...payload,
    source: "published_kv_snapshot",
    revision,
    publishedAt,
    generatedAt: payload.generatedAt || publishedAt
  };
  const meta = {
    schemaVersion: "danielclancy-public-site-data-publish-meta.v1",
    publishedAt,
    publishedBy: safeActor,
    revision,
    counts,
    warnings: published.warnings || []
  };
  await Promise.all([
    kv.put(PUBLISHED_SITE_DATA_KEY, JSON.stringify(published, null, 2)),
    kv.put(PUBLISHED_SITE_DATA_META_KEY, JSON.stringify(meta, null, 2))
  ]);
  return {
    ok: true,
    published: true,
    revision,
    counts,
    warnings: meta.warnings,
    publishedAt,
    source: "published_kv_snapshot",
    publicUrl: `/api/public/site-data?rev=${encodeURIComponent(revision)}`,
    meta
  };
}

export function sanitizeProject(raw = {}) {
  if (!isActivePublic(raw)) return null;
  const companyIds = safeArray(raw.companyIds);
  const companyLabels = safeArray(raw.companyLabels || raw.studio);
  const platformIds = safeArray(raw.platformIds);
  const platformLabels = safeArray(raw.platformLabels || raw.software);
  return removeInternalFields({
    ...raw,
    id: safeString(raw.id || raw.slug),
    slug: safeString(raw.slug || raw.id),
    code: safeString(raw.code || raw.slug || raw.id),
    title: safeString(raw.title),
    summary: safeString(raw.summary),
    description: safeString(raw.description),
    tags: safeArray(raw.tags || raw.subtypes || raw.disciplines),
    thumbnailPath: safeAssetPath(raw.thumbnailPath || raw.thumbnail),
    heroImage: safeAssetPath(raw.heroImage || raw.hero),
    galleryPaths: safeArray(raw.galleryPaths || raw.gallery).map(safeAssetPath).filter(Boolean),
    documentPath: safeAssetPath(raw.documentPath || raw.document, { docsOnly: true }),
    documentationUrl: safePublicUrl(raw.documentationUrl),
    companyIds,
    companyLabels,
    companyId: safeString(raw.companyId || companyIds[0] || ""),
    companyName: safeString(raw.companyName || companyLabels[0] || ""),
    studio: companyLabels,
    clientName: safeString(raw.clientName || raw.client || ""),
    clientLabel: safeString(raw.clientLabel || raw.clientName || raw.client || ""),
    platformIds,
    platformLabels,
    software: platformLabels,
    dates: safeString(raw.dates || raw.dateLabel || ""),
    year: safeString(raw.year),
    dateLabel: safeString(raw.dateLabel),
    location: safeString(raw.location),
    status: safeString(raw.status || "active"),
    visibility: safeString(raw.visibility || "public"),
    featured: Boolean(raw.featured),
    sortOrder: safeNumber(raw.sortOrder, 1000),
    source: safeString(raw.source || "public_baseline")
  });
}

export function sanitizeProductOverride(raw = {}) {
  const visibility = safeString(raw.visibility || "public").toLowerCase();
  if (["private", "internal"].includes(visibility)) return null;
  const gallery = safeArray(raw.galleryOverride || raw.gallery)
    .map((item) => safeProductImageUrl(item))
    .filter(Boolean);
  return removeInternalFields({
    productId: safeString(raw.productId || raw.printfulProductId || raw.syncProductId),
    printfulProductId: safeString(raw.printfulProductId || raw.syncProductId || raw.productId),
    externalId: safeString(raw.externalId),
    slug: safeProductSlug(raw.slug || raw.slugOverride),
    slugOverride: safeProductSlug(raw.slugOverride || raw.slug),
    displayTitle: safeString(raw.displayTitle || raw.titleOverride),
    descriptionOverride: safeString(raw.descriptionOverride || raw.description),
    categoryOverride: safeString(raw.categoryOverride || raw.category || raw.collectionOverride),
    categories: safeProductCategories(raw.categories || raw.categoryOverrides || raw.categoryOverride || raw.category),
    primaryCategory: safeString(raw.primaryCategory || raw.primaryCategorySlug || raw.categoryOverride || raw.category),
    banners: safeProductBanners(raw.banners || raw.bannerOverrides || raw.promos),
    visibility,
    featured: Boolean(raw.featured),
    heroImageOverride: safeProductImageUrl(raw.heroImageOverride || raw.heroImage),
    galleryOverride: gallery,
    altText: safeString(raw.altText || raw.displayLabel),
    displayLabel: safeString(raw.displayLabel || raw.altText),
    sortOrder: safeNumber(raw.sortOrder, 1000),
    updatedAt: safeString(raw.updatedAt)
  });
}

export function sanitizeProductSettings(raw = {}) {
  return removeInternalFields({
    baseCurrency: "AUD",
    convertedCurrencyDefault: safeCurrency(raw.convertedCurrencyDefault || "USD"),
    categories: safeProductCategorySettings(raw.categories),
    banners: safeProductBannerSettings(raw.banners),
    hero: {
      activeSet: safeSlug(raw.hero?.activeSet || raw.heroSlideSet || "default") || "default",
      crossfadeIntervalSeconds: safeClampedNumber(raw.hero?.crossfadeIntervalSeconds || raw.intervalSeconds || raw.crossfadeSpeed, 5, 2, 30),
      crossfadeDurationSeconds: safeClampedNumber(raw.hero?.crossfadeDurationSeconds || raw.durationSeconds, 1.2, 0.2, 5)
    },
    heroSlides: safeHeroSlides(raw.heroSlides || raw.slides || raw.hero?.slides),
    updatedAt: safeString(raw.updatedAt)
  });
}

export function sanitizeCompany(raw = {}) {
  if (!isActivePublic(raw)) return null;
  return {
    id: safeString(raw.id || raw.slug),
    slug: safeString(raw.slug || raw.id),
    name: safeString(raw.name),
    logoPath: safeString(raw.logoPath),
    location: safeString(raw.location),
    website: safePublicUrl(raw.website),
    description: safeString(raw.description || raw.details),
    details: safeString(raw.details || raw.description),
    status: safeString(raw.status || "active"),
    sortOrder: safeNumber(raw.sortOrder, 1000)
  };
}

export function sanitizePlatform(raw = {}) {
  if (!isActivePublic(raw)) return null;
  return {
    id: safeString(raw.id || raw.slug),
    slug: safeString(raw.slug || raw.id),
    name: safeString(raw.name),
    vendor: safeString(raw.vendor || raw.company),
    company: safeString(raw.company || raw.vendor),
    logoPath: safeString(raw.logoPath),
    website: safePublicUrl(raw.website),
    status: safeString(raw.status || "active"),
    sortOrder: safeNumber(raw.sortOrder, 1000)
  };
}

export function sanitizePosition(raw = {}, companies = []) {
  if (!isActivePublic(raw)) return null;
  const companyId = safeString(raw.companyId);
  return {
    id: safeString(raw.id || raw.slug),
    slug: safeString(raw.slug || raw.id),
    title: safeString(raw.title || raw.role),
    companyId,
    companyName: safeString(raw.companyName || companyNameById(companies, companyId)),
    location: safeString(raw.location),
    startDate: safeString(raw.startDate),
    endDate: safeString(raw.endDate),
    current: Boolean(raw.current),
    summary: safeString(raw.summary),
    responsibilities: safeArray(raw.responsibilities),
    highlights: safeArray(raw.highlights || raw.responsibilities),
    platformIds: safeArray(raw.platformIds),
    status: safeString(raw.status || "active"),
    sortOrder: safeNumber(raw.sortOrder, 1000)
  };
}

export function sanitizeAssetCatalog(catalog = {}) {
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];
  return {
    portfolioThumbs: sanitizeAssetEntries(entries, "thumbnail"),
    portfolioImages: sanitizeAssetEntries(entries, "portfolio_image"),
    docs: sanitizeAssetEntries(entries, "document_pdf")
  };
}

async function loadRegistryBaselines(request, env) {
  const [companiesPayload, platformsPayload, positionsPayload, auditPayload] = await Promise.all([
    loadJsonAsset(request, env, COMPANIES_BASELINE_PATH, { meta: {}, companies: [] }, "companies"),
    loadJsonAsset(request, env, PLATFORMS_BASELINE_PATH, { meta: {}, platforms: [] }, "platforms"),
    loadJsonAsset(request, env, POSITIONS_BASELINE_PATH, { meta: {}, positions: [] }, "positions"),
    loadJsonAsset(request, env, SOURCE_AUDIT_PATH, {}, "audit")
  ]);
  const companies = Array.isArray(companiesPayload?.companies) ? companiesPayload.companies : [];
  const platforms = Array.isArray(platformsPayload?.platforms) ? platformsPayload.platforms : [];
  const positions = Array.isArray(positionsPayload?.positions) ? positionsPayload.positions : [];
  return {
    companies,
    platforms,
    positions,
    audit: auditPayload || {},
    clientOnlyIds: extractClientOnlyIds(auditPayload || {}),
    requiredCompanyIds: extractRequiredCompanyIds(auditPayload || {}, companies)
  };
}

async function loadJsonAsset(request, env, path, fallback, key) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return fallback;
  }
  try {
    const response = await env.ASSETS.fetch(new URL(path, request.url));
    if (!response.ok) return fallback;
    const parsed = await response.json();
    if (key === "projects") {
      return { meta: parsed?.meta || {}, projects: Array.isArray(parsed?.projects) ? parsed.projects : [] };
    }
    return parsed || fallback;
  } catch {
    return fallback;
  }
}

async function getKvValue(kv, key, warnings) {
  if (!kv || typeof kv.get !== "function") return null;
  try {
    return await kv.get(key);
  } catch {
    warnings.push(`${key.replace("cms:", "")}_kv_read_failed`);
    return null;
  }
}

function parseStoredValue(raw, warnings, collection) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion === "registry-overlay.v3") return parsed;
    return Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  } catch {
    warnings.push(`${collection}_stored_payload_invalid_baseline_used`);
    return [];
  }
}

function parseStoredCollection(raw, warnings, collection) {
  if (!raw) return { items: [], wrapper: null };
  try {
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [],
      wrapper: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
    };
  } catch {
    warnings.push(`${collection}_stored_payload_invalid_baseline_used`);
    return { items: [], wrapper: null };
  }
}

function mergeProjectsBaselineWithKv(baselinePayload, storedItems, storedWrapper = null) {
  const baseline = Array.isArray(baselinePayload?.projects) ? baselinePayload.projects : [];
  const baselineIds = new Set(baseline.map(projectIdentity).filter(Boolean));
  const hiddenBaselineIds = new Set(
    Array.isArray(storedWrapper?.hiddenBaselineIds)
      ? storedWrapper.hiddenBaselineIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean)
      : []
  );
  const kvById = new Map();
  const adminCreatedItems = [];
  for (const item of Array.isArray(storedItems) ? storedItems : []) {
    const id = projectIdentity(item);
    if (!id) continue;
    if (baselineIds.has(id)) {
      kvById.set(id, item);
    } else {
      adminCreatedItems.push({ ...item, baselineProtected: false, source: item?.source || "admin_created" });
    }
  }
  const mergedBaselineItems = baseline
    .filter((item) => !hiddenBaselineIds.has(projectIdentity(item)))
    .map((item) => {
      const overlay = kvById.get(projectIdentity(item)) || {};
      return {
        ...item,
        ...overlay,
        id: item.id,
        slug: item.slug,
        sourceFolder: item.sourceFolder,
        baselineProtected: true,
        baselineVersion: PROJECTS_BASELINE_VERSION,
        source: overlay.source || "public_baseline"
      };
    });
  return {
    items: [...mergedBaselineItems, ...adminCreatedItems],
    meta: {
      baselineCount: baseline.length,
      mergedCount: mergedBaselineItems.length + adminCreatedItems.length,
      adminCreatedCount: adminCreatedItems.length
    }
  };
}

function projectIdentity(row) {
  return String(row?.id || row?.slug || "").trim().toLowerCase();
}

function publicWarnings(result = {}) {
  return Array.isArray(result.meta?.warnings) ? result.meta.warnings : [];
}

function companyNameById(companies, id) {
  return companies.find((company) => company.id === id || company.slug === id)?.name || "";
}

function sanitizeAssetEntries(entries, type) {
  return entries
    .filter((entry) => entry?.type === type)
    .map((entry) => ({
      id: safeString(entry.id),
      type: safeString(entry.type),
      filename: safeString(entry.filename),
      path: safeAssetPath(entry.relativePath || entry.adminPreviewPath),
      label: safeString(entry.label),
      mime: safeString(entry.mime),
      sizeBytes: safeNumber(entry.sizeBytes, 0),
      updatedAt: safeString(entry.updatedAt || entry.sourceModifiedAt)
    }))
    .filter((entry) => entry.path);
}

function isActivePublic(raw) {
  const status = String(raw.status || "active").toLowerCase();
  const visibility = String(raw.visibility || "public").toLowerCase();
  return status !== "archived" && !["private", "draft", "internal", "hidden"].includes(visibility);
}

function removeInternalFields(value) {
  const cleaned = {};
  for (const [key, entry] of Object.entries(value || {})) {
    if (INTERNAL_KEYS.has(key) || /secret|token|password|session|account|overlay|kv/i.test(key)) continue;
    cleaned[key] = entry;
  }
  return cleaned;
}

function safeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeString(item)).filter(Boolean);
}

function safeString(value) {
  return String(value ?? "").trim();
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safePublicUrl(value) {
  const text = safeString(value);
  if (!text) return "";
  if (/^https:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return safeAssetPath(text);
  return "";
}

function safeAssetPath(value, options = {}) {
  const text = safeString(value);
  if (!text) return "";
  if (/^https:\/\//i.test(text)) return text;
  if (options.docsOnly && !text.startsWith("/docs/")) return "";
  if (SAFE_ASSET_PREFIXES.some((prefix) => text.startsWith(prefix))) return text;
  return "";
}

function safeProductImageUrl(value) {
  const text = safeString(value);
  if (!text) return "";
  if (/^https:\/\//i.test(text)) return text;
  return safeAssetPath(text);
}

function safeProductCategories(value) {
  const raw = Array.isArray(value) ? value : safeString(value).split(/[,;\n]/);
  const categories = raw
    .map((item) => {
      const label = safeString(item?.label || item?.name || item);
      const normalizedSlug = safeProductSlug(item?.slug || label);
      const slug = normalizedSlug === "all-products" ? "all" : normalizedSlug;
      if (!label || !slug) return null;
      return { label: slug === "all" ? "All Products" : label, slug, source: safeString(item?.source || (slug === "all" ? "system" : "admin")) };
    })
    .filter(Boolean);
  if (!categories.some((item) => item.slug === "all")) categories.unshift({ label: "All Products", slug: "all", source: "system", enabled: true, locked: true });
  return categories;
}

function safeProductCategorySettings(value) {
  const raw = Array.isArray(value) ? value : [];
  const map = new Map();
  map.set("all", { label: "All Products", slug: "all", source: "system", enabled: true, locked: true, sortOrder: 0 });
  raw.forEach((item, index) => {
    const label = safeString(item?.label || item?.name || item?.slug);
    const normalizedSlug = safeProductSlug(item?.slug || label);
    const slug = normalizedSlug === "all-products" ? "all" : normalizedSlug;
    if (!slug) return;
    if (slug === "all") {
      map.set("all", { label: "All Products", slug: "all", source: "system", enabled: true, locked: true, sortOrder: 0 });
      return;
    }
    if (!map.has(slug)) {
      map.set(slug, {
        label: label || slug,
        slug,
        source: ["system", "printful", "admin"].includes(safeString(item?.source)) ? safeString(item.source) : "admin",
        enabled: item?.enabled !== false,
        sortOrder: safeNumber(item?.sortOrder, index + 1),
        description: safeString(item?.description)
      });
    }
  });
  return Array.from(map.values()).sort((left, right) => (left.sortOrder || 1000) - (right.sortOrder || 1000) || left.label.localeCompare(right.label));
}

function safeProductBanners(value) {
  const raw = Array.isArray(value) ? value : safeString(value).split(/[,;\n]/);
  return raw.map((item, index) => safeBannerRecord(item, index)).filter(Boolean);
}

function safeProductBannerSettings(value) {
  const raw = Array.isArray(value) ? value : [];
  const map = new Map();
  raw.forEach((item, index) => {
    const banner = safeBannerRecord(item, index);
    if (banner && !map.has(banner.slug)) map.set(banner.slug, banner);
  });
  return Array.from(map.values()).sort((left, right) => (left.sortOrder || 1000) - (right.sortOrder || 1000) || left.label.localeCompare(right.label));
}

function safeBannerRecord(item, index = 0) {
  const label = safeString(item?.label || item?.name || item).toUpperCase();
  const slug = safeProductSlug(item?.slug || label);
  if (!label || !slug) return null;
  const theme = safeString(item?.theme || item?.style || "purple-orange");
  return {
    label,
    slug,
    enabled: item?.enabled !== false,
    sortOrder: safeNumber(item?.sortOrder, index + 1),
    theme: ["purple-orange", "red", "gold", "silver", "green", "neutral"].includes(theme) ? theme : "purple-orange"
  };
}

function safeHeroSlides(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item, index) => {
      const id = safeSlug(item?.id || item?.filename || item?.label || item?.src || `shophero-${index}`);
      const src = safeProductImageUrl(item?.src || item?.url || item?.path);
      if (!id && !src) return null;
      const source = safeString(item?.source || (src.startsWith("https://") ? "r2" : "static"));
      return {
        id,
        label: safeString(item?.label || item?.name || item?.filename || id),
        src,
        enabled: item?.enabled !== false,
        sortOrder: safeNumber(item?.sortOrder, index + 1),
        source: ["static", "r2", "admin"].includes(source) ? source : "static",
        set: safeSlug(item?.set || item?.activeSet || "default") || "default"
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.sortOrder || 1000) - (right.sortOrder || 1000) || left.label.localeCompare(right.label));
}

function safeCurrency(value) {
  const code = safeString(value).toUpperCase();
  return ["USD", "CAD", "NZD", "GBP", "EUR", "JPY", "CHF", "SGD", "HKD", "KRW"].includes(code) ? code : "USD";
}

function safeClampedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function safeProductSlug(value) {
  return safeString(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeSlug(value) {
  return safeProductSlug(value);
}

export function collectionCounts(payload = {}) {
  const collections = payload.collections || {};
  const assets = payload.assets || {};
  return {
    projects: Array.isArray(collections.projects) ? collections.projects.length : 0,
    products: Array.isArray(collections.products) ? collections.products.length : 0,
    companies: Array.isArray(collections.companies) ? collections.companies.length : 0,
    platforms: Array.isArray(collections.platforms) ? collections.platforms.length : 0,
    positions: Array.isArray(collections.positions) ? collections.positions.length : 0,
    assets:
      (Array.isArray(assets.portfolioThumbs) ? assets.portfolioThumbs.length : 0) +
      (Array.isArray(assets.portfolioImages) ? assets.portfolioImages.length : 0) +
      (Array.isArray(assets.docs) ? assets.docs.length : 0)
  };
}

async function publicSiteDataRevision(payload) {
  const stable = stableJson(payload, new Set(["generatedAt", "revision"]));
  const bytes = new TextEncoder().encode(stable);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return `rev-${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16)}`;
  }
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `rev-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableJson(value, omitKeys = new Set()) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item, omitKeys)).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value)
    .filter((key) => !omitKeys.has(key))
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key], omitKeys)}`)
    .join(",")}}`;
}
