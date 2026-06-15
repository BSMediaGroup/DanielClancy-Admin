import { postDanielClancyAlert } from "../../_shared/alert-sender.js";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safePath(value) {
  const path = cleanText(value || "/", 500);
  if (!path.startsWith("/") && !path.startsWith("#/")) return "/";
  return path || "/";
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

function methodNotAllowed() {
  return json({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST, OPTIONS" });
}

export const onRequestGet = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;

export async function onRequestPost(context) {
  let payload = {};
  try {
    payload = await context.request.json();
  } catch {
    payload = {};
  }

  const pagePath = safePath(payload.path || payload.pagePath || payload.route);
  const result = await postDanielClancyAlert(context, {
    triggerType: "page_visit",
    surface: "admin.danielclancy.net",
    domain: "admin.danielclancy.net",
    severity: "info",
    title: "DanielClancy Admin page visit",
    message: `Admin page visit: ${pagePath}`,
    tags: ["page_visit", "admin", "danielclancy"],
    pagePath,
    linkUrl: `https://admin.danielclancy.net/${pagePath.startsWith("#") ? pagePath : `#${pagePath}`}`,
    payload: {
      pagePath,
      title: cleanText(payload.title, 160),
      referrer: cleanText(payload.referrer, 500),
    },
  });

  if (!result.ok && result.configured) {
    console.error(JSON.stringify({ event: "admin_page_visit_alert_delivery_failed", status: result.status || 0, error: result.error }));
  }

  return json({ ok: true, delivered: Boolean(result.ok), configured: Boolean(result.configured) });
}
