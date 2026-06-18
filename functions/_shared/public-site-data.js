import {
  extractClientOnlyIds,
  extractRequiredCompanyIds,
  normalizePositionRegistryItem,
  reconcilePositionsCollection,
  reconcileRegistryCollection
} from "./registry-reconciliation.js";

const COLLECTIONS = {
  projects: { key: "cms:projects" },
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

const SAFE_ASSET_PREFIXES = ["/media/portfolio/thumbs/", "/media/portfolio/", "/docs/"];
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

export async function buildPublicSiteData(context) {
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
  const [projectsRaw, companiesRaw, platformsRaw, positionsRaw] = await Promise.all([
    getKvValue(kv, COLLECTIONS.projects.key, warnings),
    getKvValue(kv, COLLECTIONS.companies.key, warnings),
    getKvValue(kv, COLLECTIONS.platforms.key, warnings),
    getKvValue(kv, COLLECTIONS.positions.key, warnings)
  ]);

  const projectsStored = parseStoredCollection(projectsRaw, warnings, "projects");
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

  return {
    ok: true,
    schemaVersion: "danielclancy-public-site-data.v1",
    generatedAt,
    source: storageConfigured ? "admin_kv_reconciled" : "admin_baseline_reconciled",
    collections: {
      projects: projectsResult.items.map((item) => sanitizeProject(item)).filter(Boolean),
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
