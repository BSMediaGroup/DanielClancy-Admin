export const REGISTRY_SCHEMA_VERSION = "registry-overlay.v3";
export const LEGACY_REGISTRY_SCHEMA_VERSION = "danielclancy-admin.registries.v2";

const IDENTITY_FIELDS = new Set(["id", "slug"]);
const INTERNAL_FIELDS = new Set([
  "source",
  "sourceRequired",
  "registryOrigin",
  "registrySourceType",
  "overlayStatus",
  "exclusionReason",
  "updatedBy"
]);

export function createRegistrySlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function arrayFromRegistryValue(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return String(value)
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeRegistryItem(raw = {}) {
  const name = String(raw.name || raw.label || raw.id || "").trim();
  const id = createRegistrySlug(raw.id || raw.slug || name);
  return {
    ...raw,
    id,
    slug: createRegistrySlug(raw.slug || id),
    name: name || id,
    logoPath: String(raw.logoPath || ""),
    location: String(raw.location || ""),
    company: String(raw.company || raw.vendor || ""),
    vendor: String(raw.vendor || raw.company || ""),
    website: String(raw.website || ""),
    description: String(raw.description || raw.details || ""),
    details: String(raw.details || raw.description || ""),
    status: normalizeStatus(raw.status),
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 1000,
    sourceNotes: String(raw.sourceNotes || raw.source || ""),
    source: String(raw.source || raw.sourceNotes || "public_cv_source"),
    updatedAt: String(raw.updatedAt || new Date().toISOString())
  };
}

export function normalizePositionRegistryItem(raw = {}, companyLabelResolver = () => "") {
  const title = String(raw.title || raw.role || raw.id || "").trim();
  const companyId = createRegistrySlug(raw.companyId || raw.company || raw.companyName || "");
  const companyName = String(raw.companyName || companyLabelResolver(companyId) || raw.company || "").trim();
  return {
    ...raw,
    id: createRegistrySlug(raw.id || raw.slug || `${companyName}-${title}`),
    slug: createRegistrySlug(raw.slug || raw.id || `${companyName}-${title}`),
    title: title || "Untitled position",
    companyId,
    companyName,
    location: String(raw.location || ""),
    startDate: String(raw.startDate || ""),
    endDate: String(raw.endDate || ""),
    current: Boolean(raw.current),
    employmentType: String(raw.employmentType || ""),
    summary: String(raw.summary || ""),
    responsibilities: arrayFromRegistryValue(raw.responsibilities || raw.highlights || []),
    highlights: arrayFromRegistryValue(raw.highlights || raw.responsibilities || []),
    platformIds: arrayFromRegistryValue(raw.platformIds || raw.technologies || raw.software || []).map(createRegistrySlug),
    status: normalizeStatus(raw.status),
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 1000,
    source: String(raw.source || "public_cv_source"),
    updatedAt: String(raw.updatedAt || new Date().toISOString())
  };
}

export function extractClientOnlyIds(audit = {}) {
  return new Set(
    [
      ...(audit.clientOnlyOrganizationIds || []),
      ...(audit.clientsExcludedFromCompanies || []).map((item) => item.normalizedId || item.id || item.slug || item.name)
    ]
      .map(createRegistrySlug)
      .filter(Boolean)
  );
}

export function extractRequiredCompanyIds(audit = {}, baselineCompanies = []) {
  return new Set(
    [
      ...baselineCompanies.map((item) => item.id || item.slug || item.name),
      ...(audit.employersFound || []).map((item) => item.normalizedId || item.id || item.slug || item.normalizedName),
      ...(audit.studiosFound || []).map((item) => item.normalizedId || item.id || item.slug || item.normalizedName),
      ...(audit.companiesPromotedToRegistry || []).map((item) => item.normalizedId || item.id || item.slug || item.name)
    ]
      .map(createRegistrySlug)
      .filter(Boolean)
  );
}

export function unpackRegistryStorage(value) {
  const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
  if (isOverlayPayload(parsed)) {
    return {
      overlay: normalizeOverlay(parsed.collection || "", parsed),
      items: [],
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      migratedFromLegacy: false,
      wrapper: parsed
    };
  }
  if (Array.isArray(parsed)) {
    return { overlay: null, items: parsed, schemaVersion: "", migratedFromLegacy: parsed.length > 0, wrapper: null };
  }
  if (parsed && typeof parsed === "object") {
    return {
      overlay: null,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      schemaVersion: String(parsed.schemaVersion || ""),
      migratedFromLegacy: parsed.schemaVersion !== REGISTRY_SCHEMA_VERSION,
      wrapper: parsed
    };
  }
  return { overlay: null, items: [], schemaVersion: "", migratedFromLegacy: false, wrapper: null };
}

export function registryStoragePayload(collection, rowsOrOverlay, reconciliation = {}, options = {}) {
  const baselineItems = options.baselineItems || options.baseline || [];
  if (isOverlayPayload(rowsOrOverlay)) {
    return normalizeOverlay(collection, rowsOrOverlay, reconciliation);
  }
  if (baselineItems.length) {
    const overlay = rowsToRegistryOverlay(collection, rowsOrOverlay || [], baselineItems, options);
    if (Array.isArray(reconciliation.excludedRows) && reconciliation.excludedRows.length) {
      const byId = new Map(overlay.excludedRows.map((item) => [createRegistrySlug(item.id || item.slug || item.name || item.title), item]));
      for (const item of reconciliation.excludedRows) {
        const id = createRegistrySlug(item.id || item.slug || item.name || item.title);
        if (id && !byId.has(id)) byId.set(id, { ...item, id });
      }
      overlay.excludedRows = Array.from(byId.values());
    }
    return overlay;
  }
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    collection,
    updatedAt: new Date().toISOString(),
    overrides: {},
    customRows: (rowsOrOverlay || []).filter((item) => !isSourceDerivedRow(item)).map((item) => ({ ...item, source: item.source || "admin_created" })),
    deletedCustomIds: [],
    excludedRows: reconciliation.excludedRows || []
  };
}

