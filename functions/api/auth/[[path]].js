import { postDanielClancyAlert } from "../../_shared/alert-sender.js";
import { registerOAuthAccount, resolveSession } from "../../_shared/admin-accounts.js";
import {
  clearCustomerSessionCookie,
  createCustomerSession,
  customerStorage,
  normalizeEmail,
  upsertCustomerByEmail
} from "../../_shared/customer-records.js";

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
function logAlertFailure(event, result) {
  if (!result?.ok && result?.configured) {
    console.error(JSON.stringify({ event, status: result.status || 0, error: result.error || "alert_failed" }));
  }
}

function json(payload, init = {}) {
  const headers = new Headers(JSON_HEADERS);
  new Headers(init.headers || {}).forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") headers.append(key, value);
    else headers.set(key, value);
  });
  return new Response(JSON.stringify(payload), {
    ...init,
    headers
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
  const domain = authCookieDomain(request, env);
  if (domain) attributes.push(`Domain=${domain}`);
  if (isHttps(request)) attributes.push("Secure");
  return attributes;
}

function authCookieDomain(request, env) {
  const configured = String(env.DC_AUTH_COOKIE_DOMAIN || "").trim();
  if (configured) return configured;
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "danielclancy.net" || hostname === "admin.danielclancy.net" ? ".danielclancy.net" : "";
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
    admin_level: "none",
    is_admin: false,
    is_master_admin: false,
    roleSource: "none"
    };
  }
  const accountType = String(session.account_type || "regular").toLowerCase();
  return {
    authenticated: true,
    email: session.email || "",
    provider: session.provider || "",
    username: session.username || "",
    account_type: accountType,
    admin_level: session.admin_level || "none",
    is_admin: accountType === "admin",
    is_master_admin: session.admin_level === "master",
    roleSource: session.roleSource || "session",
    display_name: session.display_name || session.email || "DanielClancy account",
    avatar_url: session.avatar_url || session.avatarUrl || "",
    customer_id: session.customer_id || "",
    admin_access: session.admin_access || null
  };
}

async function handleLogin(context) {
  const { request, env } = context;
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
  const sharedCustomerCookie = await createSharedCustomerSessionCookie(context, {
    email,
    displayName: email,
    provider: "password",
    adminAccess: true,
    adminAccessUpdatedBy: "env_master"
  });
  logAlertFailure(
    "admin_login_alert_delivery_failed",
    await postDanielClancyAlert(context, {
      triggerType: "auth_admin_login",
      surface: "admin.danielclancy.net",
      domain: "admin.danielclancy.net",
      severity: "info",
      title: "DanielClancy Admin login",
      message: `Admin password login accepted for ${email}.`,
      tags: ["auth", "admin", "danielclancy"],
      linkUrl: "https://admin.danielclancy.net/#/overview",
      pagePath: "/api/auth/login",
      pageUrl: "https://admin.danielclancy.net/api/auth/login",
      displayName: email,
      userEmail: email,
      userType: "admin",
      accountType: "admin",
      authProvider: "password",
      payload: {
        email,
        provider: "password",
        user_type: "admin",
        account_type: "admin",
      },
    }),
  );
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
    { headers: setCookieHeaders([cookie, sharedCustomerCookie]) }
  );
}

async function handleSignup(request, env) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  }
  let payload = {};
  try {
    payload = await request.json();
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

function encodeOAuthState(returnTo = "") {
  return base64UrlEncode(JSON.stringify({ nonce: crypto.randomUUID(), returnTo }));
}

function decodeOAuthState(value) {
  if (!value) return { nonce: "", returnTo: "" };
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(value)));
    return {
      nonce: String(parsed?.nonce || ""),
      returnTo: String(parsed?.returnTo || "")
    };
  } catch {
    return { nonce: String(value || ""), returnTo: "" };
  }
}

function allowedRedirectOrigins(request, env) {
  return new Set(
    [
      env.DC_PUBLIC_SITE_ORIGIN || "https://danielclancy.net",
      "https://www.danielclancy.net",
      env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net",
      new URL(request.url).origin,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173"
    ].filter(Boolean).map((origin) => String(origin).replace(/\/+$/g, ""))
  );
}

