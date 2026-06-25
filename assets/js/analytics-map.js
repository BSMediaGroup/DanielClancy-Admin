import { GEO_COORDINATE_LOOKUP } from "./geo-coordinate-lookup.js";

const SOURCE_ID = "analytics-live-locations";
const LAYER_IDS = {
  halo: "analytics-location-halo",
  dot: "analytics-location-dot",
  hitbox: "analytics-location-hitbox"
};
const DEFAULT_CENTER = [10, 18];
const DEFAULT_ZOOM = 1.2;
const ALLOWED_LIVE_SOURCES = new Set([
  "page_visit_kv",
  "cloudflare_graphql",
  "streamsuites_event_mirror",
  "streamsuites_live"
]);
const FLAG_BASE_PATH = "/assets/icons/flags";
const COUNTRY_ALIASES = Object.fromEntries(
  Object.entries(GEO_COORDINATE_LOOKUP.countryAliases || {}).map(([alias, code]) => [normalizeAliasKey(alias), code])
);
const CITY_LOOKUP_ROWS = GEO_COORDINATE_LOOKUP.cityLookup || [];
const COUNTRY_CENTROID_ROWS = GEO_COORDINATE_LOOKUP.countryCentroids || [];
const COUNTRY_CENTROIDS = Object.fromEntries(
  COUNTRY_CENTROID_ROWS.map((row) => [normalizeCountryCode(row.country_code), row])
);
const COUNTRY_NAMES = Object.fromEntries(
  COUNTRY_CENTROID_ROWS.map((row) => [normalizeCountryCode(row.country_code), row.country_name])
);
const COUNTRY_NAME_LOOKUP = new Map(
  COUNTRY_CENTROID_ROWS.map((row) => [normalizeKeyPart(row.country_name), normalizeCountryCode(row.country_code)])
);

const CITY_LOOKUP = new Map();
for (const row of CITY_LOOKUP_ROWS) {
  const city = normalizeKeyPart(row.city);
  const region = normalizeKeyPart(row.region);
  const code = normalizeCountryCode(row.country_code).toLowerCase();
  const country = normalizeKeyPart(COUNTRY_NAMES[normalizeCountryCode(row.country_code)]);
  const value = { latitude: row.latitude, longitude: row.longitude };
  CITY_LOOKUP.set([city, region, code].join("|"), value);
  CITY_LOOKUP.set([city, country].join("|"), value);
  CITY_LOOKUP.set([city, code].join("|"), value);
}

const state = {
  map: null,
  container: null,
  popup: null,
  ready: false,
  layersReady: false,
  options: {},
  pendingFeatureCollection: emptyFeatureCollection(),
  updateCount: 0
};

export {
  SOURCE_ID as ANALYTICS_MAP_SOURCE_ID,
  LAYER_IDS as ANALYTICS_MAP_LAYER_IDS
};

export function initAnalyticsMap(container, options = {}) {
  if (!container) return null;
  state.options = { ...state.options, ...options };
  const maplibregl = options.maplibregl || globalThis.window?.maplibregl;
  const feedback = resolveElement(options.feedbackElement);

  if (!maplibregl || typeof maplibregl.Map !== "function") {
    setFeedback(feedback, "Map unavailable: local MapLibre GL assets failed to load.", true);
    return null;
  }

  if (state.map && state.container !== container) {
    destroyAnalyticsMap();
  }

  if (state.map) {
    scheduleResize();
    return state.map;
  }

  state.container = container;
  state.ready = false;
  state.layersReady = false;

  try {
    state.map = new maplibregl.Map({
      container,
      style: mapStyleConfig(),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 1,
      maxZoom: 12,
      projection: "mercator",
      attributionControl: true,
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false
    });
  } catch (error) {
    setFeedback(feedback, "Map unavailable: unable to initialize MapLibre renderer.", true);
    return null;
  }

  state.map.dragRotate?.disable();
  state.map.touchZoomRotate?.disableRotation();
  state.map.keyboard?.disableRotation();

  if (typeof maplibregl.NavigationControl === "function") {
    state.map.addControl(
      new maplibregl.NavigationControl({
        showCompass: false,
        visualizePitch: false
      }),
      "top-right"
    );
  }

  state.map.on("error", (event) => {
    const detail = event?.error?.message || event?.error?.statusText || "tile/style load failed.";
    setFeedback(feedback, `Map unavailable: ${detail}`, true);
  });

  state.map.once("load", () => {
    state.ready = true;
    ensureAnalyticsMapLayers();
    applyFeatureCollection(state.pendingFeatureCollection);
    updateDebugState(state.pendingFeatureCollection);
    scheduleResize();
  });

  updateDebugState();
  return state.map;
}