export function rowsToRegistryOverlay(collection, rows = [], baselineItems = [], options = {}) {
  return migrateRegistryOverlay(collection, rows, baselineItems, options).overlay;
}

export function migrateRegistryOverlay(collection, storedValue, baselineItems = [], options = {}) {
  const unpacked = unpackRegistryStorageSafe(storedValue);
  if (unpacked.overlay) {
    const overlay = normalizeOverlay(collection, unpacked.overlay);
    const migrated = applyOverlayRules(collection, overlay, baselineItems, options);
    return {
      overlay: migrated.overlay,
      meta: {
        ...summarizeOverlay(migrated.overlay),
        migratedFromLegacy: false,
        warnings: migrated.warnings,
        excludedRows: migrated.overlay.excludedRows,
        staleRowsExcluded: migrated.overlay.excludedRows.length
      }
    };
  }
  const sourceRows = Array.isArray(storedValue) ? storedValue : unpacked.items;
  const baseline = normalizeBaseline(collection, baselineItems, options.companyLabelResolver);
  const baselineById = new Map(baseline.map((item) => [item.id, item]));
  const baselineAliases = baselineAliasMap(baseline);
  const clientOnlyIds = options.clientOnlyIds || new Set();
  const requiredIds = options.requiredIds || new Set(baseline.map((item) => item.id));
  const overlay = emptyOverlay(collection);
  const warnings = [];
  const seen = new Map();

  for (const rawRow of sourceRows || []) {
    const row = normalizeCollectionRow(collection, rawRow, options.companyLabelResolver);
    if (!row.id) continue;
    const identity = duplicateIdentity(row);
    const previous = seen.get(identity);
    if (previous && newerRow(previous, row) !== row) {
      warnings.push(`Duplicate ${collection} row ${identity} ignored in v3 migration; kept newer row.`);
      continue;
    }
    if (previous) {
      warnings.push(`Duplicate ${collection} row ${identity} replaced in v3 migration; kept newer row.`);
    }
    seen.set(identity, row);
  }

  for (const row of seen.values()) {
    const rowId = createRegistrySlug(row.id || row.slug || row.name || row.title);
    if (collection === "companies" && clientOnlyIds.has(rowId)) {
      overlay.excludedRows.push({ id: rowId, reason: "client_only_source_exclusion", row });
      continue;
    }
    const baselineId = baselineAliases.get(rowId) || baselineAliases.get(createRegistrySlug(row.slug)) || baselineAliases.get(createRegistrySlug(row.name || row.title));
    if (baselineId && baselineById.has(baselineId)) {
      const baselineRow = baselineById.get(baselineId);
      const patch = diffPatch(collection, baselineRow, row);
      const statusOverride = requiredIds.has(baselineId) ? null : statusDiff(baselineRow, row);
      if (requiredIds.has(baselineId) && row.status === "archived") {
        warnings.push(`Source-required ${collection} row ${baselineId} cannot be archived during migration.`);
      }
      if (Object.keys(patch).length || statusOverride) {
        overlay.overrides[baselineId] = {
          id: baselineId,
          patch,
          statusOverride,
          updatedAt: row.updatedAt || new Date().toISOString(),
          updatedBy: row.updatedBy || options.updatedBy || "admin"
        };
      }
      continue;
    }
    if (collection === "companies" && isClientOnlyName(row, clientOnlyIds)) {
      overlay.excludedRows.push({ id: rowId, reason: "client_only_source_exclusion", row });
      continue;
    }
    overlay.customRows.push({ ...row, source: row.source === "public_cv_source" ? "admin_created" : row.source || "admin_created" });
  }

  const cleaned = applyOverlayRules(collection, overlay, baselineItems, options);
  return {
    overlay: cleaned.overlay,
    meta: {
      ...summarizeOverlay(cleaned.overlay),
      migratedFromLegacy: Boolean(unpacked.migratedFromLegacy || sourceRows?.length),
      warnings: [...warnings, ...cleaned.warnings],
      excludedRows: cleaned.overlay.excludedRows,
      staleRowsExcluded: cleaned.overlay.excludedRows.length
    }
  };
}

