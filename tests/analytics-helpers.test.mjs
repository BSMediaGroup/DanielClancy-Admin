import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregatePageVisitEvents,
  analyticsStatus,
  queryStreamSuitesAnalytics,
  queryCloudflareAnalytics
} from "../functions/api/admin/analytics.js";
import {
  filterPageVisitEventsForWindow,
  normalizeAnalyticsWindow
} from "../functions/_shared/analytics-store.js";

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

test("missing Cloudflare analytics env returns configured false", async () => {
  const result = await queryCloudflareAnalytics({});
  assert.equal(result.configured, false);
  assert.equal(result.source, "cloudflare_analytics_not_configured");
  assert.deepEqual(result.missingConfig, [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ZONE_ID_DANIELCLANCY",
    "CLOUDFLARE_API_TOKEN_ANALYTICS"
  ]);
});

test("configured env attempts GraphQL and returns safe errors", async () => {
  const token = "secret-token-value";
  let calls = 0;
  const result = await queryCloudflareAnalytics(
    {
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_ZONE_ID_DANIELCLANCY: "zone-id",
      CLOUDFLARE_API_TOKEN_ANALYTICS: token
    },
    async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          errors: [{ message: "schema field unavailable" }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
  );

  assert.equal(calls > 0, true);
  assert.equal(result.configured, true);
  assert.equal(result.source, "cloudflare_graphql_error");
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("unsupported analytics windows normalize and GraphQL never uses a one-week range", async () => {
  assert.equal(normalizeAnalyticsWindow("bogus"), "1h");
  const calls = [];
  const result = await queryCloudflareAnalytics(
    {
      CLOUDFLARE_ACCOUNT_ID: "account-id",
      CLOUDFLARE_ZONE_ID_DANIELCLANCY: "zone-id",
      CLOUDFLARE_API_TOKEN_ANALYTICS: "secret"
    },
    async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      return new Response(JSON.stringify({ data: { viewer: { zones: [{}] } } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    },
    { window: "bogus" }
  );

  assert.equal(result.window, "1h");
  assert.equal(calls.length, 5);
  for (const call of calls) {
    const since = Date.parse(call.variables.filter.datetime_geq);
    const until = Date.parse(call.variables.filter.datetime_lt);
    assert.ok(until - since <= 24 * 60 * 60 * 1000);
    assert.equal(call.query.includes("clientCityName"), false);
    assert.equal(call.query.includes("clientrefererhost"), false);
    assert.equal(call.query.includes("clientRefererHost"), false);
  }
});

test("page-visit rows aggregate city and country precision truthfully", () => {
  const rollup = aggregatePageVisitEvents([
    {
      source: "page_visit_kv",
      live: true,
      session_id: "sydney-1",
      page_path: "/",
      referrer_host: "example.com",
      country: "AU",
      country_code: "AU",
      region: "NSW",
      city: "Sydney",
      browser: "Safari",
      device: "Desktop"
    },
    {
      source: "page_visit_kv",
      live: true,
      session_id: "us-1",
      page_path: "/work",
      country: "US",
      country_code: "US",
      precision: "country",
      browser: "Chrome",
      device: "Mobile"
    }
  ]);

  assert.equal(rollup.events, 2);
  assert.equal(rollup.cities[0].city, "Sydney");
  assert.equal(rollup.cities[0].precision, "city");
  assert.equal(rollup.cities[0].requests, 1);
  assert.equal(rollup.cities[0].sessions, 1);
  assert.equal(rollup.regions.find((row) => row.country === "US").precision, "country");
});

test("unknown session count is not invented", () => {
  const rollup = aggregatePageVisitEvents([
    {
      source: "page_visit_kv",
      live: true,
      page_path: "/",
      country: "AU",
      country_code: "AU",
      region: "NSW",
      city: "Sydney"
    }
  ]);
  assert.equal(rollup.cities[0].requests, 1);
  assert.equal(rollup.cities[0].sessions, null);
});

test("page-visit rows outside the selected window are excluded from live rows", () => {
  const now = Date.parse("2026-06-19T00:00:00.000Z");
  const result = filterPageVisitEventsForWindow(
    [
      {
        source: "page_visit_kv",
        live: true,
        recordedAt: "2026-06-18T23:59:00.000Z",
        city: "Sydney"
      },
      {
        source: "page_visit_kv",
        live: true,
        recordedAt: "2026-06-18T22:00:00.000Z",
        city: "Portland"
      },
      {
        source: "page_visit_kv",
        live: true,
        city: "Los Angeles"
      }
    ],
    "5m",
    now
  );
  assert.equal(result.liveRows.length, 1);
  assert.equal(result.liveRows[0].city, "Sydney");
  assert.equal(result.staleRows.some((row) => row.city === "Portland"), true);
  assert.equal(result.unknownWindowRows.some((row) => row.city === "Los Angeles"), true);
});

test("analytics readiness exposes configured flags only", async () => {
  const token = "do-not-expose";
  const env = {
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_ZONE_ID_DANIELCLANCY: "zone-id",
    CLOUDFLARE_API_TOKEN_ANALYTICS: token,
    DC_ADMIN_KV: {
      async get() {
        return null;
      },
      async put() {}
    }
  };
  const result = await analyticsStatus(env, {
    window: "24h",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: { viewer: { zones: [{}] } }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  });

  assert.equal(result.readiness.cloudflare.CLOUDFLARE_ACCOUNT_ID, true);
  assert.equal(result.readiness.cloudflare.CLOUDFLARE_ZONE_ID_DANIELCLANCY, true);
  assert.equal(result.readiness.cloudflare.CLOUDFLARE_API_TOKEN_ANALYTICS, true);
  assert.equal(result.readiness.dcAdminKvConfigured, true);
  assert.equal(result.window, "24h");
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("StreamSuites analytics URL forwards selected window and normalizes live rows", async () => {
  const secret = "read-secret-value";
  const calls = [];
  const result = await queryStreamSuitesAnalytics(
    {
      STREAMSUITES_ANALYTICS_URL: "https://api.streamsuites.app/api/analytics/danielclancy",
      DANIELCLANCY_ANALYTICS_READ_SECRET: secret
    },
    async (url, init) => {
      calls.push({ url, headers: init.headers });
      return new Response(JSON.stringify({
        ok: true,
        source: "streamsuites_live",
        generatedAt: "2026-06-22T00:00:00.000Z",
        rows: [
          {
            eventId: "ca-1",
            source: "streamsuites_live",
            project: "danielclancy",
            source_namespace: "danielclancy",
            surface: "danielclancy_public",
            event_type: "danielclancy_page_visit",
            city: "Toronto",
            region: "Ontario",
            country: "Canada",
            country_code: "CA",
            latitude: 43.6532,
            longitude: -79.3832,
            sessions: 2,
            requests: 3,
            recordedAt: "2026-06-22T00:00:00.000Z",
            lastSeen: "2026-06-22T00:00:00.000Z",
            page_path: "/work"
          }
        ],
        sourceBreakdown: { streamsuites_live: 1 }
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    { window: "15m" }
  );

  assert.equal(result.connected, true);
  assert.equal(result.rows[0].source, "streamsuites_live");
  assert.equal(result.rows[0].live, true);
  assert.equal(result.rows[0].city, "Toronto");
  assert.equal(result.rows[0].sessions, 2);
  assert.equal(result.rows[0].requests, 3);
  assert.equal(new URL(calls[0].url).searchParams.get("window"), "15m");
  assert.equal(calls[0].headers.authorization, `Bearer ${secret}`);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("api.streamsuites.app"), false);
});

test("analytics status prefers StreamSuites live rows and keeps stale LA Portland local rows out of live markers", async () => {
  const kv = memoryKv();
  kv.store.set("analytics:page_visits:recent", JSON.stringify({
    items: [
      { source: "sample_fallback", live: false, city: "Los Angeles", country: "US", timestamp: "2026-06-18T00:00:00.000Z" },
      { city: "Portland", country: "US", timestamp: "2026-06-18T00:00:01.000Z" }
    ]
  }));

  const now = "2026-06-22T00:00:00.000Z";
  const result = await analyticsStatus(
    {
      STREAMSUITES_ANALYTICS_URL: "https://api.streamsuites.app/api/analytics/danielclancy",
      DANIELCLANCY_ANALYTICS_READ_SECRET: "secret",
      DC_ADMIN_KV: kv
    },
    {
      window: "24h",
      fetchImpl: async () => new Response(JSON.stringify({
        ok: true,
        source: "streamsuites_live",
        generatedAt: now,
        rows: [
          { city: "Toronto", region: "Ontario", country: "Canada", country_code: "CA", latitude: 43.6532, longitude: -79.3832, sessions: 2, requests: 3, recordedAt: now, lastSeen: now, page_path: "/canada" },
          { city: "Sao Paulo", region: "Sao Paulo", country: "Brazil", country_code: "BR", latitude: -23.5505, longitude: -46.6333, sessions: 1, requests: 2, recordedAt: now, lastSeen: now, page_path: "/brazil" },
          { city: "Sydney", region: "NSW", country: "Australia", country_code: "AU", latitude: -33.8688, longitude: 151.2093, sessions: 1, requests: 1, recordedAt: now, lastSeen: now, page_path: "/australia" },
          { city: "London", region: "England", country: "United Kingdom", country_code: "GB", latitude: 51.5072, longitude: -0.1276, sessions: 4, requests: 5, recordedAt: now, lastSeen: now, page_path: "/uk" }
        ],
        sourceBreakdown: { streamsuites_live: 4 }
      }), { status: 200, headers: { "content-type": "application/json" } })
    }
  );

  assert.equal(result.source, "streamsuites_live");
  assert.equal(result.streamSuitesAnalyticsConnected, true);
  assert.equal(result.sourceBreakdown.streamsuites_live, 4);
  assert.equal(result.sourceBreakdown.sample_fallback, 1);
  assert.equal(result.sourceBreakdown.stale_legacy, 1);
  assert.deepEqual(result.location.liveLocationRows.map((row) => row.country_code).sort(), ["AU", "BR", "CA", "GB"]);
  assert.equal(result.location.liveLocationRows.some((row) => row.city === "Los Angeles" || row.city === "Portland"), false);
  assert.equal(result.cities.find((row) => row.country_code === "CA").city, "Toronto");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});
