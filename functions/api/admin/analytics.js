import { requireAdmin } from "../../_shared/admin-accounts.js";
import {
  ANALYTICS_WINDOWS,
  isLiveAnalyticsRow,
  loadPageVisitAnalytics as loadStoredPageVisitAnalytics,
  normalizeAnalyticsWindow,
  purgeNonLiveAnalyticsRows
} from "../../_shared/analytics-store.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const REQUIRED_CONFIG = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_ZONE_ID_DANIELCLANCY",
  "CLOUDFLARE_API_TOKEN_ANALYTICS"
];

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const RECENT_VISITS_KEY = "analytics:page_visits:recent";
const ROLLUP_KEY = "analytics:page_visits:rollup";
const RECENT_VISIT_LIMIT = 1000;
const LIVE_LOCATION_SOURCES = new Set(["page_visit_kv", "cloudflare_graphql", "streamsuites_event_mirror", "streamsuites_live"]);

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
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function hasEnv(env, key) {
  return Boolean(String(env?.[key] || "").trim());
}

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function countryCode(value) {
  const text = cleanText(value, 80).toUpperCase();
  if (/^[A-Z]{2}$/.test(text)) return text;
  const lookup = {
    "AUSTRALIA": "AU",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "USA": "US",
    "UNITED KINGDOM": "GB",
    "GREAT BRITAIN": "GB",
    "CANADA": "CA",
    "NEW ZEALAND": "NZ"
  };
  return lookup[text] || "";
}

function mergeCount(map, key, seed) {
  const id = key || "Unavailable";
  const existing = map.get(id) || { ...seed, count: 0 };
  existing.count += 1;
  map.set(id, existing);
}

function mergePageVisitEvent(map, key, seed, event) {
  const id = key || "Unavailable";
  const existing = map.get(id) || { ...seed, count: 0, requests: 0, sessionIds: new Set(), sessions: null };
  existing.count += 1;
  existing.requests += 1;
  const sessionId = cleanText(event?.session_id || event?.sessionId || event?.visitor_session_id, 160);
  if (sessionId) {
    existing.sessionIds.add(sessionId);
    existing.sessions = existing.sessionIds.size;
  }
  const eventTime = event?.recordedAt || event?.timestamp || "";
  if (eventTime && (!existing.lastSeen || eventTime > existing.lastSeen)) existing.lastSeen = eventTime;
  map.set(id, existing);
}