function safeOAuthReturnTo(request, env, value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const fallback = env.DC_PUBLIC_SITE_ORIGIN || "https://danielclancy.net";
    const url = new URL(raw, fallback);
    if (!/^https?:$/i.test(url.protocol)) return "";
    if (!allowedRedirectOrigins(request, env).has(url.origin.replace(/\/+$/g, ""))) return "";
    if (/^\/api\//i.test(url.pathname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function oauthRedirectUrl(request, env, state, status) {
  const adminOrigin = (env.DC_ADMIN_SITE_ORIGIN || "https://admin.danielclancy.net").replace(/\/+$/, "");
  const returnTo = safeOAuthReturnTo(request, env, state?.returnTo);
  const redirect = new URL(returnTo || adminOrigin);
  if (returnTo) {
    redirect.searchParams.set("auth", status);
  } else {
    redirect.hash = `/login?oauth=${status}`;
  }
  return redirect.toString();
}

async function handleOAuthStart(request, env, provider) {
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
  endpoint.searchParams.set("state", encodeOAuthState(safeOAuthReturnTo(request, env, new URL(request.url).searchParams.get("return_to"))));
  if (provider === "twitter") {
    endpoint.searchParams.set("code_challenge", "danielclancy-admin-oauth-scaffold");
    endpoint.searchParams.set("code_challenge_method", "plain");
  }
  return Response.redirect(endpoint.toString(), 302);
}

async function exchangeOAuthToken(request, env, provider, code) {
  const config = OAUTH_PROVIDERS[provider];
  const redirectUri = buildCallbackUrl(request, env, provider);
  if (provider === "github") {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        client_id: env[config.clientId],
        client_secret: env[config.clientSecret],
        redirect_uri: redirectUri,
        code
      })
    });
    return response.json();
  }
  if (provider === "google") {
    const body = new URLSearchParams({
      client_id: env[config.clientId],
      client_secret: env[config.clientSecret],
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });
    return response.json();
  }
  const body = new URLSearchParams({
    client_id: env[config.clientId],
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code,
    code_verifier: "danielclancy-admin-oauth-scaffold"
  });
  const credentials = btoa(`${env[config.clientId]}:${env[config.clientSecret]}`);
  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });
  return response.json();
}

async function fetchOAuthProfile(provider, tokenPayload) {
  const accessToken = tokenPayload?.access_token;
  if (!accessToken) return null;
  if (provider === "github") {
    const [userResponse, emailsResponse] = await Promise.all([
      fetch("https://api.github.com/user", {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "DanielClancy-Admin"
        }
      }),
      fetch("https://api.github.com/user/emails", {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "DanielClancy-Admin"
        }
      })
    ]);
    const user = await userResponse.json();
    const emails = emailsResponse.ok ? await emailsResponse.json() : [];
    const primary = Array.isArray(emails) ? emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified) : null;
    return {
      provider,
      providerSubject: user?.id ? String(user.id) : "",
      email: user?.email || primary?.email || "",
      username: user?.login || "",
      displayName: user?.name || user?.login || "",
      avatarUrl: user?.avatar_url || ""
    };
  }
  if (provider === "google") {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const user = await response.json();
    return {
      provider,
      providerSubject: user?.sub || "",
      email: user?.email || "",
      username: "",
      displayName: user?.name || user?.email || "",
      avatarUrl: user?.picture || ""
    };
  }
  const response = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url", {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json();
  const user = payload?.data || {};
  return {
    provider,
    providerSubject: user?.id || "",
    email: "",
    username: user?.username || "",
    displayName: user?.name || user?.username || "",
    avatarUrl: user?.profile_image_url || ""
  };
}

