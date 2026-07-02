export const CUSTOMER_PROFILE_PREFIX = "customer:profile:";
export const CUSTOMER_EMAIL_PREFIX = "customer:email:";
export const CUSTOMER_SESSION_PREFIX = "customer:session:";
export const CUSTOMER_ORDERS_PREFIX = "customer:orders:";
export const CUSTOMER_RECENT_PREFIX = "customer:index:recent:";
export const MERCH_ORDER_PREFIX = "merch:orders:";
export const CUSTOMER_SESSION_COOKIE = "dc_customer_session";
export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export function customerStorage(env) {
  const binding = env?.DC_CUSTOMERS_KV;
  return binding && typeof binding.get === "function" && typeof binding.put === "function" ? binding : null;
}

export function merchOrderStorage(env) {
  const binding = env?.DC_MERCH_ORDERS_KV;
  return binding && typeof binding.get === "function" ? binding : null;
}

export function customerProfileKey(customerId) {
  return `${CUSTOMER_PROFILE_PREFIX}${cleanId(customerId)}`;
}

export function customerEmailKey(email) {
  return `${CUSTOMER_EMAIL_PREFIX}${normalizeEmail(email)}`;
}

export function customerSessionKey(sessionIdHash) {
  return `${CUSTOMER_SESSION_PREFIX}${cleanId(sessionIdHash)}`;
}

export function customerOrdersKey(customerId) {
  return `${CUSTOMER_ORDERS_PREFIX}${cleanId(customerId)}`;
}

export function customerRecentKey(profile) {
  const created = Date.parse(profile?.createdAt || "") || Date.now();
  return `${CUSTOMER_RECENT_PREFIX}${String(created).padStart(13, "0")}:${cleanId(profile?.id)}`;
}

export async function listCustomerIds(storage) {
  if (!storage || typeof storage.list !== "function") return [];
  const listed = await storage.list({ prefix: CUSTOMER_RECENT_PREFIX, limit: 100 });
  const recent = (Array.isArray(listed?.keys) ? listed.keys : [])
    .map((entry) => String(entry.name || "").split(":").pop())
    .filter(Boolean)
    .reverse();
  if (recent.length) return Array.from(new Set(recent)).slice(0, 100);
  const profiles = await storage.list({ prefix: CUSTOMER_PROFILE_PREFIX, limit: 100 });
  return (Array.isArray(profiles?.keys) ? profiles.keys : [])
    .map((entry) => String(entry.name || "").slice(CUSTOMER_PROFILE_PREFIX.length))
    .filter(Boolean);
}

