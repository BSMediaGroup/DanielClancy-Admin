import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregatePageVisitEvents,
  analyticsStatus,
  queryCloudflareAnalytics
} from "../functions/api/admin/analytics.js";
import {
  filterPageVisitEventsForWindow,
  normalizeAnalyticsWindow
} from "../functions/_shared/analytics-store.js";

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
