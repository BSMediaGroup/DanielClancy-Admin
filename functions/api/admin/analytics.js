import { requireAdmin } from "../../_shared/admin-accounts.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const REQUIRED_CONFIG = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ZONE_ID_DANIELCLANCY",
  "CLOUDFLARE_API_TOKEN_ANALYTICS"
];

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {})
    }
  });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set(
    [
      env.DC_PUBLIC_SITE_ORIGIN || "https://danielclancy.net",
      env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ].filter(Boolean)
  );
  if (allowed.has(origin)) return origin;
  return env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net";
}

function corsHeaders(request, env) {
  return {
    "access-control-allow-origin": allowedOrigin(request, env),
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function hasEnv(env, key) {
  return Boolean(String(env?.[key] || "").trim());
}

function buildPlaceholderPanel(name, configured) {
  return {
    status: configured ? "not_queried" : "not_configured",
    source: configured ? "cloudflare_ready_placeholder" : "configuration_required",
    items: [],
    message: configured
      ? `${name} analytics query support is ready for Cloudflare API wiring; live fetch is not implemented in this endpoint yet.`
      : "Cloudflare Analytics API config is missing. No live analytics values are returned."
  };
}

function analyticsStatus(env) {
  const missingConfig = REQUIRED_CONFIG.filter((key) => !hasEnv(env, key));
  const configured = missingConfig.length === 0;
  const siteOrigin = String(env.DC_PUBLIC_SITE_ORIGIN || "https://danielclancy.net").replace(/\/+$/, "");
  const adminOrigin = String(env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net").replace(/\/+$/, "");

  return {
    ok: true,
    configured,
    source: configured ? "cloudflare_analytics_api_ready" : "cloudflare_analytics_not_configured",
    site: {
      origin: siteOrigin,
      domain: new URL(siteOrigin).hostname,
      adminOrigin,
      adminDomain: new URL(adminOrigin).hostname
    },
    pageViews: buildPlaceholderPanel("Page views", configured),
    topPages: buildPlaceholderPanel("Top pages", configured),
    referrers: buildPlaceholderPanel("Referrers", configured),
    countries: buildPlaceholderPanel("Countries/regions", configured),
    map: {
      ...buildPlaceholderPanel("Map", configured),
      markers: [],
      regions: []
    },
    lastChecked: new Date().toISOString(),
    requiredConfig: REQUIRED_CONFIG,
    missingConfig,
    notes: [
      configured
        ? "Cloudflare Analytics env vars are present, but this endpoint intentionally does not return live metrics until the API query contract is implemented and tested."
        : "Cloudflare Analytics env vars are not fully configured; the dashboard should use clearly labelled sample/local fallback rows only.",
      "Secret values are never returned."
    ]
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  let response;
  try {
    if (request.method !== "GET") {
      response = json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    } else {
      const admin = await requireAdmin(request, env);
      if (admin.error) {
        response = json({ ok: false, error: admin.error }, { status: admin.status });
      } else {
        response = json({
          ...analyticsStatus(env),
          session: admin.session
        });
      }
    }
  } catch {
    response = json({ ok: false, error: "analytics_status_unavailable" }, { status: 500 });
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