export function updateAnalyticsMap(data = {}) {
  const payload = Array.isArray(data) ? { rows: data } : data || {};
  state.options = { ...state.options, ...payload };
  const featureCollection = buildLocationFeatures(payload.rows || payload.liveLocationRows || [], state.options);
  state.pendingFeatureCollection = featureCollection;
  updateEmptyOverlay(featureCollection, payload);
  applyFeatureCollection(featureCollection);
  updateDebugState(featureCollection);
  return featureCollection;
}

export function destroyAnalyticsMap() {
  state.popup?.remove();
  state.popup = null;
  if (state.map) {
    state.map.remove();
  }
  state.map = null;
  state.container = null;
  state.ready = false;
  state.layersReady = false;
  state.pendingFeatureCollection = emptyFeatureCollection();
  updateDebugState();
}

export function resizeAnalyticsMap() {
  scheduleResize(80);
}

export function buildLocationFeatures(rows, options = {}) {
  const aggregate = aggregateLocationRows(rows, options);
  const features = aggregate.groups.map((group) => groupToFeature(group, options));
  const cityMarkers = features.filter((feature) => feature.properties?.plottedPrecision === "city").length;
  const countryFallbackMarkers = features.filter((feature) => feature.properties?.plottedPrecision === "country_fallback").length;
  return {
    type: "FeatureCollection",
    features,
    metadata: {
      eligibleRows: aggregate.eligibleRows,
      unmappedRows: aggregate.unmappedRows,
      rejectedRows: aggregate.rejectedRows,
      groupedRows: aggregate.groups.length,
      cityMarkers,
      countryFallbackMarkers
    }
  };
}

export function aggregateLocationRows(rows, options = {}) {
  const groups = new Map();
  const eligibleRows = [];
  const unmappedRows = [];
  const rejectedRows = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") {
      rejectedRows.push({ row, reason: "invalid_row" });
      continue;
    }
    if (!isEligibleLocationRow(row, options)) {
      rejectedRows.push({ row, reason: "not_live_or_source_tagged" });
      continue;
    }

    eligibleRows.push(row);
    const coordinate = normalizeLocationCoordinate(row);
    if (!coordinate) {
      unmappedRows.push({ row, reason: unmappedReason(row) });
      continue;
    }

    const key = locationGroupKey(row, coordinate);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        coordinate,
        rows: [],
        requests: 0,
        events: 0,
        sessionIds: new Set(),
        sessionCount: 0,
        hasSessionCount: false,
        pages: new Set(),
        referrers: new Set(),
        contributingCities: new Set(),
        originalPrecisions: new Set(),
        lastSeen: "",
        sample: row
      };
      groups.set(key, group);
    }

    group.rows.push(row);
    group.contributingCities.add(contributingCityLabel(row));
    group.originalPrecisions.add(coordinate.originalPrecision || originalRowPrecision(row));
    group.requests += rowRequestWeight(row);
    group.events += rowEventWeight(row);
    const sessionId = rowSessionId(row);
    if (sessionId) {
      group.sessionIds.add(sessionId);
    } else {
      const sessions = rowSessionCount(row);
      if (sessions !== null) {
        group.sessionCount += sessions;
        group.hasSessionCount = true;
      }
    }
    const page = firstText(row.page_path, row.path, row.page, row.page_url, row.url);
    if (page) group.pages.add(page);
    const referrer = firstText(row.referrer_host, row.referrer, row.referrerHost);
    if (referrer) group.referrers.add(referrer);
    group.lastSeen = latestTimestamp(group.lastSeen, rowTimestamp(row));
  }

  return {
    groups: Array.from(groups.values()).sort((left, right) => left.key.localeCompare(right.key)),
    eligibleRows,
    unmappedRows,
    rejectedRows
  };
}

