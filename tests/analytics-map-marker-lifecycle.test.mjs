import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/admin.css", import.meta.url), "utf8");

test("admin route no longer owns the Analytics marker lifecycle", () => {
  assert.match(app, /from "\.\/analytics-map\.js"/);
  assert.match(app, /initAnalyticsMap\(container/);
  assert.match(app, /updateAnalyticsMap\(\{/);
  assert.match(app, /buildLocationFeatures\(liveLocationRows/);
  assert.doesNotMatch(app, /analyticsMapState/);
  assert.doesNotMatch(app, /map\.addSource\(/);
  assert.doesNotMatch(app, /map\.addLayer\(/);
  assert.doesNotMatch(app, /source\.setData/);
  assert.doesNotMatch(app, /new window\.maplibregl\.Popup/);
  assert.doesNotMatch(app, /new window\.maplibregl\.Marker/);
});

test("analytics-map module initializes one MapLibre instance and reuses it", () => {
  assert.match(mapModule, /export function initAnalyticsMap\(container, options = \{\}\)/);
  assert.match(mapModule, /if \(state\.map && state\.container !== container\)/);
  assert.match(mapModule, /destroyAnalyticsMap\(\)/);
  assert.match(mapModule, /if \(state\.map\) \{/);
  assert.match(mapModule, /return state\.map/);
  assert.match(mapModule, /new maplibregl\.Map/);
});

test("analytics-map module owns required GeoJSON source and centered circle layers", () => {
  assert.match(mapModule, /const SOURCE_ID = "analytics-live-locations"/);
  assert.match(mapModule, /halo: "analytics-location-halo"/);
  assert.match(mapModule, /dot: "analytics-location-dot"/);
  assert.match(mapModule, /hitbox: "analytics-location-hitbox"/);
  assert.match(mapModule, /map\.addSource\(SOURCE_ID/);
  assert.match(mapModule, /type: "geojson"/);
  assert.match(mapModule, /id: LAYER_IDS\.halo/);
  assert.match(mapModule, /id: LAYER_IDS\.dot/);
  assert.match(mapModule, /id: LAYER_IDS\.hitbox/);
  assert.match(mapModule, /"circle-blur": 0\.72/);
  assert.doesNotMatch(mapModule, /type: "symbol"/);
});

test("window refresh replaces GeoJSON source data instead of appending marker DOM", () => {
  assert.match(mapModule, /state\.pendingFeatureCollection = featureCollection/);
  assert.match(mapModule, /source\.setData\(featureCollection \|\| emptyFeatureCollection\(\)\)/);
  assert.match(mapModule, /state\.popup\?\.remove\(\)/);
  assert.match(mapModule, /fitFeatureBounds\(featureCollection\)/);
  assert.doesNotMatch(mapModule, /document\.createElement\(["']span["']\)/);
  assert.doesNotMatch(mapModule, /new (window\.)?maplibregl\.Marker/);
});

test("coordinate normalization protects longitude latitude order", () => {
  assert.match(mapModule, /return \{ longitude, latitude, coordinateSource \}/);
  assert.match(mapModule, /geometry: \{\s+type: "Point",\s+coordinates: \[group\.coordinate\.longitude, group\.coordinate\.latitude\]/);
  assert.match(mapModule, /"corrected_lat_lng"/);
  assert.match(mapModule, /"declared_lng_lat"/);
  assert.doesNotMatch(mapModule, /coordinates: \[group\.coordinate\.latitude, group\.coordinate\.longitude\]/);
  assert.doesNotMatch(mapModule, /\.setLngLat\(\[.*latitude.*longitude.*\]\)/);
});

test("sessions are n/a unless real session ids or counts exist", () => {
  assert.match(mapModule, /rowSessionId\(row\)/);
  assert.match(mapModule, /group\.sessionIds\.add\(sessionId\)/);
  assert.match(mapModule, /rowSessionCount\(row\)/);
  assert.match(mapModule, /sessionsAvailable/);
  assert.match(mapModule, /Sessions/);
  assert.match(mapModule, /properties\.sessionsAvailable \? formatNumber\(properties\.sessions\) : "n\/a"/);
});

test("DOM marker smear classes are absent from app and CSS", () => {
  assert.doesNotMatch(app, /analytics-location-marker|analytics-marker|request-dot|marker-dot-list|map-marker-stack/);
  assert.doesNotMatch(css, /\.analytics-location-marker|\.analytics-marker|request-dot|marker-dot-list|map-marker-stack/);
});

test("all analytics windows still call the module update path", () => {
  for (const windowKey of ['["5m", "5M"]', '["15m", "15M"]', '["1h", "1H"]', '["24h", "24HRS"]']) {
    assert.ok(app.includes(windowKey), `${windowKey} missing`);
  }
  assert.match(app, /detachAnalyticsMapContainerForRender\(\)/);
  assert.match(app, /restoreAnalyticsMapContainerAfterRender\(preservedAnalyticsMapContainer\)/);
  assert.match(app, /syncAnalyticsLocationMap\(status, liveLocationRows\)/);
  assert.match(app, /selectedWindow,\s+windowLabel: analyticsWindowLabel\(selectedWindow\)/);
});
