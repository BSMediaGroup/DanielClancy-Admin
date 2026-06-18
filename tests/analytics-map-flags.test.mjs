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
  assert.ok(app.includes("City rows without an exact coordinate lookup."));
});

test("country flag helper resolves required local SVG paths and fallback", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  for (const code of ["us", "au", "gb", "ca", "nz"]) {
    assert.ok(app.includes(`/assets/icons/flags/${code}.svg`));
    const svg = await readFile(new URL(`../assets/icons/flags/${code}.svg`, import.meta.url), "utf8");
    assert.ok(svg.includes("<svg"));
  }
  assert.ok(app.includes("/assets/icons/flags/_fallback.svg"));
  const fallback = await readFile(new URL("../assets/icons/flags/_fallback.svg", import.meta.url), "utf8");
  assert.ok(fallback.includes("<svg"));
});

test("analytics location rendering includes flags, freshness, and isolated demo rows", async () => {
  const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
  assert.ok(app.includes("country-flag"));
  assert.ok(app.includes("location-chip"));
  assert.ok(app.includes("map-marker-label"));
  assert.ok(app.includes("Refresh analytics"));
  assert.ok(app.includes("Last live page-visit event"));
  assert.ok(app.includes("Sample fallback only — not live analytics"));
  assert.ok(app.includes("demo-fallback"));
});
