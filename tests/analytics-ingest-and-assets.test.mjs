import assert from "node:assert/strict";
import test from "node:test";

import { createSessionCookie } from "../functions/_shared/admin-accounts.js";
import { storePageVisitEvent } from "../functions/_shared/analytics-store.js";
import { analyticsStatus } from "../functions/api/admin/analytics.js";
import { onRequest as adminAnalytics } from "../functions/api/admin/analytics.js";
import { onRequest as analyticsIngest } from "../functions/api/analytics/ingest/page-visit.js";
import { onRequest as assetUpload } from "../functions/api/admin/assets/upload.js";

function memoryKv() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, value) {
      store.set(key, value);
    }
  };
}

test("analytics ingest rejects missing secret", async () => {
  const response = await analyticsIngest({
    request: new Request("https://admin.danielclancy.net/api/analytics/ingest/page-visit", {
      method: "POST",
      body: JSON.stringify({ page_path: "/" })
    }),
    env: { DANIELCLANCY_ANALYTICS_INGEST_SECRET: "expected" }
  });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error, "invalid_analytics_secret");
});

test("analytics ingest accepts valid secret and stores Cloudflare city event", async () => {
  const kv = memoryKv();
  const request = new Request("https://admin.danielclancy.net/api/analytics/ingest/page-visit", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-DanielClancy-Analytics-Secret": "expected",
      "User-Agent": "Mozilla/5.0 Safari/605.1.15"
    },
    body: JSON.stringify({ page_path: "/portfolio", page_title: "Portfolio" })
  });
  Object.defineProperty(request, "cf", {
    value: { city: "Sydney", region: "NSW", regionCode: "NSW", country: "AU", timezone: "Australia/Sydney", colo: "SYD" }
  });
  const response = await analyticsIngest({
    request,
    env: {
      DANIELCLANCY_ANALYTICS_INGEST_SECRET: "expected",
      DC_ADMIN_KV: kv
    }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stored, true);
  assert.equal(body.cityAvailable, true);
  const rollup = JSON.parse(kv.store.get("analytics:page_visits:rollup"));
  assert.equal(rollup.cityEvents, 1);
  assert.equal(rollup.cities[0].city, "Sydney");
  const recent = JSON.parse(kv.store.get("analytics:page_visits:recent"));
  assert.equal(recent.items[0].source, "page_visit_kv");
  assert.equal(recent.items[0].live, true);
  assert.equal(recent.items[0].precision, "city");
  assert.ok(recent.items[0].eventId);
  assert.ok(recent.items[0].recordedAt);
});

test("analytics status returns city rows from mocked KV rollup and exact empty message with zero events", async () => {
  const kv = memoryKv();
  const request = new Request("https://admin.danielclancy.net/api/track/page-visit", { headers: { "User-Agent": "Chrome/125" } });
  Object.defineProperty(request, "cf", {
    value: { city: "Perth", region: "WA", country: "AU" }
  });
  await storePageVisitEvent({ request, env: { DC_ADMIN_KV: kv } }, { page_path: "/cv", surface: "danielclancy_public" });
  const withCity = await analyticsStatus({ DC_ADMIN_KV: kv });
  assert.equal(withCity.cities[0].city, "Perth");
  assert.equal(withCity.cities[0].precision, "city");

  const empty = await analyticsStatus({ DC_ADMIN_KV: memoryKv() });
  assert.equal(empty.pageVisits.emptyMessage, "No page-visit events have been captured yet.");
  assert.equal(empty.cities.length, 0);
});

test("analytics status excludes sample and stale rows from live location rows", async () => {
  const kv = memoryKv();
  kv.store.set("analytics:page_visits:recent", JSON.stringify({
    updatedAt: "2026-06-18T00:00:00.000Z",
    items: [
      { source: "sample_fallback", live: false, city: "Los Angeles", country: "US", page_path: "/sample", timestamp: "2026-06-18T00:00:00.000Z" },
      { city: "Portland", country: "US", page_path: "/stale", timestamp: "2026-06-18T00:00:01.000Z" },
      { source: "page_visit_kv", live: true, city: "Sydney", region: "NSW", country: "AU", country_code: "AU", page_path: "/live", recordedAt: "2026-06-18T00:00:02.000Z", precision: "city" },
      { source: "page_visit_kv", live: true, country: "US", country_code: "US", page_path: "/country", recordedAt: "2026-06-18T00:00:03.000Z", precision: "country" }
    ]
  }));

  const status = await analyticsStatus({ DC_ADMIN_KV: kv });
  assert.deepEqual(status.cities.map((row) => row.city), ["Sydney"]);
  assert.equal(status.pageVisits.sampleRows.length, 1);
  assert.equal(status.pageVisits.staleRows.length, 1);
  assert.equal(status.location.countryOnlyEventCount, 1);
  assert.equal(status.countries.find((row) => row.country === "US").precision, "country");
  assert.equal(status.sourceFreshnessState, "live_stale");
});