export function reconcileRegistryCollection(collection, baselineItems = [], storedValue = [], options = {}) {
  const baseline = normalizeBaseline(collection, baselineItems, options.companyLabelResolver);
  const requiredIds = options.requiredIds || new Set(baseline.map((item) => item.id));
  const migrated = migrateRegistryOverlay(collection, storedValue, baseline, options);
  const overlay = migrated.overlay;
  const itemsById = new Map();
  const restoredRows = [];
  const warnings = [...(migrated.meta.warnings || [])];

  for (const row of baseline) {
    const override = overlay.overrides[row.id] || null;
    const patched = {
      ...row,
      ...(override?.patch || {}),
      id: row.id,
      slug: row.slug,
      status: requiredIds.has(row.id) ? "active" : override?.statusOverride || row.status,
      source: row.source || "public_cv_source",
      registryOrigin: override ? "source_override" : "source_baseline",
      registrySourceType: "source",
      sourceRequired: requiredIds.has(row.id),
      updatedAt: override?.updatedAt || row.updatedAt
    };
    itemsById.set(row.id, patched);
  }

  for (const row of overlay.customRows) {
    const normalized = normalizeCollectionRow(collection, row, options.companyLabelResolver);
    if (!normalized.id || overlay.deletedCustomIds.includes(normalized.id)) continue;
    if (collection === "companies" && (options.clientOnlyIds || new Set()).has(normalized.id)) {
      continue;
    }
    if (itemsById.has(normalized.id)) {
      warnings.push(`Custom ${collection} row ${normalized.id} duplicates a source baseline row and was not added.`);
      continue;
    }
    itemsById.set(normalized.id, { ...normalized, source: normalized.source || "admin_created", registryOrigin: "custom", registrySourceType: "custom" });
  }

  for (const requiredId of requiredIds) {
    if (!itemsById.has(requiredId)) {
      const baselineRow = baseline.find((item) => item.id === requiredId || item.slug === requiredId);
      if (baselineRow) {
        const restored = { ...baselineRow, status: "active", sourceRequired: true, registryOrigin: "source_baseline", registrySourceType: "source" };
        itemsById.set(requiredId, restored);
        restoredRows.push(restored);
      }
    }
  }

  const items = Array.from(itemsById.values()).sort(compareRegistryItems);
  return {
    items,
    overlay,
    meta: {
      reconciled: true,
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      overlaySchemaVersion: REGISTRY_SCHEMA_VERSION,
      storageSource: "registry_overlay_v3",
      staleRowsExcluded: overlay.excludedRows.length,
      sourceRequiredRowsRestored: restoredRows.length,
      excludedRows: overlay.excludedRows,
      restoredRows,
      sourceRequiredRowsRestoredRows: restoredRows,
      warnings,
      overlaySummary: summarizeOverlay(overlay),
      overridesCount: Object.keys(overlay.overrides).length,
      customRowsCount: overlay.customRows.length,
      excludedRowsCount: overlay.excludedRows.length
    }
  };
}

