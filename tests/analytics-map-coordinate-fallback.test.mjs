import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildLocationFeatures,
  locationMapPrecision,
  normalizeLocationCoordinate
} from "../assets/js/analytics-map.js";

const NOW = "2026-06-25T00:00:00.000Z";

function liveRow(overrides = {}) {
  return {
    city: "Portland",
    region: "Oregon",
    country: "United States",
    country_code: "US",
    source: "streamsuites_live",
    live: true,
    recordedAt: NOW,
    requests: 1,
    page_path: "/",
    ...overrides
  };
}

function featureByCity(collection, city) {
  return collection.features.find((feature) => feature.properties.city === city);
}

function countryFallbackFeature(collection, countryCode) {
  return collection.features.find((feature) =>
    feature.properties.country_code === countryCode &&
    feature.properties.plottedPrecision === "country_fallback"
  );
}

test("Santa Clara, Ashburn, and London are no longer unmapped", () => {
  const collection = buildLocationFeatures([
    liveRow({ city: "Santa Clara", region: "California", country: "United States", country_code: "US" }),
    liveRow({ city: "Ashburn", region: "Virginia", country: "United States", country_code: "US" }),
    liveRow({ city: "London", region: "England", country: "United Kingdom", country_code: "GB" }),
    liveRow({ city: "Maseru", region: "Maseru District", country: "Lesotho", country_code: "LS" })
  ], { selectedWindow: "5m" });

  assert.equal(collection.metadata.unmappedRows.length, 0);
  assert.equal(featureByCity(collection, "Santa Clara")?.properties.coordinateSource, "city_lookup");
  assert.equal(featureByCity(collection, "Ashburn")?.properties.coordinateSource, "city_lookup");
  assert.equal(featureByCity(collection, "London")?.properties.coordinateSource, "city_lookup");
  assert.equal(featureByCity(collection, "Maseru")?.properties.coordinateSource, "city_lookup");
  assert.deepEqual(featureByCity(collection, "Santa Clara")?.geometry.coordinates, [-121.9552, 37.3541]);
  assert.deepEqual(featureByCity(collection, "Ashburn")?.geometry.coordinates, [-77.4874, 39.0438]);
  assert.deepEqual(featureByCity(collection, "London")?.geometry.coordinates, [-0.1276, 51.5072]);
  assert.deepEqual(featureByCity(collection, "Maseru")?.geometry.coordinates, [27.48, -29.31]);
});

test("unknown city rows with valid countries use labelled country centroid fallback", () => {
  const collection = buildLocationFeatures([
    liveRow({ city: "Unknown City", region: "Unknown Region", country: "United States", country_code: "US", requests: 4 }),
    liveRow({ city: "Unresolved Town", region: "Unknown Region", country: "United Kingdom", country_code: "GB", requests: 6 })
  ], { selectedWindow: "15m" });

  const us = countryFallbackFeature(collection, "US");
  const gb = countryFallbackFeature(collection, "GB");
  assert.equal(collection.metadata.unmappedRows.length, 0);
  assert.equal(collection.metadata.countryFallbackMarkers, 2);
  assert.equal(us.properties.coordinateSource, "country_centroid");
  assert.equal(us.properties.plottedPrecision, "country_fallback");
  assert.equal(us.properties.precision, "country fallback");
  assert.match(us.properties.popupHtml, /Country fallback location/);
  assert.match(us.properties.popupHtml, /Unknown City, Unknown Region/);
  assert.deepEqual(us.geometry.coordinates, [-98.5795, 39.8283]);
  assert.deepEqual(gb.geometry.coordinates, [-3.436, 55.3781]);
});

test("rows without usable country or coordinates remain genuinely unmapped", () => {
  const collection = buildLocationFeatures([
    liveRow({ city: "No Country City", region: "Nowhere", country: "", country_code: "", requests: 3 })
  ]);

  assert.equal(collection.features.length, 0);
  assert.equal(collection.metadata.unmappedRows.length, 1);
  assert.equal(collection.metadata.unmappedRows[0].reason, "missing_country_code");
  assert.equal(locationMapPrecision(collection.metadata.unmappedRows[0].row), "unmapped");
});

