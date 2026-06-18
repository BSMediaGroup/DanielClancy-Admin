import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("../", import.meta.url);
const repoRootPath = fileURLToPath(repoRoot);
const adminApp = readFileSync(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
const audit = JSON.parse(readFileSync(new URL("../assets/data/source-audit-report.json", import.meta.url), "utf8"));
const companies = JSON.parse(readFileSync(new URL("../assets/data/admin-companies-baseline.json", import.meta.url), "utf8")).companies;
const platforms = JSON.parse(readFileSync(new URL("../assets/data/admin-platforms-baseline.json", import.meta.url), "utf8")).platforms;
const positions = JSON.parse(readFileSync(new URL("../assets/data/admin-positions-baseline.json", import.meta.url), "utf8")).positions;
const projects = JSON.parse(readFileSync(new URL("../assets/data/public-projects-baseline.json", import.meta.url), "utf8")).projects;
const assetCatalog = JSON.parse(readFileSync(new URL("../assets/data/public-asset-catalog.json", import.meta.url), "utf8"));

function idSet(items) {
  return new Set(items.map((item) => item.id || item.slug).filter(Boolean));
}

function assertAllPresent(sourceItems, targetItems, label) {
  const targetIds = idSet(targetItems);
  const missing = sourceItems
    .map((item) => item.normalizedId || item.id || item.slug)
    .filter((id) => id && !targetIds.has(id));
  assert.deepEqual(missing, [], `${label} missing from baseline`);
}

test("source audit records are represented in generated Admin baselines", () => {
  assertAllPresent(audit.companiesFound, companies, "companies");
  assertAllPresent(audit.platformsFound, platforms, "platforms");
  assertAllPresent(audit.positionsFound, positions, "positions");
  assertAllPresent(audit.projectsFound, projects, "projects");
});

test("project company and platform references resolve or are explicitly warned", () => {
  const companyIds = idSet(companies);
  const platformIds = idSet(platforms);
  const warnedCompanies = new Set((audit.unmatchedProjectCompanies || []).map((item) => item.normalizedId));
  const warnedPlatforms = new Set((audit.unmatchedProjectPlatforms || []).map((item) => item.normalizedId));

  const unresolvedCompanies = [];
  const unresolvedPlatforms = [];
  for (const project of projects) {
    for (const id of project.companyIds || []) {
      if (!companyIds.has(id) && !warnedCompanies.has(id)) unresolvedCompanies.push(`${project.id}:${id}`);
    }
    for (const id of project.platformIds || []) {
      if (!platformIds.has(id) && !warnedPlatforms.has(id)) unresolvedPlatforms.push(`${project.id}:${id}`);
    }
  }

  assert.deepEqual(unresolvedCompanies, [], "all project company ids should resolve");
  assert.deepEqual(unresolvedPlatforms, [], "all project platform ids should resolve");
});

test("required dashboard routes and nav entries remain registered", () => {
  for (const route of ["overview", "analytics", "accounts", "settings", "projects", "media", "companies", "platforms", "positions"]) {
    assert.match(adminApp, new RegExp(`\\{ id: "${route}"`), `${route} route should exist`);
    assert.match(adminApp, new RegExp(`path: "#/${route}"`), `${route} nav path should exist`);
  }
  assert.doesNotMatch(adminApp, /\{\s*id:\s*"alerts",\s*label:\s*"Alerts"/, "Alerts editor should not return to main nav");
});

test("asset catalog preview paths exist in Admin public folders", () => {
  const missing = [];
  for (const entry of assetCatalog.entries || []) {
    const relativePath = String(entry.adminPreviewPath || entry.relativePath || "").replace(/^\/+/, "");
    if (!relativePath) continue;
    const fullPath = join(repoRootPath, "public", relativePath);
    if (!existsSync(fullPath)) missing.push(relativePath);
  }
  assert.deepEqual(missing, [], "asset catalog entries should point at existing Admin preview files");
});

test("registry fallback and Projects editor integrity hooks are present", () => {
  assert.match(adminApp, /const CV_COMPANY_SEED = \[/);
  assert.match(adminApp, /const CV_PLATFORM_SEED = \[/);
  assert.match(adminApp, /const CV_POSITION_SEED = \[/);
  assert.match(adminApp, /registryMultiSelectField\("Software \/ platforms", "platformIds", "platforms"/);
  assert.match(adminApp, /<select class="input" name="\$\{escapeHtml\(name\)\}" multiple/);
  assert.match(adminApp, /addEventListener\("click"/);
  assert.match(adminApp, /data-project-row-id="\$\{escapeHtml\(project\.id\)\}"/);
  assert.match(adminApp, /isInteractiveProjectRowTarget\(target\)/);
  assert.match(adminApp, /openProjectRow\(row\)/);
});
