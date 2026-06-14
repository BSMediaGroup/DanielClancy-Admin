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

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {})
    }
  });
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
  const session = sessionResponse(await readSession(request, env));
  if (!session.authenticated) {
    return { session, response: json({ ok: false, error: "unauthenticated" }, { status: 401 }) };
  }
  if (!session.is_admin) {
    return { session, response: json({ ok: false, error: "admin_required" }, { status: 403 }) };
  }
  return { session, response: null };
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

async function readCollection(env, collection) {
  const binding = env.DC_ADMIN_KV;
  if (!binding || typeof binding.get !== "function") {
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
    const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
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

async function writeCollection(request, env, collection) {
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
  const stored = {
    collection,
    items,
    updatedAt
  };
  await binding.put(COLLECTIONS[collection].key, JSON.stringify(stored, null, 2));
  return json({
    ok: true,
    configured: true,
    source: "kv",
    collection,
    items,
    meta: {
      storage: "kv",
      binding: "DC_ADMIN_KV",
      key: COLLECTIONS[collection].key,
      updatedAt
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
        response = await readCollection(env, collection);
      } else if (request.method === "PUT") {
        response = await writeCollection(request, env, collection);
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