export function normalizeLocationCoordinate(row) {
  if (!row || typeof row !== "object") return null;
  const originalPrecision = originalRowPrecision(row);

  const explicitLatitude = firstFiniteField(row, ["latitude", "lat"]);
  const explicitLongitude = firstFiniteField(row, ["longitude", "lng", "lon"]);
  const hasExplicitLatitude = hasPresentField(row, ["latitude", "lat"]);
  const hasExplicitLongitude = hasPresentField(row, ["longitude", "lng", "lon"]);

  if (hasExplicitLatitude || hasExplicitLongitude) {
    if (explicitLatitude !== null && explicitLongitude !== null) {
      const explicitCoordinate = guardKnownCityCoordinate(
        row,
        coordinateFromLngLat(explicitLongitude, explicitLatitude, "event_coordinate", "city", originalPrecision)
      );
      if (explicitCoordinate) return explicitCoordinate;
    }
  }

  const arrayCoordinate = coordinateFromArray(row);
  if (arrayCoordinate) return guardKnownCityCoordinate(row, arrayCoordinate);

  const cityCoordinate = lookupCityCoordinate(row);
  if (cityCoordinate) return guardKnownCityCoordinate(row, cityCoordinate);

  const countryCoordinate = lookupCountryCoordinate(row);
  if (countryCoordinate) return countryCoordinate;

  return null;
}

export function locationMapPrecision(row) {
  const coordinate = normalizeLocationCoordinate(row);
  if (!coordinate) return "unmapped";
  return coordinate.plottedPrecision === "country_fallback" ? "country fallback" : "city";
}

export function assertCoordinateGuardrails() {
  const portland = normalizeLocationCoordinate({
    live: true,
    source: "page_visit_kv",
    city: "Portland",
    region: "Oregon",
    country_code: "US"
  });
  const losAngeles = normalizeLocationCoordinate({
    live: true,
    source: "page_visit_kv",
    city: "Los Angeles",
    region: "California",
    country_code: "US"
  });
  assertWestCoastCoordinate("Portland", portland, { lonMin: -123.5, lonMax: -121.5, latMin: 44.5, latMax: 46.5 });
  assertWestCoastCoordinate("Los Angeles", losAngeles, { lonMin: -119.5, lonMax: -117, latMin: 33, latMax: 35.5 });
}

function ensureAnalyticsMapLayers() {
  const map = state.map;
  if (!map || !state.ready || state.layersReady) return;

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: state.pendingFeatureCollection || emptyFeatureCollection()
    });
  }

  if (!map.getLayer(LAYER_IDS.halo)) {
    map.addLayer({
      id: LAYER_IDS.halo,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "#5db9e8",
          "#f0a43a"
        ],
        "circle-opacity": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "requests"], 0],
          0, 0.12,
          10, 0.18,
          50, 0.24,
          150, 0.31,
          400, 0.38
        ],
        "circle-blur": 0.72,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "requests"], 0],
          0, 13,
          10, 18,
          50, 26,
          150, 36,
          400, 48
        ],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "rgba(126, 220, 255, 0.42)",
          "rgba(255, 210, 128, 0.24)"
        ],
        "circle-stroke-width": 1
      }
    });
  }

  if (!map.getLayer(LAYER_IDS.dot)) {
    map.addLayer({
      id: LAYER_IDS.dot,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "#9ee7ff",
          "#f6d58a"
        ],
        "circle-opacity": 0.96,
        "circle-blur": 0.08,
        "circle-stroke-color": [
          "case",
          ["==", ["get", "plottedPrecision"], "country_fallback"],
          "rgba(232, 251, 255, 0.9)",
          "rgba(255, 255, 255, 0.76)"
        ],
        "circle-stroke-width": 1.1,
        "circle-radius": [
          "case",
          ["==", ["get", "sessionsAvailable"], true],
          [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "sessions"], 0],
            0, 5.5,
            5, 7,
            20, 9,
            75, 12,
            200, 15
          ],
          6
        ]
      }
    });
  }

  if (!map.getLayer(LAYER_IDS.hitbox)) {
    map.addLayer({
      id: LAYER_IDS.hitbox,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "requests"], 0],
          0, 16,
          10, 20,
          50, 26,
          150, 34
        ],
        "circle-opacity": 0,
        "circle-stroke-opacity": 0
      }
    });
  }

  bindMapEvents();
  state.layersReady = true;
}

