import { requireAdmin as resolveAdminSession } from "../../../_shared/admin-accounts.js";
import { postDanielClancyAlert } from "../../../_shared/alert-sender.js";

const COOKIE_NAME = "dc_auth_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const COLLECTIONS = {
  projects: { key: "cms:projects", maxRows: 500 },
  media: { key: "cms:media", maxRows: 500 },
  alerts: { key: "cms:alerts", maxRows: 500 }
};
const PROJECTS_BASELINE_PATH = "/assets/data/public-projects-baseline.json";
const PROJECTS_BASELINE_VERSION = "public-projects-baseline-2026-06-14";
const CMS_ALERT_TRIGGER_TYPES = {
  projects: "project_cms_update",
  media: "media_cms_update",
  alerts: "alerts_cms_update"
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

function logAlertFailure(event, result) {
  if (!result?.ok && result?.configured) {
    console.error(JSON.stringify({ event, status: result.status || 0, error: result.error || "alert_failed" }));
  }
}

function textBytes(value) {
  return new TextEncoder().encode(String(value || ""));
}

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : textBytes(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textBytes(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(left, right) {
  const leftBytes = textBytes(left);
  const rightBytes = textBytes(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return diff === 0;
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const equalsIndex = part.indexOf("=");
        if (equalsIndex < 0) return [part, ""];
        return [part.slice(0, equalsIndex), decodeURIComponent(part.slice(equalsIndex + 1))];
      })
  );
}

async function readSession(request, env) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token || !env.DC_AUTH_SESSION_SECRET) return null;
  const [encoded, signature] = String(token).split(".");
  if (!encoded || !signature) return null;
  const expected = await hmac(env.DC_AUTH_SESSION_SECRET, encoded);
  if (!timingSafeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded)));
    if (!payload.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sessionResponse(session) {
  if (!session) {
    return {
      authenticated: false,
      account_type: "anonymous",
      is_admin: false
    };
  }
  const accountType = String(session.account_type || "regular").toLowerCase();
  return {
    authenticated: true,
    email: session.email || "",
    provider: session.provider || "",
    account_type: accountType,
    admin_level: session.admin_level || null,
    is_admin: accountType === "admin",
    display_name: session.display_name || session.email || "DanielClancy account"
  };
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
    "access-control-allow-methods": "GET,PUT,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

async function requireAdmin(request, env) {
  const admin = await resolveAdminSession(request, env);
  if (admin.error) {
    return { session: admin.session, response: json({ ok: false, error: admin.error }, { status: admin.status }) };
  }
  return { session: admin.session, response: null };
}

function collectionName(params) {
  const raw = Array.isArray(params.collection) ? params.collection.join("/") : String(params.collection || "");
  return raw.replace(/^\/+|\/+$/g, "");
}

function validateRows(collection, value) {
  if (!Array.isArray(value)) {
    return "payload_collection_must_be_array";
  }
  if (value.length > COLLECTIONS[collection].maxRows) {
    return "payload_too_large";
  }
  const ids = new Set();
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return "payload_rows_must_be_objects";
    }
    const id = String(row.id || row.slug || row.name || "").trim();
    if (!id) {
      return "payload_rows_need_id";
    }
    if (ids.has(id)) {
      return "payload_duplicate_id";
    }
    ids.add(id);
  }
  return "";
}

function projectIdentity(row) {
  return String(row?.id || row?.slug || "").trim().toLowerCase();
}

function normalizeStoredCollection(parsed) {
  const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  return {
    items,
    wrapper: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null
  };
}

async function loadProjectsBaseline(request, env) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return {
      meta: {
        sourceRepo: "DanielClancy",
        projectCount: 0,
        sourceFilesUsed: [],
        missingReason: "assets_binding_unavailable"
      },
      projects: []
    };
  }

  const url = new URL(PROJECTS_BASELINE_PATH, request.url);
  const response = await env.ASSETS.fetch(url);
  if (!response.ok) {
    return {
      meta: {
        sourceRepo: "DanielClancy",
        projectCount: 0,
        sourceFilesUsed: [],
        missingReason: `asset_http_${response.status}`
      },
      projects: []
    };
  }

  const parsed = await response.json();
  const projects = Array.isArray(parsed?.projects) ? parsed.projects : [];
  return {
    meta: {
      ...(parsed?.meta || {}),
      projectCount: projects.length
    },
    projects
  };
}

