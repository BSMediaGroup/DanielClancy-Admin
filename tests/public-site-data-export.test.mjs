import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSessionCookie } from "../functions/_shared/admin-accounts.js";
import { onRequest as publishSiteData } from "../functions/api/admin/publish/site-data.js";
import { onRequest as publicSiteData } from "../functions/api/public/site-data.js";
import { buildPublicSiteData, PUBLISHED_SITE_DATA_KEY, PUBLISHED_SITE_DATA_META_KEY } from "../functions/_shared/public-site-data.js";

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

function memoryKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    store
  };
}

function adminEnv(secret, kv) {
  return {
    ASSETS: mockAssets(),
    DC_ADMIN_KV: kv,
    DC_AUTH_SESSION_SECRET: secret,
    DC_ADMIN_EMAIL_1: "admin@example.test",
    DC_ADMIN_SECRET_1: "unused-in-cookie-test"
  };
}

async function adminRequest(url = "https://admin.danielclancy.net/api/admin/publish/site-data") {
  const secret = "test-secret";
  const cookie = await createSessionCookie(new Request(url), { DC_AUTH_SESSION_SECRET: secret }, {
    email: "admin@example.test",
    provider: "password",
    account_type: "admin",
    admin_level: "owner",
    is_master_admin: true
  });
  return {
    request: new Request(url, {
      method: "POST",
      headers: {
        cookie,
        origin: "https://admin.danielclancy.net"
      }
    }),
    secret
  };
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
  assert.equal(payload.source, "baseline_fallback");
  assert.ok(payload.revision);
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

  assert.equal(payload.source, "live_reconciled_fallback");
  assert.equal(project.thumbnailPath, "/media/portfolio/thumbs/thumb-dawesville.webp");
  assert.equal(project.heroImage, "/media/portfolio/dawesville-p1.webp");
  assert.deepEqual(project.galleryPaths, ["/media/portfolio/dawesville-p1.webp", "/media/portfolio/dawesville-p2.webp"]);
  assert.equal(project.documentPath, "/docs/Daniel_Clancy_CV_2026.pdf");
  assert.equal(project.overlayStatus, undefined);
  assert.equal(project.updatedBy, undefined);
});

test("public site-data export includes sanitized product overrides only", async () => {
  const kv = {
    async get(key) {
      if (key === "cms:products") {
        return JSON.stringify({
          collection: "products",
          settings: {
            banners: [
              { label: "Limited Drop", slug: "limited-drop", enabled: true, theme: "gold", sortOrder: 2 },
              { label: "Internal", slug: "internal", enabled: false, sortOrder: 9, secretToken: "never-public" }
            ]
          },
          items: [
            {
              productId: "123",
              printfulProductId: "123",
              slugOverride: "signature-tee",
              displayTitle: "Signature Tee",
              descriptionOverride: "Published storefront copy.",
              categoryOverride: "Apparel",
              visibility: "public",
              featured: true,
              banners: [{ label: "Limited Drop", slug: "limited-drop", enabled: true, theme: "gold", sortOrder: 2 }],
              heroImageOverride: "https://cdn.example.test/signature-tee.webp",
              galleryOverride: ["https://cdn.example.test/signature-tee.webp", "javascript:alert(1)"],
              sortOrder: 4,
              updatedBy: "admin@example.test",
              secretToken: "never-public"
            },
            {
              productId: "999",
              printfulProductId: "999",
              slugOverride: "private-sample",
              visibility: "private",
              displayTitle: "Private sample"
            }
          ]
        });
      }
      return null;
    }
  };

  const payload = await buildPublicSiteData({
    request: mockRequest(),
    env: { ASSETS: mockAssets(), DC_ADMIN_KV: kv }
  });

  assert.equal(payload.collections.products.length, 1);
  assert.equal(payload.collections.products[0].slugOverride, "signature-tee");
  assert.deepEqual(payload.collections.products[0].banners, [{ label: "LIMITED DROP", slug: "limited-drop", enabled: true, theme: "gold", sortOrder: 2 }]);
  assert.deepEqual(payload.collections.productSettings.banners, [
    { label: "LIMITED DROP", slug: "limited-drop", enabled: true, sortOrder: 2, theme: "gold" },
    { label: "INTERNAL", slug: "internal", enabled: false, sortOrder: 9, theme: "purple-orange" }
  ]);
  assert.equal(payload.collections.products[0].heroImageOverride, "https://cdn.example.test/signature-tee.webp");
  assert.deepEqual(payload.collections.products[0].galleryOverride, ["https://cdn.example.test/signature-tee.webp"]);
  assert.equal(payload.collections.products[0].updatedBy, undefined);
  assert.equal(payload.collections.products[0].secretToken, undefined);
});

test("admin publish endpoint requires an admin session", async () => {
  const response = await publishSiteData({
    request: new Request("https://admin.danielclancy.net/api/admin/publish/site-data", { method: "POST" }),
    env: { ASSETS: mockAssets(), DC_ADMIN_KV: memoryKv(), DC_AUTH_SESSION_SECRET: "test-secret" }
  });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, "unauthenticated");
});

test("admin publish writes sanitized snapshot and metadata to KV", async () => {
  const kv = memoryKv();
  const admin = await adminRequest();
  const response = await publishSiteData({
    request: admin.request,
    env: adminEnv(admin.secret, kv)
  });
  const body = await response.json();
  const stored = JSON.parse(await kv.get(PUBLISHED_SITE_DATA_KEY));
  const meta = JSON.parse(await kv.get(PUBLISHED_SITE_DATA_META_KEY));

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.published, true);
  assert.equal(stored.source, "published_kv_snapshot");
  assert.equal(stored.revision, body.revision);
  assert.equal(meta.revision, body.revision);
  assert.ok(body.counts.projects > 0);
  assert.ok(body.counts.companies > 0);
  assert.ok(body.counts.platforms > 0);
  assert.ok(body.counts.positions > 0);
  assert.ok(body.counts.assets > 0);
  const forbiddenKeyPattern = /overlay|excludedRows|account|auth|session|secret|token|password|kv|updatedBy/i;
  const forbiddenKeys = collectKeys(stored).filter((key) => forbiddenKeyPattern.test(key));
  assert.deepEqual(forbiddenKeys, [], `published payload leaked forbidden keys: ${forbiddenKeys.join(", ")}`);
});

test("public endpoint serves published snapshot when present with revision metadata", async () => {
  const kv = memoryKv();
  const admin = await adminRequest();
  const publishedResponse = await publishSiteData({
    request: admin.request,
    env: adminEnv(admin.secret, kv)
  });
  const published = await publishedResponse.json();
  const response = await publicSiteData({
    request: new Request(`https://admin.danielclancy.net/api/public/site-data?rev=${published.revision}`, {
      headers: { origin: "https://danielclancy.net" }
    }),
    env: { ASSETS: mockAssets(), DC_ADMIN_KV: kv }
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, "published_kv_snapshot");
  assert.equal(body.revision, published.revision);
  assert.ok(body.publishedAt);
  assert.ok(response.headers.get("etag")?.includes(published.revision));
});