function topRows(map, limit = 20) {
  return [...map.values()]
    .map((row) => {
      const { sessionIds, ...rest } = row;
      return {
        ...rest,
        sessions: sessionIds instanceof Set && sessionIds.size ? sessionIds.size : row.sessions ?? null
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getKv(env) {
  return env?.DC_ADMIN_KV && typeof env.DC_ADMIN_KV.get === "function" && typeof env.DC_ADMIN_KV.put === "function"
    ? env.DC_ADMIN_KV
    : null;
}

function referrerHost(value) {
  const text = cleanText(value, 500);
  if (!text) return "";
  try {
    return new URL(text).hostname.replace(/^www\./, "");
  } catch {
    return text.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  }
}

function detectBrowser(userAgent) {
  const ua = String(userAgent || "");
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (!ua) return "";
  return "Other";
}

function detectDevice(userAgent) {
  const ua = String(userAgent || "");
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (!ua) return "";
  return "Desktop";
}

function detectPlatform(userAgent) {
  const ua = String(userAgent || "");
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "";
}

function configuredStreamSuitesAnalyticsUrl(env) {
  const raw = cleanText(env?.STREAMSUITES_ANALYTICS_URL, 1000);
  if (!raw) return "";
  try {
    return new URL(raw).toString();
  } catch {
    return "";
  }
}

function normalizeStreamSuitesAnalyticsRow(row, selectedWindow) {
  if (!row || typeof row !== "object") return null;
  const recordedAt = cleanText(row.recordedAt || row.recorded_at || row.lastSeen || row.timestamp, 80);
  const timestamp = Date.parse(recordedAt);
  if (!Number.isFinite(timestamp)) return null;
  const country = cleanText(row.country || row.country_name || row.country_code, 120);
  const code = countryCode(row.country_code || row.countryCode || row.country || country);
  if (!country && !code) return null;
  const sessions = positiveIntegerOrNull(row.sessions);
  const requests = positiveIntegerOrNull(row.requests ?? row.count ?? row.events) ?? 0;
  if (requests <= 0 && sessions === null) return null;
  return {
    eventId: cleanText(row.eventId || row.event_id, 160),
    source: "streamsuites_live",
    live: true,
    project: "danielclancy",
    source_namespace: "danielclancy",
    surface: cleanText(row.surface || "danielclancy_public", 120),
    event_type: cleanText(row.event_type || "danielclancy_page_visit", 120),
    city: cleanText(row.city, 120),
    region: cleanText(row.region, 120),
    regionCode: cleanText(row.regionCode || row.region_code, 40),
    country,
    country_code: code,
    latitude: safeNumber(row.latitude ?? row.lat),
    longitude: safeNumber(row.longitude ?? row.lon ?? row.lng),
    precision: cleanText(row.precision || (row.city ? "city" : code ? "country" : "unknown"), 40),
    sessions,
    requests: requests || sessions || 0,
    count: requests || sessions || 0,
    recordedAt,
    timestamp: recordedAt,
    lastSeen: cleanText(row.lastSeen || recordedAt, 80),
    page_path: cleanText(row.page_path || row.path, 500),
    page_url: cleanText(row.page_url || row.url, 500),
    referrer_host: cleanText(row.referrer_host || row.referrerHost, 200),
    browser: cleanText(row.browser, 80),
    device: cleanText(row.device, 80),
    platform: cleanText(row.platform, 80),
    window: selectedWindow
  };
}

function countryRowsFromLiveRows(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const code = countryCode(row.country_code || row.country);
    if (!code) continue;
    const existing = grouped.get(code) || {
      country: row.country || code,
      country_code: code,
      source: "streamsuites_live",
      live: true,
      precision: "country",
      requests: 0,
      sessions: null,
      lastSeen: ""
    };
    existing.requests += positiveIntegerOrNull(row.requests ?? row.count) ?? 0;
    const sessions = positiveIntegerOrNull(row.sessions);
    if (sessions !== null) existing.sessions = (existing.sessions || 0) + sessions;
    if (row.lastSeen && row.lastSeen > existing.lastSeen) existing.lastSeen = row.lastSeen;
    grouped.set(code, existing);
  }
  return [...grouped.values()].sort((a, b) => (b.requests || 0) - (a.requests || 0));
}

function cityRowsFromLiveRows(rows = []) {
  return rows
    .filter((row) => row.city)
    .map((row) => ({
      ...row,
      precision: row.precision || "city",
      source: "streamsuites_live",
      live: true
    }))
    .sort((a, b) => (b.requests || 0) - (a.requests || 0));
}

function topPagesFromLiveRows(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const path = row.page_path || row.page_url || "/";
    const existing = grouped.get(path) || { path, title: "", source: "streamsuites_live", requests: 0, sessions: null, lastSeen: "" };
    existing.requests += positiveIntegerOrNull(row.requests) ?? 0;
    const sessions = positiveIntegerOrNull(row.sessions);
    if (sessions !== null) existing.sessions = (existing.sessions || 0) + sessions;
    if (row.lastSeen && row.lastSeen > existing.lastSeen) existing.lastSeen = row.lastSeen;
    grouped.set(path, existing);
  }
  return [...grouped.values()].sort((a, b) => (b.requests || 0) - (a.requests || 0)).slice(0, 20);
}

function referrersFromLiveRows(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    if (!row.referrer_host) continue;
    const existing = grouped.get(row.referrer_host) || { host: row.referrer_host, source: "streamsuites_live", requests: 0, sessions: null, lastSeen: "" };
    existing.requests += positiveIntegerOrNull(row.requests) ?? 0;
    const sessions = positiveIntegerOrNull(row.sessions);
    if (sessions !== null) existing.sessions = (existing.sessions || 0) + sessions;
    if (row.lastSeen && row.lastSeen > existing.lastSeen) existing.lastSeen = row.lastSeen;
    grouped.set(row.referrer_host, existing);
  }
  return [...grouped.values()].sort((a, b) => (b.requests || 0) - (a.requests || 0)).slice(0, 20);
}

export async function queryStreamSuitesAnalytics(env, fetchImpl = fetch, options = {}) {
  const selectedWindow = normalizeAnalyticsWindow(options.window);
  const endpoint = configuredStreamSuitesAnalyticsUrl(env);
  if (!endpoint) {
    return {
      configured: false,
      connected: false,
      source: "streamsuites_not_configured",
      rows: [],
      sourceBreakdown: {},
      warnings: []
    };
  }
  const url = new URL(endpoint);
  url.searchParams.set("window", selectedWindow);
  const headers = { accept: "application/json" };
  const secret = cleanText(env?.DANIELCLANCY_ANALYTICS_READ_SECRET, 500);
  if (secret) headers.authorization = `Bearer ${secret}`;
  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok !== true) {
      return {
        configured: true,
        connected: false,
        source: "streamsuites_error",
        status: response.status,
        rows: [],
        sourceBreakdown: {},
        warnings: ["StreamSuites analytics source returned an error."]
      };
    }
    const rows = (Array.isArray(payload.rows) ? payload.rows : [])
      .map((row) => normalizeStreamSuitesAnalyticsRow(row, selectedWindow))
      .filter(Boolean);
    return {
      configured: true,
      connected: true,
      source: "streamsuites_live",
      queriedAt: cleanText(payload.generatedAt || new Date().toISOString(), 80),
      selectedWindow,
      rows,
      sourceBreakdown: payload.sourceBreakdown && typeof payload.sourceBreakdown === "object" ? payload.sourceBreakdown : {},
      warnings: Array.isArray(payload.warnings) ? payload.warnings.map((item) => cleanText(item, 220)).filter(Boolean) : []
    };
  } catch {
    return {
      configured: true,
      connected: false,
      source: "streamsuites_error",
      rows: [],
      sourceBreakdown: {},
      warnings: ["StreamSuites analytics source is configured but unreachable."]
    };
  }
}

