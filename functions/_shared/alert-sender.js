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

  const payload = {
    trigger_type: cleanText(event.triggerType || event.trigger_type, 80),
    surface: cleanText(event.surface || "admin.danielclancy.net", 120),
    domain: cleanText(event.domain || event.host || "admin.danielclancy.net", 120),
    severity: cleanText(event.severity || "info", 40),
    title: cleanText(event.title, 180),
    message: cleanText(event.message, 600),
    tags: cleanTags(event.tags),
    link_url: cleanText(event.linkUrl || event.link_url, 500),
    page_path: cleanText(event.pagePath || event.page_path, 500),
    request_method: context?.request?.method || "",
    client_ip: context?.request?.headers?.get("CF-Connecting-IP") || "",
    user_agent: cleanText(context?.request?.headers?.get("User-Agent"), 300),
    payload: event.payload && typeof event.payload === "object" ? event.payload : {},
    context: event.context && typeof event.context === "object" ? event.context : {},
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
