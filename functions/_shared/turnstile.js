const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const MISSING_TOKEN_MESSAGE = "Complete the security check to continue.";
const INVALID_TOKEN_MESSAGE = "Security check expired. Please try again.";
const MISSING_CONFIG_MESSAGE = "Security check is unavailable. Please try again later.";

function normalizeEnvValue(value, maxLength = 400) {
  const trimmed = String(value || "")
    .trim()
    .slice(0, maxLength);

  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }

  return trimmed;
}

function isDevBypassEnabled(env) {
  return String(env?.DC_TURNSTILE_DEV_BYPASS || "").trim().toLowerCase() === "true";
}

export function getTurnstileSiteKey(env) {
  return normalizeEnvValue(env?.DC_TURNSTILE_SITE_KEY, 300);
}

export function turnstileConfigResponse(env, headers = {}) {
  const siteKey = getTurnstileSiteKey(env);
  return new Response(
    JSON.stringify({
      ok: Boolean(siteKey),
      siteKey,
      unavailable: !siteKey,
      message: siteKey ? "" : "Turnstile is unavailable in this environment.",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...headers,
      },
    },
  );
}

export async function verifyTurnstileToken({ env, token, remoteIp }) {
  const secret = normalizeEnvValue(env?.DC_TURNSTILE_SECRET_KEY, 400);
  const bypass = isDevBypassEnabled(env);

  if (bypass) {
    return { ok: true, code: "dev_bypass", message: "" };
  }

  if (!secret) {
    console.error(JSON.stringify({ event: "turnstile_config_missing", hasSecret: false }));
    return { ok: false, code: "turnstile_config_missing", message: MISSING_CONFIG_MESSAGE };
  }

  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    return { ok: false, code: "turnstile_token_missing", message: MISSING_TOKEN_MESSAGE };
  }

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", cleanToken);
  if (remoteIp) form.set("remoteip", String(remoteIp));

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body: form,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      console.error(
        JSON.stringify({
          event: "turnstile_verify_failed",
          status: response.status,
          errorCodes: Array.isArray(result?.["error-codes"]) ? result["error-codes"] : [],
        }),
      );
      return { ok: false, code: "turnstile_invalid", message: INVALID_TOKEN_MESSAGE };
    }
    return { ok: true, code: "turnstile_ok", message: "" };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "turnstile_verify_exception",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return { ok: false, code: "turnstile_unavailable", message: MISSING_CONFIG_MESSAGE };
  }
}