function mergeProjectsBaselineWithKv(baselinePayload, storedItems, storedWrapper = null) {
  const baseline = Array.isArray(baselinePayload?.projects) ? baselinePayload.projects : [];
  const baselineIds = new Set(baseline.map(projectIdentity).filter(Boolean));
  const hiddenBaselineIds = new Set(
    Array.isArray(storedWrapper?.hiddenBaselineIds)
      ? storedWrapper.hiddenBaselineIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean)
      : []
  );
  const kvItems = Array.isArray(storedItems) ? storedItems : [];
  const kvById = new Map();
  const adminCreatedItems = [];

  for (const item of kvItems) {
    const id = projectIdentity(item);
    if (!id) continue;
    if (baselineIds.has(id)) {
      kvById.set(id, item);
    } else {
      adminCreatedItems.push({
        ...item,
        baselineProtected: false,
        source: item?.source || "admin_created"
      });
    }
  }

  const mergedBaselineItems = baseline
    .filter((item) => !hiddenBaselineIds.has(projectIdentity(item)))
    .map((item) => {
      const id = projectIdentity(item);
      const overlay = kvById.get(id) || {};
      return {
        ...item,
        ...overlay,
        id: item.id,
        slug: item.slug,
        livePage: overlay.livePage || item.livePage,
        sourceFolder: item.sourceFolder,
        baselineProtected: true,
        baselineVersion: PROJECTS_BASELINE_VERSION,
        source: overlay.source || "public_baseline"
      };
    });

  return {
    items: [...mergedBaselineItems, ...adminCreatedItems],
    hiddenBaselineIds: Array.from(hiddenBaselineIds),
    meta: {
      baselineCount: baseline.length,
      kvCount: kvItems.length,
      mergedCount: mergedBaselineItems.length + adminCreatedItems.length,
      adminCreatedCount: adminCreatedItems.length,
      hiddenBaselineCount: hiddenBaselineIds.size,
      baselineProtected: baseline.length > 0,
      partialKvMerged: baseline.length > 0 && kvItems.length > 0 && kvItems.length < baseline.length,
      baselineVersion: PROJECTS_BASELINE_VERSION,
      baseline: baselinePayload?.meta || null
    }
  };
}

function validateProjectsPayloadSafety(items, baselinePayload, payload) {
  const baseline = Array.isArray(baselinePayload?.projects) ? baselinePayload.projects : [];
  if (!baseline.length) return "";
  const itemIds = new Set((items || []).map(projectIdentity).filter(Boolean));
  const baselineIds = baseline.map(projectIdentity).filter(Boolean);
  const hiddenIds = new Set(
    Array.isArray(payload?.hiddenBaselineIds)
      ? payload.hiddenBaselineIds.map((id) => String(id).trim().toLowerCase()).filter(Boolean)
      : []
  );
  const missing = baselineIds.filter((id) => !itemIds.has(id) && !hiddenIds.has(id));
  if (missing.length && payload?.mode !== "baseline_overlay") {
    return "projects_payload_missing_baseline_records";
  }
  if (items.length < baseline.length && payload?.mode !== "baseline_overlay") {
    return "projects_payload_smaller_than_baseline";
  }
  return "";
}

