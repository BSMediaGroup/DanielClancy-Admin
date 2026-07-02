import { buildPublicSiteDataResponse } from "../../_shared/public-site-data.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

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
      "https://www.danielclancy.net",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173"
    ].filter(Boolean)
  );
  return allowed.has(origin) ? origin : "";
}

function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return {
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  let response;
  if (request.method !== "GET") {
    response = json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { "cache-control": "no-store" } }
    );
  } else {
    try {
      const result = await buildPublicSiteDataResponse(context);
      response = json(result.payload, {
        headers: {
          "cache-control": "no-store",
          ...(result.etag ? { etag: result.etag } : {})
        }
      });
    } catch {
      response = json(
        {
          ok: false,
          error: "public_site_data_unavailable",
          schemaVersion: "danielclancy-public-site-data.v1",
          generatedAt: new Date().toISOString(),
          source: "error"
        },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