function bindMapEvents() {
  const map = state.map;
  if (!map || map.__dcAnalyticsLayerEventsBound) return;
  const clickableLayers = [LAYER_IDS.hitbox, LAYER_IDS.dot, LAYER_IDS.halo];
  const openPopup = (event) => {
    const feature = event?.features?.[0];
    const coordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates.slice() : null;
    if (!coordinates || coordinates.length < 2) return;
    state.popup?.remove();
    state.popup = new (state.options.maplibregl || globalThis.window?.maplibregl).Popup({
      offset: 14,
      closeButton: true,
      closeOnClick: true,
      className: "analytics-map-popup"
    })
      .setLngLat(coordinates)
      .setHTML(feature.properties?.popupHtml || buildPopupHtml(feature.properties || {}))
      .addTo(map);
  };

  clickableLayers.forEach((layerId) => {
    map.on("click", layerId, openPopup);
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
  map.__dcAnalyticsLayerEventsBound = true;
}

function applyFeatureCollection(featureCollection) {
  if (!state.map || !state.ready) return;
  ensureAnalyticsMapLayers();
  const source = state.map.getSource(SOURCE_ID);
  if (source?.setData) {
    source.setData(featureCollection || emptyFeatureCollection());
  }
  state.popup?.remove();
  state.popup = null;
  state.updateCount += 1;
  fitFeatureBounds(featureCollection);
  updateDebugState(featureCollection);
}

function fitFeatureBounds(featureCollection) {
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : [];
  const map = state.map;
  const maplibregl = state.options.maplibregl || globalThis.window?.maplibregl;
  if (!map) return;
  if (features.length > 1 && typeof maplibregl?.LngLatBounds === "function") {
    const bounds = new maplibregl.LngLatBounds();
    features.forEach((feature) => bounds.extend(feature.geometry.coordinates));
    map.fitBounds(bounds, { padding: 58, maxZoom: 6, duration: 350 });
  } else if (features.length === 1) {
    const [longitude, latitude] = features[0].geometry.coordinates;
    map.easeTo({ center: [longitude, latitude], zoom: 4.2, duration: 350 });
  } else {
    map.easeTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 350 });
  }
}

function updateEmptyOverlay(featureCollection, payload) {
  const overlay = resolveElement(payload.emptyElement || state.options.emptyElement);
  if (!overlay) return;
  const hasFeatures = Array.isArray(featureCollection?.features) && featureCollection.features.length > 0;
  const hasEvents = Boolean(payload.hasEvents);
  overlay.textContent = hasFeatures
    ? ""
    : hasEvents
      ? (payload.unmappedText || "Live location rows do not have verified coordinates yet.")
      : (payload.emptyText || "No live page-visit location events captured for this window.");
  overlay.hidden = hasFeatures;
}

