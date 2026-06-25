import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("analytics map module uses exact city-country lookup and not city-only fallback", async () => {
  const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  const lookupModule = await readFile(new URL("../assets/js/geo-coordinate-lookup.js", import.meta.url), "utf8");
  const lookup = JSON.parse(await readFile(new URL("../assets/data/geo-coordinate-lookup.json", import.meta.url), "utf8"));
  assert.equal(lookup.source, "verified_builtin_lookup");
  assert.ok(lookup.cityLookup.some((row) => row.city === "Los Angeles" && row.country_code === "US"));
  assert.ok(lookup.cityLookup.some((row) => row.city === "Portland" && row.region === "Oregon" && row.country_code === "US"));
  assert.ok(lookup.cityLookup.some((row) => row.city === "Santa Clara" && row.region === "California" && row.country_code === "US"));
  assert.ok(lookup.countryCentroids.some((row) => row.country_code === "GB" && row.sourceNotes === "country_centroid_fallback"));
  assert.ok(lookupModule.includes('city: "Los Angeles"'));
  assert.ok(lookupModule.includes('city: "Portland"'));
  assert.equal(mapModule.includes("CITY_LOOKUP.get(city)"), false);
  assert.ok(mapModule.includes("CITY_LOOKUP.get([city, region, code].join(\"|\"))"));
  assert.ok(mapModule.includes("lookupCountryCoordinate"));
  assert.ok(mapModule.includes("guardKnownCityCoordinate"));
});

test("country flag helper resolves broad local SVG paths and fallback", async () => {
  const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  for (const code of ["us", "au", "gb", "ca", "nz", "de", "fr", "jp", "in", "br", "za"]) {
    assert.ok(app.includes("getCountryFlagPath"));
    assert.ok(mapModule.includes("countryFlagPath"));
    const svg = await readFile(new URL(`../assets/icons/flags/${code}.svg`, import.meta.url), "utf8");
    assert.ok(svg.includes("<svg"));
  }
  assert.ok(app.includes("/assets/icons/flags/_fallback.svg"));
  assert.ok(mapModule.includes("/_fallback.svg"));
  const fallback = await readFile(new URL("../assets/icons/flags/_fallback.svg", import.meta.url), "utf8");
  assert.ok(fallback.includes("<svg"));
});

test("analytics location rendering includes MapLibre module, flags, freshness, and isolated demo rows", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(app.includes("country-flag"));
  assert.ok(app.includes("location-chip"));
  assert.ok(app.includes("from \"./analytics-map.js\""));
  assert.ok(app.includes("analytics-window-selector"));
  assert.ok(app.includes("[\"5m\", \"5M\"]"));
  assert.ok(app.includes("[\"15m\", \"15M\"]"));
  assert.ok(app.includes("[\"1h\", \"1H\"]"));
  assert.ok(app.includes("[\"24h\", \"24HRS\"]"));
  assert.ok(mapModule.includes("new maplibregl.Map"));
  assert.equal(app.includes("new window.maplibregl.Marker"), false);
  assert.equal(mapModule.includes("maplibregl.Marker"), false);
  assert.ok(mapModule.includes("analytics-live-locations"));
  assert.ok(mapModule.includes("analytics-location-halo"));
  assert.ok(mapModule.includes("analytics-location-dot"));
  assert.ok(mapModule.includes("source.setData(featureCollection"));
  assert.ok(mapModule.includes("DC_ADMIN_ANALYTICS_MAP_DEBUG"));
  assert.ok(mapModule.includes("carto-dark"));
  assert.ok(index.includes("assets/vendor/maplibre-gl/maplibre-gl.css"));
  assert.ok(index.includes("assets/vendor/maplibre-gl/maplibre-gl.js"));
  assert.ok(app.includes('id="analytics-location-map"'));
  assert.ok(app.includes("Refresh analytics"));
  assert.ok(app.includes("Last live page-visit event"));
  assert.ok(app.includes("sourceFreshnessState"));
  assert.ok(app.includes("Sample/stale rows are diagnostics only"));
  assert.ok(app.includes("demo-fallback"));
  assert.equal(app.includes("<svg class=\"map-world\""), false);
});

test("location table flags are limited to the country column", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  assert.equal(app.includes("locationChip(row, row.city"), false);
  assert.equal(app.includes("locationChip(row, row.region"), false);
  assert.ok(app.includes('["City", "Region", "Country", "Sessions", "Requests", "Map precision", "Source", "Last seen"]'));
  assert.ok(app.includes("plainLocationText(row.city"));
  assert.ok(app.includes("plainLocationText(row.region"));
  assert.ok(app.includes("locationChip(row, row.country"));
});

test("marker model separates sessions and requests in GeoJSON layer expressions", async () => {
  const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../assets/css/admin.css", import.meta.url), "utf8");
  assert.ok(mapModule.includes("function rowSessionCount(row)"));
  assert.ok(mapModule.includes("function rowRequestWeight(row)"));
  assert.ok(mapModule.includes("sessionsAvailable"));
  assert.ok(mapModule.includes("\"coalesce\", [\"get\", \"requests\"], 0"));
  assert.ok(mapModule.includes("\"coalesce\", [\"get\", \"sessions\"], 0"));
  assert.equal(css.includes(".analytics-map-marker"), false);
});

test("analytics marker generation excludes samples and only truly unmappable rows", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  assert.ok(mapModule.includes("ALLOWED_LIVE_SOURCES"));
  assert.ok(mapModule.includes("row.live !== true"));
  assert.ok(mapModule.includes("not_live_or_source_tagged"));
  assert.ok(mapModule.includes("missing_country_code"));
  assert.ok(mapModule.includes("missing_country_centroid"));
  assert.ok(mapModule.includes("country_centroid"));
  assert.ok(app.includes("updateAnalyticsMap({"));
});

test("country-only rows are country precision and popups include flag metadata", async () => {
  const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  const api = await readFile(new URL("../functions/api/admin/analytics.js", import.meta.url), "utf8");
  assert.ok(api.includes('precision: "country"'));
  assert.ok(api.includes("sessions: row.sessions ?? null"));
  assert.ok(api.includes("liveLocationRows"));
  assert.ok(mapModule.includes("COUNTRY_CENTROIDS"));
  assert.ok(mapModule.includes("coordinateSource"));
  assert.ok(mapModule.includes("plottedPrecision"));
  assert.ok(mapModule.includes("Country fallback location"));
  assert.ok(mapModule.includes("Flag path"));
  assert.ok(mapModule.includes("buildPopupHtml"));
});

test("empty live data keeps real map state without sample markers", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  assert.ok(app.includes("No live page-visit location events captured for this window."));
  assert.ok(mapModule.includes("map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM"));
  assert.ok(mapModule.includes("features: []"));
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
