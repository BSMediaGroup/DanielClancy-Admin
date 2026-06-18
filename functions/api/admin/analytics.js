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

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const RECENT_VISITS_KEY = "analytics:page_visits:recent";
const ROLLUP_KEY = "analytics:page_visits:rollup";
const RECENT_VISIT_LIMIT = 1000;

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

function mergeCount(map, key, seed) {
  const id = key || "Unavailable";
  const existing = map.get(id) || { ...seed, count: 0 };
  existing.count += 1;
  map.set(id, existing);
}

function topRows(map, limit = 20) {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
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

  for (const event of events) {
    mergeCount(pages, event.page_path || "/", {
      path: event.page_path || "/",
      title: event.page_title || "",
      source: "page_visit_kv"
    });
    if (event.referrer_host) {
      mergeCount(referrers, event.referrer_host, { host: event.referrer_host, source: "page_visit_kv" });
    }
    if (event.country) {
      mergeCount(countries, event.country, { country: event.country, source: "page_visit_kv" });
    }
    if (event.region || event.country) {
      const key = `${event.region || "Unavailable"}|${event.country || ""}`;
      mergeCount(regions, key, {
        region: event.region || "Unavailable",
        country: event.country || "",
        source: "page_visit_kv",
        precision: event.region ? "region" : "country"
      });
    }
    if (event.city) {
      cityCount += 1;
      const key = `${event.city}|${event.region || ""}|${event.country || ""}`;
      mergeCount(cities, key, {
        city: event.city,
        region: event.region || "",
        country: event.country || "",
        source: "page_visit_kv",
        precision: "city"
      });
    } else if (event.country) {
      countryOnlyCount += 1;
    }
    if (event.browser) {
      mergeCount(browsers, event.browser, { browser: event.browser, source: "page_visit_kv" });
    }
    if (event.device) {
      mergeCount(devices, event.device, { device: event.device, source: "page_visit_kv" });
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
    referrers: "referrers: httpRequestsAdaptiveGroups(limit: 12, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { metric: clientRefererHost } }",
    countries: "countries: httpRequestsAdaptiveGroups(limit: 20, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { country: clientCountryName } }",
    browsers: "browsers: httpRequestsAdaptiveGroups(limit: 12, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { browser: userAgentBrowser } }",
    devices: "devices: httpRequestsAdaptiveGroups(limit: 12, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { device: clientDeviceType } }",
    cities: "cities: httpRequestsAdaptiveGroups(limit: 20, filter: $filter, orderBy: [count_DESC]) { count sum { visits } dimensions { city: clientCityName region: clientRegion country: clientCountryName } }"
  };
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
    errors: []
  };
  for (const result of results) {
    if (!result.ok) {
      output.errors.push({ section: result.kind, status: result.status, error: result.error });
      notes.push(`Cloudflare ${result.kind} query unavailable: ${result.error}`);
      continue;
    }
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
        requests: safeNumber(row.count),
        visits: safeNumber(row.sum?.visits),
        source: "cloudflare_graphql",
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
    if (result.kind === "cities") {
      output.cities = result.rows.map((row) => ({
        city: cleanText(row.dimensions?.city || "", 120),
        region: cleanText(row.dimensions?.region || "", 120),
        country: cleanText(row.dimensions?.country || "", 120),
        count: safeNumber(row.count),
        visits: safeNumber(row.sum?.visits),
        source: "cloudflare_graphql",
        precision: row.dimensions?.city ? "city" : row.dimensions?.region ? "region" : "country"
      })).filter((row) => row.city);
    }
  }
  return { ...output, notes };
}

