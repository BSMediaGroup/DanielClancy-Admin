import {
  loadAccountRegistry,
  requireAdmin,
  requireMasterAdmin,
  safeRegistryResponse,
  updateAccount,
  updateCurrentAccountProfile
} from "../../../_shared/admin-accounts.js";

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
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

function accountPath(params) {
  const raw = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  return raw.replace(/^\/+|\/+$/g, "");
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function actionFromRequest(request, path, body) {
  if (request.method === "PATCH" && path) return { action: "update", id: decodeURIComponent(path) };
  const normalized = path || String(body.action || "").trim();
  const id = String(body.id || body.accountId || "").trim();
  return { action: normalized, id };
}

async function handleMutation(request, env, path) {
  if (path === "profile") {
    const admin = await requireAdmin(request, env);
    if (admin.error) return json({ ok: false, error: admin.error }, { status: admin.status });
    const body = await readBody(request);
    const result = await updateCurrentAccountProfile(env, admin.session, {
      displayName: body.displayName || body.display_name,
      avatarUrl: body.avatarUrl || body.avatar_url
    });
    if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status || 500 });
    const registry = await loadAccountRegistry(env);
    return json({
      ...safeRegistryResponse(registry, { ...admin.session, display_name: result.account.displayName, avatar_url: result.account.avatarUrl }),
      action: "profile",
      account: result.account
    });
  }

  const master = await requireMasterAdmin(request, env);
  if (master.error) return json({ ok: false, error: master.error }, { status: master.status });

  const body = await readBody(request);
  const { action, id } = actionFromRequest(request, path, body);
  if (!id) return json({ ok: false, error: "account_id_required" }, { status: 400 });
  if (!["promote", "demote", "disable", "enable", "update"].includes(action)) {
    return json({ ok: false, error: "unknown_account_action" }, { status: 404 });
  }

  let patch = {};
  if (action === "promote") {
    patch = { accountType: "admin", adminLevel: "admin", status: "active" };
  } else if (action === "demote") {
    patch = { accountType: "regular", adminLevel: "none" };
  } else if (action === "disable") {
    patch = { status: "disabled" };
  } else if (action === "enable") {
    patch = { status: "active" };
  } else {
    patch = { notes: String(body.notes || "").slice(0, 2000) };
  }

  const result = await updateAccount(env, id, patch);
  if (!result.ok) {
    return json({ ok: false, error: result.error }, { status: result.status || 500 });
  }
  const registry = await loadAccountRegistry(env);
  return json({
    ...safeRegistryResponse(registry, master.session),
    action,
    account: result.account
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const path = accountPath(params);
  let response;
  try {
    if (request.method === "GET" && !path) {
      const admin = await requireAdmin(request, env);
      if (admin.error) {
        response = json({ ok: false, error: admin.error }, { status: admin.status });
      } else {
        const registry = await loadAccountRegistry(env);
        response = json(safeRegistryResponse(registry, admin.session));
      }
    } else if (request.method === "POST" || request.method === "PATCH") {
      response = await handleMutation(request, env, path);
    } else {
      response = json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }
  } catch {
    response = json({ ok: false, error: "accounts_unavailable" }, { status: 500 });
  }

  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