export async function readCustomerProfile(storage, customerId) {
  const raw = await storage.get(customerProfileKey(customerId));
  if (!raw) return null;
  try {
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function readCustomerOrderIds(storage, customerId) {
  const raw = await storage.get(customerOrdersKey(customerId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.orderIds) ? parsed.orderIds.map(cleanId).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function putCustomerProfile(storage, profile) {
  const normalized = normalizeProfile(profile);
  await storage.put(customerProfileKey(normalized.id), JSON.stringify(normalized));
  if (normalized.email) await storage.put(customerEmailKey(normalized.email), normalized.id);
  await storage.put(customerRecentKey(normalized), normalized.id);
  return normalized;
}

export async function findCustomerByEmail(storage, email) {
  const customerId = await storage.get(customerEmailKey(email));
  return customerId ? readCustomerProfile(storage, customerId) : null;
}

export async function upsertCustomerByEmail(storage, email, patch = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const existing = await findCustomerByEmail(storage, normalizedEmail);
  const now = new Date().toISOString();
  const profile = normalizeProfile({
    ...(existing || {}),
    ...patch,
    displayName: patch.displayName || existing?.displayName || "",
    avatarUrl: patch.avatarUrl || existing?.avatarUrl || "",
    roles: Array.isArray(patch.roles) ? Array.from(new Set([...(existing?.roles || []), ...patch.roles])) : existing?.roles || [],
    id: existing?.id || `cust_${crypto.randomUUID()}`,
    email: normalizedEmail,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastLoginAt: patch.lastLoginAt || existing?.lastLoginAt || now
  });
  return putCustomerProfile(storage, profile);
}

export async function createCustomerSession(storage, request, env, profile) {
  const sessionId = randomToken(32);
  const sessionIdHash = await sha256(sessionId);
  const now = new Date().toISOString();
  const session = {
    schemaVersion: 1,
    customerId: profile.id,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + CUSTOMER_SESSION_TTL_SECONDS * 1000).toISOString(),
    lastSeenAt: now
  };
  await storage.put(customerSessionKey(sessionIdHash), JSON.stringify(session), { expirationTtl: CUSTOMER_SESSION_TTL_SECONDS });
  return { session, cookie: customerSessionCookie(request, env, sessionId) };
}

export async function readCustomerSession(request, env) {
  const storage = customerStorage(env);
  if (!storage) return { storage: null, session: null, profile: null };
  const sessionId = parseCookies(request)[CUSTOMER_SESSION_COOKIE];
  if (!sessionId) return { storage, session: null, profile: null };
  const sessionIdHash = await sha256(sessionId);
  const session = await readJson(storage, customerSessionKey(sessionIdHash));
  if (!session?.customerId || Date.parse(session.expiresAt || "") <= Date.now()) {
    return { storage, session: null, profile: null };
  }
  const profile = await readCustomerProfile(storage, session.customerId);
  if (!profile || profile.status === "disabled") return { storage, session: null, profile: null };
  return { storage, session, profile };
}

export function customerHasAdminAccess(profile) {
  const normalized = normalizeProfile(profile);
  return Boolean(normalized.adminAccess || normalized.roles.includes("admin"));
}

export function clearCustomerSessionCookie(request, env) {
  return customerSessionCookie(request, env, "", 0);
}

export async function readMerchOrder(storage, orderId) {
  if (!storage || !orderId) return null;
  const raw = await storage.get(`${MERCH_ORDER_PREFIX}${cleanId(orderId)}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function adminCustomerSummary(profile, orders = []) {
  const normalized = normalizeProfile(profile);
  const totals = summarizeOrders(orders);
  const defaultAddress = normalized.addresses.find((address) => address.isDefault) || normalized.addresses[0] || null;
  return {
    id: normalized.id,
    email: normalized.email,
    emailMasked: maskEmail(normalized.email),
    displayName: normalized.displayName,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    lastLoginAt: normalized.lastLoginAt,
    orderCount: orders.length,
    totalSpend: totals.totalSpend,
    currency: totals.currency,
    defaultCountry: defaultAddress?.countryCode || "",
    preferenceSummary: preferenceSummary(normalized),
    stripeCustomerMapped: Boolean(normalized.stripeCustomerId),
    adminAccess: customerHasAdminAccess(normalized),
    roles: normalized.roles,
    adminAccessUpdatedAt: normalized.adminAccessUpdatedAt,
    adminAccessUpdatedBy: normalized.adminAccessUpdatedBy,
    adminAccessRevokedAt: normalized.adminAccessRevokedAt,
    adminAccessRevokedBy: normalized.adminAccessRevokedBy,
    status: normalized.status,
    adminNotes: normalized.adminNotes
  };
}

export function adminCustomerDetail(profile, orders = []) {
  const normalized = normalizeProfile(profile);
  return {
    ...adminCustomerSummary(normalized, orders),
    phone: normalized.phone,
    avatarUrl: normalized.avatarUrl,
    addresses: normalized.addresses,
    preferences: normalized.contactPreferences,
    marketingOptIn: normalized.marketingOptIn,
    stripeCustomerMapped: Boolean(normalized.stripeCustomerId),
    orderHistory: orders.map(adminOrderSummary),
    metadata: normalized.metadata
  };
}

export function normalizeProfile(raw = {}) {
  const roles = normalizeRoles(raw.roles);
  const adminAccess = Boolean(raw.adminAccess || raw.admin_access || roles.includes("admin"));
  const normalizedRoles = adminAccess && !roles.includes("admin") ? [...roles, "admin"] : roles;
  return {
    schemaVersion: Number(raw.schemaVersion) || 1,
    id: cleanId(raw.id),
    email: normalizeEmail(raw.email),
    displayName: cleanText(raw.displayName || raw.display_name, 120),
    avatarUrl: cleanText(raw.avatarUrl || raw.avatar_url, 1000),
    phone: cleanText(raw.phone, 60),
    status: cleanText(raw.status, 40) === "disabled" ? "disabled" : "active",
    marketingOptIn: Boolean(raw.marketingOptIn || raw.marketing_opt_in),
    contactPreferences: {
      marketing: Boolean(raw.contactPreferences?.marketing),
      productDrops: Boolean(raw.contactPreferences?.productDrops),
      orderUpdates: raw.contactPreferences?.orderUpdates === false ? false : true,
      newsletter: Boolean(raw.contactPreferences?.newsletter)
    },
    addresses: Array.isArray(raw.addresses) ? raw.addresses.map(normalizeAddress).filter((address) => address.name || address.address1).slice(0, 8) : [],
    stripeCustomerId: cleanId(raw.stripeCustomerId || raw.stripe_customer_id),
    roles: normalizedRoles,
    adminAccess,
    adminAccessUpdatedAt: cleanText(raw.adminAccessUpdatedAt || raw.admin_access_updated_at, 80),
    adminAccessUpdatedBy: cleanText(raw.adminAccessUpdatedBy || raw.admin_access_updated_by, 180),
    adminAccessRevokedAt: cleanText(raw.adminAccessRevokedAt || raw.admin_access_revoked_at, 80),
    adminAccessRevokedBy: cleanText(raw.adminAccessRevokedBy || raw.admin_access_revoked_by, 180),
    adminNotes: cleanText(raw.adminNotes || raw.admin_notes, 1000),
    metadata: raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata) ? raw.metadata : {},
    createdAt: cleanText(raw.createdAt || raw.created_at, 80),
    updatedAt: cleanText(raw.updatedAt || raw.updated_at, 80),
    lastLoginAt: cleanText(raw.lastLoginAt || raw.last_login_at, 80)
  };
}

export function normalizeRoles(raw) {
  const values = Array.isArray(raw) ? raw : [];
  return Array.from(new Set(values.map((role) => cleanText(role, 40).toLowerCase()).filter(Boolean))).slice(0, 12);
}

function normalizeAddress(raw = {}) {
  return {
    id: cleanId(raw.id),
    label: cleanText(raw.label, 80),
    name: cleanText(raw.name, 140),
    address1: cleanText(raw.address1, 180),
    address2: cleanText(raw.address2, 180),
    city: cleanText(raw.city, 120),
    region: cleanText(raw.region || raw.state || raw.state_code, 80),
    postalCode: cleanText(raw.postalCode || raw.postal_code || raw.zip, 40),
    countryCode: cleanText(raw.countryCode || raw.country_code || raw.country, 2).toUpperCase(),
    phone: cleanText(raw.phone, 60),
    isDefault: Boolean(raw.isDefault || raw.is_default)
  };
}

function summarizeOrders(orders) {
  const totals = orders.reduce(
    (acc, order) => {
      const currency = cleanText(order?.totals?.currency || order?.cart?.currency || order?.shipping?.currency || acc.currency || "AUD", 12).toUpperCase();
      const amount = Number(order?.totals?.totalAmount || order?.totalAmount || ((Number(order?.cart?.subtotalAmount) || 0) + (Number(order?.shipping?.amount) || 0))) || 0;
      return { totalSpend: acc.totalSpend + amount, currency };
    },
    { totalSpend: 0, currency: "AUD" }
  );
  return totals;
}

function adminOrderSummary(order) {
  return {
    id: cleanId(order?.id),
    createdAt: cleanText(order?.createdAt, 80),
    updatedAt: cleanText(order?.updatedAt, 80),
    status: cleanText(order?.status, 80),
    totalAmount: Number(order?.totals?.totalAmount || order?.totalAmount || ((Number(order?.cart?.subtotalAmount) || 0) + (Number(order?.shipping?.amount) || 0))) || 0,
    currency: cleanText(order?.totals?.currency || order?.cart?.currency || order?.shipping?.currency, 12).toUpperCase(),
    itemSummary: Array.isArray(order?.cart?.items)
      ? order.cart.items.map((item) => ({
          title: cleanText(item.title, 220),
          variantName: cleanText(item.variantName, 220),
          quantity: Number(item.quantity) || 0
        }))
      : []
  };
}

function preferenceSummary(profile) {
  const enabled = [];
  if (profile.marketingOptIn || profile.contactPreferences.marketing) enabled.push("marketing");
  if (profile.contactPreferences.productDrops) enabled.push("drops");
  if (profile.contactPreferences.newsletter) enabled.push("newsletter");
  if (profile.contactPreferences.orderUpdates) enabled.push("order updates");
  return enabled.join(", ") || "none";
}

export function maskEmail(value) {
  const email = cleanText(value, 180).toLowerCase();
  const [name, domain] = email.split("@");
  if (!name || !domain) return "";
  return `${name.length <= 2 ? `${name[0] || ""}*` : `${name.slice(0, 2)}***`}@${domain}`;
}

export function cleanText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeEmail(value) {
  return cleanText(value, 180).toLowerCase();
}

export function cleanId(value) {
  return cleanText(value, 180).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 180);
}

export async function readJson(storage, key) {
  if (!storage || !key) return null;
  const raw = await storage.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return base64Url(new Uint8Array(digest));
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function customerSessionCookie(request, env, sessionId, maxAge = CUSTOMER_SESSION_TTL_SECONDS) {
  const attributes = [
    `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(sessionId || "")}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ];
  const domain = sessionCookieDomain(request, env);
  if (domain) attributes.push(`Domain=${domain}`);
  if (isHttps(request)) attributes.push("Secure");
  return attributes.join("; ");
}

function sessionCookieDomain(request, env) {
  const configured = cleanText(env?.DC_CUSTOMER_COOKIE_DOMAIN || env?.DC_AUTH_COOKIE_DOMAIN, 180);
  if (configured) return configured;
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "danielclancy.net" || hostname === "admin.danielclancy.net" ? ".danielclancy.net" : "";
}

function isHttps(request) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