async function readCollection(request, env, collection) {
  const binding = env.DC_ADMIN_KV;
  const baselinePayload = collection === "projects" ? await loadProjectsBaseline(request, env) : null;
  if (!binding || typeof binding.get !== "function") {
    if (collection === "projects" && baselinePayload?.projects?.length) {
      const merged = mergeProjectsBaselineWithKv(baselinePayload, []);
      return {
        ok: true,
        configured: false,
        storageConfigured: false,
        source: "baseline_only_storage_not_configured",
        collection,
        items: merged.items,
        meta: {
          storage: "kv",
          binding: "DC_ADMIN_KV",
          message: "DC_ADMIN_KV is not configured; returning protected public Projects baseline.",
          ...merged.meta
        }
      };
    }
    return {
      ok: true,
      configured: false,
      error: "storage_not_configured",
      source: "local_fallback_unavailable",
      collection,
      items: [],
      meta: {
        storage: "kv",
        binding: "DC_ADMIN_KV",
        message: "DC_ADMIN_KV is not configured for this environment."
      }
    };
  }

  const raw = await binding.get(COLLECTIONS[collection].key);
  if (!raw) {
    if (collection === "projects" && baselinePayload?.projects?.length) {
      const merged = mergeProjectsBaselineWithKv(baselinePayload, []);
      return {
        ok: true,
        configured: true,
        storageConfigured: true,
        source: "baseline_only",
        collection,
        items: merged.items,
        meta: {
          storage: "kv",
          binding: "DC_ADMIN_KV",
          key: COLLECTIONS[collection].key,
          message: "No KV record exists yet; returning protected public Projects baseline.",
          ...merged.meta
        }
      };
    }
    return {
      ok: true,
      configured: true,
      source: "seed",
      collection,
      items: [],
      meta: {
        storage: "kv",
        binding: "DC_ADMIN_KV",
        key: COLLECTIONS[collection].key,
        message: "No KV record exists yet for this collection."
      }
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const { items, wrapper } = normalizeStoredCollection(parsed);
    if (collection === "projects" && baselinePayload?.projects?.length) {
      const merged = mergeProjectsBaselineWithKv(baselinePayload, items, wrapper);
      return {
        ok: true,
        configured: true,
        storageConfigured: true,
        source: "baseline_plus_kv",
        collection,
        items: merged.items,
        meta: {
          storage: "kv",
          binding: "DC_ADMIN_KV",
          key: COLLECTIONS[collection].key,
          updatedAt: wrapper?.updatedAt || null,
          ...merged.meta
        }
      };
    }
    return {
      ok: true,
      configured: true,
      source: "kv",
      collection,
      items,
      meta: {
        storage: "kv",
        binding: "DC_ADMIN_KV",
        key: COLLECTIONS[collection].key,
        updatedAt: parsed?.updatedAt || null
      }
    };
  } catch {
    return json({ ok: false, error: "stored_payload_invalid" }, { status: 500 });
  }
}

async function writeCollection(context, collection, session) {
  const { request, env } = context;
  const binding = env.DC_ADMIN_KV;
  if (!binding || typeof binding.put !== "function") {
    return json(
      {
        ok: false,
        error: "storage_not_configured",
        message: "DC_ADMIN_KV is required for production CMS persistence."
      },
      { status: 503 }
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const items = Array.isArray(payload) ? payload : payload?.items;
  const validationError = validateRows(collection, items);
  if (validationError) {
    return json({ ok: false, error: validationError }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  let stored = {
    collection,
    items,
    updatedAt
  };
  if (collection === "projects") {
    const baselinePayload = await loadProjectsBaseline(request, env);
    const safetyError = validateProjectsPayloadSafety(items, baselinePayload, payload);
    if (safetyError) {
      return json(
        {
          ok: false,
          error: safetyError,
          baselineProtected: true,
          baselineCount: baselinePayload?.projects?.length || 0,
          message: "Projects saves must preserve the protected public-site baseline or use baseline_overlay with explicit hiddenBaselineIds."
        },
        { status: 409 }
      );
    }
    stored = {
      collection,
      mode: "baseline_overlay",
      baselineVersion: PROJECTS_BASELINE_VERSION,
      updatedAt,
      items,
      adminCreatedItems: Array.isArray(payload?.adminCreatedItems) ? payload.adminCreatedItems : [],
      hiddenBaselineIds: Array.isArray(payload?.hiddenBaselineIds) ? payload.hiddenBaselineIds : []
    };
  }
  await binding.put(COLLECTIONS[collection].key, JSON.stringify(stored, null, 2));
  const responseItems =
    collection === "projects"
      ? mergeProjectsBaselineWithKv(await loadProjectsBaseline(request, env), items, stored).items
      : items;
  logAlertFailure(
    "cms_alert_delivery_failed",
    await postDanielClancyAlert(context, {
      triggerType: CMS_ALERT_TRIGGER_TYPES[collection],
      surface: "admin.danielclancy.net",
      domain: "admin.danielclancy.net",
      severity: "info",
      title: `DanielClancy ${collection} CMS update`,
      message: `${collection} CMS save accepted with ${items.length} item(s).`,
      tags: ["cms", collection, "admin", "danielclancy"],
      linkUrl: `https://admin.danielclancy.net/#/${collection}`,
      payload: {
        collection,
        itemCount: items.length,
        actorEmail: session?.email || "",
        actorProvider: session?.provider || "",
        updatedAt,
      },
    }),
  );

  return json({
    ok: true,
    configured: true,
    storageConfigured: true,
    source: collection === "projects" ? "baseline_overlay_saved" : "kv",
    collection,
    items: responseItems,
    meta: {
      storage: "kv",
      binding: "DC_ADMIN_KV",
      key: COLLECTIONS[collection].key,
      updatedAt,
      ...(collection === "projects"
        ? mergeProjectsBaselineWithKv(await loadProjectsBaseline(request, env), items, stored).meta
        : {})
    }
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const collection = collectionName(params);
  let response;
  try {
    if (!Object.prototype.hasOwnProperty.call(COLLECTIONS, collection)) {
      response = json({ ok: false, error: "unknown_collection" }, { status: 404 });
    } else {
      const admin = await requireAdmin(request, env);
      if (admin.response) {
        response = admin.response;
      } else if (request.method === "GET") {
        response = await readCollection(request, env, collection);
      } else if (request.method === "PUT") {
        response = await writeCollection(context, collection, admin.session);
      } else {
        response = json({ ok: false, error: "method_not_allowed" }, { status: 405 });
      }
    }
  } catch {
    response = json({ ok: false, error: "cms_unavailable" }, { status: 500 });
  }

  if (!(response instanceof Response)) {
    response = json(response);
  }
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
