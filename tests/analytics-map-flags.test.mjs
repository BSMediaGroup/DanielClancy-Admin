import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analytics map uses exact city-country coordinates and does not use city-only fallback", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const lookup = JSON.parse(await readFile(new URL("../assets/data/geo-coordinate-lookup.json", import.meta.url), "utf8"));
  assert.equal(lookup.source, "verified_builtin_lookup");
  assert.ok(lookup.cities.some((row) => row.city === "Los Angeles" && row.country_code === "US"));
  assert.ok(lookup.cities.some((row) => row.city === "Portland" && row.region === "Oregon" && row.country_code === "US"));
  assert.ok(lookup.cities.some((row) => row.city === "Sydney" && row.country_code === "AU"));
  assert.equal(app.includes("CITY_COORDINATES[city]"), false);
  assert.ok(app.includes("Rows without verified coordinates."));
  assert.ok(app.includes("function markerCoordinate(row)"));
  assert.ok(app.includes("function isValidMarkerCoordinate(coord)"));
  assert.ok(app.includes("return isValidMarkerCoordinate(coord) ? coord : null;"));
});

test("country flag helper resolves broad local SVG paths and fallback", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  for (const code of ["us", "au", "gb", "ca", "nz", "de", "fr", "jp", "in", "br", "za"]) {
    assert.ok(app.includes("getCountryFlagPath"));
    const svg = await readFile(new URL(`../assets/icons/flags/${code}.svg`, import.meta.url), "utf8");
    assert.ok(svg.includes("<svg"));
  }
  assert.ok(app.includes("/assets/icons/flags/_fallback.svg"));
  const fallback = await readFile(new URL("../assets/icons/flags/_fallback.svg", import.meta.url), "utf8");
  assert.ok(fallback.includes("<svg"));
});

test("analytics location rendering includes MapLibre, flags, freshness, and isolated demo rows", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(app.includes("country-flag"));
  assert.ok(app.includes("location-chip"));
  assert.ok(app.includes("ANALYTICS_MAP_SOURCE_ID"));
  assert.ok(app.includes("analytics-location-halo-layer"));
  assert.ok(app.includes("analytics-location-dot-layer"));
  assert.ok(app.includes("analytics-window-selector"));
  assert.ok(app.includes("[\"5m\", \"5M\"]"));
  assert.ok(app.includes("[\"15m\", \"15M\"]"));
  assert.ok(app.includes("[\"1h\", \"1H\"]"));
  assert.ok(app.includes("[\"24h\", \"24HRS\"]"));
  assert.ok(app.includes("window.maplibregl.Map"));
  assert.equal(app.includes("new window.maplibregl.Marker"), false);
  assert.ok(app.includes("markerFeatureCollection"));
  assert.ok(app.includes("source.setData(featureCollection)"));
  assert.ok(app.includes("DC_ADMIN_ANALYTICS_MAP_DEBUG"));
  assert.ok(app.includes("mapStyleConfig"));
  assert.ok(app.includes("carto-dark"));
  assert.ok(index.includes("assets/vendor/maplibre-gl/maplibre-gl.css"));
  assert.ok(index.includes("assets/vendor/maplibre-gl/maplibre-gl.js"));
  assert.ok(app.includes('id="analytics-location-map"'));
  assert.ok(app.includes("Refresh analytics"));
  assert.ok(app.includes("Last live page-visit event"));
  assert.ok(app.includes("sourceFreshnessState"));
  assert.ok(app.includes("Sample/stale rows are diagnostics only — not live analytics"));
  assert.ok(app.includes("demo-fallback"));
  assert.equal(app.includes("<svg class=\"map-world\""), false);
});

test("location table flags are limited to the country column", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  assert.equal(app.includes("locationChip(row, row.city"), false);
  assert.equal(app.includes("locationChip(row, row.region"), false);
  assert.ok(app.includes('["City", "Region", "Country", "Sessions", "Requests", "Precision", "Source", "Last seen"]'));
  assert.ok(app.includes("plainLocationText(row.city"));
  assert.ok(app.includes("plainLocationText(row.region"));
  assert.ok(app.includes("locationChip(row, row.country"));
});

test("marker model separates sessions and requests and scales dot versus halo", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../assets/css/admin.css", import.meta.url), "utf8");
  assert.ok(app.includes("function sessionCount(row)"));
  assert.ok(app.includes("function requestCount(row)"));
  assert.ok(app.includes("function markerDotRadius(row)"));
  assert.ok(app.includes("function markerHaloRadius(row)"));
  assert.ok(app.includes("sessionsAvailable: sessions !== null"));
  assert.ok(app.includes("requests: requests ?? 0"));
  assert.ok(app.includes('"circle-radius": ["get", "haloRadius"]'));
  assert.ok(app.includes('"circle-radius": ["get", "dotRadius"]'));
  assert.equal(css.includes(".analytics-map-marker"), false);
});

test("analytics marker generation excludes samples and rows without coordinates", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  assert.ok(app.includes('LIVE_ANALYTICS_SOURCES = new Set(["page_visit_kv", "cloudflare_graphql", "streamsuites_event_mirror", "streamsuites_live"])'));
  assert.ok(app.includes("function isLiveAnalyticsLocationRow(row)"));
  assert.ok(app.includes("row?.live === true && LIVE_ANALYTICS_SOURCES.has(source) && Number.isFinite(timestamp)"));
  assert.ok(app.includes("buildLiveMapMarkers(liveLocationRows)"));
  assert.ok(app.includes("markerFeatureCollection(markerModels)"));
  assert.ok(app.includes("function aggregateMarkerRows(rows)"));
});

test("country-only rows are country precision and popups include flag metadata", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../functions/api/admin/analytics.js", import.meta.url), "utf8");
  assert.ok(api.includes('precision: "country"'));
  assert.ok(api.includes("sessions: row.sessions ?? null"));
  assert.ok(api.includes("liveLocationRows"));
  assert.ok(app.includes("COUNTRY_CENTROIDS"));
  assert.ok(app.includes("coord.coordinateSource || \"source\""));
  assert.ok(app.includes("Flag path"));
  assert.ok(app.includes("markerPopupHtml"));
});

test("empty live data keeps real map state without sample markers", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  assert.ok(app.includes("No live page-visit location events captured for this window."));
  assert.ok(app.includes("map.easeTo({ center: [10, 18], zoom: 1.2"));
  assert.ok(app.includes('data: { type: "FeatureCollection", features: [] }'));
  assert.equal(app.includes("sampleMarkers"), false);
});

test("analytics UI exposes diagnostics and dynamic sidebar API status", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(index.includes('id="sidebar-status-note"'));
  assert.ok(app.includes("function updateSidebarApiStatus()"));
  assert.ok(app.includes("Live Admin API connected. DC_ADMIN_KV/analytics status available."));
  assert.ok(app.includes("Static/local fallback. No live admin API connected."));
  assert.ok(app.includes("Source breakdown"));
  assert.ok(app.includes("Stale analytics rows ignored."));
  assert.ok(app.includes("Sample analytics rows ignored."));
});
