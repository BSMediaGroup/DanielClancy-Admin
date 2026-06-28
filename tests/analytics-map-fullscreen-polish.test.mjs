import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildLocationCoverKey,
  buildLocationFeatures,
  getCountryFallbackCover,
  getDefaultLocationCover,
  getLocationCoverImage
} from "../assets/js/analytics-map.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const app = await readFile(new URL("../assets/js/admin-app.js", import.meta.url), "utf8");
const mapModule = await readFile(new URL("../assets/js/analytics-map.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/css/admin.css", import.meta.url), "utf8");
const coverManifest = JSON.parse(await readFile(new URL("../assets/data/location-cover-images.json", import.meta.url), "utf8"));

test("fullscreen map has shared dot/glow controls, selected sidebar, and mapped-list selection", () => {
  assert.match(app, /data-analytics-action="map-layer-toggle"/);
  assert.match(app, /data-analytics-map-layer="dots"/);
  assert.match(app, /data-analytics-map-layer="glow"/);
  assert.match(app, /data-analytics-action="map-sidebar-toggle"/);
  assert.match(app, /data-analytics-action="map-location-select"/);
  assert.match(app, /data-analytics-map-sidebar-section="selected"/);
  assert.match(app, /Select a map location to inspect details\./);
  assert.match(app, /hydrateAnalyticsMapSelectedLocation/);
  assert.match(app, /analyticsMapSelectedLocationCard/);
});

test("map module exposes layer visibility and selected feature popup contracts", () => {
  assert.match(mapModule, /export function setAnalyticsMapLayerVisibility/);
  assert.match(mapModule, /export function selectAnalyticsMapFeature/);
  assert.match(mapModule, /halo: "analytics-location-halo"/);
  assert.match(mapModule, /dot: "analytics-location-dot"/);
  assert.match(mapModule, /selected: "analytics-location-selected"/);
  assert.match(mapModule, /setLayerVisibility\(LAYER_IDS\.dot, state\.layerVisibility\.dots\)/);
  assert.match(mapModule, /setLayerVisibility\(LAYER_IDS\.halo, state\.layerVisibility\.glow\)/);
  assert.match(mapModule, /state\.options\.onFeatureSelect/);
  assert.match(mapModule, /className: "analytics-map-popup"/);
});

test("popup/sidebar styling fixes close icon color and renders covers", () => {
  assert.match(css, /\.analytics-map-popup \.maplibregl-popup-close-button\s*\{[\s\S]*color:\s*#f7fbff/);
  assert.doesNotMatch(css, /\.analytics-map-popup \.maplibregl-popup-close-button\s*\{[\s\S]*color:\s*black/);
  assert.match(css, /\.analytics-map-popup-cover/);
  assert.match(css, /\.analytics-map-selected-card/);
  assert.match(css, /\.analytics-map-modal-body\.is-sidebar-collapsed/);
  assert.match(css, /\.analytics-map-sidebar-location-button/);
});

test("location cover helpers resolve required city and country fallback images", () => {
  assert.equal(buildLocationCoverKey("Portland", "Oregon", "US"), "us:oregon:portland");
  assert.match(getLocationCoverImage({ city: "Maseru", region: "Maseru District", countryCode: "LS" }).imagePath, /city-ls-maseru-district-maseru\.webp$/);
  assert.match(getCountryFallbackCover("LS").imagePath, /capital-ls-maseru-district-maseru\.webp$/);
  assert.match(getCountryFallbackCover("US").title, /Washington/);
  assert.match(getDefaultLocationCover().imagePath, /default-location-cover\.webp$/);
});

test("feature model gives popup and sidebar the same selected feature details", () => {
  const collection = buildLocationFeatures([
    {
      live: true,
      source: "page_visit_kv",
      city: "Portland",
      region: "Oregon",
      country_code: "US",
      requests: 7,
      sessions: 3,
      page_path: "/analytics",
      referrer_host: "example.test",
      timestamp: "2026-06-28T00:00:00Z"
    },
    {
      live: true,
      source: "page_visit_kv",
      city: "Unknown LS City",
      region: "Unknown District",
      country_code: "LS",
      requests: 4,
      timestamp: "2026-06-28T00:00:00Z"
    }
  ], { selectedWindow: "5m" });
  assert.equal(collection.features.length, 2);
  const portland = collection.features.find((feature) => feature.properties.city === "Portland");
  const fallback = collection.features.find((feature) => feature.properties.plottedPrecision === "country_fallback");
  assert.match(portland.properties.popupHtml, /analytics-map-popup-cover/);
  assert.match(portland.properties.popupHtml, /country-flag/);
  assert.match(portland.properties.popupHtml, /Page/);
  assert.match(portland.properties.coverImagePath, /city-us-oregon-portland\.webp$/);
  assert.match(fallback.properties.coverImagePath, /capital-ls-maseru-district-maseru\.webp$/);
  assert.match(fallback.properties.popupHtml, /Country fallback location/);
});

test("location cover manifest covers required keys with local files and attribution", () => {
  const requiredLocations = [
    "us:oregon:portland",
    "us:california:los-angeles",
    "us:california:santa-clara",
    "us:virginia:ashburn",
    "gb:england:london",
    "ls:maseru-district:maseru",
    "dk:capital-region:copenhagen",
    "pt:lisbon",
    "pt:faro:portimao",
    "us:oregon:boardman",
    "au:new-south-wales:sydney",
    "au:victoria:melbourne",
    "ca:ontario:toronto",
    "br:sao-paulo:sao-paulo",
    "br:rio-de-janeiro:rio-de-janeiro"
  ];
  const requiredCountries = ["us", "gb", "ls", "dk", "pt", "au", "ca", "br", "de", "fr", "nl", "jp", "sg", "ie", "nz"];
  assert.equal(coverManifest.schemaVersion, "location-cover-images.v2");
  for (const key of requiredLocations) {
    assert.ok(coverManifest.locations[key], `${key} missing`);
  }
  for (const key of requiredCountries) {
    assert.ok(coverManifest.countryFallbacks[key], `${key} fallback missing`);
  }
  const entries = [
    coverManifest.defaultFallbackMeta,
    ...Object.values(coverManifest.locations),
    ...Object.values(coverManifest.countryFallbacks)
  ];
  for (const entry of entries) {
    assert.ok(entry.imagePath.startsWith("/assets/analytics/location-covers/"), entry.imagePath);
    assert.equal(/^https?:\/\//.test(entry.imagePath), false, entry.imagePath);
    assert.ok(entry.sourceQuality, entry.title);
    assert.ok(entry.credit);
    assert.ok(entry.license);
    assert.ok(existsSync(join(repoRoot, entry.imagePath.replace(/^\//, ""))), entry.imagePath);
  }
  assert.ok(existsSync(new URL("../assets/analytics/location-covers/city-ls-maseru-district-maseru.webp", import.meta.url)));
});
