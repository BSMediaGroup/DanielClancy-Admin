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
  assert.match(functionBody("liveRowCoordinate"), /return isValidMarkerCoordinate\(coord\) \? coord : null/);
  assert.match(functionBody("updateAnalyticsMapMarkers"), /\.setLngLat\(\[coord\.lon, coord\.lat\]\)/);
  assert.doesNotMatch(functionBody("updateAnalyticsMapMarkers"), /\.setLngLat\(\[coord\.lat, coord\.lon\]\)/);
});

test("window refresh replaces marker state instead of appending duplicate markers", () => {
  const updateBody = functionBody("updateAnalyticsMapMarkers");
  assert.match(updateBody, /analyticsMapState\.markers\.forEach\(\(marker\) => marker\.remove\(\)\)/);
  assert.match(updateBody, /analyticsMapState\.markers = \[\]/);
  assert.match(updateBody, /analyticsMapState\.markerModels = markerModels/);
  assert.match(updateBody, /analyticsMapState\.markers = markerModels\.map/);
  assert.match(functionBody("ensureAnalyticsMap"), /if \(!analyticsMapState\.map\)/);
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

test("marker CSS centers one halo and one dot without request-dot trail behavior", () => {
  const rootRule = cssRule(".analytics-map-marker");
  assert.match(rootRule, /display: block;/);
  assert.match(rootRule, /width: var\(--analytics-marker-dot\);/);
  assert.match(rootRule, /height: var\(--analytics-marker-dot\);/);
  assert.doesNotMatch(rootRule, /display: inline-flex;/);
  assert.doesNotMatch(rootRule, /gap: 7px;/);
  assert.match(cssRule(".analytics-map-marker-halo"), /left: 50%;[\s\S]*top: 50%;[\s\S]*transform: translate\(-50%, -50%\);/);
  assert.match(cssRule(".analytics-map-marker-dot"), /left: 50%;[\s\S]*top: 50%;[\s\S]*transform: translate\(-50%, -50%\);/);
  assert.doesNotMatch(css, /request-dot|request-trail|marker-trail/);
});

test("country flags stay out of city and region table cells but remain in country and map markup", () => {
  assert.equal(app.includes("locationChip(row, row.city"), false);
  assert.equal(app.includes("locationChip(row, row.region"), false);
  assert.ok(app.includes("plainLocationText(row.city"));
  assert.ok(app.includes("plainLocationText(row.region"));
  assert.ok(app.includes("locationChip(row, row.country"));
  assert.ok(app.includes("analytics-map-marker-label"));
  assert.ok(app.includes("markerPopupHtml"));
  assert.ok(app.includes("flagIcon(row, row.country"));
});
