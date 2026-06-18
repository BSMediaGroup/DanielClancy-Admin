const RECENT_VISITS_KEY = "analytics:page_visits:recent";
const ROLLUP_KEY = "analytics:page_visits:rollup";
const RECENT_VISIT_LIMIT = 1000;
const LIVE_SOURCES = new Set(["page_visit_kv", "cloudflare_graphql"]);
const SAMPLE_SOURCES = new Set(["sample", "sample_fallback", "fallback", "demo", "mock", "test", "local_mock"]);

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
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

function mergeCount(map, key, seed, increment = 1) {
  const id = key || "Unavailable";
  const existing = map.get(id) || { ...seed, count: 0 };
  existing.count += increment;
  map.set(id, existing);
}

function topRows(map, limit = 20) {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
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

function rowSource(row) {
  return cleanText(row?.source || row?.analyticsSource || row?.kind, 80).toLowerCase();
}

export function isSampleAnalyticsRow(row) {
  const source = rowSource(row);
  const marker = `${source} ${cleanText(row?.id || row?.eventId || row?.page_path || row?.city || row?.country, 220)}`.toLowerCase();
  return row?.live === false || [...SAMPLE_SOURCES].some((sample) => source === sample || marker.includes(sample));
}

export function isLiveAnalyticsRow(row) {
  return row?.live === true && LIVE_SOURCES.has(rowSource(row));
}

export function isStaleAnalyticsRow(row) {
  return row && !isSampleAnalyticsRow(row) && !isLiveAnalyticsRow(row);
}

function eventPrecision(event) {
  if (event.city) return "city";
  if (event.region) return "region";
  if (event.country || event.country_code) return "country";
  return "unknown";
}

export function storageConfigured(env) {
  return Boolean(getKv(env));
}

export function buildPageVisitEvent(context, payload = {}) {
  const request = context?.request;
  const cf = request?.cf || {};
  const headers = request?.headers;
  const userAgent = headers?.get("User-Agent") || "";
  const pagePath = cleanText(payload.page_path || payload.pagePath || payload.path || payload.route || "/", 500);
  const referrer = cleanText(payload.referrer || "", 500);
  const recordedAt = new Date().toISOString();
  const country = cleanText(cf.country || payload.country, 80);
  const country_code = countryCode(cf.country || payload.country_code || payload.countryCode || payload.country);
  const event = {
    eventId: cleanText(payload.eventId || payload.id, 120) || `page_visit_${recordedAt}_${Math.random().toString(36).slice(2, 10)}`,
    source: "page_visit_kv",
    live: true,
    timestamp: recordedAt,
    recordedAt,
    surface: cleanText(payload.surface, 80) || "danielclancy_public",
    page_path: pagePath.startsWith("/") || pagePath.startsWith("#/") ? pagePath : "/",
    page_url: cleanText(payload.page_url || payload.pageUrl || payload.url, 500),
    page_title: cleanText(payload.page_title || payload.title, 160),
    referrer,
    referrer_host: referrerHost(payload.referrer_host || payload.referrerHost || referrer),
    country,
    country_code,
    region: cleanText(cf.region || payload.region, 120),
    regionCode: cleanText(cf.regionCode || payload.regionCode, 40),
    city: cleanText(cf.city || payload.city, 120),
    timezone: cleanText(payload.timezone || cf.timezone, 120),
    cf_timezone: cleanText(cf.timezone, 120),
    colo: cleanText(cf.colo || payload.colo, 40),
    browser: cleanText(payload.browser || detectBrowser(userAgent), 80),
    device: cleanText(payload.device || detectDevice(userAgent), 80),
    platform: cleanText(payload.platform || detectPlatform(userAgent), 80),
    admin: Boolean(payload.admin),
    authenticated: Boolean(payload.authenticated)
  };
  return { ...event, precision: eventPrecision(event) };
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

  let lastEventAt = "";
  for (const event of events.filter(isLiveAnalyticsRow)) {
    const eventTime = event.recordedAt || event.timestamp || "";
    if (eventTime && (!lastEventAt || eventTime > lastEventAt)) lastEventAt = eventTime;
    mergeCount(pages, event.page_path || "/", {
      path: event.page_path || "/",
      title: event.page_title || "",
      source: "page_visit_kv"
    });
    if (event.referrer_host) {
      mergeCount(referrers, event.referrer_host, { host: event.referrer_host, source: "page_visit_kv" });
    }
    if (event.country) {
      mergeCount(countries, event.country, { country: event.country, country_code: event.country_code || countryCode(event.country), source: "page_visit_kv", precision: "country" });
    }
    if (event.region || event.country) {
      const key = `${event.region || "Unavailable"}|${event.country || ""}`;
      mergeCount(regions, key, {
        region: event.region || "Unavailable",
        country: event.country || "",
        country_code: event.country_code || countryCode(event.country),
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
        country_code: event.country_code || countryCode(event.country),
        source: "page_visit_kv",
        precision: "city",
        lastSeen: eventTime
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
    devices: topRows(devices),
    lastEventAt
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
    return { ok: true, configured: true, stored: true, event, count: capped.length, cityAvailable: Boolean(event.city), updatedAt };
  } catch {
    return { ok: false, configured: true, error: "page_visit_storage_failed" };
  }
}

export async function loadPageVisitAnalytics(env) {
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
    const [recentRaw] = await Promise.all([kv.get(RECENT_VISITS_KEY), kv.get(ROLLUP_KEY)]);
    const recent = parseJson(recentRaw, { items: [] });
    const items = Array.isArray(recent?.items) ? recent.items : [];
    const liveRows = items.filter(isLiveAnalyticsRow);
    const sampleRows = items.filter(isSampleAnalyticsRow);
    const staleRows = items.filter(isStaleAnalyticsRow);
    const rollup = aggregatePageVisitEvents(liveRows);
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
      liveRows,
      sampleRows,
      staleRows,
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

export async function purgeNonLiveAnalyticsRows(env) {
  const kv = getKv(env);
  if (!kv) return { ok: false, configured: false, error: "dc_admin_kv_not_configured" };
  const recent = parseJson(await kv.get(RECENT_VISITS_KEY), { items: [] });
  const items = Array.isArray(recent?.items) ? recent.items : [];
  const kept = items.filter((item) => !isSampleAnalyticsRow(item));
  const removed = items.length - kept.length;
  const updatedAt = new Date().toISOString();
  await kv.put(RECENT_VISITS_KEY, JSON.stringify({ ...recent, updatedAt, limit: RECENT_VISIT_LIMIT, items: kept }));
  await kv.put(ROLLUP_KEY, JSON.stringify({ updatedAt, source: "page_visit_kv", ...aggregatePageVisitEvents(kept) }));
  return { ok: true, configured: true, removed, kept: kept.length, updatedAt };
}

export const PAGE_VISIT_KEYS = {
  recent: RECENT_VISITS_KEY,
  rollup: ROLLUP_KEY,
  limit: RECENT_VISIT_LIMIT
};
