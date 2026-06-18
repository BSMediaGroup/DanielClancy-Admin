import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPublicSiteData } from "../functions/_shared/public-site-data.js";

const repoRoot = new URL("../", import.meta.url);

function assetPathFromUrl(url) {
  const parsed = new URL(String(url));
  return new URL(`..${parsed.pathname}`, import.meta.url);
}

function mockAssets() {
  return {
    async fetch(url) {
      try {
        const body = readFileSync(assetPathFromUrl(url), "utf8");
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      } catch {
        return new Response("not found", { status: 404 });
      }
    }
  };
}

function mockRequest() {
  return new Request("https://admin.danielclancy.net/api/public/site-data", {
    headers: { origin: "https://danielclancy.net" }
  });
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  for (const [key, entry] of Object.entries(value)) {
    keys.push(key);
    collectKeys(entry, keys);
  }
  return keys;
}

test("public site-data export returns sanitized baseline collections without KV", async () => {
  const payload = await buildPublicSiteData({
    request: mockRequest(),
    env: { ASSETS: mockAssets() }
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.schemaVersion, "danielclancy-public-site-data.v1");
  assert.equal(payload.source, "admin_baseline_reconciled");
  assert.ok(payload.collections.projects.length > 0, "projects should be exported");
  assert.ok(payload.collections.companies.length > 0, "companies should be exported");
  assert.ok(payload.collections.platforms.length > 0, "platforms should be exported");
  assert.ok(payload.collections.positions.length > 0, "positions should be exported");
  assert.ok(payload.assets.portfolioThumbs.length > 0, "portfolio thumbnails should be exported");
  assert.ok(payload.assets.portfolioImages.length > 0, "portfolio images should be exported");
  assert.ok(payload.assets.docs.length > 0, "docs should be exported");

  const companyIds = new Set(payload.collections.companies.map((company) => company.id));
  assert.ok(companyIds.has("fleetwood-australia"), "Fleetwood should be present from source baseline");
  assert.ok(companyIds.has("ghd"), "GHD should be present from source baseline");
  assert.ok(!companyIds.has("riley-consulting"), "Riley Consulting must remain client-only, not a Company");

  const forbiddenKeyPattern = /overlay|excludedRows|account|auth|session|secret|token|password|kv|updatedBy/i;
  const forbiddenKeys = collectKeys(payload).filter((key) => forbiddenKeyPattern.test(key));
  assert.deepEqual(forbiddenKeys, [], `public payload leaked forbidden keys: ${forbiddenKeys.join(", ")}`);
});

test("public site-data export uses KV overlay when available and keeps fallback-safe shape", async () => {
  const projectsBaseline = JSON.parse(
    readFileSync(new URL("../assets/data/public-projects-baseline.json", import.meta.url), "utf8")
  );
  const firstProject = projectsBaseline.projects[0];
  const kvItems = [
    {
      ...firstProject,
      title: firstProject.title,
      thumbnailPath: "/media/portfolio/thumbs/thumb-dawesville.webp",
      heroImage: "/media/portfolio/dawesville-p1.webp",
      galleryPaths: ["/media/portfolio/dawesville-p1.webp", "/media/portfolio/dawesville-p2.webp"],
      documentPath: "/docs/Daniel_Clancy_CV_2026.pdf",
      overlayStatus: "edited",
      updatedBy: "admin@example.test"
    }
  ];
  const kv = {
    async get(key) {
      if (key === "cms:projects") return JSON.stringify({ collection: "projects", items: kvItems });
      return null;
    }
  };

  const payload = await buildPublicSiteData({
    request: mockRequest(),
    env: { ASSETS: mockAssets(), DC_ADMIN_KV: kv }
  });
  const project = payload.collections.projects.find((item) => item.id === firstProject.id);

  assert.equal(payload.source, "admin_kv_reconciled");
  assert.equal(project.thumbnailPath, "/media/portfolio/thumbs/thumb-dawesville.webp");
  assert.equal(project.heroImage, "/media/portfolio/dawesville-p1.webp");
  assert.deepEqual(project.galleryPaths, ["/media/portfolio/dawesville-p1.webp", "/media/portfolio/dawesville-p2.webp"]);
  assert.equal(project.documentPath, "/docs/Daniel_Clancy_CV_2026.pdf");
  assert.equal(project.overlayStatus, undefined);
  assert.equal(project.updatedBy, undefined);
});
