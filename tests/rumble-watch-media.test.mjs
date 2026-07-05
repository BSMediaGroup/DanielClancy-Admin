import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    visible: true,
    heroEmbeddable: true
  });

  assert.equal(item.aspect, "portrait");
  assert.equal(item.galleryOnly, true);
  assert.equal(item.heroEmbeddable, false);
});

test("Rumble video dates persist through normalized public sanitizer", () => {
  const visible = sanitizeWatchMediaItem({
    id: "rumble-video-dated",
    sourcePlatform: "rumble",
    entryType: "video",
    source: "manual",
    title: "Newest Rumble video",
    sourceUrl: "https://rumble.com/v7c9m82-video.html",
    embedUrl: "https://rumble.com/embed/v7a2y7u/?pub=vmzw3",
    thumbnailUrl: "https://cdn.example.test/thumb.webp",
    visible: true,
    publishedAt: "2026-07-05T01:00:00.000Z",
    sortDate: "2026-07-06T01:00:00.000Z",
    enteredAt: "2026-07-04T01:00:00.000Z",
    createdAt: "2026-07-03T01:00:00.000Z",
    updatedAt: "2026-07-06T02:00:00.000Z"
  });

  assert.equal(visible.publishedAt, "2026-07-05T01:00:00.000Z");
  assert.equal(visible.sortDate, "2026-07-06T01:00:00.000Z");
  assert.equal(visible.enteredAt, "2026-07-04T01:00:00.000Z");
  assert.equal(visible.createdAt, "2026-07-03T01:00:00.000Z");
  assert.equal(visible.updatedAt, "2026-07-06T02:00:00.000Z");
  assert.equal(visible.heroEmbeddable, true);
  assert.equal(visible.galleryOnly, false);
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

test("Admin Media runtime does not render scaffold/demo seed rows", async () => {
  const appSource = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const seedSource = await readFile(new URL("../assets/js/scaffold-data.js", import.meta.url), "utf8");

  assert.match(appSource, /message: "Checking Watch Media CMS\. No scaffold media rows are rendered\."/);
  assert.match(appSource, /return \[\];/);
  assert.match(appSource, /No watch media entries yet\./);
  assert.doesNotMatch(appSource, /Reset Media CMS scaffold rows to the repo seed data/);
  assert.doesNotMatch(appSource, /No local scaffold media items/);
  assert.match(seedSource, /media:\s*\[\]/);
  assert.doesNotMatch(seedSource, /latest-youtube-release-scaffold|scheduled-livestream-scaffold|archived-replay-scaffold/);
});