function groupToFeature(group, options = {}) {
  const sample = group.sample || {};
  const countryCode = normalizeCountryCode(sample.country_code || sample.countryCode || sample.country);
  const country = firstText(
    normalizeKeyPart(sample.country) === countryCode.toLowerCase() ? "" : sample.country,
    COUNTRY_NAMES[countryCode],
    countryCode,
    "Unavailable"
  );
  const plottedPrecision = group.coordinate.plottedPrecision || "city";
  const isCountryFallback = plottedPrecision === "country_fallback";
  const city = isCountryFallback ? "" : firstText(sample.city);
  const region = isCountryFallback ? "" : firstText(sample.region, sample.region_code);
  const sessions = group.sessionIds.size + group.sessionCount;
  const sessionsAvailable = group.sessionIds.size > 0 || group.hasSessionCount;
  const pages = Array.from(group.pages).slice(0, 4);
  const referrers = Array.from(group.referrers).slice(0, 4);
  const contributingCities = Array.from(group.contributingCities).filter(Boolean).slice(0, 12);
  const contributingCitiesSummary = summarizeContributingCities(contributingCities);
  const originalPrecision = Array.from(group.originalPrecisions).filter(Boolean).join(", ") || originalRowPrecision(sample);
  const label = isCountryFallback
    ? `${country || countryCode || "Country"} country fallback`
    : [city, region, country || countryCode].filter(Boolean).join(", ") || "Location";
  const properties = {
    id: group.key,
    city,
    region,
    country,
    country_code: countryCode,
    precision: isCountryFallback ? "country fallback" : firstText(sample.precision, city ? "city" : "country"),
    plottedPrecision,
    originalPrecision,
    unmappedReason: "",
    contributingCities,
    contributingCitiesSummary,
    source: firstText(sample.source, "unavailable"),
    project: firstText(sample.project, sample.source_namespace, "danielclancy"),
    sessions: sessionsAvailable ? sessions : null,
    sessionsAvailable,
    requests: Math.max(0, Math.round(group.requests)),
    events: Math.max(0, Math.round(group.events)),
    aggregatedRows: group.rows.length,
    lastSeen: group.lastSeen,
    page_path: pages[0] || "",
    pages: pages.join(", "),
    referrer_host: referrers[0] || "",
    referrers: referrers.join(", "),
    flagPath: countryFlagPath(countryCode),
    coordinateSource: group.coordinate.coordinateSource,
    longitude: group.coordinate.longitude,
    latitude: group.coordinate.latitude,
    window: options.selectedWindow || options.window || "",
    windowLabel: options.windowLabel || options.selectedWindow || options.window || "",
    label
  };
  properties.popupHtml = buildPopupHtml(properties);
  return {
    type: "Feature",
    id: group.key,
    properties,
    geometry: {
      type: "Point",
      coordinates: [group.coordinate.longitude, group.coordinate.latitude]
    }
  };
}

function isEligibleLocationRow(row, options = {}) {
  if (options.requireLive === false) return true;
  const source = String(row?.source || "").trim();
  if (!ALLOWED_LIVE_SOURCES.has(source)) return false;
  if (row.live !== true) return false;
  if (options.requireTimestamp === false) return true;
  return Number.isFinite(Date.parse(rowTimestamp(row)));
}

function rowRequestWeight(row) {
  const value = firstFiniteField(row, ["request", "requestCount", "requests", "event", "eventCount", "events", "count", "visits"]);
  return value === null ? 1 : Math.max(0, Math.round(value));
}

function rowEventWeight(row) {
  const value = firstFiniteField(row, ["event", "eventCount", "events", "count"]);
  return value === null ? 1 : Math.max(0, Math.round(value));
}

function rowSessionCount(row) {
  const value = firstFiniteField(row, ["sessionCount", "session_count", "sessions"]);
  return value === null ? null : Math.max(0, Math.round(value));
}

function rowSessionId(row) {
  return firstText(row.session_id, row.sessionId, row.visitor_session_id, row.visitorSessionId);
}

function rowTimestamp(row) {
  return firstText(row.lastSeen, row.last_seen, row.recordedAt, row.recorded_at, row.timestamp);
}

function lookupCityCoordinate(row) {
  const city = normalizeKeyPart(row.city);
  if (!city) return null;
  const region = normalizeKeyPart(row.region || row.region_code);
  const country = normalizeKeyPart(row.country);
  const code = normalizeCountryCode(row.country_code || row.countryCode || row.country).toLowerCase();
  const coord =
    CITY_LOOKUP.get([city, region, code].join("|")) ||
    CITY_LOOKUP.get([city, country].join("|")) ||
    CITY_LOOKUP.get([city, code].join("|")) ||
    null;
  return coord ? coordinateFromLookup(coord, "city_lookup", "city", originalRowPrecision(row)) : null;
}

function lookupCountryCoordinate(row) {
  const code = normalizeCountryCode(row.country_code || row.countryCode || row.country);
  const centroid = COUNTRY_CENTROIDS[code];
  return centroid ? coordinateFromLookup(centroid, "country_centroid", "country_fallback", originalRowPrecision(row)) : null;
}

