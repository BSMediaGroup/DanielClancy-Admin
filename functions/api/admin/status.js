import { loadAccountRegistry, requireAdmin } from "../../_shared/admin-accounts.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const COLLECTIONS = {
  projects: "cms:projects",
  media: "cms:media",
  alerts: "cms:alerts"
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

function countItems(raw) {
  if (!raw) return { configured: true, source: "empty", count: 0, updatedAt: "" };
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  return {
    configured: true,
    source: "kv",
    count: items.length,
    updatedAt: parsed?.updatedAt || ""
  };
}

async function collectionStatuses(env) {
  const binding = env.DC_ADMIN_KV;
  const configured = binding && typeof binding.get === "function";
  const entries = {};
  for (const [collection, key] of Object.entries(COLLECTIONS)) {
    if (!configured) {
      entries[collection] = {
        configured: false,
        error: "storage_not_configured",
        count: 0,
        key
      };
      continue;
    }
    try {
      entries[collection] = {
        ...countItems(await binding.get(key)),
        key
      };
    } catch {
      entries[collection] = {
        configured: true,
        error: "stored_payload_invalid",
        count: 0,
        key
      };
    }
  }
  return entries;
}

async function baselineStatus(request, env) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return { configured: false, count: 0, source: "assets_binding_unavailable" };
  }
  try {
    const response = await env.ASSETS.fetch(new URL("/assets/data/public-projects-baseline.json", request.url));
    if (!response.ok) return { configured: true, count: 0, source: `asset_http_${response.status}` };
    const payload = await response.json();
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];
    return {
      configured: true,
      count: projects.length,
      source: "public-projects-baseline",
      updatedAt: payload?.meta?.generatedAt || ""
    };
  } catch {
    return { configured: true, count: 0, source: "baseline_unavailable" };
  }
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
        const [accounts, cms, baseline] = await Promise.all([
          loadAccountRegistry(env),
          collectionStatuses(env),
          baselineStatus(request, env)
        ]);
        response = json({
          ok: true,
          checkedAt: new Date().toISOString(),
          session: admin.session,
          accounts: {
            configured: Boolean(accounts.storageConfigured),
            key: accounts.key,
            count: accounts.accounts.length,
            envMasterCount: accounts.meta?.envMasterCount || accounts.accounts.filter((account) => account.source === "env_master").length,
            kvAccountCount: accounts.meta?.kvAccountCount || 0
          },
          cms,
          publicProjectsBaseline: baseline,
          turnstile: {
            siteKeyConfigured: hasEnv(env, "DC_TURNSTILE_SITE_KEY"),
            secretConfigured: hasEnv(env, "DC_TURNSTILE_SECRET_KEY"),
            devBypassEnabled: String(env.DC_TURNSTILE_DEV_BYPASS || "").toLowerCase() === "true"
          },
          oauth: {
            githubConfigured: hasEnv(env, "GITHUB_CLIENT_ID") && hasEnv(env, "GITHUB_CLIENT_SECRET"),
            googleConfigured: hasEnv(env, "GOOGLE_CLIENT_ID") && hasEnv(env, "GOOGLE_CLIENT_SECRET"),
            twitterConfigured: hasEnv(env, "TWITTER_CLIENT_ID") && hasEnv(env, "TWITTER_CLIENT_SECRET")
          },
          alerts: {
            ingestSecretConfigured: hasEnv(env, "DANIELCLANCY_ALERT_INGEST_SECRET")
          }
        });
      }
    }
  } catch {
    response = json({ ok: false, error: "status_unavailable" }, { status: 500 });
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