test("admin purge action removes only sample analytics rows", async () => {
  const kv = memoryKv();
  kv.store.set("analytics:page_visits:recent", JSON.stringify({
    items: [
      { source: "sample_fallback", live: false, city: "Los Angeles" },
      { source: "page_visit_kv", live: true, city: "Sydney", country: "AU", country_code: "AU", recordedAt: "2026-06-18T00:00:00.000Z", precision: "city" },
      { city: "Legacy", country: "US" }
    ]
  }));
  const secret = "secret";
  const cookie = await createSessionCookie(new Request("https://admin.danielclancy.net"), { DC_AUTH_SESSION_SECRET: secret }, { provider: "password", email: "admin@example.com", account_type: "admin", admin_level: "master" });
  const response = await adminAnalytics({
    request: new Request("https://admin.danielclancy.net/api/admin/analytics", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "purge_non_live_fallback_rows" })
    }),
    env: { DC_AUTH_SESSION_SECRET: secret, DC_ADMIN_EMAIL_1: "admin@example.com", DC_ADMIN_KV: kv }
  });
  const body = await response.json();
  const recent = JSON.parse(kv.store.get("analytics:page_visits:recent"));
  assert.equal(response.status, 200);
  assert.equal(body.result.removed, 1);
  assert.equal(recent.items.some((row) => row.source === "page_visit_kv"), true);
  assert.equal(recent.items.some((row) => row.city === "Legacy"), true);
  assert.equal(recent.items.some((row) => row.source === "sample_fallback"), false);
});

test("asset upload rejects unauthenticated requests", async () => {
  const form = new FormData();
  form.set("file", new File(["not-an-image"], "test.txt", { type: "text/plain" }));
  const response = await assetUpload({
    request: new Request("https://admin.danielclancy.net/api/admin/assets/upload", { method: "POST", body: form }),
    env: { DC_AUTH_SESSION_SECRET: "secret" }
  });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error, "unauthenticated");
});

test("asset upload returns storage_not_configured before pretending persistence", async () => {
  const secret = "secret";
  const request = new Request("https://admin.danielclancy.net/api/admin/assets/upload", { method: "POST" });
  const cookie = await createSessionCookie(request, { DC_AUTH_SESSION_SECRET: secret }, { provider: "password", email: "admin@example.com", account_type: "admin", admin_level: "master" });
  const form = new FormData();
  form.set("file", new File(["fake"], "image.png", { type: "image/png" }));
  const response = await assetUpload({
    request: new Request("https://admin.danielclancy.net/api/admin/assets/upload", {
      method: "POST",
      headers: { cookie },
      body: form
    }),
    env: { DC_AUTH_SESSION_SECRET: secret, DC_ADMIN_EMAIL_1: "admin@example.com" }
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, "storage_not_configured");
});

test("asset upload rejects non-image files when R2 is configured", async () => {
  const secret = "secret";
  const request = new Request("https://admin.danielclancy.net/api/admin/assets/upload", { method: "POST" });
  const cookie = await createSessionCookie(request, { DC_AUTH_SESSION_SECRET: secret }, { provider: "password", email: "admin@example.com", account_type: "admin", admin_level: "master" });
  const form = new FormData();
  form.set("file", new File(["plain"], "note.txt", { type: "text/plain" }));
  const response = await assetUpload({
    request: new Request("https://admin.danielclancy.net/api/admin/assets/upload", {
      method: "POST",
      headers: { cookie },
      body: form
    }),
    env: {
      DC_AUTH_SESSION_SECRET: secret,
      DC_ADMIN_EMAIL_1: "admin@example.com",
      DC_ADMIN_ASSETS_R2: { async put() {} }
    }
  });
  const body = await response.json();
  assert.equal(response.status, 415);
  assert.equal(body.error, "unsupported_file_type");
});
