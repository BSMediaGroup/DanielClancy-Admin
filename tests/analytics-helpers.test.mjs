import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregatePageVisitEvents,
  analyticsStatus,
  queryCloudflareAnalytics
} from "../functions/api/admin/analytics.js";

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

test("page-visit rows aggregate city and country precision truthfully", () => {
  const rollup = aggregatePageVisitEvents([
    {
      page_path: "/",
      referrer_host: "example.com",
      country: "AU",
      region: "NSW",
      city: "Sydney",
      browser: "Safari",
      device: "Desktop"
    },
    {
      page_path: "/work",
      country: "US",
      browser: "Chrome",
      device: "Mobile"
    }
  ]);

  assert.equal(rollup.events, 2);
  assert.equal(rollup.cities[0].city, "Sydney");
  assert.equal(rollup.cities[0].precision, "city");
  assert.equal(rollup.regions.find((row) => row.country === "US").precision, "country");
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
  assert.equal(JSON.stringify(result).includes(token), false);
});
