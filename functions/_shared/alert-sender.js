function normalizeEnvValue(value, maxLength = 1000) {
  const trimmed = String(value || "").trim().slice(0, maxLength);
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanTags(tags) {
  return Array.isArray(tags)
    ? tags.map((tag) => cleanText(tag, 40).toLowerCase()).filter(Boolean).slice(0, 12)
    : [];
}

function firstHeader(headers, names) {
  for (const name of names) {
    const value = cleanText(headers?.get?.(name), 500);
    if (value) return value;
  }
  return "";
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

function countryFlag(countryCode) {
  const code = String(countryCode || "").replace(/[^A-Za-z]/g, "").toUpperCase();
  if (code.length !== 2 || code === "ZZ") return "";
  return Array.from(code).map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65)).join("");
}

function detectBrowser(userAgent) {
  const ua = String(userAgent || "");
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  return ua ? "Unknown" : "";
}

function detectDevice(userAgent) {
  const ua = String(userAgent || "");
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "Mobile";
  return ua ? "Desktop" : "";
}

function detectPlatform(userAgent) {
  const ua = String(userAgent || "");
  if (/Windows/i.test(ua)) return "Windows";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Linux/i.test(ua)) return "Linux";
  return ua ? "Unknown" : "";
}

export function extractGeoFromRequest(request) {
  const cf = request?.cf || {};
  const countryCode = cleanText(cf.country, 8).toUpperCase();
  return {
    city: cleanText(cf.city, 120),
    region: cleanText(cf.region, 120),
    region_code: cleanText(cf.regionCode, 40).toUpperCase(),
    country: countryCode,
    country_code: countryCode,
  };
}

export function buildClientContext(request, event = {}) {
  const headers = request?.headers;
  const url = (() => {
    try {
      return new URL(request?.url || "https://admin.danielclancy.net/");
    } catch {
      return new URL("https://admin.danielclancy.net/");
    }
  })();
  const userAgent = cleanText(headers?.get?.("User-Agent"), 500);
  const referrer = cleanText(event.referrer || event.referrer_url || firstHeader(headers, ["Referer", "Referrer"]), 500);
  const origin = cleanText(event.origin || firstHeader(headers, ["Origin"]), 500);
  const host = cleanText(event.host || firstHeader(headers, ["Host"]) || url.host, 160);
  const geo = extractGeoFromRequest(request);
  return {
    source_namespace: "danielclancy",
    project: "danielclancy",
    surface: cleanText(event.surface || "danielclancy_admin", 120),
    domain: cleanText(event.domain || "admin.danielclancy.net", 120),
    host,
    origin,
    page_path: cleanText(event.pagePath || event.page_path || url.pathname || "/", 500),
    page_key: cleanText(event.pageKey || event.page_key, 160),
    page_url: cleanText(event.pageUrl || event.page_url, 500),
    page_title: cleanText(event.pageTitle || event.page_title, 180),
    referrer,
    referrer_host: cleanText(event.referrerHost || event.referrer_host || referrerHost(referrer), 200),
    request_method: cleanText(request?.method, 20),
    client_ip: cleanText(firstHeader(headers, ["CF-Connecting-IP"]), 128),
    user_agent: userAgent,
    browser: cleanText(event.browser || detectBrowser(userAgent), 80),
    device: cleanText(event.device || detectDevice(userAgent), 80),
    platform: cleanText(event.platform || detectPlatform(userAgent), 80),
    timezone: cleanText(request?.cf?.timezone || event.timezone, 120),
    colo: cleanText(request?.cf?.colo, 40),
    geo,
    country_flag: countryFlag(geo.country_code),
    display_name: cleanText(event.displayName || event.display_name, 120),
    user_code: cleanText(event.userCode || event.user_code, 80),
    user_email: cleanText(event.userEmail || event.user_email || event.email, 160),
    user_type: cleanText(event.userType || event.user_type || event.accountType || event.account_type, 80),
    account_type: cleanText(event.accountType || event.account_type, 80),
    auth_provider: cleanText(event.authProvider || event.auth_provider || event.provider, 80),
  };
}