export function buildPageVisitEvent(context, payload = {}) {
  const request = context?.request;
  const cf = request?.cf || {};
  const headers = request?.headers;
  const userAgent = headers?.get("User-Agent") || "";
  const surface = cleanText(payload.surface, 80) || (String(payload.domain || "").includes("danielclancy.net") && !String(payload.domain || "").includes("admin")
    ? "danielclancy_public"
    : "danielclancy_admin");
  const pagePath = cleanText(payload.pagePath || payload.path || payload.route || "/", 500);
  return {
    timestamp: new Date().toISOString(),
    surface,
    page_path: pagePath.startsWith("/") || pagePath.startsWith("#/") ? pagePath : "/",
    page_url: cleanText(payload.pageUrl || payload.url, 500),
    page_title: cleanText(payload.title, 160),
    session_id: cleanText(payload.session_id || payload.sessionId || payload.visitor_session_id, 160),
    referrer_host: referrerHost(payload.referrer || payload.referrerHost),
    country: cleanText(cf.country || payload.country, 80),
    region: cleanText(cf.region || payload.region, 120),
    regionCode: cleanText(cf.regionCode || payload.regionCode, 40),
    city: cleanText(cf.city || payload.city, 120),
    timezone: cleanText(cf.timezone || payload.timezone, 120),
    colo: cleanText(cf.colo || payload.colo, 40),
    browser: cleanText(payload.browser || detectBrowser(userAgent), 80),
    device: cleanText(payload.device || detectDevice(userAgent), 80),
    platform: cleanText(payload.platform || detectPlatform(userAgent), 80),
    admin: Boolean(payload.admin),
    authenticated: Boolean(payload.authenticated)
  };
}

export function aggregatePageVisitEvents(events = []) {
  const pages = new Map();
  const referrers = new Map();
  const countries = new Map();
  const regions = new Map();
  const cities = new Map();
  const browsers = new Map();
  const devices = new Map();
  let cityCount = 0;
  let countryOnlyCount = 0;

  for (const event of events.filter(isLiveAnalyticsRow)) {
    mergePageVisitEvent(pages, event.page_path || "/", {
      path: event.page_path || "/",
      title: event.page_title || "",
      source: "page_visit_kv"
    }, event);
    if (event.referrer_host) {
      mergePageVisitEvent(referrers, event.referrer_host, { host: event.referrer_host, source: "page_visit_kv" }, event);
    }
    if (event.country) {
      mergePageVisitEvent(countries, event.country, { country: event.country, source: "page_visit_kv" }, event);
    }
    if (event.region || event.country) {
      const key = `${event.region || "Unavailable"}|${event.country || ""}`;
      mergePageVisitEvent(regions, key, {
        region: event.region || "Unavailable",
        country: event.country || "",
        source: "page_visit_kv",
        precision: event.region ? "region" : "country"
      }, event);
    }
    if (event.city) {
      cityCount += 1;
      const key = `${event.city}|${event.region || ""}|${event.country || ""}`;
      mergePageVisitEvent(cities, key, {
        city: event.city,
        region: event.region || "",
        country: event.country || "",
        source: "page_visit_kv",
        precision: "city"
      }, event);
    } else if (event.country) {
      countryOnlyCount += 1;
    }
    if (event.browser) {
      mergePageVisitEvent(browsers, event.browser, { browser: event.browser, source: "page_visit_kv" }, event);
    }
    if (event.device) {
      mergePageVisitEvent(devices, event.device, { device: event.device, source: "page_visit_kv" }, event);
    }
  }

  return {
    events: events.length,
    cityEvents: cityCount,
    countryOnlyEvents: countryOnlyCount,
    topPages: topRows(pages),
    referrers: topRows(referrers),
    countries: topRows(countries),
    regions: topRows(regions),
    cities: topRows(cities),
    browsers: topRows(browsers),
    devices: topRows(devices)
  };
}

