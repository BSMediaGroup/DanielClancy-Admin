import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWatchMediaItem, parseRumbleInput, resolveRumbleMetadata, sanitizeWatchMediaItem } from "../functions/_shared/rumble-watch-media.js";

test("Rumble parser accepts main, monetized, embed URL, iframe HTML, and raw id inputs", () => {
  const main = parseRumbleInput("https://rumble.com/v7c9m82-happy-birthday-america-you-made-it-.html");
  const monetized = parseRumbleInput("https://rumble.com/v7c9m82-happy-birthday-america-you-made-it-.html?mref=vmzw3&mc=2u7v2");
  const embed = parseRumbleInput("https://rumble.com/embed/v7a2y7u/?pub=vmzw3");
  const iframe = parseRumbleInput('<iframe class="rumble" width="640" height="360" src="https://rumble.com/embed/v7a2y7u/?pub=vmzw3" frameborder="0" allowfullscreen></iframe>');
  const raw = parseRumbleInput("v7a2y7u");

  assert.equal(main.platformVideoId, "v7c9m82");
  assert.equal(monetized.sourceUrl, "https://rumble.com/v7c9m82-happy-birthday-america-you-made-it-.html?mref=vmzw3&mc=2u7v2");
  assert.equal(embed.embedUrl, "https://rumble.com/embed/v7a2y7u/?pub=vmzw3");
  assert.equal(iframe.embedUrl, "https://rumble.com/embed/v7a2y7u/?pub=vmzw3");
  assert.equal(raw.sourceUrl, "https://rumble.com/v7a2y7u.html");
});

test("Rumble resolver parses Open Graph metadata and discovered embed without executing scripts", async () => {
  const html = `
    <html><head>
      <meta property="og:title" content="Happy Birthday America">
      <meta property="og:description" content="Resolved description">
      <meta property="og:image" content="https://cdn.example.test/thumb.webp">
    </head><body>
      <script>alert("not executed")</script>
      <iframe src="https://rumble.com/embed/v7a2y7u/?pub=vmzw3"></iframe>
    </body></html>
  `;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } });
  try {
    const resolved = await resolveRumbleMetadata("https://rumble.com/v7c9m82-happy-birthday-america-you-made-it-.html");
    assert.equal(resolved.title, "Happy Birthday America");
    assert.equal(resolved.description, "Resolved description");
    assert.equal(resolved.thumbnailUrl, "https://cdn.example.test/thumb.webp");
    assert.equal(resolved.embedUrl, "https://rumble.com/embed/v7a2y7u/?pub=vmzw3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Rumble shorts normalize as portrait gallery-only and not hero embeddable", () => {
  const item = normalizeWatchMediaItem({
    id: "short-1",
    sourcePlatform: "rumble",
    entryType: "short",
    title: "Portrait short",
    sourceUrl: "https://rumble.com/v7c9m82-short.html",
    thumbnailUrl: "https://cdn.example.test/short.webp",
    visible: true
  });

  assert.equal(item.aspect, "portrait");
  assert.equal(item.galleryOnly, true);
  assert.equal(item.heroEmbeddable, false);
});

test("public watch media sanitizer removes hidden and admin-only fields", () => {
  const hidden = sanitizeWatchMediaItem({ id: "hidden", title: "Hidden", visible: false, sourceUrl: "https://rumble.com/v1.html" });
  const visible = sanitizeWatchMediaItem({
    id: "visible",
    title: "Visible",
    sourcePlatform: "rumble",
    entryType: "video",
    sourceUrl: "https://rumble.com/v7c9m82-video.html",
    embedUrl: "https://rumble.com/embed/v7a2y7u/?pub=vmzw3",
    thumbnailUrl: "https://cdn.example.test/thumb.webp",
    visible: true,
    updatedBy: "admin@example.test",
    secretToken: "never"
  });

  assert.equal(hidden, null);
  assert.equal(visible.updatedBy, undefined);
  assert.equal(visible.secretToken, undefined);
  assert.equal(visible.heroEmbeddable, true);
});
