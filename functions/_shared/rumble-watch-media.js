const RUMBLE_PUB_CODE = "vmzw3";
const SCAFFOLD_WATCH_MEDIA_EXACT = new Set([
  "latest-youtube-release-scaffold",
  "latest youtube release scaffold",
  "scheduled-livestream-scaffold",
  "scheduled livestream scaffold",
  "archived-replay-scaffold",
  "archived replay scaffold"
]);
const SCAFFOLD_WATCH_MEDIA_TERMS = [
  "scaffold",
  "demo",
  "sample",
  "placeholder",
  "seeded watch media",
  "local placeholder"
];

export function isScaffoldWatchMediaEntry(raw = {}) {
  const candidates = [raw?.id, raw?.slug, raw?.title]
    .map((value) => cleanText(value, 300).toLowerCase())
    .filter(Boolean);
  if (!candidates.length) return false;
  return candidates.some((value) => SCAFFOLD_WATCH_MEDIA_EXACT.has(value) || SCAFFOLD_WATCH_MEDIA_TERMS.some((term) => value.includes(term)));
}

export function filterScaffoldWatchMediaEntries(items = []) {
  const kept = [];
  const rejected = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (isScaffoldWatchMediaEntry(item)) {
      rejected.push(item);
    } else {
      kept.push(item);
    }
  }
  return {
    items: kept,
    rejected,
    purgedCount: rejected.length
  };
}

export function watchMediaSortTime(item = {}) {
  const parsed = new Date(item.sortDate || item.publishedAt || item.enteredAt || item.createdAt || item.updatedAt || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseRumbleInput(value = "") {
  const input = cleanText(value, 2000);
  const iframeSrc = input.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/i)?.[1] || "";
  const candidate = iframeSrc || input;
  const url = safeUrl(candidate);
  const rawId = !url ? cleanRumbleId(candidate) : "";
  const embedId = url ? rumbleEmbedId(url) : "";
  const pageId = url ? rumblePageId(url) : "";
  const platformVideoId = embedId || pageId || rawId;
  const sourceUrl = url && isRumbleUrl(url) && !isRumbleEmbedUrl(url) ? stripUnsafeQuery(url) : rawId ? `https://rumble.com/${rawId}.html` : "";
  const embedUrl = embedId ? buildRumbleEmbedUrl(embedId) : "";

  return {
    ok: Boolean(platformVideoId || sourceUrl || embedUrl),
    input,
    sourceUrl,
    embedUrl,
    platformVideoId,
    pageVideoId: pageId,
    embedVideoId: embedId || "",
    externalUrl: sourceUrl || (url && isRumbleUrl(url) ? stripUnsafeQuery(url) : ""),
    warnings: []
  };
}

export async function resolveRumbleMetadata(input, options = {}) {
  const parsed = parseRumbleInput(input);
  const warnings = [...(parsed.warnings || [])];
  let pageUrl = parsed.sourceUrl;
  let pageHtml = "";

  if (!pageUrl && parsed.embedUrl) {
    pageUrl = parsed.embedUrl;
  }

  if (pageUrl && options.fetchPage !== false) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "DanielClancy-Admin/1.0 watch-media-resolver"
        }
      });
      if (response.ok) {
        pageHtml = await response.text();
      } else {
        warnings.push(`rumble_metadata_http_${response.status}`);
      }
    } catch {
      warnings.push("rumble_metadata_fetch_failed");
    }
  }

  const og = parseMetadataTags(pageHtml);
  const discoveredEmbedId = rumbleEmbedIdFromHtml(pageHtml);
  const embedUrl = parsed.embedUrl || (discoveredEmbedId ? buildRumbleEmbedUrl(discoveredEmbedId) : "");
  const sourceUrl = parsed.sourceUrl || pageUrl || "";
  const title = og["og:title"] || og["twitter:title"] || titleFromRumbleUrl(sourceUrl);
  const description = og["og:description"] || og["twitter:description"] || "";
  const thumbnailUrl = safeHttpsUrl(og["og:image"] || og["twitter:image"] || "");

  return {
    ok: parsed.ok || Boolean(title || thumbnailUrl || embedUrl),
    sourcePlatform: "rumble",
    source: "manual",
    sourceUrl,
    externalUrl: sourceUrl,
    canonicalUrl: sourceUrl,
    embedUrl,
    platformVideoId: parsed.platformVideoId || discoveredEmbedId || "",
    title,
    description,
    thumbnailUrl,
    warnings
  };
}

