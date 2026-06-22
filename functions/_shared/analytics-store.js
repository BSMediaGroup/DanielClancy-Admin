const RECENT_VISITS_KEY = "analytics:page_visits:recent";
const ROLLUP_KEY = "analytics:page_visits:rollup";
const RECENT_VISIT_LIMIT = 1000;
const LIVE_SOURCES = new Set(["page_visit_kv", "cloudflare_graphql", "streamsuites_event_mirror", "streamsuites_live"]);
const SAMPLE_SOURCES = new Set(["sample", "sample_fallback", "fallback", "demo", "mock", "test", "local_mock"]);
export const ANALYTICS_WINDOWS = Object.freeze({
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000
});
const DEFAULT_ANALYTICS_WINDOW = "1h";

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

export function normalizeAnalyticsWindow(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ANALYTICS_WINDOWS, normalized)
    ? normalized
    : DEFAULT_ANALYTICS_WINDOW;
}

function eventTimestampMs(event) {
  const value = event?.recordedAt || event?.recorded_at || event?.timestamp || event?.time || event?.createdAt || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventTimestampIso(event) {
  const value = event?.recordedAt || event?.recorded_at || event?.timestamp || event?.time || event?.createdAt || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

export function filterPageVisitEventsForWindow(events = [], windowKey = DEFAULT_ANALYTICS_WINDOW, nowMs = Date.now()) {
  const safeWindow = normalizeAnalyticsWindow(windowKey);
  const cutoff = nowMs - ANALYTICS_WINDOWS[safeWindow];
  const liveRows = [];
  const sampleRows = [];
  const staleRows = [];
  const unknownWindowRows = [];
  for (const event of Array.isArray(events) ? events : []) {
    if (isSampleAnalyticsRow(event)) {
      sampleRows.push(event);
      continue;
    }
    if (!isLiveAnalyticsRow(event)) {
      staleRows.push(event);
      continue;
    }
    const eventMs = eventTimestampMs(event);
    if (!Number.isFinite(eventMs)) {
      unknownWindowRows.push(event);
      continue;
    }
    if (eventMs >= cutoff && eventMs <= nowMs) {
      liveRows.push(event);
    } else {
      staleRows.push({ ...event, staleReason: "outside_selected_window" });
    }
  }
  return { window: safeWindow, liveRows, sampleRows, staleRows, unknownWindowRows };
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
  const recordedAt = eventTimestampIso(payload) || new Date().toISOString();
  const country = cleanText(cf.country || payload.country || payload.geo?.country || payload.geo?.country_code, 80);
  const country_code = countryCode(cf.country || payload.country_code || payload.countryCode || payload.country || payload.geo?.country_code || payload.geo?.country);
  const requestedSource = rowSource(payload);
  const source = requestedSource === "streamsuites_event_mirror" ? "streamsuites_event_mirror" : "page_visit_kv";
  const event = {
    eventId: cleanText(payload.eventId || payload.event_id || payload.id || payload.dedupeKey || payload.dedupe_key, 160) || `page_visit_${recordedAt}_${Math.random().toString(36).slice(2, 10)}`,
    dedupeKey: cleanText(payload.dedupeKey || payload.dedupe_key, 220),
    source,
    live: true,
    timestamp: recordedAt,
    recordedAt,
    surface: cleanText(payload.surface, 80) || "danielclancy_public",
    page_path: pagePath.startsWith("/") || pagePath.startsWith("#/") ? pagePath : "/",
    page_url: cleanText(payload.page_url || payload.pageUrl || payload.url, 500),
    page_title: cleanText(payload.page_title || payload.title, 160),
    session_id: cleanText(payload.session_id || payload.sessionId || payload.visitor_session_id, 160),
    referrer,
    referrer_host: referrerHost(payload.referrer_host || payload.referrerHost || referrer),
    country,
    country_code,
    region: cleanText(cf.region || payload.region || payload.geo?.region, 120),
    regionCode: cleanText(cf.regionCode || payload.regionCode || payload.region_code || payload.geo?.region_code, 40),
    city: cleanText(cf.city || payload.city || payload.geo?.city, 120),
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

function conservativeDedupeKey(event) {
  const minute = Math.floor((eventTimestampMs(event) || Date.now()) / (60 * 1000));
  return [
    minute,
    cleanText(event.page_path, 240),
    cleanText(event.page_url, 240),
    cleanText(event.session_id, 120),
    cleanText(event.city, 120),
    cleanText(event.region, 120),
    cleanText(event.country_code || event.country, 80),
    cleanText(event.browser, 80),
    cleanText(event.device, 80),
    cleanText(event.platform, 80)
  ].join("|");
}

function analyticsEventIdentity(event) {
  return cleanText(event?.eventId || event?.event_id || event?.dedupeKey || event?.dedupe_key, 220) || conservativeDedupeKey(event);
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
    mergePageVisitEvent(pages, event.page_path || "/", {
      path: event.page_path || "/",
      title: event.page_title || "",
      source: rowSource(event) || "page_visit_kv"
    }, event);
    if (event.referrer_host) {
      mergePageVisitEvent(referrers, event.referrer_host, { host: event.referrer_host, source: rowSource(event) || "page_visit_kv" }, event);
    }
    if (event.country) {
      mergePageVisitEvent(countries, event.country, { country: event.country, country_code: event.country_code || countryCode(event.country), source: rowSource(event) || "page_visit_kv", live: true, precision: "country" }, event);
    }
    if (event.region || event.country) {
      const key = `${event.region || "Unavailable"}|${event.country || ""}`;
      mergePageVisitEvent(regions, key, {
        region: event.region || "Unavailable",
        country: event.country || "",
        country_code: event.country_code || countryCode(event.country),
        source: rowSource(event) || "page_visit_kv",
        live: true,
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
        country_code: event.country_code || countryCode(event.country),
        source: rowSource(event) || "page_visit_kv",
        live: true,
        precision: "city",
        lastSeen: eventTime
      }, event);
    } else if (event.country) {
      countryOnlyCount += 1;
    }
    if (event.browser) {
      mergePageVisitEvent(browsers, event.browser, { browser: event.browser, source: rowSource(event) || "page_visit_kv" }, event);
    }
    if (event.device) {
      mergePageVisitEvent(devices, event.device, { device: event.device, source: rowSource(event) || "page_visit_kv" }, event);
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
    const incomingIdentity = analyticsEventIdentity(event);
    const duplicate = items.some((item) => analyticsEventIdentity(item) === incomingIdentity);
    if (duplicate) {
      return { ok: true, configured: true, stored: false, duplicate: true, event, count: items.length, cityAvailable: Boolean(event.city), source: event.source, recordedAt: event.recordedAt, updatedAt: existing?.updatedAt || "" };
    }
    items.unshift(event);
    const capped = items.slice(0, RECENT_VISIT_LIMIT);
    const rollup = aggregatePageVisitEvents(capped);
    const updatedAt = new Date().toISOString();
    await kv.put(RECENT_VISITS_KEY, JSON.stringify({ updatedAt, limit: RECENT_VISIT_LIMIT, items: capped }));
    await kv.put(ROLLUP_KEY, JSON.stringify({ updatedAt, source: "page_visit_kv", ...rollup }));
    return { ok: true, configured: true, stored: true, duplicate: false, event, count: capped.length, cityAvailable: Boolean(event.city), source: event.source, recordedAt: event.recordedAt, updatedAt };
  } catch {
    return { ok: false, configured: true, error: "page_visit_storage_failed" };
  }
}

export async function loadPageVisitAnalytics(env, options = {}) {
  const windowKey = normalizeAnalyticsWindow(options.window);
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const kv = getKv(env);
  if (!kv) {
    return {
      configured: false,
      source: "dc_admin_kv_missing",
      window: windowKey,
      storage: { configured: false, status: "missing", lastResult: "DC_ADMIN_KV missing" },
      rollup: aggregatePageVisitEvents([])
    };
  }
  try {
    const [recentRaw] = await Promise.all([kv.get(RECENT_VISITS_KEY), kv.get(ROLLUP_KEY)]);
    const recent = parseJson(recentRaw, { items: [] });
    const items = Array.isArray(recent?.items) ? recent.items : [];
    const { liveRows, sampleRows, staleRows, unknownWindowRows } = filterPageVisitEventsForWindow(items, windowKey, nowMs);
    const rollup = aggregatePageVisitEvents(liveRows);
    return {
      configured: true,
      source: "page_visit_kv",
      window: windowKey,
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
      unknownWindowRows,
      rollup: {
        ...aggregatePageVisitEvents([]),
        ...rollup
      }
    };
  } catch {
    return {
      configured: true,
      source: "page_visit_kv_error",
      window: windowKey,
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
  const kept = items.filter((item) => isLiveAnalyticsRow(item));
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