export function reconcilePositionsCollection(baselinePositions = [], storedValue = [], companies = [], companyLabelResolver = () => "") {
  const companyIds = new Set(companies.filter((item) => item.status !== "archived").map((item) => item.id || item.slug).filter(Boolean));
  const baseline = baselinePositions.map((item) => normalizePositionRegistryItem(item, companyLabelResolver)).filter((item) => item.id);
  const migrated = migrateRegistryOverlay("positions", storedValue, baseline, { companyLabelResolver });
  const overlay = migrated.overlay;
  const itemsById = new Map();
  const warnings = [...(migrated.meta.warnings || [])];

  for (const row of baseline) {
    const override = overlay.overrides[row.id] || null;
    const patched = {
      ...row,
      ...(override?.patch || {}),
      id: row.id,
      slug: row.slug,
      status: override?.statusOverride || row.status,
      registryOrigin: override ? "source_override" : "source_baseline",
      registrySourceType: "source",
      updatedAt: override?.updatedAt || row.updatedAt
    };
    if (!companyIds.has(patched.companyId)) {
      warnings.push(`Source position ${patched.id} references missing company ${patched.companyId || patched.companyName || "unknown"}.`);
    }
    itemsById.set(row.id, patched);
  }

  for (const row of overlay.customRows) {
    const normalized = normalizePositionRegistryItem(row, companyLabelResolver);
    if (!normalized.id || overlay.deletedCustomIds.includes(normalized.id)) continue;
    if (itemsById.has(normalized.id)) {
      warnings.push(`Custom position ${normalized.id} duplicates a source baseline row and was not added.`);
      continue;
    }
    if (!companyIds.has(normalized.companyId)) {
      warnings.push(`Position ${normalized.id} references missing company ${normalized.companyId || normalized.companyName || "unknown"}.`);
    }
    itemsById.set(normalized.id, { ...normalized, source: normalized.source || "admin_created", registryOrigin: "custom", registrySourceType: "custom" });
  }

  const items = Array.from(itemsById.values()).sort(compareRegistryItems);
  return {
    items,
    overlay,
    meta: {
      reconciled: true,
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      overlaySchemaVersion: REGISTRY_SCHEMA_VERSION,
      storageSource: "registry_overlay_v3",
      staleRowsExcluded: overlay.excludedRows.length,
      sourceRequiredRowsRestored: 0,
      excludedRows: overlay.excludedRows,
      restoredRows: [],
      warnings,
      overlaySummary: summarizeOverlay(overlay),
      overridesCount: Object.keys(overlay.overrides).length,
      customRowsCount: overlay.customRows.length,
      excludedRowsCount: overlay.excludedRows.length
    }
  };
}

export function summarizeReconciliation(reconciliation = {}) {
  const overlaySummary = reconciliation.overlaySummary || {};
  return {
    staleRowsExcluded: Number(reconciliation.staleRowsExcluded || reconciliation.excludedRows?.length || 0),
    sourceRequiredRowsRestored: Number(reconciliation.sourceRequiredRowsRestored || reconciliation.restoredRows?.length || 0),
    localDataRepaired: Boolean(reconciliation.localDataRepaired || reconciliation.migratedFromLegacy),
    warnings: Array.isArray(reconciliation.warnings) ? reconciliation.warnings : [],
    overridesCount: Number(reconciliation.overridesCount || overlaySummary.overridesCount || 0),
    customRowsCount: Number(reconciliation.customRowsCount || overlaySummary.customRowsCount || 0),
    excludedRowsCount: Number(reconciliation.excludedRowsCount || overlaySummary.excludedRowsCount || 0)
  };
}

export function summarizeOverlay(overlay = {}) {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    overridesCount: Object.keys(overlay.overrides || {}).length,
    customRowsCount: Array.isArray(overlay.customRows) ? overlay.customRows.length : 0,
    deletedCustomIdsCount: Array.isArray(overlay.deletedCustomIds) ? overlay.deletedCustomIds.length : 0,
    excludedRowsCount: Array.isArray(overlay.excludedRows) ? overlay.excludedRows.length : 0,
    updatedAt: overlay.updatedAt || null
  };
}