export function normalizeWatchMediaItem(raw = {}) {
  const sourcePlatform = normalizeEnum(raw.sourcePlatform || raw.platform || raw.provider, ["youtube", "rumble", "manual"], "manual");
  const entryType = normalizeEnum(raw.entryType || raw.type || raw.kind, ["video", "short", "livestream", "other"], "video");
  const source = normalizeEnum(raw.source, ["autofetch", "manual"], sourcePlatform === "youtube" ? "autofetch" : "manual");
  const visible = raw.visible !== undefined ? Boolean(raw.visible) : !["hidden", "draft", "private", "archived"].includes(cleanText(raw.visibility || raw.status).toLowerCase());
  const aspect = normalizeEnum(raw.aspect, ["landscape", "portrait"], entryType === "short" ? "portrait" : "landscape");
  const galleryOnly = raw.galleryOnly !== undefined ? Boolean(raw.galleryOnly) : sourcePlatform === "rumble" && entryType === "short";
  const embedUrl = safeEmbedUrl(raw.embedUrl);
  const heroEmbeddable = galleryOnly ? false : Boolean(embedUrl);
  const enteredAt = cleanIsoish(raw.enteredAt || raw.createdAt || raw.updatedAt) || new Date().toISOString();
  const publishedAt = cleanIsoish(raw.publishedAt || raw.publishedAtOverride || raw.date) || "";
  const sortDate = cleanIsoish(raw.sortDate || raw.publishedAt || raw.publishedAtOverride || raw.enteredAt || raw.createdAt || raw.updatedAt) || enteredAt;
  const title = cleanText(raw.titleOverride || raw.title || "Untitled media", 240);
  const id = cleanSlug(raw.id || raw.slug || `${sourcePlatform}-${entryType}-${title}-${sortDate}`) || `media-${Date.now()}`;
  const sourceUrl = safeHttpsUrl(raw.sourceUrl || raw.videoUrl || raw.url || "");
  const externalUrl = safeHttpsUrl(raw.externalUrl || raw.externalPageUrl || raw.pageUrl || sourceUrl);
  const canonicalUrl = safeHttpsUrl(raw.canonicalUrl || externalUrl || sourceUrl);
  const thumbnailUrl = safeHttpsUrl(raw.thumbnailOverrideUrl || raw.thumbnailUrl || raw.thumbnailPath || "");

  return {
    id,
    slug: cleanSlug(raw.slug || id),
    sourcePlatform,
    entryType,
    source,
    title,
    description: cleanText(raw.descriptionOverride || raw.description || raw.summary || raw.excerpt || "", 2000),
    excerpt: cleanText(raw.excerpt || raw.summary || raw.descriptionOverride || raw.description || "", 280),
    thumbnailUrl,
    thumbnailPath: thumbnailUrl,
    sourceUrl,
    videoUrl: sourceUrl || externalUrl,
    embedUrl,
    externalUrl,
    externalPageUrl: externalUrl,
    canonicalUrl,
    platformVideoId: cleanText(raw.platformVideoId || raw.videoId || "", 160),
    platformChannelId: cleanText(raw.platformChannelId || raw.channelId || "", 160),
    publishedAt: publishedAt || null,
    enteredAt,
    sortDate,
    visible,
    visibility: visible ? "public" : cleanText(raw.visibility || raw.status || "hidden", 40),
    status: visible ? "published" : cleanText(raw.status || raw.visibility || "hidden", 40),
    featured: Boolean(raw.featured || raw.featuredEligible || raw.manualHeroEligible),
    featuredEligible: Boolean(raw.featured || raw.featuredEligible || raw.manualHeroEligible),
    manualHeroEligible: Boolean(raw.manualHeroEligible || raw.featured),
    heroEmbeddable,
    galleryOnly,
    aspect,
    tags: safeArray(raw.tags),
    titleOverride: cleanText(raw.titleOverride || "", 240),
    descriptionOverride: cleanText(raw.descriptionOverride || "", 2000),
    thumbnailOverrideUrl: safeHttpsUrl(raw.thumbnailOverrideUrl || ""),
    publishedAtOverride: cleanIsoish(raw.publishedAtOverride || "") || "",
    createdAt: cleanIsoish(raw.createdAt || enteredAt) || enteredAt,
    updatedAt: cleanIsoish(raw.updatedAt || enteredAt) || enteredAt,
    createdBy: cleanText(raw.createdBy || "", 160),
    updatedBy: cleanText(raw.updatedBy || "", 160),
    resolverWarnings: safeArray(raw.resolverWarnings || raw.warnings)
  };
}