test("country fallback markers use longitude latitude order and safe continental centroids", () => {
  const us = normalizeLocationCoordinate(liveRow({ city: "Missing US City", region: "Unknown", country_code: "US" }));
  const gb = normalizeLocationCoordinate(liveRow({ city: "Missing UK City", region: "Unknown", country_code: "UK", country: "UK" }));
  const ls = normalizeLocationCoordinate(liveRow({ city: "Missing LS City", region: "Unknown", country_code: "LS", country: "Lesotho" }));

  assert.deepEqual([us.longitude, us.latitude], [-98.5795, 39.8283]);
  assert.equal(us.coordinateSource, "country_centroid");
  assert.equal(us.plottedPrecision, "country_fallback");
  assert.ok(us.longitude < -60 && us.longitude > -130, "US fallback should remain in North America");
  assert.ok(us.latitude > 20 && us.latitude < 55, "US fallback should not plot in ocean/Africa");

  assert.deepEqual([gb.longitude, gb.latitude], [-3.436, 55.3781]);
  assert.ok(gb.longitude > -12 && gb.longitude < 4, "GB fallback should not plot in the US");
  assert.ok(gb.latitude > 49 && gb.latitude < 61, "GB fallback should not plot in Africa");

  assert.deepEqual([ls.longitude, ls.latitude], [28.2336, -29.61]);
  assert.equal(ls.coordinateSource, "country_centroid");
  assert.equal(ls.plottedPrecision, "country_fallback");
});

test("GB and UK normalization work for city lookup and country fallback", () => {
  const london = buildLocationFeatures([
    liveRow({ city: "London", region: "England", country: "UK", country_code: "UK" })
  ]);
  const unknownUk = buildLocationFeatures([
    liveRow({ city: "Unknown UK City", region: "Unknown", country: "UK", country_code: "UK" })
  ]);

  assert.equal(featureByCity(london, "London")?.properties.country_code, "GB");
  assert.deepEqual(featureByCity(london, "London")?.geometry.coordinates, [-0.1276, 51.5072]);
  assert.equal(countryFallbackFeature(unknownUk, "GB")?.properties.plottedPrecision, "country_fallback");
});

test("all analytics windows use the same coordinate fallback behavior", () => {
  for (const selectedWindow of ["5m", "15m", "1h", "24h"]) {
    const collection = buildLocationFeatures([
      liveRow({ city: "Santa Clara", region: "California", country_code: "US", requests: 2 }),
      liveRow({ city: "Unknown City", region: "Unknown", country_code: "US", requests: 3 }),
      liveRow({ city: "No Country", country: "", country_code: "", requests: 4 })
    ], { selectedWindow });

    assert.equal(collection.features.length, 2, selectedWindow);
    assert.equal(collection.metadata.cityMarkers, 1, selectedWindow);
    assert.equal(collection.metadata.countryFallbackMarkers, 1, selectedWindow);
    assert.equal(collection.metadata.unmappedRows.length, 1, selectedWindow);
  }
});

test("unmapped count excludes rows that have country fallback", () => {
  const collection = buildLocationFeatures([
    liveRow({ city: "Unknown City A", region: "Unknown", country_code: "US" }),
    liveRow({ city: "Unknown City B", region: "Unknown", country_code: "US" }),
    liveRow({ city: "No Country", region: "Unknown", country: "", country_code: "" })
  ]);

  assert.equal(collection.features.length, 1);
  assert.equal(collection.metadata.countryFallbackMarkers, 1);
  assert.equal(collection.metadata.unmappedRows.length, 1);
  assert.equal(countryFallbackFeature(collection, "US").properties.aggregatedRows, 2);
});

test("repeated city rows aggregate and do not produce marker smear", () => {
  const collection = buildLocationFeatures(Array.from({ length: 20 }, (_, index) =>
    liveRow({
      city: "Santa Clara",
      region: "California",
      country_code: "US",
      session_id: `session-${index % 3}`
    })
  ));

  assert.equal(collection.features.length, 1);
  const feature = featureByCity(collection, "Santa Clara");
  assert.equal(feature.properties.aggregatedRows, 20);
  assert.equal(feature.properties.requests, 20);
  assert.equal(feature.properties.sessions, 3);
});

test("country table flags remain only in the Country column", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  assert.ok(app.includes('["City", "Region", "Country", "Sessions", "Requests", "Map precision", "Source", "Last seen"]'));
  assert.equal(app.includes("locationChip(row, row.city"), false);
  assert.equal(app.includes("locationChip(row, row.region"), false);
  assert.ok(app.includes("plainLocationText(row.city"));
  assert.ok(app.includes("plainLocationText(row.region"));
  assert.ok(app.includes("locationChip(row, row.country"));
});