export function compareRegistryItems(left, right) {
  return (Number(left.sortOrder) || 1000) - (Number(right.sortOrder) || 1000) || String(left.name || left.title || "").localeCompare(String(right.name || right.title || ""));
}

function emptyOverlay(collection) {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    collection,
    updatedAt: new Date().toISOString(),
    overrides: {},
    customRows: [],
    deletedCustomIds: [],
    excludedRows: []
  };
}

function isOverlayPayload(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && value.schemaVersion === REGISTRY_SCHEMA_VERSION);
}

function normalizeOverlay(collection, raw = {}) {
  const overlay = emptyOverlay(collection || raw.collection || "");
  const rawOverrides = raw.overrides && typeof raw.overrides === "object" && !Array.isArray(raw.overrides) ? raw.overrides : {};
  for (const [rawId, value] of Object.entries(rawOverrides)) {
    const id = createRegistrySlug(value?.id || rawId);
    if (!id) continue;
    overlay.overrides[id] = {
      id,
      patch: sanitizePatch(value?.patch || {}),
      statusOverride: value?.statusOverride ? normalizeStatus(value.statusOverride) : null,
      updatedAt: String(value?.updatedAt || raw.updatedAt || new Date().toISOString()),
      updatedBy: String(value?.updatedBy || "")
    };
  }
  overlay.customRows = Array.isArray(raw.customRows) ? raw.customRows.filter((item) => item && typeof item === "object").map((item) => ({ ...item })) : [];
  overlay.deletedCustomIds = Array.isArray(raw.deletedCustomIds) ? raw.deletedCustomIds.map(createRegistrySlug).filter(Boolean) : [];
  overlay.excludedRows = Array.isArray(raw.excludedRows) ? raw.excludedRows.filter((item) => item && typeof item === "object").map((item) => ({ ...item, id: createRegistrySlug(item.id || item.slug || item.name || item.title) })) : [];
  overlay.updatedAt = String(raw.updatedAt || new Date().toISOString());
  return overlay;
}

function unpackRegistryStorageSafe(value) {
  try {
    return unpackRegistryStorage(value);
  } catch {
    return { overlay: null, items: [], schemaVersion: "", migratedFromLegacy: true, wrapper: null };
  }
}

function normalizeBaseline(collection, baselineItems, companyLabelResolver) {
  return (baselineItems || []).map((item) => normalizeCollectionRow(collection, { ...item, source: item.source || "public_cv_source" }, companyLabelResolver)).filter((item) => item.id);
}

function normalizeCollectionRow(collection, row, companyLabelResolver) {
  return collection === "positions" ? normalizePositionRegistryItem(row, companyLabelResolver) : normalizeRegistryItem(row);
}

function duplicateIdentity(row) {
  return createRegistrySlug(row.id || row.slug || row.name || row.title);
}

function newerRow(left, right) {
  const leftTime = Date.parse(left.updatedAt || "");
  const rightTime = Date.parse(right.updatedAt || "");
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return rightTime >= leftTime ? right : left;
  return right;
}

function baselineAliasMap(baseline) {
  const aliases = new Map();
  for (const item of baseline) {
    [item.id, item.slug, item.name, item.title, ...(Array.isArray(item.aliases) ? item.aliases : [])]
      .map(createRegistrySlug)
      .filter(Boolean)
      .forEach((alias) => aliases.set(alias, item.id));
  }
  return aliases;
}

function normalizeStatus(value) {
  return String(value || "active").toLowerCase() === "archived" ? "archived" : "active";
}

function statusDiff(baseline, row) {
  const baselineStatus = normalizeStatus(baseline.status);
  const rowStatus = normalizeStatus(row.status);
  return baselineStatus === rowStatus ? null : rowStatus;
}

function sanitizePatch(raw) {
  const patch = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (IDENTITY_FIELDS.has(key) || INTERNAL_FIELDS.has(key)) continue;
    patch[key] = value;
  }
  return patch;
}

