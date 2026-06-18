import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractClientOnlyIds,
  extractRequiredCompanyIds,
  normalizePositionRegistryItem,
  reconcilePositionsCollection,
  reconcileRegistryCollection
} from "../functions/_shared/registry-reconciliation.js";

const audit = JSON.parse(readFileSync(new URL("../assets/data/source-audit-report.json", import.meta.url), "utf8"));
const companies = JSON.parse(readFileSync(new URL("../assets/data/admin-companies-baseline.json", import.meta.url), "utf8")).companies;
const platforms = JSON.parse(readFileSync(new URL("../assets/data/admin-platforms-baseline.json", import.meta.url), "utf8")).platforms;
const positions = JSON.parse(readFileSync(new URL("../assets/data/admin-positions-baseline.json", import.meta.url), "utf8")).positions;
const projects = JSON.parse(readFileSync(new URL("../assets/data/public-projects-baseline.json", import.meta.url), "utf8")).projects;
const adminApp = readFileSync(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");

const clientOnlyIds = extractClientOnlyIds(audit);
const requiredCompanyIds = extractRequiredCompanyIds(audit, companies);
const brokenOldCompanyRows = [
  { id: "acce", name: "ACCE", status: "active" },
  { id: "dc-design-studio", name: "DC Design Studio", status: "active" },
  { id: "place-laboratory", name: "Place Laboratory", status: "active" },
  { id: "richmond-ross", name: "Richmond+Ross", status: "active" },
  { id: "riley-consulting", name: "Riley Consulting", status: "active" },
  { id: "urbis", name: "Urbis", status: "active" }
];

function activeIds(items) {
  return new Set(items.filter((item) => item.status !== "archived").map((item) => item.id));
}

function activeNames(items) {
  return new Set(items.filter((item) => item.status !== "archived").map((item) => item.name));
}

function reconciledCompanies(storedRows = brokenOldCompanyRows) {
  return reconcileRegistryCollection("companies", companies, storedRows, { clientOnlyIds, requiredIds: requiredCompanyIds });
}

test("stale old companies list self-repairs to source-required Companies", () => {
  const result = reconciledCompanies();
  const ids = activeIds(result.items);
  assert.ok(ids.has("fleetwood-australia"), "Fleetwood Australia should be restored from source baseline");
  assert.ok(ids.has("ghd"), "GHD should be restored from source baseline");
  assert.ok(!ids.has("riley-consulting"), "Riley Consulting should be excluded when client-only");
  assert.ok(result.meta.staleRowsExcluded >= 1, "stale/client-only Riley row should be reported as excluded");
});

test("stale KV/local list missing Fleetwood and GHD cannot hide required employers", () => {
  const result = reconciledCompanies(brokenOldCompanyRows.filter((item) => !["fleetwood-australia", "ghd"].includes(item.id)));
  const ids = activeIds(result.items);
  assert.ok(ids.has("fleetwood-australia"), "missing Fleetwood Australia was not restored");
  assert.ok(ids.has("ghd"), "missing GHD was not restored");
});

test("client-only Riley cannot be promoted by local, KV, scaffold, or import rows", () => {
  const result = reconciledCompanies([{ id: "riley-consulting", name: "Riley Consulting", source: "admin_created", status: "active" }]);
  assert.ok(!activeIds(result.items).has("riley-consulting"), "Riley Consulting leaked into active Companies");
  assert.deepEqual(
    result.meta.excludedRows.map((item) => item.id),
    ["riley-consulting"],
    "excluded Riley row should be preserved in reconciliation metadata"
  );
});

test("Projects editor company selector source uses reconciled active Companies only", () => {
  const result = reconciledCompanies();
  const names = activeNames(result.items);
  assert.ok(names.has("Fleetwood Australia"), "Fleetwood Australia missing from reconciled selector options");
  assert.ok(names.has("GHD"), "GHD missing from reconciled selector options");
  assert.ok(!names.has("Riley Consulting"), "Riley Consulting leaked into reconciled selector options");
  assert.match(adminApp, /activeRegistryItems\(kind\)/, "Projects selector should read activeRegistryItems");
  assert.match(adminApp, /reconcileRegistryItems\("companies"/, "Companies selector source should be reconciled");
});

test("Riley source mention remains client/provenance only", () => {
  const rileyClientProjects = projects.filter((project) => /riley consulting/i.test([project.client, project.clientName, project.clientLabel].join(" ")));
  assert.ok(rileyClientProjects.length > 0, "Riley Consulting client/provenance mention should remain present");
  for (const project of rileyClientProjects) {
    assert.ok(!(project.companyIds || []).includes("riley-consulting"), `${project.id} promoted Riley into companyIds`);
  }
});

test("Positions reconcile only against Companies that exist after reconciliation", () => {
  const companyResult = reconciledCompanies();
  const positionResult = reconcilePositionsCollection(
    positions,
    positions.map((item) => normalizePositionRegistryItem(item, (id) => companyResult.items.find((company) => company.id === id)?.name || "")),
    companyResult.items,
    (id) => companyResult.items.find((company) => company.id === id)?.name || ""
  );
  const companyIds = activeIds(companyResult.items);
  const unresolved = positionResult.items.filter((position) => !companyIds.has(position.companyId)).map((position) => `${position.id}:${position.companyId}`);
  assert.deepEqual(unresolved, [], `unresolved position companies: ${unresolved.join(", ")}`);
});

test("Platforms remain baseline-protected during registry reconciliation", () => {
  const result = reconcileRegistryCollection("platforms", platforms, [], {
    requiredIds: new Set(platforms.map((item) => item.id))
  });
  const ids = activeIds(result.items);
  for (const platform of platforms) {
    assert.ok(ids.has(platform.id), `missing platform ${platform.id}`);
  }
});
