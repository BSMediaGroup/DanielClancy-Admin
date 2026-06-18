export const REGISTRY_SCHEMA_VERSION = "danielclancy-admin.registries.v2";

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
    status: String(raw.status || "active").toLowerCase() === "archived" ? "archived" : "active",
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
    status: String(raw.status || "active").toLowerCase() === "archived" ? "archived" : "active",
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 1000,
    source: String(raw.source || "public_cv_source"),
    updatedAt: String(raw.updatedAt || new Date().toISOString())
  };
}

export function unpackRegistryStorage(value) {
  const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
  if (Array.isArray(parsed)) {
    return { items: parsed, schemaVersion: "", migratedFromLegacy: parsed.length > 0, wrapper: null };
  }
  if (parsed && typeof parsed === "object") {
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      schemaVersion: String(parsed.schemaVersion || ""),
      migratedFromLegacy: parsed.schemaVersion !== REGISTRY_SCHEMA_VERSION,
      wrapper: parsed
    };
  }
  return { items: [], schemaVersion: "", migratedFromLegacy: false, wrapper: null };
}

export function registryStoragePayload(collection, items, reconciliation = {}) {
  return {
    collection,
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    reconciled: true,
    updatedAt: new Date().toISOString(),
    reconciliation: summarizeReconciliation(reconciliation),
    items
  };
}

export function summarizeReconciliation(reconciliation = {}) {
  return {
    staleRowsExcluded: Number(reconciliation.staleRowsExcluded || reconciliation.excludedRows?.length || 0),
    sourceRequiredRowsRestored: Number(reconciliation.sourceRequiredRowsRestored || reconciliation.restoredRows?.length || 0),
    localDataRepaired: Boolean(reconciliation.localDataRepaired),
    warnings: Array.isArray(reconciliation.warnings) ? reconciliation.warnings : []
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

export function reconcileRegistryCollection(collection, baselineItems = [], storedItems = [], options = {}) {
  const clientOnlyIds = options.clientOnlyIds || new Set();
  const requiredIds = options.requiredIds || new Set(baselineItems.map((item) => createRegistrySlug(item.id || item.slug || item.name)).filter(Boolean));
  const baseline = baselineItems.map((item) => normalizeRegistryItem({ ...item, source: item.source || "public_cv_source" })).filter((item) => item.id);
  const stored = storedItems.map(normalizeRegistryItem).filter((item) => item.id);
  const byId = new Map();
  const excludedRows = [];
  const restoredRows = [];
  const warnings = [];

  for (const item of baseline) {
    byId.set(item.id, {
      ...item,
      status: requiredIds.has(item.id) ? "active" : item.status,
      sourceRequired: requiredIds.has(item.id)
    });
  }

  for (const item of stored) {
    const id = createRegistrySlug(item.id || item.slug || item.name);
    if (collection === "companies" && clientOnlyIds.has(id)) {
      excludedRows.push({ ...item, status: "excluded", exclusionReason: "client_only_source_audit" });
      continue;
    }

    const baselineItem = byId.get(id);
    if (baselineItem) {
      byId.set(id, {
        ...baselineItem,
        ...item,
        id: baselineItem.id,
        slug: baselineItem.slug,
        name: baselineItem.name,
        classificationSource: baselineItem.classificationSource || item.classificationSource,
        provenance: baselineItem.provenance || item.provenance,
        sourceNotes: baselineItem.sourceNotes || item.sourceNotes,
        source: item.source || baselineItem.source,
        status: requiredIds.has(id) ? "active" : item.status
      });
    } else {
      byId.set(id, {
        ...item,
        source: item.source || "admin_created"
      });
    }
  }

  for (const requiredId of requiredIds) {
    if (!byId.has(requiredId)) {
      const baselineItem = baseline.find((item) => item.id === requiredId || item.slug === requiredId);
      if (baselineItem) {
        byId.set(requiredId, { ...baselineItem, status: "active", sourceRequired: true });
        restoredRows.push(baselineItem);
      }
    }
  }

  if (excludedRows.length) {
    warnings.push(`${excludedRows.length} stale/client-only row(s) excluded from ${collection}.`);
  }
  if (restoredRows.length) {
    warnings.push(`${restoredRows.length} source-required row(s) restored to ${collection}.`);
  }

  const items = Array.from(byId.values()).sort(compareRegistryItems);
  return {
    items,
    meta: {
      reconciled: true,
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      staleRowsExcluded: excludedRows.length,
      sourceRequiredRowsRestored: restoredRows.length,
      excludedRows,
      restoredRows,
      warnings
    }
  };
}

export function reconcilePositionsCollection(baselinePositions = [], storedPositions = [], companies = [], companyLabelResolver = () => "") {
  const companyIds = new Set(companies.map((item) => item.id || item.slug).filter(Boolean));
  const baseline = baselinePositions.map((item) => normalizePositionRegistryItem(item, companyLabelResolver)).filter((item) => item.id);
  const stored = storedPositions.map((item) => normalizePositionRegistryItem(item, companyLabelResolver)).filter((item) => item.id);
  const byId = new Map(baseline.map((item) => [item.id, item]));
  const warnings = [];

  for (const item of stored) {
    if (!companyIds.has(item.companyId)) {
      warnings.push(`Position ${item.id} references missing company ${item.companyId || item.companyName || "unknown"}.`);
      continue;
    }
    byId.set(item.id, {
      ...(byId.get(item.id) || {}),
      ...item
    });
  }

  for (const item of baseline) {
    if (!companyIds.has(item.companyId)) {
      warnings.push(`Source position ${item.id} references missing company ${item.companyId || item.companyName || "unknown"}.`);
    }
    if (!byId.has(item.id)) byId.set(item.id, item);
  }

  const items = Array.from(byId.values()).sort(compareRegistryItems);
  return {
    items,
    meta: {
      reconciled: true,
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      staleRowsExcluded: stored.length - items.filter((item) => stored.some((storedItem) => storedItem.id === item.id)).length,
      sourceRequiredRowsRestored: baseline.filter((item) => !stored.some((storedItem) => storedItem.id === item.id)).length,
      warnings
    }
  };
}

export function compareRegistryItems(left, right) {
  return (Number(left.sortOrder) || 1000) - (Number(right.sortOrder) || 1000) || String(left.name || left.title || "").localeCompare(String(right.name || right.title || ""));
}