export function sanitizeWatchMediaItem(raw = {}) {
  if (isScaffoldWatchMediaEntry(raw)) return null;
  const item = normalizeWatchMediaItem(raw);
  if (!item.visible) return null;
  if (!item.title || (!item.sourceUrl && !item.externalUrl && !item.embedUrl)) return null;
  return {
    id: item.id,
    sourcePlatform: item.sourcePlatform,
    entryType: item.entryType,
    source: item.source,
    title: item.title,
    description: item.description,
    excerpt: item.excerpt,
    thumbnailUrl: item.thumbnailUrl,
    sourceUrl: item.sourceUrl,
    embedUrl: item.embedUrl,
    externalUrl: item.externalUrl,
    canonicalUrl: item.canonicalUrl,
    platformVideoId: item.platformVideoId,
    platformChannelId: item.platformChannelId,
    publishedAt: item.publishedAt,
    enteredAt: item.enteredAt,
    sortDate: item.sortDate,
    createdAt: item.createdAt,
    visible: item.visible,
    featured: item.featured,
    manualHeroEligible: item.manualHeroEligible,
    heroEmbeddable: item.heroEmbeddable,
    galleryOnly: item.galleryOnly,
    aspect: item.aspect,
    tags: item.tags,
    updatedAt: item.updatedAt
  };
}

function parseMetadataTags(html = "") {
  const result = {};
  const source = String(html || "");
  const tagPattern = /<meta\b[^>]*>/gi;
  for (const [tag] of source.matchAll(tagPattern)) {
    const property = attributeValue(tag, "property") || attributeValue(tag, "name");
    const content = attributeValue(tag, "content");
    if (property && content && /^(og:|twitter:)/i.test(property)) {
      result[property.toLowerCase()] = decodeHtml(content);
    }
  }
  return result;
}

function attributeValue(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return tag.match(pattern)?.[1] || "";
}

function rumbleEmbedIdFromHtml(html = "") {
  return String(html || "").match(/https:\/\/rumble\.com\/embed\/([a-z0-9]+)/i)?.[1] || "";
}

function rumbleEmbedId(url) {
  if (!url || !isRumbleEmbedUrl(url)) return "";
  return url.pathname.match(/\/embed\/([a-z0-9]+)/i)?.[1] || "";
}

function rumblePageId(url) {
  if (!url || !isRumbleUrl(url) || isRumbleEmbedUrl(url)) return "";
  return url.pathname.match(/\/(v[a-z0-9]+)(?:-|\.html|\/|$)/i)?.[1] || "";
}

function cleanRumbleId(value) {
  const text = cleanText(value, 160);
  return /^v[a-z0-9]+$/i.test(text) ? text.toLowerCase() : "";
}

function buildRumbleEmbedUrl(id) {
  const clean = cleanRumbleId(id);
  return clean ? `https://rumble.com/embed/${clean}/?pub=${RUMBLE_PUB_CODE}` : "";
}

function stripUnsafeQuery(url) {
  if (!url) return "";
  const next = new URL(url.toString());
  for (const key of Array.from(next.searchParams.keys())) {
    if (!["mref", "mc"].includes(key)) next.searchParams.delete(key);
  }
  next.hash = "";
  return next.toString();
}

function safeUrl(value) {
  const text = cleanText(value, 2000);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function safeHttpsUrl(value) {
  const url = safeUrl(value);
  return url ? url.toString() : "";
}

function safeEmbedUrl(value) {
  const url = safeUrl(value);
  if (!url) return "";
  if (url.hostname === "rumble.com" && url.pathname.startsWith("/embed/")) return url.toString();
  if (url.hostname.endsWith("youtube.com") && url.pathname.startsWith("/embed/")) return url.toString();
  return "";
}

function isRumbleUrl(url) {
  return url?.hostname === "rumble.com" || url?.hostname.endsWith(".rumble.com");
}

function isRumbleEmbedUrl(url) {
  return isRumbleUrl(url) && url.pathname.startsWith("/embed/");
}

function titleFromRumbleUrl(value) {
  const url = safeUrl(value);
  if (!url) return "";
  const slug = url.pathname.replace(/\.html$/i, "").split("/").filter(Boolean).pop() || "";
  return cleanText(slug.replace(/^v[a-z0-9]+-?/i, "").replace(/-/g, " "), 240);
}

function normalizeEnum(value, allowed, fallback) {
  const text = cleanText(value).toLowerCase();
  return allowed.includes(text) ? text : fallback;
}

function cleanIsoish(value) {
  const text = cleanText(value, 80);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function safeArray(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item, 80)).filter(Boolean);
  const text = cleanText(value, 1000);
  return text ? text.split(/[,;\n]/).map((item) => cleanText(item, 80)).filter(Boolean) : [];
}

function cleanSlug(value) {
  return cleanText(value, 240)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function decodeHtml(value) {
  return cleanText(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