function coordinateFromArray(row) {
  const values = row.coordinates || row.coordinate || row.lngLat || row.latLng;
  if (!Array.isArray(values) || values.length < 2) return null;
  const first = parseFiniteNumber(values[0]);
  const second = parseFiniteNumber(values[1]);
  if (first === null || second === null) return null;
  const order = normalizeKeyPart(row.coordinateOrder || row.coordinatesOrder || row.coordinate_order || row.order);

  if (["lnglat", "lonlat", "longlat", "longitude_latitude"].includes(order)) {
    return coordinateFromLngLat(first, second, "event_coordinate", "city", originalRowPrecision(row));
  }
  if (["latlng", "latlon", "latitude_longitude"].includes(order)) {
    return coordinateFromLngLat(second, first, "event_coordinate", "city", originalRowPrecision(row));
  }

  const asLngLat = coordinateFromLngLat(first, second, "event_coordinate", "city", originalRowPrecision(row));
  const asLatLng = coordinateFromLngLat(second, first, "event_coordinate", "city", originalRowPrecision(row));
  if (asLngLat && !asLatLng) return asLngLat;
  if (asLatLng && !asLngLat) return asLatLng;
  if (asLngLat && Math.abs(first) > 90 && Math.abs(second) <= 90) return asLngLat;
  if (asLatLng && Math.abs(second) > 90 && Math.abs(first) <= 90) return asLatLng;
  return null;
}

function coordinateFromLookup(coord, source, plottedPrecision, originalPrecision) {
  return coordinateFromLngLat(coord.longitude, coord.latitude, source, plottedPrecision, originalPrecision);
}

