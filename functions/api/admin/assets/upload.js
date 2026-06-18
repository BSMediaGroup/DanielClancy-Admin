import { requireAdmin } from "../../../_shared/admin-accounts.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {})
    }
  });
}

function cleanText(value, maxLength = 200) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeSlug(value) {
  return cleanText(value || "project", 120)
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function safeFileName(value, mime) {
  const extension = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf"
  }[mime] || "";
  const cleaned = cleanText(value || "asset", 160)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withoutExtension = cleaned.replace(/\.[a-z0-9]{2,5}$/i, "") || "asset";
  return `${withoutExtension}${extension}`;
}

function publicUrl(env, key) {
  const base = cleanText(env.DC_ADMIN_ASSETS_PUBLIC_BASE_URL, 500).replace(/\/+$/g, "");
  if (!base) return "";
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
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

  const bucket = env?.DC_ADMIN_ASSETS_R2;
  if (!bucket || typeof bucket.put !== "function") {
    return json({ ok: false, error: "storage_not_configured", binding: "DC_ADMIN_ASSETS_R2" }, { status: 503 });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "invalid_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json({ ok: false, error: "file_required" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return json({ ok: false, error: "unsupported_file_type", mime: cleanText(file.type, 80) }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return json({ ok: false, error: "file_too_large", maxBytes: MAX_UPLOAD_BYTES }, { status: 413 });
  }

  const projectSlug = safeSlug(form.get("projectSlug") || form.get("slug"));
  const field = safeSlug(form.get("field") || "gallery");
  const filename = safeFileName(file.name, file.type);
  const keyPrefix =
    field === "thumbnailpath" || field === "thumbnail"
      ? `portfolio/thumbs/${projectSlug}`
      : field === "documentpath" || field === "document"
        ? `docs/projects/${projectSlug}`
        : field === "avatar" || field === "avatarurl"
          ? "accounts/avatars"
          : `portfolio/projects/${projectSlug}`;
  const key = `${keyPrefix}/${Date.now()}-${crypto.randomUUID()}-${filename}`;
  const url = publicUrl(env, key);
  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: cleanText(file.name, 180),
      uploadedBy: cleanText(admin.session?.email || admin.session?.username || "admin", 160)
    }
  });

  return json({
    ok: true,
    key,
    url,
    relativePath: url || `/${key}`,
    path: url || `/${key}`,
    mime: file.type,
    size: file.size,
    originalName: cleanText(file.name, 180)
  });
}
