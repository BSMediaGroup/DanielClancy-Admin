import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/admin.css", import.meta.url), "utf8");

function functionBody(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const next = app.indexOf("\n  function ", start + 1);
  return app.slice(start, next === -1 ? undefined : next);
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${selector} CSS rule is missing`);
  return match[0];
}

test("analytics map aggregates repeated live rows before plotting markers", () => {
  const aggregateBody = functionBody("aggregateMarkerRows");
  const buildBody = functionBody("buildLiveMapMarkers");
  assert.match(aggregateBody, /const aggregate = new Map\(\)/);
  assert.match(aggregateBody, /const key = markerGroupKey\(row, coord\)/);
  assert.match(aggregateBody, /aggregate\.get\(key\)/);
  assert.match(aggregateBody, /aggregate\.set\(key, model\)/);
  assert.match(aggregateBody, /model\.requests \+= Math\.max\(0, requests\)/);
  assert.match(aggregateBody, /model\.row\.aggregatedLocationKey = key/);
  assert.match(buildBody, /return aggregateMarkerRows\(rows\)/);
});

test("marker grouping key uses source/project/location and rounded longitude latitude", () => {
  const keyBody = functionBody("markerGroupKey");
  assert.match(keyBody, /project/);
  assert.match(keyBody, /source/);
  assert.match(keyBody, /precision/);
  assert.match(keyBody, /countryCode/);
  assert.match(keyBody, /roundedCoordinatePart\(coord\?\.lon\)/);
  assert.match(keyBody, /roundedCoordinatePart\(coord\?\.lat\)/);
});

test("marker coordinates are validated and passed to MapLibre as longitude latitude", () => {
  assert.match(functionBody("isValidMarkerCoordinate"), /lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180/);
  assert.match(functionBody("normalizedMarkerCoordinate"), /return isValidMarkerCoordinate\(coord\) \? coord : null/);
  assert.match(functionBody("normalizedCoordinateArray"), /const lngLat = normalizedMarkerCoordinate\(second, first, coordinateSource\)/);
  assert.match(functionBody("normalizedCoordinateArray"), /const latLng = normalizedMarkerCoordinate\(first, second, "corrected_lat_lng"\)/);
  assert.match(functionBody("liveRowCoordinate"), /return isValidMarkerCoordinate\(coord\) \? coord : null/);
  assert.match(functionBody("markerFeature"), /coordinates: \[coord\.lon, coord\.lat\]/);
  assert.doesNotMatch(functionBody("updateAnalyticsMapMarkers"), /\.setLngLat\(\[coord\.lat, coord\.lon\]\)/);
  assert.doesNotMatch(functionBody("markerFeature"), /coordinates: \[coord\.lat, coord\.lon\]/);
});

test("window refresh replaces GeoJSON source data instead of appending DOM markers", () => {
  const updateBody = functionBody("updateAnalyticsMapMarkers");
  assert.match(updateBody, /analyticsMapState\.markerModels = markerModels/);
  assert.match(updateBody, /const featureCollection = markerFeatureCollection\(markerModels\)/);
  assert.match(updateBody, /source\.setData\(featureCollection\)/);
  assert.doesNotMatch(updateBody, /new window\.maplibregl\.Marker/);
  assert.match(functionBody("ensureAnalyticsMap"), /if \(!analyticsMapState\.map\)/);
  assert.match(functionBody("ensureAnalyticsMapLayers"), /map\.addSource\(ANALYTICS_MAP_SOURCE_ID/);
  assert.match(functionBody("ensureAnalyticsMapLayers"), /id: ANALYTICS_MAP_HALO_LAYER_ID/);
  assert.match(functionBody("ensureAnalyticsMapLayers"), /id: ANALYTICS_MAP_DOT_LAYER_ID/);
  assert.doesNotMatch(functionBody("ensureAnalyticsMapLayers"), /type: "symbol"/);
});

test("sessions are not invented when unavailable and requests/events are retained", () => {
  const aggregateBody = functionBody("aggregateMarkerRows");
  assert.match(functionBody("requestCount"), /if \(value === null \|\| value === undefined \|\| value === ""\) return null/);
  assert.match(aggregateBody, /const sessionId = rowSessionId\(row\)/);
  assert.match(aggregateBody, /model\.sessionIds\.add\(sessionId\)/);
  assert.match(aggregateBody, /model\.hasSessionCount = true/);
  assert.match(aggregateBody, /model\.row\.sessions = model\.sessionIds\.size \? model\.sessionIds\.size : model\.hasSessionCount \? model\.sessionTotal : null/);
  assert.match(functionBody("rowEventCount"), /return Number\.isFinite\(Date\.parse\(timestamp\)\) \? 1 : 0/);
});

test("DOM marker smear path is removed and request volume is one layer property", () => {
  assert.doesNotMatch(app, /new window\.maplibregl\.Marker/);
  assert.doesNotMatch(app, /markerEl\.innerHTML/);
  assert.doesNotMatch(app, /analytics-map-marker-halo|analytics-map-marker-dot|analytics-map-marker-label/);
  assert.doesNotMatch(css, /\.analytics-map-marker|request-dot|request-trail|marker-trail/);
  assert.doesNotMatch(css, /request-dot|request-trail|marker-trail/);
  assert.match(functionBody("markerFeature"), /requests: requests \?\? 0/);
  assert.match(functionBody("markerFeature"), /haloRadius: markerHaloRadius\(row\)/);
  assert.match(functionBody("markerFeature"), /dotRadius: markerDotRadius\(row\)/);
});

test("country flags stay out of city and region table cells but remain in country and map markup", () => {
  assert.equal(app.includes("locationChip(row, row.city"), false);
  assert.equal(app.includes("locationChip(row, row.region"), false);
  assert.ok(app.includes("plainLocationText(row.city"));
  assert.ok(app.includes("plainLocationText(row.region"));
  assert.ok(app.includes("locationChip(row, row.country"));
  assert.ok(app.includes("markerPopupHtml"));
  assert.ok(app.includes("flagIcon(row, row.country"));
});

test("all analytics windows use the same aggregate feature pipeline", () => {
  for (const windowKey of ['["5m", "5M"]', '["15m", "15M"]', '["1h", "1H"]', '["24h", "24HRS"]']) {
    assert.ok(app.includes(windowKey), `${windowKey} missing`);
  }
  assert.match(functionBody("syncAnalyticsLocationMap"), /const markers = buildLiveMapMarkers\(liveLocationRows\)/);
  assert.match(functionBody("syncAnalyticsLocationMap"), /ensureAnalyticsMap\(markers\)/);
  assert.match(functionBody("renderAnalytics"), /syncAnalyticsLocationMap\(status, liveLocationRows\)/);
});

test("Portland and Los Angeles lookup coordinates stay on the US west coast", async () => {
  const lookup = JSON.parse(await readFile(new URL("../assets/data/geo-coordinate-lookup.json", import.meta.url), "utf8"));
  const portland = lookup.cities.find((row) => row.city === "Portland" && row.region === "Oregon" && row.country_code === "US");
  const losAngeles = lookup.cities.find((row) => row.city === "Los Angeles" && row.country_code === "US");
  for (const row of [portland, losAngeles]) {
    assert.ok(row, "expected coordinate fixture is missing");
    assert.ok(row.lat >= 30 && row.lat <= 50, `${row.city} latitude should be west-coast North America`);
    assert.ok(row.lon <= -110 && row.lon >= -130, `${row.city} longitude should be west-coast North America`);
  }
});