function coordinateFromLngLat(longitudeValue, latitudeValue, coordinateSource, plottedPrecision, originalPrecision) {
  const longitude = parseFiniteNumber(longitudeValue);
  const latitude = parseFiniteNumber(latitudeValue);
  if (longitude === null || latitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return {
    longitude,
    latitude,
    coordinateSource,
    plottedPrecision: plottedPrecision || "city",
    originalPrecision: originalPrecision || "unknown"
  };
}

function guardKnownCityCoordinate(row, coordinate) {
  if (!coordinate) return null;
  const city = normalizeKeyPart(row.city);
  const region = normalizeKeyPart(row.region || row.region_code);
  const code = normalizeCountryCode(row.country_code || row.countryCode || row.country);

  if (city === "portland" && code === "US" && (!region || region === "oregon" || region === "or")) {
    return inRange(coordinate, { lonMin: -123.5, lonMax: -121.5, latMin: 44.5, latMax: 46.5 }) ? coordinate : null;
  }
  if (city === "los angeles" && code === "US") {
    return inRange(coordinate, { lonMin: -119.5, lonMax: -117, latMin: 33, latMax: 35.5 }) ? coordinate : null;
  }
  return coordinate;
}

function assertWestCoastCoordinate(label, coordinate, range) {
  if (!coordinate || !inRange(coordinate, range) || coordinate.longitude > 0) {
    throw new Error(`${label} analytics coordinate guardrail failed.`);
  }
}

function inRange(coordinate, range) {
  return coordinate.longitude >= range.lonMin &&
    coordinate.longitude <= range.lonMax &&
    coordinate.latitude >= range.latMin &&
    coordinate.latitude <= range.latMax;
}

function locationGroupKey(row, coordinate) {
  if (coordinate?.plottedPrecision === "country_fallback") {
    return [
      normalizeTokenPart(row.project || row.source_namespace || "danielclancy"),
      normalizeTokenPart(row.source || "unknown"),
      "country_fallback",
      normalizeCountryCode(row.country_code || row.countryCode || row.country).toLowerCase(),
      roundedCoordinatePart(coordinate.longitude),
      roundedCoordinatePart(coordinate.latitude)
    ].join("|");
  }
  return [
    normalizeTokenPart(row.project || row.source_namespace || "danielclancy"),
    normalizeTokenPart(row.source || "unknown"),
    normalizeKeyPart(row.city),
    normalizeKeyPart(row.region || row.region_code),
    normalizeCountryCode(row.country_code || row.countryCode || row.country).toLowerCase(),
    normalizeKeyPart(row.precision || (row.city ? "city" : "country")),
    roundedCoordinatePart(coordinate.longitude),
    roundedCoordinatePart(coordinate.latitude)
  ].join("|");
}

function originalRowPrecision(row) {
  return normalizeKeyPart(row?.precision || (row?.city ? "city" : normalizeCountryCode(row?.country_code || row?.countryCode || row?.country) ? "country" : "unknown")) || "unknown";
}

function contributingCityLabel(row) {
  const city = firstText(row?.city, row?.cityName);
  const region = firstText(row?.region, row?.region_code, row?.regionCode);
  if (city && region) return `${city}, ${region}`;
  if (city) return city;
  if (region) return `Region: ${region}`;
  return "Country-only row";
}

function summarizeContributingCities(values) {
  const list = Array.from(new Set(values.filter(Boolean)));
  if (!list.length) return "";
  if (list.length <= 6) return list.join("; ");
  return `${list.slice(0, 6).join("; ")}; +${list.length - 6} more`;
}

function unmappedReason(row) {
  const code = normalizeCountryCode(row?.country_code || row?.countryCode || row?.country);
  if (!code) return "missing_country_code";
  if (!COUNTRY_CENTROIDS[code]) return "missing_country_centroid";
  return "invalid_or_unverified_coordinate";
}

function roundedCoordinatePart(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : "";
}

function latestTimestamp(left, right) {
  const leftTime = Date.parse(left || "");
  const rightTime = Date.parse(right || "");
  if (!Number.isFinite(leftTime)) return right || left || "";
  if (!Number.isFinite(rightTime)) return left || right || "";
  return rightTime > leftTime ? right : left;
}

function mapStyleConfig() {
  return {
    version: 8,
    sources: {
      "carto-dark": {
        type: "raster",
        tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }
    },
    layers: [
      {
        id: "carto-dark",
        type: "raster",
        source: "carto-dark",
        minzoom: 0,
        maxzoom: 19
      }
    ]
  };
}

function buildPopupHtml(properties) {
  const sessions = properties.sessionsAvailable ? formatNumber(properties.sessions) : "n/a";
  const countryLabel = properties.country || properties.country_code || "Unavailable";
  const flagPath = properties.flagPath || countryFlagPath(properties.country_code);
  const coordinateLabel = coordinateSourceLabel(properties.coordinateSource, properties.plottedPrecision);
  const isCountryFallback = properties.plottedPrecision === "country_fallback";
  return `
    <div class="analytics-map-popup-inner">
      <strong>${escapeHtml(properties.label || "Location")}</strong>
      <dl>
        <div><dt>Marker</dt><dd>${escapeHtml(isCountryFallback ? "Country fallback location" : coordinateLabel)}</dd></div>
        <div><dt>City</dt><dd>${escapeHtml(properties.city || (isCountryFallback ? "Country fallback marker" : "n/a"))}</dd></div>
        <div><dt>Region</dt><dd>${escapeHtml(properties.region || "n/a")}</dd></div>
        <div><dt>Country</dt><dd><span class="location-chip"><img class="country-flag" src="${escapeHtml(flagPath)}" alt="" loading="lazy" decoding="async" /><span>${escapeHtml(countryLabel)}</span></span></dd></div>
        ${isCountryFallback ? `<div><dt>Cities</dt><dd>${escapeHtml(properties.contributingCitiesSummary || "No city detail")}</dd></div>` : ""}
        <div><dt>Sessions</dt><dd>${escapeHtml(sessions)}</dd></div>
        <div><dt>Requests</dt><dd>${escapeHtml(formatNumber(properties.requests))}</dd></div>
        <div><dt>Events</dt><dd>${escapeHtml(formatNumber(properties.events))}</dd></div>
        <div><dt>Window</dt><dd>${escapeHtml(properties.windowLabel || properties.window || "n/a")}</dd></div>
        <div><dt>Precision</dt><dd>${escapeHtml(properties.precision || "unavailable")}</dd></div>
        <div><dt>Original precision</dt><dd>${escapeHtml(properties.originalPrecision || "unknown")}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(sourceLabel(properties.source))}</dd></div>
        <div><dt>Coordinates</dt><dd>${escapeHtml(coordinateLabel)}</dd></div>
        <div><dt>Last seen</dt><dd>${escapeHtml(formatTimestamp(properties.lastSeen))}</dd></div>
        ${properties.page_path ? `<div><dt>Page</dt><dd>${escapeHtml(properties.page_path)}</dd></div>` : ""}
        ${properties.referrer_host ? `<div><dt>Referrer</dt><dd>${escapeHtml(properties.referrer_host)}</dd></div>` : ""}
        <div><dt>Flag path</dt><dd>${escapeHtml(flagPath)}</dd></div>
      </dl>
    </div>
  `;
}

function coordinateSourceLabel(source, plottedPrecision) {
  if (source === "country_centroid" || plottedPrecision === "country_fallback") return "Country fallback";
  if (source === "city_lookup") return "City lookup";
  if (source === "event_coordinate") return "City coordinate";
  return source || "source";
}

function sourceLabel(source) {
  const labels = {
    page_visit_kv: "Page-visit KV",
    cloudflare_graphql: "Cloudflare GraphQL",
    streamsuites_event_mirror: "StreamSuites mirror",
    streamsuites_live: "StreamSuites live"
  };
  return labels[source] || source || "Unavailable";
}

function updateDebugState(featureCollection = state.pendingFeatureCollection) {
  const browserWindow = globalThis.window;
  if (!browserWindow) return;
  browserWindow.DC_ADMIN_ANALYTICS_MAP_DEBUG = {
    map: state.map,
    sourceId: SOURCE_ID,
    layerIds: [LAYER_IDS.halo, LAYER_IDS.dot, LAYER_IDS.hitbox],
    featureCollection,
    markerCount: featureCollection?.features?.length || 0,
    updateCount: state.updateCount,
    ready: state.ready
  };
}

function scheduleResize(delay = 0) {
  if (!state.map) return;
  globalThis.setTimeout(() => state.map?.resize(), delay);
}

function setFeedback(element, text, isError = false) {
  const target = resolveElement(element);
  if (!target) return;
  target.textContent = text || "";
  target.classList.toggle("is-error", Boolean(isError));
}

function resolveElement(value) {
  if (!value) return null;
  if (typeof value === "string") return globalThis.document?.getElementById(value) || null;
  return value;
}

function emptyFeatureCollection() {
  return {
    type: "FeatureCollection",
    features: [],
    metadata: {
      eligibleRows: [],
      unmappedRows: [],
      rejectedRows: [],
      groupedRows: 0,
      cityMarkers: 0,
      countryFallbackMarkers: 0
    }
  };
}

function normalizeCountryCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (/^[A-Z]{2}$/.test(normalized)) return COUNTRY_ALIASES[normalized] || normalized;
  const aliasKey = normalizeAliasKey(raw);
  if (COUNTRY_ALIASES[aliasKey]) return COUNTRY_ALIASES[aliasKey];
  const countryNameCode = COUNTRY_NAME_LOOKUP.get(normalizeKeyPart(raw));
  if (countryNameCode) return countryNameCode;
  return "";
}

function countryFlagPath(countryCodeValue) {
  const code = normalizeCountryCode(countryCodeValue).toLowerCase();
  return code ? `${FLAG_BASE_PATH}/${code}.svg` : `${FLAG_BASE_PATH}/_fallback.svg`;
}

function normalizeKeyPart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeTokenPart(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function normalizeAliasKey(value) {
  return normalizeKeyPart(value).toUpperCase().replace(/\s+/g, "_");
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function hasPresentField(row, names) {
  return names.some((name) => {
    const value = row?.[name];
    return value !== null && value !== undefined && String(value).trim() !== "";
  });
}

function firstFiniteField(row, names) {
  for (const name of names) {
    const parsed = parseFiniteNumber(row?.[name]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function parseFiniteNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : String(value);
}

function formatTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : "n/a";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

assertCoordinateGuardrails();
