import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ANALYTICS_MAP_LAYER_IDS,
  ANALYTICS_MAP_SOURCE_ID,
  aggregateLocationRows,
  buildLocationFeatures,
  normalizeLocationCoordinate
} from "../assets/js/analytics-map.js";

const NOW = "2026-06-25T00:00:00.000Z";

function locationRow(city, overrides = {}) {
  const defaults = city === "Los Angeles"
    ? {
        city: "Los Angeles",
        region: "California",
        country: "United States",
        country_code: "US",
        source: "page_visit_kv",
        live: true,
        recordedAt: NOW,
        page_path: "/work/la",
        referrer_host: "example.com"
      }
    : {
        city: "Portland",
        region: "Oregon",
        country: "United States",
        country_code: "US",
        source: "page_visit_kv",
        live: true,
        recordedAt: NOW,
        page_path: "/work/portland",
        referrer_host: "example.com"
      };
  return { ...defaults, ...overrides };
}

function repeatedRows(city, count, overrides = {}) {
  return Array.from({ length: count }, (_, index) =>
    locationRow(city, typeof overrides === "function" ? overrides(index) : overrides)
  );
}

function featureFor(collection, city) {
  return collection.features.find((feature) => feature.properties.city === city);
}

test("buildLocationFeatures aggregates 100 Portland rows into one west-coast feature", () => {
  const collection = buildLocationFeatures(repeatedRows("Portland", 100), { selectedWindow: "5m" });
  assert.equal(collection.features.length, 1);
  const feature = featureFor(collection, "Portland");
  assert.ok(feature);
  assert.equal(feature.properties.requests, 100);
  assert.equal(feature.properties.events, 100);
  assert.equal(feature.properties.sessionsAvailable, false);
  assert.equal(feature.properties.sessions, null);
  assert.deepEqual(feature.geometry.coordinates, [-122.6784, 45.5152]);
});

test("buildLocationFeatures aggregates 100 Los Angeles rows into one west-coast feature", () => {
  const collection = buildLocationFeatures(
    repeatedRows("Los Angeles", 100, (index) => ({ session_id: `la-${index % 5}` })),
    { selectedWindow: "15m" }
  );
  assert.equal(collection.features.length, 1);
  const feature = featureFor(collection, "Los Angeles");
  assert.ok(feature);
  assert.equal(feature.properties.requests, 100);
  assert.equal(feature.properties.sessionsAvailable, true);
  assert.equal(feature.properties.sessions, 5);
  assert.deepEqual(feature.geometry.coordinates, [-118.2437, 34.0522]);
});

test("Portland and Los Angeles never use positive East Hemisphere event longitudes", () => {
  const portland = normalizeLocationCoordinate(locationRow("Portland", { longitude: 122.6784, latitude: 45.5152 }));
  const losAngeles = normalizeLocationCoordinate(locationRow("Los Angeles", { longitude: 118.2437, latitude: 34.0522 }));
  assert.deepEqual(
    { longitude: portland.longitude, latitude: portland.latitude, coordinateSource: portland.coordinateSource },
    { longitude: -122.6784, latitude: 45.5152, coordinateSource: "city_lookup" }
  );
  assert.deepEqual(
    { longitude: losAngeles.longitude, latitude: losAngeles.latitude, coordinateSource: losAngeles.coordinateSource },
    { longitude: -118.2437, latitude: 34.0522, coordinateSource: "city_lookup" }
  );
});

test("invalid coordinates and ambiguous coordinate arrays without country fallback are not plotted", () => {
  const collection = buildLocationFeatures([
    locationRow("Portland", { city: "", region: "", country: "", country_code: "", latitude: 200, longitude: -122.6784 }),
    locationRow("Los Angeles", { city: "", region: "", country: "", country_code: "", coordinates: [34, 45] })
  ]);
  assert.equal(collection.features.length, 0);
  assert.equal(collection.metadata.unmappedRows.length, 2);
});

test("lat-lng arrays are corrected only when the order is clear", () => {
  const coordinate = normalizeLocationCoordinate(locationRow("Portland", {
    coordinates: [45.5152, -122.6784]
  }));
  assert.deepEqual(
    { longitude: coordinate.longitude, latitude: coordinate.latitude, coordinateSource: coordinate.coordinateSource },
    { longitude: -122.6784, latitude: 45.5152, coordinateSource: "event_coordinate" }
  );
});

test("raw event rows without explicit counts increment requests and events by row count", () => {
  const collection = buildLocationFeatures(repeatedRows("Portland", 3));
  const feature = featureFor(collection, "Portland");
  assert.equal(feature.properties.requests, 3);
  assert.equal(feature.properties.events, 3);
});

