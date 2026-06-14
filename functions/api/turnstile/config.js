import { turnstileConfigResponse } from "../../_shared/turnstile.js";

function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = new Set(
    [
      env?.DC_PUBLIC_SITE_ORIGIN || "https://danielclancy.net",
      env?.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ].filter(Boolean),
  );
  return {
    "access-control-allow-origin": allowed.has(origin) ? origin : env?.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function onRequestGet(context) {
  return turnstileConfigResponse(context.env, corsHeaders(context.request, context.env));
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(context.request, context.env),
      Allow: "GET, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

function methodNotAllowed(context) {
  return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
    status: 405,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Allow: "GET, OPTIONS",
      ...corsHeaders(context.request, context.env),
    },
  });
}

export const onRequestPost = methodNotAllowed;
export const onRequestPut = methodNotAllowed;
export const onRequestPatch = methodNotAllowed;
export const onRequestDelete = methodNotAllowed;