async function handleOAuthCallback(context, provider) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = decodeOAuthState(url.searchParams.get("state"));
  if (error || !code) {
    return redirectResponse(oauthRedirectUrl(request, env, state, "not-ready"));
  }

  try {
    const tokenPayload = await exchangeOAuthToken(request, env, provider, code);
    const profile = await fetchOAuthProfile(provider, tokenPayload);
    if (!profile?.providerSubject) {
      return redirectResponse(oauthRedirectUrl(request, env, state, `${provider}-profile-unavailable`));
    }
    const registration = await registerOAuthAccount(env, profile);
    const account = registration.account || {
      provider,
      providerSubject: profile.providerSubject,
      email: profile.email || "",
      username: profile.username || "",
      displayName: profile.displayName || profile.username || profile.email || `${provider} account`,
      accountType: "regular",
      adminLevel: "none"
    };
    const cookie = await createSessionCookie(request, env, {
      provider,
      providerSubject: profile.providerSubject,
      email: account.email || profile.email || "",
      username: account.username || profile.username || "",
      display_name: account.displayName || profile.displayName || "",
      account_type: "regular",
      admin_level: "none"
    });
    const sharedCustomerCookie = await createSharedCustomerSessionCookie(context, {
      email: account.email || profile.email || "",
      displayName: account.displayName || profile.displayName || profile.username || "",
      avatarUrl: account.avatarUrl || profile.avatarUrl || "",
      provider
    });
    logAlertFailure(
      "oauth_login_alert_delivery_failed",
      await postDanielClancyAlert(context, {
        triggerType: "auth_oauth_login",
        surface: "admin.danielclancy.net",
        domain: "admin.danielclancy.net",
        severity: "info",
        title: "DanielClancy OAuth login",
        message: `OAuth login callback completed for ${provider}.`,
        tags: ["auth", "oauth", "danielclancy"],
        linkUrl: "https://admin.danielclancy.net/#/accounts",
        pagePath: `/api/auth/oauth/${provider}/callback`,
        pageUrl: `https://admin.danielclancy.net/api/auth/oauth/${provider}/callback`,
        displayName: account.displayName || profile.displayName || "",
        userEmail: account.email || profile.email || "",
        userType: "regular",
        accountType: "regular",
        authProvider: provider,
        payload: {
          provider,
          email: account.email || profile.email || "",
          username: account.username || profile.username || "",
          accountType: "regular",
          user_type: "regular",
          registered: Boolean(registration.ok),
        },
      }),
    );
    return redirectResponse(
      oauthRedirectUrl(
        request,
        env,
        state,
        registration.ok ? `${provider}-registered` : `${provider}-${registration.error || "storage_not_configured"}`
      ),
      [cookie, sharedCustomerCookie]
    );
  } catch {
    return redirectResponse(oauthRedirectUrl(request, env, state, `${provider}-callback-failed`));
  }
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
      response = json({ ok: true, session: await resolveSession(request, env) });
    } else if (path === "login") {
      response = await handleLogin(context);
    } else if (path === "signup") {
      response = await handleSignup(request, env);
    } else if (path === "logout") {
      response = json({ ok: true }, { headers: setCookieHeaders([clearCookie(request, env), clearCustomerSessionCookie(request, env)]) });
    } else {
      const match = path.match(/^oauth\/(github|google|twitter)\/(start|callback)$/);
      if (!match) {
        response = json({ ok: false, error: "not_found" }, { status: 404 });
      } else if (match[2] === "start") {
        response = await handleOAuthStart(request, env, match[1]);
      } else {
        response = await handleOAuthCallback(context, match[1]);
      }
    }
  } catch (error) {
    response = json({ ok: false, error: "auth_unavailable" }, { status: 500 });
  }
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(request, env)).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function createSharedCustomerSessionCookie(context, profilePatch) {
  const { request, env } = context;
  const storage = customerStorage(env);
  const email = normalizeEmail(profilePatch?.email);
  if (!storage || !email) return "";
  const now = new Date().toISOString();
  const existing = await upsertCustomerByEmail(storage, email, {
    displayName: profilePatch.displayName || "",
    avatarUrl: profilePatch.avatarUrl || "",
    lastLoginAt: now,
    ...(profilePatch.adminAccess
      ? {
          roles: ["admin"],
          adminAccess: true,
          adminAccessUpdatedAt: now,
          adminAccessUpdatedBy: profilePatch.adminAccessUpdatedBy || profilePatch.provider || "admin_login"
        }
      : {})
  });
  if (!existing) return "";
  const session = await createCustomerSession(storage, request, env, existing);
  return session.cookie;
}

function setCookieHeaders(cookies) {
  const headers = new Headers();
  cookies.filter(Boolean).forEach((cookie) => headers.append("set-cookie", cookie));
  return headers;
}

function redirectResponse(location, cookies = []) {
  const headers = setCookieHeaders(cookies);
  headers.set("location", location);
  return new Response(null, { status: 302, headers });
}
