import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSessionCookie } from "../functions/_shared/admin-accounts.js";
import { onRequest as cmsCollection } from "../functions/api/admin/cms/[[collection]].js";
import {
  filterScaffoldWatchMediaEntries,
  isScaffoldWatchMediaEntry,
  normalizeWatchMediaItem,
  parseRumbleInput,
  resolveRumbleMetadata,
  sanitizeWatchMediaItem,
  watchMediaSortTime
} from "../functions/_shared/rumble-watch-media.js";

function memoryKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    async get(key) {
      return store.get(key) || null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    store
  };
}

async function adminCmsRequest(kv, method = "GET", body = undefined) {
  const secret = "test-secret";
  const url = "https://admin.danielclancy.net/api/admin/cms/media";
  const cookie = await createSessionCookie(new Request(url), { DC_AUTH_SESSION_SECRET: secret }, {
    email: "admin@example.test",
    provider: "password",
    account_type: "admin",
    admin_level: "owner",
    is_master_admin: true
  });
  return cmsCollection({
    request: new Request(url, {
      method,
      headers: {
        cookie,
        origin: "https://admin.danielclancy.net",
        ...(body ? { "content-type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    }),
    env: {
      DC_ADMIN_KV: kv,
      DC_AUTH_SESSION_SECRET: secret,
      DC_ADMIN_EMAIL_1: "admin@example.test",
      DC_ADMIN_SECRET_1: "unused"
    },
    params: { collection: "media" }
  });
}

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

test("watch media scaffold detector rejects exact ids and broad placeholder labels", () => {
  assert.equal(isScaffoldWatchMediaEntry({ id: "latest-youtube-release-scaffold", title: "Real title" }), true);
  assert.equal(isScaffoldWatchMediaEntry({ id: "real-rumble-video", title: "Local placeholder media" }), true);
  assert.equal(isScaffoldWatchMediaEntry({ id: "real-rumble-video", title: "Happy Birthday America" }), false);

  const filtered = filterScaffoldWatchMediaEntries([
    { id: "scheduled-livestream-scaffold", title: "Scheduled livestream scaffold" },
    { id: "real-rumble-video", title: "Real Rumble Video" }
  ]);
  assert.equal(filtered.purgedCount, 1);
  assert.equal(filtered.items[0].id, "real-rumble-video");
});

test("publishedAt edits take priority over stale publishedAtOverride values", () => {
  const normalized = normalizeWatchMediaItem({
    id: "rumble-date-edit",
    sourcePlatform: "rumble",
    entryType: "video",
    title: "Rumble Date Edit",
    sourceUrl: "https://rumble.com/v7c9m82-video.html",
    embedUrl: "https://rumble.com/embed/v7a2y7u/?pub=vmzw3",
    publishedAtOverride: "2026-07-01T00:00:00.000Z",
    publishedAt: "2026-07-06T10:30:45.000Z",
    sortDate: "2026-07-06T11:30:45.000Z"
  });

  assert.equal(normalized.publishedAt, "2026-07-06T10:30:45.000Z");
  assert.equal(normalized.sortDate, "2026-07-06T11:30:45.000Z");
});

test("watch media sort time uses sortDate then publish/entry/create/update fallbacks", () => {
  const rows = [
    { id: "created", createdAt: "2026-07-01T00:00:00.000Z" },
    { id: "updated", updatedAt: "2026-07-04T00:00:00.000Z" },
    { id: "sort", sortDate: "2026-07-06T00:00:00.000Z" }
  ].sort((left, right) => watchMediaSortTime(right) - watchMediaSortTime(left));

  assert.deepEqual(rows.map((row) => row.id), ["sort", "updated", "created"]);
});

test("CMS Media GET filters and purges scaffold rows from KV", async () => {
  const kv = memoryKv({
    "cms:media": JSON.stringify({
      collection: "media",
      items: [
        {
          id: "latest-youtube-release-scaffold",
          title: "Latest YouTube release scaffold",
          sourceUrl: "https://youtube.com/watch?v=scaffold",
          visible: true
        },
        {
          id: "real-rumble-video",
          sourcePlatform: "rumble",
          entryType: "video",
          source: "manual",
          title: "Real Rumble Video",
          sourceUrl: "https://rumble.com/v7c9m82-video.html",
          embedUrl: "https://rumble.com/embed/v7a2y7u/?pub=vmzw3",
          sortDate: "2026-07-06T00:00:00.000Z",
          visible: true
        }
      ]
    })
  });

  const response = await adminCmsRequest(kv);
  const body = await response.json();
  const stored = JSON.parse(await kv.get("cms:media"));

  assert.equal(response.status, 200);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, "real-rumble-video");
  assert.equal(body.meta.scaffoldPurgedCount, 1);
  assert.equal(stored.items.length, 1);
  assert.equal(stored.items[0].id, "real-rumble-video");
});

test("CMS Media PUT rejects invalid dates and normalizes datetime-local compatible dates", async () => {
  const invalidKv = memoryKv();
  const invalid = await adminCmsRequest(invalidKv, "PUT", {
    items: [{ id: "bad-date", title: "Bad Date", publishedAt: "not-a-date", sourceUrl: "https://rumble.com/v1.html" }]
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, "publishedAt_invalid");

  const kv = memoryKv();
  const localDateTime = "2026-07-06T10:30:45";
  const response = await adminCmsRequest(kv, "PUT", {
    items: [
      {
        id: "real-rumble-video",
        sourcePlatform: "rumble",
        entryType: "video",
        source: "manual",
        title: "Real Rumble Video",
        sourceUrl: "https://rumble.com/v7c9m82-video.html",
        embedUrl: "https://rumble.com/embed/v7a2y7u/?pub=vmzw3",
        publishedAt: localDateTime,
        sortDate: "2026-07-07T10:30:45.000Z",
        enteredAt: "2026-07-05T10:30:45.000Z",
        createdAt: "2026-07-05T10:30:45.000Z",
        updatedAt: "2026-07-06T10:31:45.000Z",
        visible: true
      }
    ]
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.items[0].publishedAt, new Date(localDateTime).toISOString());
  assert.equal(body.items[0].sortDate, "2026-07-07T10:30:45.000Z");
  assert.equal(body.publish.ok, true);
  assert.equal(JSON.parse(await kv.get("cms:media")).items[0].publishedAt, new Date(localDateTime).toISOString());
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
  assert.match(appSource, /isScaffoldWatchMediaEntry/);
  assert.match(appSource, /purge-scaffold/);
  assert.match(appSource, /isoDateFromDateTimeLocal/);
  assert.match(appSource, /return \[\];/);
  assert.match(appSource, /No watch media entries yet\./);
  assert.doesNotMatch(appSource, /Reset Media CMS scaffold rows to the repo seed data/);
  assert.doesNotMatch(appSource, /No local scaffold media items/);
  assert.match(seedSource, /media:\s*\[\]/);
  assert.doesNotMatch(seedSource, /latest-youtube-release-scaffold|scheduled-livestream-scaffold|archived-replay-scaffold/);
});