export async function storePageVisitEvent(context, payload = {}) {
  const kv = getKv(context?.env);
  if (!kv) {
    return { ok: false, configured: false, error: "dc_admin_kv_not_configured" };
  }
  const event = buildPageVisitEvent(context, payload);
  try {
    const existing = parseJson(await kv.get(RECENT_VISITS_KEY), { items: [] });
    const items = Array.isArray(existing?.items) ? existing.items : [];
    items.unshift(event);
    const capped = items.slice(0, RECENT_VISIT_LIMIT);
    const rollup = aggregatePageVisitEvents(capped);
    const updatedAt = new Date().toISOString();
    await kv.put(RECENT_VISITS_KEY, JSON.stringify({ updatedAt, limit: RECENT_VISIT_LIMIT, items: capped }));
    await kv.put(ROLLUP_KEY, JSON.stringify({ updatedAt, source: "page_visit_kv", ...rollup }));
    return { ok: true, configured: true, stored: true, event, count: capped.length, updatedAt };
  } catch {
    return { ok: false, configured: true, error: "page_visit_storage_failed" };
  }
}

async function loadPageVisitAnalytics(env) {
  const kv = getKv(env);
  if (!kv) {
    return {
      configured: false,
      source: "dc_admin_kv_missing",
      storage: { configured: false, status: "missing", lastResult: "DC_ADMIN_KV missing" },
      rollup: aggregatePageVisitEvents([])
    };
  }
  try {
    const [recentRaw, rollupRaw] = await Promise.all([kv.get(RECENT_VISITS_KEY), kv.get(ROLLUP_KEY)]);
    const recent = parseJson(recentRaw, { items: [] });
    const rollup = parseJson(rollupRaw, null) || aggregatePageVisitEvents(Array.isArray(recent?.items) ? recent.items : []);
    return {
      configured: true,
      source: "page_visit_kv",
      storage: {
        configured: true,
        status: "connected",
        key: RECENT_VISITS_KEY,
        rollupKey: ROLLUP_KEY,
        lastResult: "loaded",
        updatedAt: recent?.updatedAt || rollup?.updatedAt || ""
      },
      rollup: {
        ...aggregatePageVisitEvents([]),
        ...rollup
      }
    };
  } catch {
    return {
      configured: true,
      source: "page_visit_kv_error",
      storage: { configured: true, status: "error", lastResult: "read_failed" },
      rollup: aggregatePageVisitEvents([])
    };
  }
}

function graphQlQuery(kind) {
  const fields = {
    totals: "totals: httpRequestsAdaptiveGroups(limit: 1, filter: $filter) { count sum { visits edgeResponseBytes } }",
    pages: "topPages: httpRequestsAdaptiveGroups(limit: 12, filter: $filter, orderBy: [count_DESC]) { count sum { visits edgeResponseBytes } dimensions { metric: clientRequestPath } }",
    countries: "countries: httpRequestsAdaptiveGroups(limit: 20, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { country: clientCountryName } }",
    browsers: "browsers: httpRequestsAdaptiveGroups(limit: 12, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { browser: userAgentBrowser } }",
    devices: "devices: httpRequestsAdaptiveGroups(limit: 12, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { device: clientDeviceType } }"
  };
  if (!fields[kind]) return "";
  return `query DanielClancyAnalytics($zoneTag: string, $filter: filter) { viewer { zones(filter: { zoneTag: $zoneTag }) { ${fields[kind]} } } }`;
}