export async function queryCloudflareAnalytics(env, fetchImpl = fetch) {
  const missingConfig = REQUIRED_CONFIG.filter((key) => !hasEnv(env, key));
  if (missingConfig.length) {
    return {
      configured: false,
      missingConfig,
      source: "cloudflare_analytics_not_configured",
      notes: ["Cloudflare Analytics env vars are missing; live Cloudflare metrics are not queried."]
    };
  }
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const commonFilter = {
    datetime_geq: since7d,
    datetime_lt: now.toISOString(),
    requestSource: "eyeball"
  };
  const totalsFilter = {
    datetime_geq: since24h,
    datetime_lt: now.toISOString(),
    requestSource: "eyeball"
  };
  const sections = [
    ["totals", totalsFilter],
    ["pages", commonFilter],
    ["referrers", commonFilter],
    ["countries", commonFilter],
    ["browsers", commonFilter],
    ["devices", commonFilter],
    ["cities", commonFilter]
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
  const normalized = normalizeGraphQlResults(results);
  const anySuccess = results.some((result) => result.ok);
  return {
    configured: true,
    source: anySuccess ? (normalized.errors.length ? "cloudflare_graphql_partial" : "cloudflare_graphql") : "cloudflare_graphql_error",
    windows: {
      totals: { label: "last_24_hours", since: since24h, until: now.toISOString() },
      grouped: { label: "last_7_days", since: since7d, until: now.toISOString() }
    },
    ...normalized
  };
}

function fallbackCityRows(pageVisit, cloudflare) {
  if (pageVisit.rollup.cities.length) return pageVisit.rollup.cities;
  if (cloudflare.cities?.length) return cloudflare.cities;
  return [];
}

function countryRows(pageVisit, cloudflare) {
  const rows = pageVisit.rollup.countries.length ? pageVisit.rollup.countries : cloudflare.countries || [];
  return rows.slice(0, 20).map((row) => ({
    country: row.country || "Unavailable",
    count: row.count ?? row.requests ?? row.visits ?? null,
    source: row.source || "unavailable",
    precision: "country"
  }));
}

export async function analyticsStatus(env, options = {}) {
  const missingConfig = REQUIRED_CONFIG.filter((key) => !hasEnv(env, key));
  const [cloudflare, pageVisit] = await Promise.all([
    queryCloudflareAnalytics(env, options.fetchImpl),
    loadPageVisitAnalytics(env)
  ]);
  const cityRows = fallbackCityRows(pageVisit, cloudflare);
  const countries = countryRows(pageVisit, cloudflare);
  const zeroPageVisitEvents = !pageVisit.rollup.events;
  const notes = [
    ...(cloudflare.notes || []),
    ...(pageVisit.rollup.cityEvents
      ? [`City detail is available from ${pageVisit.rollup.cityEvents} page-visit event(s).`]
      : zeroPageVisitEvents
        ? ["No page-visit events have been captured yet."]
        : ["City detail unavailable from current data source"]),
    "Secret values are never returned."
  ];
  const source = cloudflare.configured
    ? cloudflare.source
    : pageVisit.rollup.events
      ? "page_visit_kv"
      : "unavailable";
  return {
    ok: true,
    configured: missingConfig.length === 0,
    source,
    lastChecked: new Date().toISOString(),
    totals: {
      ...cloudflare.totals,
      pageVisitEvents: pageVisit.rollup.events || 0
    },
    topPages: pageVisit.rollup.topPages.length ? pageVisit.rollup.topPages : cloudflare.topPages || [],
    referrers: pageVisit.rollup.referrers.length ? pageVisit.rollup.referrers : cloudflare.referrers || [],
    countries,
    regions: pageVisit.rollup.regions.length ? pageVisit.rollup.regions : cloudflare.regions || [],
    cities: cityRows,
    devices: pageVisit.rollup.devices.length ? pageVisit.rollup.devices : cloudflare.devices || [],
    browsers: pageVisit.rollup.browsers.length ? pageVisit.rollup.browsers : cloudflare.browsers || [],
    cloudflare: {
      configured: cloudflare.configured,
      source: cloudflare.source,
      lastResult: cloudflare.source,
      errors: cloudflare.errors || [],
      windows: cloudflare.windows || null
    },
    pageVisits: {
      configured: pageVisit.configured,
      source: pageVisit.source,
      storage: pageVisit.storage,
      events: pageVisit.rollup.events || 0,
      cityEvents: pageVisit.rollup.cityEvents || 0,
      countryOnlyEvents: pageVisit.rollup.countryOnlyEvents || 0,
      emptyMessage: zeroPageVisitEvents ? "No page-visit events have been captured yet." : ""
    },
    location: {
      source: pageVisit.rollup.events ? "page_visit_kv" : cloudflare.configured ? cloudflare.source : "unavailable",
      events: pageVisit.rollup.events || 0,
      cityEvents: pageVisit.rollup.cityEvents || 0,
      countryOnlyEvents: pageVisit.rollup.countryOnlyEvents || 0,
      precision: cityRows.length ? "city" : countries.length ? "country" : "unavailable",
      emptyMessage: zeroPageVisitEvents ? "No page-visit events have been captured yet." : ""
    },
    readiness: {
      cloudflare: Object.fromEntries(REQUIRED_CONFIG.map((key) => [key, hasEnv(env, key)])),
      dcAdminKvConfigured: Boolean(getKv(env)),
      lastCloudflareQueryResult: cloudflare.source,
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
    if (request.method !== "GET") {
      response = json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    } else {
      const admin = await requireAdmin(request, env);
      if (admin.error) {
        response = json({ ok: false, error: admin.error }, { status: admin.status });
      } else {
        response = json({
          ...(await analyticsStatus(env)),
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
