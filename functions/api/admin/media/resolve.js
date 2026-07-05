import { requireAdmin } from "../../../_shared/admin-accounts.js";
import { resolveRumbleMetadata } from "../../../_shared/rumble-watch-media.js";

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

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        "cache-control": "no-store"
      }
    });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }

  const admin = await requireAdmin(request, env);
  if (admin.error) {
    return json({ ok: false, error: admin.error }, { status: admin.status });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const input = String(payload?.input || payload?.url || payload?.embed || "").trim();
  if (!input) {
    return json({ ok: false, error: "rumble_input_required" }, { status: 400 });
  }

  const resolved = await resolveRumbleMetadata(input);
  return json({
    ok: resolved.ok,
    media: resolved,
    warnings: resolved.warnings || []
  }, { status: resolved.ok ? 200 : 422 });
}
