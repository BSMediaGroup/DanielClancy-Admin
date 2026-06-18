import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractClientOnlyIds,
  extractRequiredCompanyIds,
  normalizePositionRegistryItem,
  reconcilePositionsCollection,
  reconcileRegistryCollection,
  registryStoragePayload
} from "../functions/_shared/registry-reconciliation.js";

const audit = JSON.parse(readFileSync(new URL("../assets/data/source-audit-report.json", import.meta.url), "utf8"));
const companies = JSON.parse(readFileSync(new URL("../assets/data/admin-companies-baseline.json", import.meta.url), "utf8")).companies;
const platforms = JSON.parse(readFileSync(new URL("../assets/data/admin-platforms-baseline.json", import.meta.url), "utf8")).platforms;
const positions = JSON.parse(readFileSync(new URL("../assets/data/admin-positions-baseline.json", import.meta.url), "utf8")).positions;
const adminApp = readFileSync(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");

const clientOnlyIds = extractClientOnlyIds(audit);
const requiredCompanyIds = extractRequiredCompanyIds(audit, companies);

function companyOptions() {
  return { baselineItems: companies, clientOnlyIds, requiredIds: requiredCompanyIds };
}

function platformOptions() {
  return { baselineItems: platforms, requiredIds: new Set(platforms.map((item) => item.id)) };
}

function positionOptions(reconciledCompanies) {
  return {
    baselineItems: positions,
    companyLabelResolver: (id) => reconciledCompanies.find((company) => company.id === id)?.name || ""
  };
}

function ids(items) {
  return items.map((item) => item.id);
}

function countId(items, id) {
  return items.filter((item) => item.id === id).length;
}

function editSourceCompanyOverlay() {
  const baseline = companies.find((item) => item.id === "ghd") || companies[0];
  const rows = companies.map((item) => (item.id === baseline.id ? { ...item, description: "Verified overlay edit", updatedAt: "2026-06-18T00:00:00.000Z" } : item));
  return { baseline, overlay: registryStoragePayload("companies", rows, {}, companyOptions()) };
}

test("editing a source company saves as an override and reloads without duplicate rows", () => {
  const { baseline, overlay } = editSourceCompanyOverlay();
  assert.equal(overlay.schemaVersion, "registry-overlay.v3");
  assert.ok(overlay.overrides[baseline.id], "source company edit should be stored as an override");
  assert.equal(overlay.customRows.some((row) => row.id === baseline.id), false, "baseline row must not be stored as custom");
  const reloaded = reconcileRegistryCollection("companies", companies, overlay, { clientOnlyIds, requiredIds: requiredCompanyIds });
  assert.equal(countId(reloaded.items, baseline.id), 1);
  assert.equal(reloaded.items.find((item) => item.id === baseline.id)?.description, "Verified overlay edit");
});

test("editing a source platform saves as an override and reloads without duplicate rows", () => {
  const baseline = platforms[0];
  const rows = platforms.map((item) => (item.id === baseline.id ? { ...item, description: "Platform overlay edit", updatedAt: "2026-06-18T00:00:00.000Z" } : item));
  const overlay = registryStoragePayload("platforms", rows, {}, platformOptions());
  assert.ok(overlay.overrides[baseline.id], "source platform edit should be stored as an override");
  assert.equal(overlay.customRows.some((row) => row.id === baseline.id), false);
  const reloaded = reconcileRegistryCollection("platforms", platforms, overlay, { requiredIds: new Set(platforms.map((item) => item.id)) });
  assert.equal(countId(reloaded.items, baseline.id), 1);
  assert.equal(reloaded.items.find((item) => item.id === baseline.id)?.description, "Platform overlay edit");
});

test("editing a source position persists as an override and does not disappear on reload", () => {
  const companyResult = reconcileRegistryCollection("companies", companies, [], { clientOnlyIds, requiredIds: requiredCompanyIds });
  const baseline = normalizePositionRegistryItem(positions[0], (id) => companyResult.items.find((company) => company.id === id)?.name || "");
  const visibleRows = positions.map((item) =>
    item.id === baseline.id ? { ...item, summary: "Position overlay edit", updatedAt: "2026-06-18T00:00:00.000Z" } : item
  );
  const overlay = registryStoragePayload("positions", visibleRows, {}, positionOptions(companyResult.items));
  assert.ok(overlay.overrides[baseline.id], "source position edit should be stored as an override");
  const reloaded = reconcilePositionsCollection(positions, overlay, companyResult.items, (id) => companyResult.items.find((company) => company.id === id)?.name || "");
  assert.equal(countId(reloaded.items, baseline.id), 1);
  assert.equal(reloaded.items.find((item) => item.id === baseline.id)?.summary, "Position overlay edit");
});

test("custom company and position save/reload as exactly one custom row", () => {
  const customCompany = { id: "admin-test-company", name: "Admin Test Company", status: "active", source: "admin_created", updatedAt: "2026-06-18T00:00:00.000Z" };
  const companyOverlay = registryStoragePayload("companies", [...companies, customCompany], {}, companyOptions());
  assert.equal(companyOverlay.customRows.filter((row) => row.id === customCompany.id).length, 1);
  const companyResult = reconcileRegistryCollection("companies", companies, companyOverlay, { clientOnlyIds, requiredIds: requiredCompanyIds });
  assert.equal(countId(companyResult.items, customCompany.id), 1);

  const customPosition = { id: "admin-test-position", title: "Admin Test Position", companyId: customCompany.id, status: "active", source: "admin_created", updatedAt: "2026-06-18T00:00:00.000Z" };
  const positionOverlay = registryStoragePayload("positions", [...positions, customPosition], {}, positionOptions(companyResult.items));
  assert.equal(positionOverlay.customRows.filter((row) => row.id === customPosition.id).length, 1);
  const positionResult = reconcilePositionsCollection(positions, positionOverlay, companyResult.items, (id) => companyResult.items.find((company) => company.id === id)?.name || "");
  assert.equal(countId(positionResult.items, customPosition.id), 1);
});

test("full reconciled rows array saves only overrides/custom rows, not baseline custom copies", () => {
  const edited = reconcileRegistryCollection("companies", companies, [], { clientOnlyIds, requiredIds: requiredCompanyIds }).items.map((item) =>
    item.id === "ghd" ? { ...item, website: "https://www.ghd.com/" } : item
  );
  const overlay = registryStoragePayload("companies", edited, {}, companyOptions());
  assert.equal(overlay.customRows.some((row) => companies.some((company) => company.id === row.id)), false);
});

test("reconciliation is idempotent", () => {
  const { overlay } = editSourceCompanyOverlay();
  const first = reconcileRegistryCollection("companies", companies, overlay, { clientOnlyIds, requiredIds: requiredCompanyIds });
  const second = reconcileRegistryCollection("companies", companies, registryStoragePayload("companies", first.items, first.meta, companyOptions()), { clientOnlyIds, requiredIds: requiredCompanyIds });
  assert.deepEqual(ids(second.items), ids(first.items));
});

test("Riley client-only stale row is excluded while Fleetwood and GHD remain restored", () => {
  const overlay = registryStoragePayload(
    "companies",
    [{ id: "riley-consulting", name: "Riley Consulting", source: "admin_created", status: "active" }],
    {},
    companyOptions()
  );
  const result = reconcileRegistryCollection("companies", companies, overlay, { clientOnlyIds, requiredIds: requiredCompanyIds });
  assert.equal(result.items.some((item) => item.id === "riley-consulting" && item.status === "active"), false);
  assert.ok(ids(result.items).includes("fleetwood-australia"));
  assert.ok(ids(result.items).includes("ghd"));
  const resaved = registryStoragePayload("companies", result.items, result.meta, companyOptions());
  assert.ok(resaved.excludedRows.some((item) => item.id === "riley-consulting"), "excluded Riley metadata should survive a later visible-row save");
});

test("position company links resolve after source company override", () => {
  const editedCompanyRows = companies.map((item) => (item.id === "ghd" ? { ...item, name: "GHD overlay display" } : item));
  const companyOverlay = registryStoragePayload("companies", editedCompanyRows, {}, companyOptions());
  const companyResult = reconcileRegistryCollection("companies", companies, companyOverlay, { clientOnlyIds, requiredIds: requiredCompanyIds });
  const positionResult = reconcilePositionsCollection(positions, [], companyResult.items, (id) => companyResult.items.find((company) => company.id === id)?.name || "");
  assert.deepEqual(positionResult.items.filter((position) => !ids(companyResult.items).includes(position.companyId)).map((position) => position.id), []);
});

test("localStorage migration from old arrays preserves valid custom rows and excludes client-only rows", () => {
  const custom = { id: "admin-custom-company", name: "Admin Custom Company", source: "admin_created", status: "active" };
  const result = reconcileRegistryCollection("companies", companies, [companies[0], custom, { id: "riley-consulting", name: "Riley Consulting", status: "active" }], {
    clientOnlyIds,
    requiredIds: requiredCompanyIds
  });
  assert.equal(countId(result.items, custom.id), 1);
  assert.equal(result.items.some((item) => item.id === "riley-consulting"), false);
  assert.ok(result.meta.staleRowsExcluded >= 1);
});

test("sync failure path does not clear existing in-memory rows", () => {
  assert.match(adminApp, /No live admin API connected; saved locally only\./);
  assert.doesNotMatch(adminApp, /positionsState\.items\s*=\s*\[\]/);
  assert.doesNotMatch(adminApp, /registryState\[[^\]]+\]\.items\s*=\s*\[\]/);
});