const RULE_DEFINITION_FIELDS = new Set([
  "rules",
  "alertRules",
  "definitions",
  "ruleDefinitions",
  "replaceRules",
  "fullManifest",
  "configuration",
  "preferences",
  "destination_defaults",
  "schema_version",
  "import",
  "reset",
  "seed",
  "defaults",
  "apply_configuration",
]);

function eventObjectOnly(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const cleanNested = (nested) => {
    if (Array.isArray(nested)) {
      return nested
        .map((item) => (item && typeof item === "object" ? eventObjectOnly(item) : item))
        .filter((item) => !(item && typeof item === "object" && Object.keys(item).length === 0));
    }
    if (nested && typeof nested === "object") {
      return eventObjectOnly(nested);
    }
    return nested;
  };
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !RULE_DEFINITION_FIELDS.has(key))
      .map(([key, nested]) => [key, cleanNested(nested)])
  );
}

function configured(env) {
  const url = normalizeEnvValue(env?.DANIELCLANCY_ALERT_INGEST_URL, 1000);
  const secret = normalizeEnvValue(env?.DANIELCLANCY_ALERT_INGEST_SECRET, 500);
  return { url, secret, ok: Boolean(url && secret) };
}

export function alertIngestStatus(env) {
  const state = configured(env);
  return {
    alertIngestConfigured: state.ok,
    alertIngestUrlConfigured: Boolean(state.url),
    alertIngestSecretConfigured: Boolean(state.secret),
  };
}

export async function postDanielClancyAlert(context, event) {
  const state = configured(context?.env);
  if (!state.ok) {
    return { ok: false, configured: false, skipped: true, error: "alert_ingest_not_configured" };
  }

  const clientContext = buildClientContext(context?.request, event);
  const payload = {
    trigger_type: cleanText(event.triggerType || event.trigger_type, 80),
    source_namespace: "danielclancy",
    project: "danielclancy",
    surface: cleanText(event.surface || clientContext.surface || "danielclancy_admin", 120),
    domain: cleanText(event.domain || event.host || clientContext.domain || "admin.danielclancy.net", 120),
    host: clientContext.host,
    origin: clientContext.origin,
    severity: cleanText(event.severity || "info", 40),
    title: cleanText(event.title, 180),
    message: cleanText(event.message, 600),
    tags: cleanTags(event.tags),
    link_url: cleanText(event.linkUrl || event.link_url, 500),
    page_path: cleanText(event.pagePath || event.page_path || clientContext.page_path, 500),
    page_key: cleanText(event.pageKey || event.page_key || clientContext.page_key, 160),
    page_url: cleanText(event.pageUrl || event.page_url || clientContext.page_url, 500),
    page_title: cleanText(event.pageTitle || event.page_title || clientContext.page_title, 180),
    referrer: clientContext.referrer,
    referrer_host: clientContext.referrer_host,
    request_method: clientContext.request_method,
    client_ip: clientContext.client_ip,
    user_agent: clientContext.user_agent,
    browser: clientContext.browser,
    device: clientContext.device,
    platform: clientContext.platform,
    timezone: clientContext.timezone,
    colo: clientContext.colo,
    geo: clientContext.geo,
    country_flag: clientContext.country_flag,
    display_name: cleanText(event.displayName || event.display_name || clientContext.display_name, 120),
    user_code: cleanText(event.userCode || event.user_code || clientContext.user_code, 80),
    user_email: cleanText(event.userEmail || event.user_email || event.email || clientContext.user_email, 160),
    user_type: cleanText(event.userType || event.user_type || event.accountType || event.account_type || clientContext.user_type, 80),
    account_type: cleanText(event.accountType || event.account_type || clientContext.account_type, 80),
    auth_provider: cleanText(event.authProvider || event.auth_provider || event.provider || clientContext.auth_provider, 80),
    payload: eventObjectOnly(event.payload),
    context: eventObjectOnly({ ...clientContext, ...(event.context || {}) }),
  };

  try {
    const response = await fetch(state.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${state.secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return {
      ok: response.ok,
      configured: true,
      status: response.status,
      error: response.ok ? "" : "alert_ingest_rejected",
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: "alert_ingest_unreachable",
      message: error instanceof Error ? error.message : "Unknown alert ingest error",
    };
  }
}
