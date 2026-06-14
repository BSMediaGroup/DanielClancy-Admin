const COOKIE_NAME = "dc_auth_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const OAUTH_PROVIDERS = {
  github: {
    clientId: "GITHUB_CLIENT_ID",
    clientSecret: "GITHUB_CLIENT_SECRET",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    scope: "read:user user:email"
  },
  google: {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile"
  },
  twitter: {
    clientId: "TWITTER_CLIENT_ID",
    clientSecret: "TWITTER_CLIENT_SECRET",
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    scope: "users.read tweet.read offline.access"
  }
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

function isHttps(request) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

function cookieAttributes(request, env, maxAge = SESSION_TTL_SECONDS) {
  const attributes = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];
  const domain = String(env.DC_AUTH_COOKIE_DOMAIN || "").trim();
  if (domain) attributes.push(`Domain=${domain}`);
  if (isHttps(request)) attributes.push("Secure");
  return attributes;
}

function clearCookie(request, env) {
  return `${cookieAttributes(request, env, 0).join("; ")}`;
}

async function createSessionCookie(request, env, session) {
  if (!env.DC_AUTH_SESSION_SECRET) {
    throw new Error("DC_AUTH_SESSION_SECRET is required.");
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    ...session,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(env.DC_AUTH_SESSION_SECRET, encoded);
  const cookieValue = `${encoded}.${signature}`;
  const attributes = cookieAttributes(request, env);
  attributes[0] = `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`;
  return attributes.join("; ");
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
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
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

async function handleLogin(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }
  let payload = {};
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");
  const candidates = [
    [env.DC_ADMIN_EMAIL_1, env.DC_ADMIN_SECRET_1],
    [env.DC_ADMIN_EMAIL_2, env.DC_ADMIN_SECRET_2]
  ].filter(([candidateEmail, secret]) => candidateEmail && secret);
  const match = candidates.find(([candidateEmail, secret]) => {
    return timingSafeEqual(email, String(candidateEmail).trim().toLowerCase()) && timingSafeEqual(password, secret);
  });
  if (!match) {
    return json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }
  const cookie = await createSessionCookie(request, env, {
    email,
    provider: "password",
    account_type: "admin",
    admin_level: "master",
    display_name: email
  });
  return json(
    {
      ok: true,
      session: sessionResponse({
        email,
        provider: "password",
        account_type: "admin",
        admin_level: "master"
      })
    },
    { headers: { "set-cookie": cookie } }
  );
}

async function handleSignup(request) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }
  try {
    await request.json();
  } catch {
    return json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  return json(
    {
      ok: false,
      error: "durable_account_store_required",
      message: "Email signup needs the durable account store. Use OAuth for now or sign in with an existing admin account."
    },
    { status: 501 }
  );
}

function buildCallbackUrl(request, env, provider) {
  const origin = env.DC_ADMIN_SITE_ORIGIN || new URL(request.url).origin;
  return `${origin.replace(/\/+$/, "")}/api/auth/oauth/${provider}/callback`;
}

function handleOAuthStart(request, env, provider) {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) return json({ ok: false, error: "unknown_provider" }, { status: 404 });
  const clientId = String(env[config.clientId] || "").trim();
  const clientSecret = String(env[config.clientSecret] || "").trim();
  if (!clientId || !clientSecret) {
    return json(
      {
        ok: false,
        error: "oauth_not_configured",
        provider,
        message: "OAuth is not live until Cloudflare env vars and provider redirect URIs are configured."
      },
      { status: 501 }
    );
  }
  const endpoint = new URL(config.authorizeUrl);
  endpoint.searchParams.set("client_id", clientId);
  endpoint.searchParams.set("redirect_uri", buildCallbackUrl(request, env, provider));
  endpoint.searchParams.set("response_type", "code");
  endpoint.searchParams.set("scope", config.scope);
  endpoint.searchParams.set("state", crypto.randomUUID());
  if (provider === "twitter") {
    endpoint.searchParams.set("code_challenge", "danielclancy-admin-oauth-scaffold");
    endpoint.searchParams.set("code_challenge_method", "plain");
  }
  return Response.redirect(endpoint.toString(), 302);
}

function handleOAuthCallback(request, env, provider) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const adminOrigin = (env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net").replace(/\/+$/, "");
  const redirect = new URL(adminOrigin);
  redirect.hash = error || !code ? "/login?oauth=not-ready" : `/login?oauth=${provider}-callback-received`;
  return Response.redirect(redirect.toString(), 302);
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  const path = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  let response;
  try {
    if (path === "session" || path === "") {
      response = json({ ok: true, session: sessionResponse(await readSession(request, env)) });
    } else if (path === "login") {
      response = await handleLogin(request, env);
    } else if (path === "signup") {
      response = await handleSignup(request);
    } else if (path === "logout") {
      response = json({ ok: true }, { headers: { "set-cookie": clearCookie(request, env) } });
    } else {
      const match = path.match(/^oauth\/(github|google|twitter)\/(start|callback)$/);
      if (!match) {
        response = json({ ok: false, error: "not_found" }, { status: 404 });
      } else if (match[2] === "start") {
        response = handleOAuthStart(request, env, match[1]);
      } else {
        response = handleOAuthCallback(request, env, match[1]);
      }
    }
  } catch (error) {
    response = json({ ok: false, error: "auth_unavailable" }, { status: 500 });
  }
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