test("sessions stay unavailable unless session ids or real counts exist", () => {
  const unavailable = buildLocationFeatures(repeatedRows("Portland", 2));
  assert.equal(featureFor(unavailable, "Portland").properties.sessionsAvailable, false);
  assert.equal(featureFor(unavailable, "Portland").properties.sessions, null);

  const distinct = buildLocationFeatures(repeatedRows("Los Angeles", 4, (index) => ({ session_id: `session-${index % 2}` })));
  assert.equal(featureFor(distinct, "Los Angeles").properties.sessionsAvailable, true);
  assert.equal(featureFor(distinct, "Los Angeles").properties.sessions, 2);

  const counted = buildLocationFeatures([locationRow("Los Angeles", { sessions: 7, requestCount: 9 })]);
  assert.equal(featureFor(counted, "Los Angeles").properties.sessionsAvailable, true);
  assert.equal(featureFor(counted, "Los Angeles").properties.sessions, 7);
});

test("5m, 15m, 1h, and 24h fixtures aggregate one feature per city", () => {
  for (const selectedWindow of ["5m", "15m", "1h", "24h"]) {
    const collection = buildLocationFeatures([
      ...repeatedRows("Portland", 100),
      ...repeatedRows("Los Angeles", 50, (index) => ({ session_id: `la-${selectedWindow}-${index % 10}` }))
    ], { selectedWindow });
    assert.equal(collection.features.length, 2, selectedWindow);
    assert.equal(featureFor(collection, "Portland").properties.requests, 100);
    assert.equal(featureFor(collection, "Los Angeles").properties.requests, 50);
  }
});

test("aggregation groups by source, location, precision, and rounded longitude latitude", () => {
  const aggregate = aggregateLocationRows([
    locationRow("Portland", { requestCount: 2 }),
    locationRow("Portland", { requestCount: 3 })
  ]);
  assert.equal(aggregate.groups.length, 1);
  assert.match(aggregate.groups[0].key, /danielclancy\|page_visit_kv\|portland\|oregon\|us\|city\|-122\.6784\|45\.5152/);
  assert.equal(aggregate.groups[0].requests, 5);
});

test("module source and layers use MapLibre GeoJSON names required by the route", async () => {
  const moduleSource = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  assert.equal(ANALYTICS_MAP_SOURCE_ID, "analytics-live-locations");
  assert.deepEqual(ANALYTICS_MAP_LAYER_IDS, {
    halo: "analytics-location-halo",
    dot: "analytics-location-dot",
    hitbox: "analytics-location-hitbox"
  });
  assert.ok(moduleSource.includes("map.addSource(SOURCE_ID"));
  assert.ok(moduleSource.includes('type: "geojson"'));
  assert.ok(moduleSource.includes("source.setData(featureCollection"));
  assert.equal(moduleSource.includes("new maplibregl.Marker"), false);
  assert.equal(moduleSource.includes("new window.maplibregl.Marker"), false);
});

test("old DOM marker request-dot and trail helpers are not exported or used", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  const moduleSource = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../assets/css/admin.css", import.meta.url), "utf8");
  for (const source of [app, moduleSource, css]) {
    assert.equal(/request-dot|marker-dot-list|map-marker-stack|request-trail|marker-trail|analytics-map-marker/.test(source), false);
  }
  assert.equal(app.includes("aggregateMarkerRows"), false);
  assert.equal(app.includes("buildLiveMapMarkers"), false);
  assert.equal(app.includes("updateAnalyticsMapMarkers"), false);
});

test("country table helper keeps flags out of City and Region while Country retains flags", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  assert.equal(app.includes("locationChip(row, row.city"), false);
  assert.equal(app.includes("locationChip(row, row.region"), false);
  assert.ok(app.includes("plainLocationText(row.city"));
  assert.ok(app.includes("plainLocationText(row.region"));
  assert.ok(app.includes("locationChip(row, row.country"));
});

test("feature properties include flag path and popup data", () => {
  const collection = buildLocationFeatures([locationRow("Los Angeles", { requestCount: 9, session_id: "la-1" })], {
    selectedWindow: "24h",
    windowLabel: "24HRS"
  });
  const feature = featureFor(collection, "Los Angeles");
  assert.equal(feature.properties.flagPath, "/assets/icons/flags/us.svg");
  assert.match(feature.properties.popupHtml, /Country/);
  assert.match(feature.properties.popupHtml, /Sessions/);
  assert.match(feature.properties.popupHtml, /Requests/);
  assert.match(feature.properties.popupHtml, /24HRS/);
});