async function fetchGraphQlSection(env, kind, filter, fetchImpl = fetch) {
  const response = await fetchImpl(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${String(env.CLOUDFLARE_API_TOKEN_ANALYTICS || "")}`
    },
    body: JSON.stringify({
      query: graphQlQuery(kind),
      variables: {
        zoneTag: String(env.CLOUDFLARE_ZONE_ID_DANIELCLANCY || ""),
        filter
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || Array.isArray(payload.errors)) {
    const first = Array.isArray(payload.errors) ? payload.errors[0] : null;
    return {
      ok: false,
      kind,
      status: response.status,
      error: cleanText(first?.message || `cloudflare_http_${response.status}`, 220)
    };
  }
  const zone = payload?.data?.viewer?.zones?.[0] || {};
  return { ok: true, kind, rows: Array.isArray(zone[kind]) ? zone[kind] : [] };
}

function normalizeGraphQlResults(results) {
  const notes = [];
  const sectionStatus = {};
  const output = {
    totals: {
      requests: null,
      visits: null,
      pageViews: null,
      uniqueVisitors: null,
      bandwidth: null,
      threats: null,
      cachedRequests: null
    },
    topPages: [],
    referrers: [],
    countries: [],
    regions: [],
    cities: [],
    devices: [],
    browsers: [],
    errors: [],
    sectionStatus
  };
  for (const result of results) {
    if (result.skipped) {
      sectionStatus[result.kind] = {
        status: result.status || "unavailable",
        message: result.message || ""
      };
      if (result.message) notes.push(result.message);
      continue;
    }
    if (!result.ok) {
      output.errors.push({ section: result.kind, status: result.status, error: result.error });
      sectionStatus[result.kind] = {
        status: "unavailable",
        message: cloudflareSectionMessage(result.kind, result.error)
      };
      notes.push(sectionStatus[result.kind].message);
      continue;
    }
    sectionStatus[result.kind] = { status: "live", message: `Cloudflare ${result.kind} query loaded.` };
    if (result.kind === "totals") {
      const row = result.rows[0] || {};
      output.totals.requests = safeNumber(row.count);
      output.totals.visits = safeNumber(row.sum?.visits);
      output.totals.bandwidth = safeNumber(row.sum?.edgeResponseBytes);
    }
    if (result.kind === "pages") {
      output.topPages = result.rows.map((row) => ({
        path: cleanText(row.dimensions?.metric || "/", 500),
        requests: safeNumber(row.count),
        visits: safeNumber(row.sum?.visits),
        bandwidth: safeNumber(row.sum?.edgeResponseBytes),
        source: "cloudflare_graphql"
      })).filter((row) => row.path);
    }
    if (result.kind === "referrers") {
      output.referrers = result.rows.map((row) => ({
        host: cleanText(row.dimensions?.metric || "Direct / none", 200),
        requests: safeNumber(row.count),
        visits: safeNumber(row.sum?.visits),
        source: "cloudflare_graphql"
      }));
    }
    if (result.kind === "countries") {
      output.countries = result.rows.map((row) => ({
        country: cleanText(row.dimensions?.country || "Unavailable", 120),
        country_code: countryCode(row.dimensions?.country),
        requests: safeNumber(row.count),
        visits: safeNumber(row.sum?.visits),
        source: "cloudflare_graphql",
        live: true,
        precision: "country"
      }));
    }
    if (result.kind === "browsers") {
      output.browsers = result.rows.map((row) => ({
        browser: cleanText(row.dimensions?.browser || "Unavailable", 120),
        requests: safeNumber(row.count),
        visits: safeNumber(row.sum?.visits),
        source: "cloudflare_graphql"
      }));
    }
    if (result.kind === "devices") {
      output.devices = result.rows.map((row) => ({
        device: cleanText(row.dimensions?.device || "Unavailable", 120),
        requests: safeNumber(row.count),
        visits: safeNumber(row.sum?.visits),
        source: "cloudflare_graphql"
      }));
    }
  }
  return { ...output, notes };
}

function cloudflareSectionMessage(kind, error = "") {
  if (kind === "referrers") return "Referrer host is unavailable from the current Cloudflare dataset.";
  if (kind === "cities") return "City detail is sourced from page-visit request geo metadata.";
  if (error) return `Cloudflare ${kind} query unavailable for the selected window.`;
  return `Cloudflare ${kind} query unavailable.`;
}

function cloudflareFilterForWindow(windowKey, now = new Date()) {
  const safeWindow = normalizeAnalyticsWindow(windowKey);
  const since = new Date(now.getTime() - ANALYTICS_WINDOWS[safeWindow]).toISOString();
  return {
    window: safeWindow,
    since,
    until: now.toISOString(),
    filter: {
      datetime_geq: since,
      datetime_lt: now.toISOString(),
      requestSource: "eyeball"
    }
  };
}

export async function queryCloudflareAnalytics(env, fetchImpl = fetch, options = {}) {
  const selectedWindow = normalizeAnalyticsWindow(options.window);
  const missingConfig = REQUIRED_CONFIG.filter((key) => !hasEnv(env, key));
  if (missingConfig.length) {
    return {
      configured: false,
      missingConfig,
      window: selectedWindow,
      source: "cloudflare_analytics_not_configured",
      notes: ["Cloudflare Analytics env vars are missing; live Cloudflare metrics are not queried."]
    };
  }
  const now = new Date();
  const { since, until, filter } = cloudflareFilterForWindow(selectedWindow, now);
  const sections = [
    ["totals", filter],
    ["pages", filter],
    ["countries", filter],
    ["browsers", filter],
    ["devices", filter]
  ];
  const results = [];
  for (const [kind, filter] of sections) {
    try {
      results.push(await fetchGraphQlSection(env, kind, filter, fetchImpl));
    } catch (error) {
      results.push({
        ok: false,
        kind,
        status: 0,
        error: cleanText(error instanceof Error ? error.message : "cloudflare_query_failed", 220)
      });
    }
  }
  results.push({
    ok: false,
    skipped: true,
    kind: "referrers",
    status: "unavailable",
    message: "Referrer host is unavailable from the current Cloudflare dataset."
  });
  results.push({
    ok: false,
    skipped: true,
    kind: "cities",
    status: "unavailable",
    message: "City detail is sourced from page-visit request geo metadata."
  });
  const normalized = normalizeGraphQlResults(results);
  const anySuccess = results.some((result) => result.ok);
  return {
    configured: true,
    window: selectedWindow,
    source: anySuccess ? (normalized.errors.length ? "cloudflare_graphql_partial" : "cloudflare_graphql") : "cloudflare_graphql_error",
    queriedAt: now.toISOString(),
    windows: {
      selected: { label: selectedWindow, since, until }
    },
    ...normalized
  };
}

function fallbackCityRows(pageVisit, cloudflare) {
  if (pageVisit.rollup.cities.length) return pageVisit.rollup.cities;
  return [];
}

function countryRows(pageVisit, cloudflare) {
  const rows = pageVisit.rollup.countries.length ? pageVisit.rollup.countries : cloudflare.countries || [];
  return rows.slice(0, 20).map((row) => ({
    country: row.country || "Unavailable",
    country_code: row.country_code || countryCode(row.country),
    count: row.count ?? row.requests ?? row.visits ?? null,
    requests: row.requests ?? row.count ?? row.visits ?? null,
    sessions: row.sessions ?? null,
    lastSeen: row.lastSeen || (row.source === "cloudflare_graphql" ? cloudflare.queriedAt || "" : ""),
    source: row.source || "unavailable",
    live: row.live === true && LIVE_LOCATION_SOURCES.has(row.source),
    precision: "country"
  }));
}

function freshnessState(pageVisit, cloudflare, streamsuites) {
  if (streamsuites?.rows?.length) {
    const lastEvent = Date.parse(streamsuites.rows[0]?.lastSeen || streamsuites.queriedAt || "");
    if (!Number.isFinite(lastEvent)) return "live_stale";
    return Date.now() - lastEvent <= 60 * 60 * 1000 ? "live_recent" : "live_stale";
  }
  if (pageVisit.sampleRows?.length && !pageVisit.rollup.events) return "sample_only";
  if (!pageVisit.rollup.events && cloudflare.source === "cloudflare_graphql_partial") return "cloudflare_partial";
  if (!pageVisit.rollup.events) return "no_live_events";
  const lastEvent = Date.parse(pageVisit.rollup.lastEventAt || pageVisit.storage?.updatedAt || "");
  if (!Number.isFinite(lastEvent)) return "live_stale";
  return Date.now() - lastEvent <= 60 * 60 * 1000 ? "live_recent" : "live_stale";
}

function liveLocationRows(cityRows, countryRowsList) {
  const validCityRows = cityRows.filter((row) => {
    const source = String(row?.source || "");
    const timestamp = Date.parse(row?.lastSeen || row?.recordedAt || row?.timestamp || "");
    return row?.live === true && LIVE_LOCATION_SOURCES.has(source) && Number.isFinite(timestamp);
  });
  const cityCountries = new Set(validCityRows.map((row) => countryCode(row.country_code || row.country)).filter(Boolean));
  const validCountryRows = countryRowsList.filter((row) => {
    const source = String(row?.source || "");
    const timestamp = Date.parse(row?.lastSeen || row?.recordedAt || row?.timestamp || "");
    const code = countryCode(row.country_code || row.country);
    return row?.live === true && LIVE_LOCATION_SOURCES.has(source) && Number.isFinite(timestamp) && (!code || !cityCountries.has(code));
  });
  return [...validCityRows, ...validCountryRows];
}

function sourceBreakdown(pageVisit, cloudflare, streamsuites, liveRows = []) {
  const countSource = (rows, source) => rows.filter((row) => String(row?.source || "") === source).length;
  const sampleRows = pageVisit.sampleRows || [];
  const staleRows = [...(pageVisit.staleRows || []), ...(pageVisit.unknownWindowRows || [])];
  return {
    page_visit_kv: countSource(liveRows, "page_visit_kv"),
    streamsuites_event_mirror: countSource(liveRows, "streamsuites_event_mirror"),
    streamsuites_live: countSource(liveRows, "streamsuites_live"),
    cloudflare_graphql: countSource(liveRows, "cloudflare_graphql"),
    sample_fallback: sampleRows.length,
    stale_legacy: staleRows.length,
    streamsuites_configured: streamsuites?.configured ? 1 : 0,
    streamsuites_connected: streamsuites?.connected ? 1 : 0
  };
}

export async function analyticsStatus(env, options = {}) {
  const selectedWindow = normalizeAnalyticsWindow(options.window);
  const missingConfig = REQUIRED_CONFIG.filter((key) => !hasEnv(env, key));
  const [streamsuites, cloudflare, pageVisit] = await Promise.all([
    queryStreamSuitesAnalytics(env, options.fetchImpl, { window: selectedWindow }),
    queryCloudflareAnalytics(env, options.fetchImpl, { window: selectedWindow }),
    loadStoredPageVisitAnalytics(env, { window: selectedWindow })
  ]);
  const streamSuitesRows = streamsuites.connected ? streamsuites.rows : [];
  const streamSuitesCityRows = cityRowsFromLiveRows(streamSuitesRows);
  const cityRows = streamSuitesCityRows.length ? streamSuitesCityRows : fallbackCityRows(pageVisit, cloudflare);
  const countries = streamSuitesRows.length ? countryRowsFromLiveRows(streamSuitesRows) : countryRows(pageVisit, cloudflare);
  const liveRows = liveLocationRows(cityRows, countries);
  const breakdown = sourceBreakdown(pageVisit, cloudflare, streamsuites, liveRows);
  const freshness = freshnessState(pageVisit, cloudflare, streamsuites);
  const zeroPageVisitEvents = !pageVisit.rollup.events;
  const partialStatus = {
    pages: cloudflare.sectionStatus?.pages?.status || "unavailable",
    referrers: cloudflare.sectionStatus?.referrers?.status || "unavailable",
    countries: cloudflare.sectionStatus?.countries?.status || "unavailable",
    browsers: cloudflare.sectionStatus?.browsers?.status || "unavailable",
    devices: cloudflare.sectionStatus?.devices?.status || "unavailable",
    pageVisitCityDetail: pageVisit.rollup.cityEvents ? "available" : zeroPageVisitEvents ? "no_events" : "unavailable"
  };
  const notes = [
    ...(streamsuites.configured
      ? [streamsuites.connected ? "StreamSuites analytics source connected." : "StreamSuites analytics source configured but unavailable."]
      : ["StreamSuites analytics source is not configured."]),
    ...(cloudflare.notes || []),
    ...(pageVisit.rollup.cityEvents
      ? [`City detail is available from ${pageVisit.rollup.cityEvents} page-visit event(s).`]
      : zeroPageVisitEvents
        ? ["No page-visit events have been captured yet."]
        : ["City detail is sourced from page-visit request geo metadata."]),
    ...(pageVisit.unknownWindowRows?.length ? [`${pageVisit.unknownWindowRows.length} page-visit row(s) have no timestamp and were excluded from the selected live window.`] : []),
    "Secret values are never returned."
  ];
  const warnings = [
    ...(pageVisit.sampleRows?.length ? ["Sample analytics rows ignored."] : []),
    ...((pageVisit.staleRows?.length || pageVisit.unknownWindowRows?.length) ? ["Stale analytics rows ignored."] : []),
    ...(!streamsuites.connected && streamsuites.configured ? ["StreamSuites analytics source unavailable; falling back to local/Cloudflare sources."] : []),
    ...(!pageVisit.configured ? ["DC_ADMIN_KV is unavailable; Admin analytics cannot show page-visit location rows."] : []),
    ...(!cloudflare.configured ? ["Cloudflare GraphQL analytics is not configured."] : [])
  ];
  const source = streamsuites.connected
    ? "streamsuites_live"
    : cloudflare.configured
    ? cloudflare.source
    : pageVisit.rollup.events
      ? "page_visit_kv"
      : "unavailable";
  return {
    ok: true,
    configured: streamsuites.configured || missingConfig.length === 0,
    source,
    window: selectedWindow,
    supportedWindows: Object.keys(ANALYTICS_WINDOWS),
    adminApiConnected: true,
    kvConnected: Boolean(pageVisit.configured),
    streamSuitesAnalyticsConfigured: Boolean(streamsuites.configured),
    streamSuitesAnalyticsConnected: Boolean(streamsuites.connected),
    cloudflareGraphqlConnected: Boolean(cloudflare.configured && !String(cloudflare.source || "").includes("error")),
    analyticsIngestConfigured: hasEnv(env, "DANIELCLANCY_ANALYTICS_INGEST_SECRET") && Boolean(getKv(env)),
    liveRowsCount: liveRows.length,
    staleRowsCount: (pageVisit.staleRows || []).length + (pageVisit.unknownWindowRows || []).length,
    sampleRowsCount: (pageVisit.sampleRows || []).length,
    lastLiveEventAt: streamSuitesRows[0]?.lastSeen || pageVisit.rollup.lastEventAt || "",
    selectedWindow,
    sourceBreakdown: breakdown,
    warnings,
    repairActionsAvailable: {
      purgeNonLiveFallbackRows: Boolean(getKv(env))
    },
    lastChecked: new Date().toISOString(),
    lastCloudflareQueryTime: cloudflare.queriedAt || "",
    lastLivePageVisitEventTime: streamSuitesRows[0]?.lastSeen || pageVisit.rollup.lastEventAt || "",
    sourceFreshnessState: freshness,
    totals: {
      ...cloudflare.totals,
      pageVisitEvents: streamSuitesRows.reduce((total, row) => total + (positiveIntegerOrNull(row.requests) ?? 0), 0) || pageVisit.rollup.events || 0
    },
    topPages: streamSuitesRows.length ? topPagesFromLiveRows(streamSuitesRows) : pageVisit.rollup.topPages.length ? pageVisit.rollup.topPages : cloudflare.topPages || [],
    referrers: streamSuitesRows.length ? referrersFromLiveRows(streamSuitesRows) : pageVisit.rollup.referrers.length ? pageVisit.rollup.referrers : cloudflare.referrers || [],
    countries,
    regions: pageVisit.rollup.regions.length ? pageVisit.rollup.regions : cloudflare.regions || [],
    cities: cityRows,
    devices: pageVisit.rollup.devices.length ? pageVisit.rollup.devices : cloudflare.devices || [],
    browsers: pageVisit.rollup.browsers.length ? pageVisit.rollup.browsers : cloudflare.browsers || [],
    cloudflare: {
      configured: cloudflare.configured,
      source: cloudflare.source,
      lastResult: cloudflare.source,
      lastQueryTime: cloudflare.queriedAt || "",
      errors: cloudflare.errors || [],
      windows: cloudflare.windows || null
    },
    streamSuitesAnalytics: {
      configured: Boolean(streamsuites.configured),
      connected: Boolean(streamsuites.connected),
      source: streamsuites.source,
      lastResult: streamsuites.connected ? "connected" : streamsuites.configured ? "error" : "not_configured",
      lastQueryTime: streamsuites.queriedAt || "",
      rowCount: streamSuitesRows.length
    },
    partialStatus,
    pageVisits: {
      configured: pageVisit.configured,
      source: pageVisit.source,
      window: selectedWindow,
      storage: pageVisit.storage,
      events: pageVisit.rollup.events || 0,
      cityEvents: pageVisit.rollup.cityEvents || 0,
      countryOnlyEvents: pageVisit.rollup.countryOnlyEvents || 0,
      liveRows: pageVisit.liveRows || [],
      sampleRows: pageVisit.sampleRows || [],
      staleRows: pageVisit.staleRows || [],
      unknownWindowRows: pageVisit.unknownWindowRows || [],
      lastLiveEventTime: streamSuitesRows[0]?.lastSeen || pageVisit.rollup.lastEventAt || "",
      emptyMessage: zeroPageVisitEvents ? "No page-visit events have been captured yet." : ""
    },
    location: {
      source: streamSuitesRows.length ? "streamsuites_live" : pageVisit.rollup.events ? "page_visit_kv" : cloudflare.configured ? cloudflare.source : "unavailable",
      events: streamSuitesRows.reduce((total, row) => total + (positiveIntegerOrNull(row.requests) ?? 0), 0) || pageVisit.rollup.events || 0,
      eventCount: streamSuitesRows.reduce((total, row) => total + (positiveIntegerOrNull(row.requests) ?? 0), 0) || pageVisit.rollup.events || 0,
      cityEvents: pageVisit.rollup.cityEvents || 0,
      cityEventCount: pageVisit.rollup.cityEvents || 0,
      countryOnlyEvents: pageVisit.rollup.countryOnlyEvents || 0,
      countryOnlyEventCount: pageVisit.rollup.countryOnlyEvents || 0,
      precision: cityRows.length ? "city" : countries.length ? "country" : "unavailable",
      liveRows: cityRows,
      liveLocationRows: liveRows,
      sampleRows: pageVisit.sampleRows || [],
      staleRows: pageVisit.staleRows || [],
      lastUpdated: streamSuitesRows[0]?.lastSeen || pageVisit.rollup.lastEventAt || pageVisit.storage?.updatedAt || cloudflare.queriedAt || "",
      freshnessState: freshness,
      emptyMessage: zeroPageVisitEvents ? "No page-visit events have been captured yet." : ""
    },
    readiness: {
      cloudflare: Object.fromEntries(REQUIRED_CONFIG.map((key) => [key, hasEnv(env, key)])),
      dcAdminKvConfigured: Boolean(getKv(env)),
      streamSuitesAnalyticsConfigured: Boolean(streamsuites.configured),
      streamSuitesAnalyticsConnected: Boolean(streamsuites.connected),
      lastCloudflareQueryResult: cloudflare.source,
      lastCloudflareQueryTime: cloudflare.queriedAt || "",
      lastLivePageVisitEventTime: streamSuitesRows[0]?.lastSeen || pageVisit.rollup.lastEventAt || "",
      sourceFreshnessState: freshness,
      lastPageVisitStorageResult: pageVisit.storage.lastResult
    },
    requiredConfig: REQUIRED_CONFIG,
    missingConfig,
    notes
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  let response;
  try {
    if (request.method === "POST") {
      const admin = await requireAdmin(request, env);
      if (admin.error) {
        response = json({ ok: false, error: admin.error }, { status: admin.status });
      } else {
        const body = await request.json().catch(() => ({}));
        if (body?.action !== "purge_non_live_fallback_rows") {
          response = json({ ok: false, error: "unknown_analytics_action" }, { status: 400 });
        } else {
          response = json({ ok: true, action: body.action, result: await purgeNonLiveAnalyticsRows(env) });
        }
      }
    } else if (request.method !== "GET") {
      response = json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    } else {
      const admin = await requireAdmin(request, env);
      if (admin.error) {
        response = json({ ok: false, error: admin.error }, { status: admin.status });
      } else {
        const url = new URL(request.url);
        response = json({
          ...(await analyticsStatus(env, { window: url.searchParams.get("window") })),
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
