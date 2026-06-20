import { storePageVisitEvent } from "../../../_shared/analytics-store.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
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

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
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
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-danielclancy-analytics-secret"
  };
}

function timingSafeEqual(left, right) {
  const leftText = String(left || "");
  const rightText = String(right || "");
  const maxLength = Math.max(leftText.length, rightText.length);
  let diff = leftText.length ^ rightText.length;
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftText.charCodeAt(index) || 0) ^ (rightText.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function hasValidSecret(request, env) {
  const expected = String(env.DANIELCLANCY_ANALYTICS_INGEST_SECRET || "").trim();
  const actual = String(request.headers.get("X-DanielClancy-Analytics-Secret") || "").trim();
  return Boolean(expected && actual && timingSafeEqual(actual, expected));
}

function sanitizePayload(raw) {
  return {
    eventId: cleanText(raw?.eventId || raw?.event_id || raw?.id, 160),
    dedupeKey: cleanText(raw?.dedupeKey || raw?.dedupe_key, 220),
    source: cleanText(raw?.source, 80) || "page_visit_kv",
    live: raw?.live === true,
    recordedAt: cleanText(raw?.recordedAt || raw?.recorded_at || raw?.timestamp, 80),
    surface: cleanText(raw?.surface, 80) || "danielclancy_public",
    page_path: cleanText(raw?.page_path || raw?.pagePath || raw?.path || raw?.route || "/", 500),
    page_url: cleanText(raw?.page_url || raw?.pageUrl || raw?.url, 500),
    page_title: cleanText(raw?.page_title || raw?.pageTitle || raw?.title, 160),
    session_id: cleanText(raw?.session_id || raw?.sessionId || raw?.visitor_session_id, 160),
    referrer: cleanText(raw?.referrer, 500),
    referrer_host: cleanText(raw?.referrer_host || raw?.referrerHost, 200),
    country: cleanText(raw?.country || raw?.geo?.country || raw?.geo?.country_code, 80),
    country_code: cleanText(raw?.country_code || raw?.countryCode || raw?.geo?.country_code, 20),
    region: cleanText(raw?.region || raw?.geo?.region, 120),
    regionCode: cleanText(raw?.regionCode || raw?.region_code || raw?.geo?.region_code, 40),
    city: cleanText(raw?.city || raw?.geo?.city, 120),
    timezone: cleanText(raw?.timezone, 120),
    browser: cleanText(raw?.browser, 80),
    device: cleanText(raw?.device, 80),
    platform: cleanText(raw?.platform, 80)
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  let response;
  try {
    if (request.method !== "POST") {
      response = json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    } else if (!hasValidSecret(request, env)) {
      response = json({ ok: false, error: "invalid_analytics_secret" }, { status: 401 });
    } else {
      let payload = {};
      try {
        payload = await request.json();
      } catch {
        payload = {};
      }
      const stored = await storePageVisitEvent(context, sanitizePayload(payload));
      response = json({
        ok: true,
        stored: Boolean(stored.stored),
        duplicate: Boolean(stored.duplicate),
        cityAvailable: Boolean(stored.cityAvailable),
        storageConfigured: Boolean(stored.configured),
        source: stored.source || "page_visit_kv",
        recordedAt: stored.recordedAt || "",
        error: stored.ok ? undefined : stored.error
      });
    }
  } catch {
    response = json({ ok: false, error: "analytics_ingest_unavailable" }, { status: 500 });
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