function diffPatch(collection, baseline, row) {
  const patch = {};
  const normalizedRow = normalizeCollectionRow(collection, row);
  const keys = new Set([...Object.keys(normalizedRow), ...Object.keys(baseline)]);
  for (const key of keys) {
    if (IDENTITY_FIELDS.has(key) || INTERNAL_FIELDS.has(key) || key === "status" || key === "updatedAt") continue;
    if (collection !== "positions" && key === "company") continue;
    const left = comparableValue(baseline[key]);
    const right = comparableValue(normalizedRow[key]);
    if (left !== right) {
      patch[key] = normalizedRow[key];
    }
  }
  return patch;
}

function comparableValue(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => String(item)));
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function isSourceDerivedRow(row) {
  return row?.registrySourceType === "source" || row?.registryOrigin === "source_baseline" || row?.registryOrigin === "source_override" || row?.source === "public_cv_source" || Boolean(row?.provenance || row?.sourceNotes || row?.classificationSource);
}

function applyOverlayRules(collection, rawOverlay, baselineItems, options = {}) {
  const overlay = normalizeOverlay(collection, rawOverlay);
  const baseline = normalizeBaseline(collection, baselineItems, options.companyLabelResolver);
  const aliases = baselineAliasMap(baseline);
  const baselineIds = new Set(baseline.map((item) => item.id));
  const requiredIds = options.requiredIds || new Set();
  const clientOnlyIds = options.clientOnlyIds || new Set();
  const warnings = [];

  overlay.excludedRows = overlay.excludedRows.map((item) => ({ ...item, id: createRegistrySlug(item.id || item.slug || item.name || item.title) })).filter((item) => item.id);

  for (const [id, override] of Object.entries({ ...overlay.overrides })) {
    const baselineId = aliases.get(id) || id;
    if (!baselineIds.has(baselineId)) {
      delete overlay.overrides[id];
      warnings.push(`Override ${id} has no source baseline row and was ignored.`);
      continue;
    }
    if (baselineId !== id) {
      overlay.overrides[baselineId] = { ...override, id: baselineId };
      delete overlay.overrides[id];
    }
    if (requiredIds.has(baselineId) && overlay.overrides[baselineId].statusOverride === "archived") {
      overlay.overrides[baselineId].statusOverride = null;
      warnings.push(`Source-required ${collection} row ${baselineId} cannot be archived.`);
    }
  }

  const customById = new Map();
  for (const rawRow of overlay.customRows) {
    const row = normalizeCollectionRow(collection, rawRow, options.companyLabelResolver);
    if (!row.id) continue;
    if (collection === "companies" && clientOnlyIds.has(row.id)) {
      overlay.excludedRows.push({ id: row.id, reason: "client_only_source_exclusion", row });
      continue;
    }
    const baselineId = aliases.get(row.id) || aliases.get(createRegistrySlug(row.slug)) || aliases.get(createRegistrySlug(row.name || row.title));
    if (baselineId) {
      const baselineRow = baseline.find((item) => item.id === baselineId);
      const patch = diffPatch(collection, baselineRow, row);
      const statusOverride = requiredIds.has(baselineId) ? null : statusDiff(baselineRow, row);
      if (Object.keys(patch).length || statusOverride) {
        overlay.overrides[baselineId] = {
          id: baselineId,
          patch,
          statusOverride,
          updatedAt: row.updatedAt || new Date().toISOString(),
          updatedBy: row.updatedBy || options.updatedBy || ""
        };
      }
      warnings.push(`Custom ${collection} row ${row.id} matched source baseline ${baselineId} and was converted to an override.`);
      continue;
    }
    const previous = customById.get(row.id);
    if (previous) {
      customById.set(row.id, newerRow(previous, row));
      warnings.push(`Duplicate custom ${collection} row ${row.id} was deduplicated.`);
    } else {
      customById.set(row.id, { ...row, source: row.source === "public_cv_source" ? "admin_created" : row.source || "admin_created" });
    }
  }
  overlay.customRows = Array.from(customById.values()).sort(compareRegistryItems);
  overlay.deletedCustomIds = Array.from(new Set(overlay.deletedCustomIds.map(createRegistrySlug).filter(Boolean)));
  return { overlay, warnings };
}

function isClientOnlyName(row, clientOnlyIds) {
  return [row.id, row.slug, row.name, row.title].map(createRegistrySlug).some((value) => clientOnlyIds.has(value));
}
