const COOKIE_NAME = "dc_auth_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
export const ACCOUNT_REGISTRY_KEY = "accounts:registry";

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

export function clearSessionCookie(request, env) {
  return `${cookieAttributes(request, env, 0).join("; ")}`;
}

export async function createSessionCookie(request, env, session) {
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

export async function readSession(request, env) {
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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanString(value) {
  return String(value || "").trim();
}

function accountIdFor(provider, providerSubject, email, username) {
  const subject = cleanString(providerSubject);
  if (subject) return `${provider}:${subject}`.toLowerCase();
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) return `${provider}:email:${normalizedEmail}`;
  const normalizedUsername = cleanString(username).toLowerCase();
  if (normalizedUsername) return `${provider}:username:${normalizedUsername}`;
  return `${provider}:unknown:${crypto.randomUUID()}`;
}

function envMasterAccounts(env) {
  return [
    { index: 1, email: env.DC_ADMIN_EMAIL_1, envEmail: "DC_ADMIN_EMAIL_1", envSecret: "DC_ADMIN_SECRET_1" },
    { index: 2, email: env.DC_ADMIN_EMAIL_2, envEmail: "DC_ADMIN_EMAIL_2", envSecret: "DC_ADMIN_SECRET_2" }
  ]
    .filter((entry) => cleanString(entry.email))
    .map((entry) => {
      const email = normalizeEmail(entry.email);
      const now = new Date().toISOString();
      return {
        id: `env_master:${entry.index}:${email}`,
        provider: "password",
        providerSubject: email,
        email,
        username: "",
        displayName: email,
        avatarUrl: "",
        accountType: "admin",
        adminLevel: "master",
        status: "active",
        firstSeenAt: "",
        lastSeenAt: "",
        lastLoginAt: "",
        notes: `Configured by ${entry.envEmail}; secret remains server-only.`,
        source: "env_master",
        locked: true,
        updatedAt: now
      };
    });
}

function sanitizeAccount(raw) {
  const provider = cleanString(raw?.provider || "unknown").toLowerCase();
  const accountType = cleanString(raw?.accountType || raw?.account_type).toLowerCase() === "admin" ? "admin" : "regular";
  const adminLevel = accountType === "admin" && cleanString(raw?.adminLevel || raw?.admin_level).toLowerCase() === "master" ? "master" : accountType === "admin" ? "admin" : "none";
  const status = cleanString(raw?.status).toLowerCase() === "disabled" ? "disabled" : "active";
  const id = cleanString(raw?.id) || accountIdFor(provider, raw?.providerSubject, raw?.email, raw?.username);
  return {
    id,
    provider,
    providerSubject: cleanString(raw?.providerSubject || raw?.provider_subject),
    email: normalizeEmail(raw?.email),
    username: cleanString(raw?.username),
    displayName: cleanString(raw?.displayName || raw?.display_name || raw?.name || raw?.username || raw?.email || "Known account"),
    avatarUrl: cleanString(raw?.avatarUrl || raw?.avatar_url),
    accountType,
    adminLevel,
    status,
    firstSeenAt: cleanString(raw?.firstSeenAt || raw?.first_seen_at),
    lastSeenAt: cleanString(raw?.lastSeenAt || raw?.last_seen_at),
    lastLoginAt: cleanString(raw?.lastLoginAt || raw?.last_login_at),
    notes: cleanString(raw?.notes),
    source: cleanString(raw?.source || "oauth"),
    locked: Boolean(raw?.locked && raw?.source === "env_master"),
    updatedAt: cleanString(raw?.updatedAt || raw?.updated_at || new Date().toISOString())
  };
}

function storageBinding(env) {
  const binding = env?.DC_ADMIN_KV;
  if (!binding || typeof binding.get !== "function" || typeof binding.put !== "function") return null;
  return binding;
}

export async function loadAccountRegistry(env) {
  const masters = envMasterAccounts(env);
  const binding = storageBinding(env);
  if (!binding) {
    return {
      ok: true,
      configured: false,
      storageConfigured: false,
      error: "storage_not_configured",
      collection: "accounts",
      key: ACCOUNT_REGISTRY_KEY,
      accounts: masters,
      meta: {
        storage: "kv",
        binding: "DC_ADMIN_KV",
        key: ACCOUNT_REGISTRY_KEY,
        message: "DC_ADMIN_KV is not configured; only env-backed master admins are synthesized."
      }
    };
  }

  const raw = await binding.get(ACCOUNT_REGISTRY_KEY);
  let kvAccounts = [];
  let updatedAt = "";
  if (raw) {
    const parsed = JSON.parse(raw);
    kvAccounts = Array.isArray(parsed?.accounts) ? parsed.accounts.map(sanitizeAccount) : [];
    updatedAt = cleanString(parsed?.updatedAt || parsed?.updated_at);
  }

  const lockedIds = new Set(masters.map((account) => account.id));
  const accounts = [...masters, ...kvAccounts.filter((account) => account.source !== "env_master" && !lockedIds.has(account.id))];
  return {
    ok: true,
    configured: true,
    storageConfigured: true,
    collection: "accounts",
    key: ACCOUNT_REGISTRY_KEY,
    accounts,
    meta: {
      storage: "kv",
      binding: "DC_ADMIN_KV",
      key: ACCOUNT_REGISTRY_KEY,
      updatedAt,
      envMasterCount: masters.length,
      kvAccountCount: kvAccounts.length,
      accountCount: accounts.length
    }
  };
}

async function saveKvAccounts(env, accounts) {
  const binding = storageBinding(env);
  if (!binding) return { ok: false, error: "storage_not_configured" };
  const updatedAt = new Date().toISOString();
  const storedAccounts = accounts
    .map(sanitizeAccount)
    .filter((account) => account.source !== "env_master" && !account.locked);
  await binding.put(
    ACCOUNT_REGISTRY_KEY,
    JSON.stringify(
      {
        collection: "accounts",
        updatedAt,
        accounts: storedAccounts
      },
      null,
      2
    )
  );
  return { ok: true, updatedAt };
}

function findAccount(accounts, criteria) {
  const provider = cleanString(criteria.provider).toLowerCase();
  const providerSubject = cleanString(criteria.providerSubject);
  const email = normalizeEmail(criteria.email);
  const username = cleanString(criteria.username).toLowerCase();
  const id = cleanString(criteria.id);
  return accounts.find((account) => {
    if (id && account.id === id) return true;
    if (provider && account.provider !== provider) return false;
    if (providerSubject && account.providerSubject && account.providerSubject === providerSubject) return true;
    if (email && account.email && account.email === email) return true;
    if (username && account.username && account.username.toLowerCase() === username) return true;
    return false;
  });
}

export async function registerOAuthAccount(env, profile) {
  const provider = cleanString(profile?.provider).toLowerCase();
  const providerSubject = cleanString(profile?.providerSubject);
  if (!provider || !providerSubject) {
    return { ok: false, error: "missing_provider_identity" };
  }
  const binding = storageBinding(env);
  if (!binding) {
    return {
      ok: false,
      error: "storage_not_configured",
      storageConfigured: false,
      message: "DC_ADMIN_KV is not configured; OAuth account registry persistence is unavailable."
    };
  }

  const registry = await loadAccountRegistry(env);
  const kvAccounts = registry.accounts.filter((account) => account.source !== "env_master");
  const existing = findAccount(kvAccounts, profile);
  const now = new Date().toISOString();
  const next = sanitizeAccount({
    ...(existing || {}),
    id: existing?.id || accountIdFor(provider, providerSubject, profile.email, profile.username),
    provider,
    providerSubject,
    email: profile.email,
    username: profile.username,
    displayName: profile.displayName || profile.username || profile.email || `${provider} account`,
    avatarUrl: profile.avatarUrl,
    accountType: existing?.accountType === "admin" ? "admin" : "regular",
    adminLevel: existing?.accountType === "admin" ? existing.adminLevel || "admin" : "none",
    status: existing?.status || "active",
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
    lastLoginAt: now,
    notes: existing?.notes || "",
    source: existing?.source && existing.source !== "scaffold" ? existing.source : "oauth",
    updatedAt: now
  });
  const nextAccounts = existing ? kvAccounts.map((account) => (account.id === existing.id ? next : account)) : [next, ...kvAccounts];
  const saved = await saveKvAccounts(env, nextAccounts);
  if (!saved.ok) return saved;
  return { ok: true, storageConfigured: true, account: next, updatedAt: saved.updatedAt };
}

export async function updateAccount(env, id, patch) {
  const registry = await loadAccountRegistry(env);
  if (!registry.storageConfigured) return { ok: false, error: "storage_not_configured", status: 503 };
  const target = registry.accounts.find((account) => account.id === id);
  if (!target) return { ok: false, error: "account_not_found", status: 404 };
  if (target.locked || target.source === "env_master") return { ok: false, error: "account_locked", status: 409 };
  const kvAccounts = registry.accounts.filter((account) => account.source !== "env_master");
  const updated = sanitizeAccount({
    ...target,
    ...patch,
    id: target.id,
    provider: target.provider,
    providerSubject: target.providerSubject,
    updatedAt: new Date().toISOString()
  });
  const saved = await saveKvAccounts(env, kvAccounts.map((account) => (account.id === id ? updated : account)));
  if (!saved.ok) return { ok: false, error: saved.error, status: 503 };
  return { ok: true, account: updated };
}

export async function updateCurrentAccountProfile(env, session, patch) {
  const registry = await loadAccountRegistry(env);
  if (!registry.storageConfigured) return { ok: false, error: "storage_not_configured", status: 503 };
  const email = normalizeEmail(session?.email);
  const provider = cleanString(session?.provider || "unknown").toLowerCase();
  const username = cleanString(session?.username);
  const providerSubject = cleanString(session?.providerSubject || session?.provider_subject);
  const target = findAccount(registry.accounts, { provider, providerSubject, email, username });
  if (!target) return { ok: false, error: "account_not_found", status: 404 };
  const kvAccounts = registry.accounts.filter((account) => account.source !== "env_master");
  const cleanPatch = {
    displayName: cleanString(patch?.displayName || patch?.display_name).slice(0, 160),
    avatarUrl: cleanString(patch?.avatarUrl || patch?.avatar_url).slice(0, 1000)
  };
  const now = new Date().toISOString();
  let updated;
  if (target.source === "env_master" || target.locked) {
    const overlayId = `profile_overlay:${target.email}`;
    const existing = kvAccounts.find((account) => account.id === overlayId);
    updated = sanitizeAccount({
      ...(existing || {}),
      id: overlayId,
      provider: target.provider,
      providerSubject: target.providerSubject,
      email: target.email,
      username: target.username,
      displayName: cleanPatch.displayName || target.displayName,
      avatarUrl: cleanPatch.avatarUrl || target.avatarUrl,
      accountType: target.accountType,
      adminLevel: target.adminLevel,
      status: target.status,
      source: "profile_overlay",
      firstSeenAt: existing?.firstSeenAt || now,
      lastSeenAt: now,
      updatedAt: now
    });
    const nextAccounts = existing
      ? kvAccounts.map((account) => (account.id === overlayId ? updated : account))
      : [updated, ...kvAccounts];
    const saved = await saveKvAccounts(env, nextAccounts);
    if (!saved.ok) return { ok: false, error: saved.error, status: 503 };
    return { ok: true, account: updated };
  }

  updated = sanitizeAccount({
    ...target,
    displayName: cleanPatch.displayName || target.displayName,
    avatarUrl: cleanPatch.avatarUrl || target.avatarUrl,
    updatedAt: now
  });
  const saved = await saveKvAccounts(env, kvAccounts.map((account) => (account.id === target.id ? updated : account)));
  if (!saved.ok) return { ok: false, error: saved.error, status: 503 };
  return { ok: true, account: updated };
}

export async function resolveSession(request, env) {
  const session = await readSession(request, env);
  if (!session) {
    return {
      authenticated: false,
      provider: "",
      email: "",
      username: "",
      display_name: "",
      account_type: "anonymous",
      admin_level: "none",
      is_admin: false,
      is_master_admin: false,
      roleSource: "none"
    };
  }

  const email = normalizeEmail(session.email);
  const username = cleanString(session.username);
  const provider = cleanString(session.provider || "unknown").toLowerCase();
  const providerSubject = cleanString(session.providerSubject || session.provider_subject);
  const registry = await loadAccountRegistry(env).catch(() => null);
  const envMaster = registry?.accounts?.find((account) => account.source === "env_master" && account.email === email);
  if (provider === "password" && envMaster) {
    const overlay = registry?.accounts?.find((account) => account.source === "profile_overlay" && account.email === email);
    return {
      authenticated: true,
      provider,
      email,
      username: "",
      display_name: overlay?.displayName || envMaster.displayName,
      avatar_url: overlay?.avatarUrl || envMaster.avatarUrl || "",
      account_type: "admin",
      admin_level: "master",
      is_admin: true,
      is_master_admin: true,
      roleSource: "env_master"
    };
  }

  const registryAccount = registry?.accounts ? findAccount(registry.accounts, { provider, providerSubject, email, username }) : null;
  if (registryAccount && registryAccount.status !== "disabled") {
    const isAdmin = registryAccount.accountType === "admin";
    return {
      authenticated: true,
      provider,
      email: registryAccount.email || email,
      username: registryAccount.username || username,
      display_name: registryAccount.displayName || session.display_name || email || username || "DanielClancy account",
      avatar_url: registryAccount.avatarUrl || session.avatar_url || "",
      account_type: registryAccount.accountType,
      admin_level: registryAccount.adminLevel || "none",
      is_admin: isAdmin,
      is_master_admin: registryAccount.adminLevel === "master",
      roleSource: "kv_registry"
    };
  }

  return {
    authenticated: true,
    provider,
    email,
    username,
    display_name: session.display_name || email || username || "DanielClancy account",
    account_type: "regular",
    admin_level: "none",
    is_admin: false,
    is_master_admin: false,
    roleSource: "session"
  };
}

export async function requireAdmin(request, env) {
  const session = await resolveSession(request, env);
  if (!session.authenticated) return { session, error: "unauthenticated", status: 401 };
  if (!session.is_admin) return { session, error: "admin_required", status: 403 };
  return { session };
}

export async function requireMasterAdmin(request, env) {
  const admin = await requireAdmin(request, env);
  if (admin.error) return admin;
  if (!admin.session.is_master_admin) return { session: admin.session, error: "master_admin_required", status: 403 };
  return admin;
}

export function safeRegistryResponse(registry, session = null) {
  return {
    ok: true,
    configured: Boolean(registry.storageConfigured),
    storageConfigured: Boolean(registry.storageConfigured),
    collection: "accounts",
    key: ACCOUNT_REGISTRY_KEY,
    accounts: registry.accounts,
    meta: registry.meta,
    session
  };
}
