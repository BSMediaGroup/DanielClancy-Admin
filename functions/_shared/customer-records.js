export const CUSTOMER_PROFILE_PREFIX = "customer:profile:";
export const CUSTOMER_ORDERS_PREFIX = "customer:orders:";
export const CUSTOMER_RECENT_PREFIX = "customer:index:recent:";
export const MERCH_ORDER_PREFIX = "merch:orders:";

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

export function customerOrdersKey(customerId) {
  return `${CUSTOMER_ORDERS_PREFIX}${cleanId(customerId)}`;
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
  return normalized;
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
  return {
    schemaVersion: Number(raw.schemaVersion) || 1,
    id: cleanId(raw.id),
    email: cleanText(raw.email, 180).toLowerCase(),
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
    adminNotes: cleanText(raw.adminNotes || raw.admin_notes, 1000),
    metadata: raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata) ? raw.metadata : {},
    createdAt: cleanText(raw.createdAt || raw.created_at, 80),
    updatedAt: cleanText(raw.updatedAt || raw.updated_at, 80),
    lastLoginAt: cleanText(raw.lastLoginAt || raw.last_login_at, 80)
  };
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

export function cleanId(value) {
  return cleanText(value, 180).replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 180);
}
