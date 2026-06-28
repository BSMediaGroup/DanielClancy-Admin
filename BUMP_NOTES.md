# CURRENT VER= v1.0 / PENDING VER= v1.0.1

## v1.0 Release Milestone

### Technical Notes

- Promoted the visible DanielClancy-Admin release label from `v0.1.2-beta -> v1.0` to `v1.0`.
- Replaced the static shell's default topbar/sidebar pre-release posture with v1.0/local-fallback wording while preserving live/fallback diagnostics.
- Added GitHub-release-ready `RELEASE_NOTES_v1.0.md` built from the current README, BUMP notes, package metadata, source files, and test coverage.
- Added a focused version consistency test covering the BUMP heading, visible Admin shell release label, release-notes file, README release status, and absence of stale alpha/beta/pre-release labels in `index.html`.
- Kept Admin auth behavior, CMS APIs, analytics behavior, registry overlay v3 persistence, public site-data publishing, and disabled Alerts compatibility unchanged for this release documentation pass.
- No CV, employment, company, software/platform, project, or portfolio facts were changed.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- DanielClancy-Admin is now tracked as the `v1.0` admin dashboard release.
- The dashboard remains the Admin control surface for Projects, Media, Companies, Platforms, Positions, Accounts, Analytics, Settings, and sanitized public site-data publishing.
- Alerts rule editing remains removed/disabled in DanielClancy-Admin; StreamSuites-Dashboard remains the only alert-rule UI.

### Files / Areas Changed

- `index.html`
- `README.md`
- `BUMP_NOTES.md`
- `RELEASE_NOTES_v1.0.md`
- `tests/version-consistency.test.mjs`

### Validation Notes

- Run `node --test tests/version-consistency.test.mjs`.
- Run existing source/registry/public-site-data/publish tests, syntax checks for changed JS/Functions/scripts, optional npm check/build commands, and `git diff --check` release validation commands.

### Risks / Follow-Ups

- Hosted Cloudflare Pages still needs required env vars and bindings configured before live Admin auth, KV persistence, public publishing, analytics, and uploads can be relied on in production.
- `package.json` intentionally remains a static-shell package file without a `version`, `check`, or `build` script.

## Analytics Expanded Map / Fullscreen Parity Milestone

### Technical Notes

- Added Maseru, Maseru District, LS city lookup coverage and Lesotho (`LS`) country centroid fallback coverage to the local analytics coordinate lookup data.
- Added expanded inline map state and a fullscreen MapLibre lightbox for the Analytics location map while preserving the existing GeoJSON source/layer implementation in `assets/js/analytics-map.js`.
- The fullscreen map reuses the same `#analytics-location-map` MapLibre instance and feature pipeline as the inline view, avoiding a second live map instance and preventing duplicate marker/layer lifecycle leaks on open/close/reopen.
- Added a detailed map sidebar with selected window, total rows/events, sessions, city marker count, country fallback marker count, unmapped rows, last live event, mapped locations, unmapped rows, source breakdown, precision legend, and marker legend.
- Kept the coordinate standard aligned with StreamSuites-Dashboard: explicit event coordinates first, exact city lookup second, country centroid fallback third, and unmapped only when no usable coordinate or country fallback exists.

### Human-Readable Notes

- Maseru, Maseru District, LS is no longer an unmapped analytics location.
- Unknown cities with valid country codes continue to plot as honestly labelled country fallback markers rather than fake city markers.
- Admin users can now inspect the analytics map in inline, expanded, and fullscreen modes with the same selected window and source-backed rows.

### Files / Areas Changed

- `assets/data/geo-coordinate-lookup.json`
- `assets/js/geo-coordinate-lookup.js`
- `assets/js/admin-app.js`
- `assets/css/admin.css`
- `tests/analytics-map-coordinate-fallback.test.mjs`
- `tests/analytics-map-marker-lifecycle.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Validation performed for this milestone: `node --check assets/js/admin-app.js`; `node --check assets/js/analytics-map.js`; `node --check assets/js/geo-coordinate-lookup.js`; `node --test tests/analytics-map-coordinate-fallback.test.mjs tests/analytics-map-marker-lifecycle.test.mjs`; `git diff --check`; Playwright MCP browser validation against the Analytics route with mocked StreamSuites live rows for Maseru, country fallback, fullscreen open/close, and window switching.

### Risks / Follow-Ups

- Browser validation uses mocked selected-window API responses through the real route path because local static hosting does not have production Cloudflare KV/Auth bindings.

## Analytics Coordinate Fallback Milestone

### Technical Notes

- Split Analytics coordinate data into `assets/js/geo-coordinate-lookup.js` and expanded the documented `assets/data/geo-coordinate-lookup.json` v2 data source with verified approximate city-center rows for Portland, Los Angeles, Santa Clara, Ashburn, London, Sydney, Toronto, Sao Paulo, Rio de Janeiro, Melbourne, Brisbane, Perth, Auckland, Tokyo, Singapore, Dublin, Frankfurt, Paris, and Amsterdam, plus additional existing common rows.
- Added local ISO alpha-2 country centroid fallbacks for US, GB, CA, BR, AU, NZ, IE, DE, FR, NL, JP, SG, IN, ZA, MX, ES, IT, SE, NO, and DK. No external coordinate service is called at runtime.
- Updated `assets/js/analytics-map.js` coordinate resolution to prefer verified event coordinates, then exact city lookup, then verified country centroid fallback. City rows without a known city coordinate now plot at country fallback precision instead of becoming useless unmapped rows.
- Added `coordinateSource`, `plottedPrecision`, `originalPrecision`, `unmappedReason`, and contributing-city summary metadata to map features. Country fallback markers aggregate by project/source/country/coordinate, stay visually distinct in the MapLibre circle layers, and popups say “Country fallback location.”
- Updated `assets/js/admin-app.js` Analytics summary cards to show City markers, Country fallback markers, and Unmapped rows. The Location Breakdown table keeps real city/region text, keeps flags only in the Country column, and labels Map precision as `city`, `country fallback`, or `unmapped`.
- Preserved the StreamSuites live analytics source, the existing `5M`, `15M`, `1H`, and `24HRS` windows, the dark MapLibre map, and the country-flag placement rule.

### Human-Readable Notes

- Santa Clara, Ashburn, London, and other real live city rows no longer become uselessly unmapped just because a city lookup row was missing.
- Unknown cities with valid country codes now plot at labelled country fallback markers. Unknown city coordinates are not invented, and country fallback dots are not labelled as city precision.
- Rows still count as unmapped only when they lack any usable coordinate, city lookup, or country centroid fallback.

### Files / Areas Changed

- `assets/data/geo-coordinate-lookup.json`
- `assets/js/geo-coordinate-lookup.js`
- `assets/js/analytics-map.js`
- `assets/js/admin-app.js`
- `tests/analytics-map-coordinate-fallback.test.mjs`
- `tests/analytics-map-flags.test.mjs`
- `tests/analytics-map-marker-lifecycle.test.mjs`
- `tests/analytics-map-rebuild.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Added focused coordinate fallback coverage for Santa Clara, Ashburn, London, unknown-city country fallback, no-country unmapped rows, GB/UK normalization, longitude/latitude GeoJSON ordering, safe US/GB centroids, all four Analytics windows, unmapped counts, country flag placement, and repeated-row aggregation.
- Final command and MCP/browser validation results for this milestone are recorded in the Codex task summary.
- StreamSuites and StreamSuites-Dashboard were not mutated.

## Emergency Analytics Map Rebuild Milestone

### Technical Notes

- Replaced the Analytics route's embedded map/marker code path with isolated `assets/js/analytics-map.js`; `assets/js/admin-app.js` now mounts the map container, renders non-map UI, and passes selected-window live rows into the module.
- Removed the old route-local marker lifecycle from `admin-app.js`: embedded map state, coordinate lookup, coordinate normalization, marker aggregation, feature building, layer setup, popup HTML, and `source.setData()` are no longer owned by the route file.
- The rebuilt map uses MapLibre GeoJSON source/layers only: source `analytics-live-locations`; layers `analytics-location-halo`, `analytics-location-dot`, and transparent `analytics-location-hitbox`.
- Aggregated source-tagged live rows into one GeoJSON feature per stable project/source/location/precision/rounded-coordinate group before rendering; repeated Portland, Los Angeles, and other same-location rows do not create repeated marker elements.
- Hardened coordinate normalization so GeoJSON geometry is always `[longitude, latitude]`; explicit longitude/latitude fields are validated, suspicious arrays are rejected unless declared or confidently correctable, and `[lat, lng]` west-coast arrays are corrected with `coordinateSource: "corrected_lat_lng"`.
- Added Portland/Los Angeles west-coast guardrails so positive East Hemisphere longitudes or coordinates outside Oregon/California ranges are rejected.
- Request/event volume renders as one centered blurred circle halo layer; sessions render as one centered dot-radius expression only when real session IDs/counts exist. Missing sessions remain `n/a`.
- Preserved the MapLibre instance across Analytics rerenders by detaching/restoring the existing map container before route HTML replacement; window changes now replace source data instead of recreating the map or accumulating markers.
- Preserved the table flag rule: City and Region cells stay text-only, while Country cells and map marker popups/tooltips/chips retain flags.

### Human-Readable Notes

- Repeated Portland or Los Angeles events now collapse into a single plotted MapLibre feature per live source/location instead of a horizontal or vertical chain of repeated dots.
- Request/event volume is shown as a centered halo, session volume controls the dot when session data exists, and missing sessions remain `n/a` instead of being invented.
- Switching `5M`, `15M`, `1H`, and `24HRS` windows replaces marker source data instead of accumulating prior markers or rebuilding the map instance.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `assets/js/analytics-map.js`
- `tests/analytics-map-flags.test.mjs`
- `tests/analytics-map-marker-lifecycle.test.mjs`
- `tests/analytics-map-rebuild.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Passed `node --check assets/js/admin-app.js`.
- Passed `node --check assets/js/analytics-map.js`.
- Passed `node --check assets/js/admin-auth.js`.
- Passed `node --check functions/api/admin/analytics.js`.
- Passed `node --test tests/analytics-helpers.test.mjs`.
- Passed `node --test tests/analytics-map-rebuild.test.mjs`.
- Passed `node --test tests/analytics-map-flags.test.mjs`.
- Passed `node --test tests/analytics-map-marker-lifecycle.test.mjs`.
- Passed MCP/Playwright browser validation at `http://127.0.0.1:5199/?cache=<timestamp>#/analytics` with network-level mocked Admin auth/API responses and repeated live rows for every window. The actual route initialized one MapLibre canvas, exposed GeoJSON source `analytics-live-locations`, emitted exactly two features in every window, reused the same map instance across `5M`, `15M`, `1H`, and `24HRS`, rendered zero old DOM marker/request-dot elements, kept Portland at `[-122.6784, 45.5152]`, corrected Los Angeles to `[-118.2437, 34.0522]`, opened a layer popup with flag/country/sessions/requests/source/window/page/referrer details, kept flags only in Country table cells, and ended with no console errors or bad mocked-route responses.
- Visual screenshot proof was captured at `C:/Users/jupit/AppData/Local/Temp/dc-admin-analytics-map-rebuild.png`; it showed the dark MapLibre map with one centered Portland marker and one centered Los Angeles marker, no marker chain/smear, and the Los Angeles popup open.
- Passed `git diff --check`; Git only reported line-ending normalization warnings for edited files.
- `npm run check` and `npm run build` were not run because this repo's `package.json` does not define those scripts.

## StreamSuites Live Analytics Primary Source Milestone

### Technical Notes

- Added server-side StreamSuites live analytics consumption through `STREAMSUITES_ANALYTICS_URL`, forwarding the selected `5m`, `15m`, `1h`, or `24h` window and `DANIELCLANCY_ANALYTICS_READ_SECRET` only from the Cloudflare Function environment.
- Updated Analytics source priority to prefer `streamsuites_live`, then source-tagged Admin KV page visits, then Cloudflare GraphQL aggregate metrics. Sample/fallback/demo/mock/test rows and untagged legacy rows remain quarantined and are not live map markers.
- Added `streamsuites_live` to the live row model, source breakdown, readiness diagnostics, map/table rows, top pages, referrers, and freshness status without exposing the configured StreamSuites URL or read secret to the browser response.
- Updated the sidebar/API status logic so a connected Admin API no longer reports “Static foundation. No live admin API connected.” when API status and StreamSuites analytics are connected.
- Documented `STREAMSUITES_ANALYTICS_URL`, `DANIELCLANCY_ANALYTICS_READ_SECRET`, source priority, StreamSuites live source behavior, stale local analytics quarantine, and the sidebar status fix in `README.md` and `.env.example`.

### Human-Readable Notes

- DanielClancy-Admin now uses the StreamSuites runtime/API DanielClancy analytics feed as the primary live source when configured.
- Stale local Los Angeles/Portland rows cannot appear as live rows unless StreamSuites returns them as current DanielClancy events.
- Canada, Brazil, Australia, UK, and other real StreamSuites-returned locations render through the existing MapLibre dark map using the same dot/session and halo/request semantics.

### Files / Areas Changed

- `.env.example`
- `README.md`
- `BUMP_NOTES.md`
- `assets/js/admin-app.js`
- `functions/_shared/analytics-store.js`
- `functions/api/admin/analytics.js`
- `tests/analytics-helpers.test.mjs`
- `tests/analytics-map-flags.test.mjs`

### Validation Notes

- Validation performed: `node --check assets/js/admin-app.js`; `node --check assets/js/admin-auth.js`; `node --check functions/api/admin/analytics.js`; `node --check functions/_shared/analytics-store.js`; `node --test tests/analytics-helpers.test.mjs`; `node --test tests/analytics-ingest-and-assets.test.mjs`; `node --test tests/analytics-map-flags.test.mjs`; `git diff --check`; Playwright browser validation against the Analytics page with mocked StreamSuites Canada/Brazil/Australia/UK live rows and stale Los Angeles/Portland rows held out of live markers.

## Emergency Live Analytics Source Repair Milestone

### Technical Notes

- Hardened analytics row classification so live map/table rows require `live: true`, source `page_visit_kv`, `cloudflare_graphql`, or `streamsuites_event_mirror`, and a timestamp inside the selected `5M/15M/1H/24HRS` window.
- Added Admin analytics diagnostics for Admin API, `DC_ADMIN_KV`, analytics ingest, Cloudflare GraphQL, live/stale/sample counts, `lastLiveEventAt`, `sourceBreakdown`, warnings, and repair-action availability.
- Updated `POST /api/analytics/ingest/page-visit` to accept forwarded event IDs, source/live metadata, timestamps, and sanitized geo fields, and to report stored/duplicate/source/recordedAt metadata.
- Added event dedupe in `analytics-store.js` by event ID/dedupe key with a conservative page/client/time fallback.
- Changed purge behavior to remove sample/fallback/demo/mock/test and untagged legacy rows while keeping source-tagged live rows.
- Replaced the static sidebar API note with live Admin API/KV status text driven by `/api/admin/status` and `/api/admin/analytics` results.
- Fixed admin UI icon mask URLs to use root-relative `/assets/icons/ui/...` paths so browser validation no longer requests nonexistent `/assets/css/assets/icons/...` files.
- Kept the real MapLibre dark map and local flag rendering. StreamSuites alert rules were not mutated.

### Human-Readable Notes

- Stale Los Angeles/Portland scaffold rows cannot render as live markers unless they are real, source-tagged, current events.
- If Admin API/KV is unavailable, Analytics shows disconnected/empty live state instead of fake rows.
- Canada, Brazil, Australia, UK, and other real geographies will appear only after matching live events are ingested or mirrored.

### Files / Areas Changed

- `index.html`
- `assets/css/admin.css`
- `assets/js/admin-auth.js`
- `assets/js/admin-app.js`
- `functions/_shared/analytics-store.js`
- `functions/api/admin/analytics.js`
- `functions/api/analytics/ingest/page-visit.js`
- `tests/analytics-ingest-and-assets.test.mjs`
- `tests/analytics-map-flags.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Passed `node --check assets/js/admin-app.js`.
- Passed `node --check assets/js/admin-auth.js`.
- Passed `node --check functions/api/admin/analytics.js`.
- Passed `node --check functions/_shared/analytics-store.js`.
- Passed `node --check functions/api/analytics/ingest/page-visit.js`.
- Passed focused analytics tests: `tests/analytics-helpers.test.mjs`, `tests/analytics-map-flags.test.mjs`, and `tests/analytics-ingest-and-assets.test.mjs`.
- Passed MCP/Playwright browser validation against `http://127.0.0.1:5199/#/analytics` with mocked stale/sample, live Canada/Brazil/Australia/UK, and disconnected API scenarios.
- Passed `git diff --check`; Git only reported line-ending normalization warnings for edited files.

### Risks / Follow-Ups

- Hosted Cloudflare Pages still needs live env/binding verification after deploy.

## Projects Editor Asset Preview Containment Milestone

### Technical Notes

- Added bounded Projects editor asset preview markup for selected hero, thumbnail, document/PDF, upload, and gallery values using explicit preview card/frame/image/document/grid/action classes.
- Gallery paths now render inside compact thumbnail cards with truncated path labels and wrapped up/down/remove controls, preventing natural image dimensions or long paths from widening the modal.
- Document/PDF paths now render as compact file cards with filename/path text and an open link instead of any full-page embed behavior in the modal.
- Added modal/form/grid overflow guards so preview cards and long asset paths stay inside the editor and preserve normal vertical scrolling.
- Existing asset dropdowns, upload triggers, manual path fields, gallery ordering/removal controls, Companies/Platforms selectors, local/API save flow, and protected baseline behavior were preserved.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Project image selections should now appear as useful thumbnails instead of taking over the editor.
- Gallery media is easier to scan and reorder because each item stays in a small card.
- PDF/document selections stay visible as compact file rows with an open link.

### Validation Notes

- Ran `node --check assets/js/admin-app.js`.
- Pending validation includes `git diff --check` and any available quick repo scripts after final edits.

### Risks / Follow-Ups

- Browser smoke testing with live/admin fixture data is still useful after deploy to confirm real uploaded asset URLs load correctly.

## Analytics Windowed Map / Cloudflare Query Cleanup Milestone

### Technical Notes

- Added Analytics `5M`, `15M`, `1H`, and `24HRS` window controls modelled on the StreamSuites-Dashboard analytics selector pattern; the UI sends `GET /api/admin/analytics?window=...` and refreshes map, tables, summary cards, freshness state, and notes for the selected window.
- Normalized Analytics API windows server-side to the supported `5m`, `15m`, `1h`, and `24h` set. Unsupported values normalize safely and Cloudflare GraphQL filters now stay within the selected <=24h window instead of using a one-week grouped range.
- Removed the unsupported Cloudflare GraphQL city field query path and stopped querying unavailable referrer-host dimensions from Cloudflare. City detail is sourced from page-visit KV/request geo metadata; Cloudflare referrer host reports a clear unavailable note when the current dataset cannot provide it.
- Page-visit KV reads now filter recent rows by recorded timestamp for the selected window. Rows outside the selected window and timestamp-missing rows are excluded from live map/table rollups instead of being mixed into current live counts.
- Marker semantics now mirror the StreamSuites-style dot/halo behavior in DanielClancy's existing MapLibre DOM marker implementation: dot size scales from distinct sessions when available, while the larger gradient halo scales from requests/events.
- Page-visit aggregation can count distinct sessions only when a safe session id exists; unknown session counts render as `n/a` and are not invented from request counts.
- Location table flag clutter was fixed: City and Region render text only, Country renders the local SVG flag plus label/code, and flags remain available in map popups/tooltips/chips/country labels.
- Visible Analytics notes now group partial/unavailable Cloudflare and page-visit status without surfacing raw GraphQL range/schema messages.
- No fake/sample rows appear as live markers, and no analytics counts, cities, countries, sessions, requests, or coordinates are invented.
- StreamSuites and StreamSuites-Dashboard were not mutated; StreamSuites-Dashboard was inspected read-only for the analytics map/window reference.

### Human-Readable Notes

- Analytics can now be checked by recent window, and the map/table should stop showing old all-time location rows as if they are current 5-minute traffic.
- Map markers are easier to read: sessions affect the foreground dot, while request volume affects the glow behind it.
- The location table is quieter because flags appear only where they identify the country.

### Validation Notes

- Ran `node --check assets/js/admin-app.js`, `node --check assets/js/admin-auth.js`, `node --check functions/api/admin/analytics.js`, `node --check functions/_shared/analytics-store.js`, and `node --check functions/api/analytics/ingest/page-visit.js`.
- Ran `node --test tests/analytics-helpers.test.mjs`, `node --test tests/analytics-map-flags.test.mjs`, and `node --test tests/analytics-ingest-and-assets.test.mjs`.
- Ran `git diff --check`.
- `npm run check` and `npm run build` are unavailable in this repo because `package.json` has no `check` or `build` script.
- Ran Playwright/MCP browser validation against a local mock preview on `http://127.0.0.1:5199/#/analytics`: Analytics route loaded, real MapLibre initialized, CARTO `dark_all` tile requests were observed, `5M/15M/1H/24HRS` selector was visible and refreshed state, marker dot/halo sizes varied with session/request fixture counts, table flags appeared only in Country, popup retained a country flag and session/request/window fields, raw GraphQL field/range errors were not visible, and the empty `15M` window kept the real basemap with no fake markers.

### Risks / Follow-Ups

- Live Cloudflare schema access still depends on the deployed account/token/zone permissions, so hosted verification remains needed after deploy.
- Browser validation must confirm real MapLibre tile rendering and marker scaling with controlled test data.

## Public Site-Data Publish Snapshot / Manifest Tooling Milestone

### Technical Notes

- Added admin-only `POST /api/admin/publish/site-data` with signed admin-session enforcement and `DC_ADMIN_KV` requirement.
- Publishing builds the sanitized public site-data payload, writes `public:site-data:published` plus `public:site-data:publish-meta`, and returns revision, counts, warnings, published timestamp, and cache-busting public URL.
- Updated `GET /api/public/site-data` to prefer the published KV snapshot, expose `source`, `revision`, `publishedAt`, and short-cache/ETag metadata, then fall back to live reconciled or baseline data.
- Added Overview/Settings/Projects/Companies/Platforms/Positions publish status controls with source, revision, counts, warnings, and explicit local-only/KV-unavailable blocking.
- Added `tools/rebuild-manifests.mjs` plus `npm run manifests:rebuild`, `npm run manifests:check`, and `npm run test:registries`.
- Rebuilt `assets/data/public-asset-catalog.json` from current DanielClancy public assets; asset entries increased to match the current public repo.
- No admin-only overlay/account/session/secret data is exposed by the public export or published snapshot.
- Alerts editor remains removed/disabled.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Admin now has a clear Save/Sync first, Publish site data second workflow.
- The public endpoint can report whether it is serving a published snapshot, live reconciled fallback, or baseline fallback.
- Local manifest rebuilds are repeatable after new public assets/source files are added.

### Validation Notes

- Added/updated public site-data export and publish snapshot tests.
- Targeted validation should include `node --test tests/public-site-data-export.test.mjs`, registry/source tests, manifest rebuild/check, syntax checks, and `git diff --check`.

### Risks / Follow-Ups

- Hosted Cloudflare Pages still needs `DC_ADMIN_KV` binding confirmation and public CORS/live endpoint verification.
- Save/Sync remains separate from Publish; localStorage-only edits must be synced to Admin KV before publishing.

## Analytics Real Interactive Map / Complete Local Flags Milestone

### Technical Notes

- Replaced the rejected custom SVG/graticule Analytics location panel with a real MapLibre GL map instance modelled on StreamSuites-Dashboard's MapLibre analytics approach.
- Added local vendored MapLibre GL runtime assets under `assets/vendor/maplibre-gl/` so the Cloudflare Pages static admin surface does not depend on `node_modules` at runtime.
- Added a dark CARTO `dark_all` raster basemap style through MapLibre with OpenStreetMap/CARTO attribution handled by the map control.
- Added one-time map initialization, route/layout resize handling, marker replacement on refresh, popup rendering, bounds fitting, and an empty overlay that appears over the real basemap when no live location rows exist.
- Added `location.liveLocationRows` to the Analytics API response; it contains only rows with `live !== false` and source `page_visit_kv` or `cloudflare_graphql`.
- Reworked frontend marker generation so rows without verified coordinates are listed but not plotted, country-only rows use only verified centroids and stay labelled `precision: "country"`, and sample/stale rows never become live markers.
- Replaced the five-file local flag set with the broad `flag-icons` 4x3 SVG set under `assets/icons/flags/`, retaining `_fallback.svg` for unknown/missing codes.
- Expanded map/flag tests to assert MapLibre asset inclusion, real map metadata, live-source filtering, no sample markers, coordinate filtering, country precision, broad flag coverage, fallback flags, popup flag metadata, and freshness/empty-state behavior.
- No fake/sample markers appear in live map mode.
- No analytics counts or cities were invented.
- Alerts editor remains removed/disabled.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Analytics now uses a real dark interactive map with pan/zoom, markers, popups, and attribution instead of a decorative pseudo-map.
- Empty live analytics still shows the map base layer, but no demo Los Angeles/Portland/AU/EU markers are injected.
- Country flags now come from a materially complete local SVG set rather than five hand-picked files.

### Files / Areas Changed

- `index.html`
- `assets/js/admin-app.js`
- `assets/css/admin.css`
- `assets/vendor/maplibre-gl/*`
- `assets/icons/flags/*.svg`
- `functions/api/admin/analytics.js`
- `tests/analytics-map-flags.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Run `node --check assets/js/admin-app.js`.
- Run `node --check functions/api/admin/analytics.js`.
- Run `node --test tests/analytics-helpers.test.mjs`.
- Run `node --test tests/analytics-ingest-and-assets.test.mjs`.
- Run `node --test tests/analytics-map-flags.test.mjs`.

### Risks / Follow-Ups

- The dark basemap tiles are remote CARTO raster tiles; if that provider is blocked or unavailable, MapLibre still initializes but tile loading will fail.
- Hosted Cloudflare Pages validation is still needed to confirm production env bindings and Cloudflare GraphQL schema behavior with real live traffic.

## Analytics Live Map / Source Integrity Milestone

### Technical Notes

- Repaired the Analytics API/page-visit storage contract so real ingest rows are tagged with `source: "page_visit_kv"`, `live: true`, `eventId`, `recordedAt`, `country_code`, and `precision`.
- Recomputed page-visit rollups from live source-tagged rows only; explicit sample/fallback/demo/mock/test rows are isolated as `sampleRows`, and untagged legacy rows are held out as `staleRows`.
- Added admin-session-protected `POST /api/admin/analytics` action `purge_non_live_fallback_rows` for clearing only explicitly tagged sample/fallback analytics rows.
- Added Analytics response freshness metadata: last checked, last live page-visit event time, last Cloudflare GraphQL query time, and `sourceFreshnessState`.
- Reworked the Analytics map panel to keep fake/sample markers out of live mode, show the intentional empty state, plot only exact known city/country coordinate matches, and list unknown city rows without inventing coordinates.
- Added local SVG country flags for US, AU, GB, CA, NZ, plus a local fallback globe, and rendered flags in location table cells, city/region/country chips, map labels, and marker tooltip text where available.
- Added `assets/data/geo-coordinate-lookup.json` documenting the limited verified built-in coordinate lookup for Los Angeles, Portland, and Sydney.
- Added `tests/analytics-map-flags.test.mjs` and expanded ingest/API tests for source tags, sample/stale isolation, country-only precision, flag assets, coordinate lookup behavior, freshness metadata, and purge safety.
- No fake/sample markers appear in live map mode.
- Country-only data is not treated as city data.
- No analytics counts or cities were invented.
- Alerts editor remains removed/disabled.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Analytics now shows live page-visit geography only when real source-tagged rows exist.
- Empty analytics now renders the real MapLibre basemap with “No live page-visit location events captured yet.” instead of demo locations.
- Operators can refresh analytics manually and clear only tagged sample rows without deleting real page-visit data.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `assets/css/admin.css`
- `assets/data/geo-coordinate-lookup.json`
- `assets/icons/flags/*.svg`
- `functions/_shared/analytics-store.js`
- `functions/api/admin/analytics.js`
- `tests/analytics-ingest-and-assets.test.mjs`
- `tests/analytics-map-flags.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Run `node --check functions/_shared/analytics-store.js functions/api/admin/analytics.js assets/js/admin-app.js`.
- Run `node --test tests/analytics-helpers.test.mjs`.
- Run `node --test tests/analytics-ingest-and-assets.test.mjs`.
- Run `node --test tests/analytics-map-flags.test.mjs`.

### Risks / Follow-Ups

- Hosted Cloudflare Pages validation is still needed to confirm the deployed env bindings and GraphQL schema return the expected live sections.
- Existing untagged legacy KV rows are intentionally held out as stale rather than purged automatically; only rows explicitly tagged sample/fallback/demo/mock/test are removed by the repair action.

## Public Site-Data Export Milestone

### Technical Notes

- Added `GET /api/public/site-data` as a public, read-only, sanitized Cloudflare Pages Function endpoint for DanielClancy.net hydration.
- Added `functions/_shared/public-site-data.js` to build the export from protected Projects baseline plus safe `cms:projects` KV overlay, and from reconciled Companies/Platforms/Positions using the existing `registry-overlay.v3` layer.
- Public export returns explicit `danielclancy-public-site-data.v1` shape with `projects`, `companies`, `platforms`, `positions`, public asset catalogs, generated timestamp, source label, and warnings.
- Client-only Companies remain excluded from public Companies; Riley Consulting remains project client/provenance metadata only when source data intends it.
- Fleetwood Australia and GHD continue to be restored from source baselines when present in source data.
- The endpoint does not expose admin sessions, account registry data, auth state, secrets, KV binding names, overlay wrappers, excluded-row internals, edit-only metadata, or draft/private rows.
- CORS allows only public DanielClancy origins and local Vite/preview origins for GET/OPTIONS. Unsafe methods are rejected.
- Successful responses use short public caching with stale-while-revalidate; errors use `no-store`.
- If `DC_ADMIN_KV` is unavailable or a collection read fails, the endpoint returns reconciled baselines plus warnings rather than breaking public site hydration.
- Added `tests/public-site-data-export.test.mjs` covering collection/asset presence, Riley exclusion, Fleetwood/GHD inclusion, internal-field leakage prevention, KV overlay merge, and baseline fallback.
- Alerts editor remains removed/disabled.
- OAuth users are still not auto-promoted.
- Manual env-backed admin access remains preserved.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- DanielClancy-Admin can now publish a safe public data feed for DanielClancy.net without making the public site depend on admin login or raw CMS internals.
- The export is designed to fail soft: public website fallback data remains authoritative when Admin storage or the endpoint is unavailable.

### Files / Areas Changed

- `functions/_shared/public-site-data.js`
- `functions/api/public/site-data.js`
- `tests/public-site-data-export.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Run `node --check functions/_shared/public-site-data.js functions/api/public/site-data.js`.
- Run `node --test tests/public-site-data-export.test.mjs tests/registry-reconciliation.test.mjs tests/source-audit-completeness.test.mjs`.
- Run `git diff --check`.

### Risks / Follow-Ups

- Hosted Cloudflare Pages validation should confirm live CORS, cache headers, and fallback behavior against real `DC_ADMIN_KV`.
- Public project rows still need clean `/media/portfolio/...` and `/docs/...` paths configured where old source filenames or OneDrive links remain.

## Emergency Registry Overlay v3 Persistence Hotfix

### Technical Notes

- Replaced Companies/Platforms/Positions registry persistence with schema `registry-overlay.v3`.
- Baseline source rows are no longer persisted as full KV/localStorage rows. Source-derived edits are stored as `overrides` keyed by stable source ID, user-created rows are stored as `customRows`, deleted custom IDs are tracked separately, and stale/client-only rows are tracked in `excludedRows`.
- Fixed the exact persistence bug from the previous pass: `registryStoragePayload()` was saving reconciled baseline rows back into storage as normal `items`, then API/client reloads re-reconciled that already-reconciled snapshot. Source baseline fields could overwrite edited fields, full-row storage could reappear as duplicates, and API/local fallback used mismatched storage shapes.
- CMS API GET for Companies/Platforms/Positions now migrates old v1/v2 arrays or wrappers in memory, reconciles baseline plus overlay, returns `rows`/`items`, `overlaySummary`, warnings, excluded rows, stale-exclusion counts, and source-required restoration counts.
- CMS API PUT for Companies/Platforms/Positions now accepts either `registry-overlay.v3` or full visible rows. Full rows are converted to overlay patches/custom rows before persistence; full reconciled baseline rows are not stored as duplicate custom rows.
- Positions reconciliation now resolves company links against the current Companies overlay where available, not only the Companies baseline.
- Local static fallback saves Companies/Platforms/Positions to localStorage in the same v3 overlay format before attempting the live API. API failures leave the in-memory editor rows intact and show “No live admin API connected; saved locally only.”
- Added “Reconcile / repair local registry cache” for Companies, Platforms, and Positions. It migrates stale local arrays/wrappers to overlay v3 without deleting valid custom rows.
- Kept “Reset local registry cache” scoped to Companies/Platforms/Positions registry cache keys only after confirmation; it does not clear auth/session state, Projects, Media, disabled Alerts compatibility data, or unrelated CMS content.
- Added row-source UI badges for Source baseline, Source override, Custom, Archived, and Excluded/stale, plus save/status badges for override/custom/excluded counts.
- Added `tests/registry-overlay-persistence.test.mjs` covering source edit persistence, custom row dedupe, full-row PUT conversion, idempotence, Riley exclusion, Fleetwood/GHD restoration, position company resolution, old localStorage migration, and sync failure retaining in-memory rows.
- DanielClancy public website was read-only.
- No employment/company/client/software/position/CV facts were invented.
- Alerts rule editor remains removed/disabled.
- OAuth users are still not auto-promoted.
- Manual env-backed admin access remains preserved.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Editing a source Company, Platform, or Position now creates an override instead of a duplicate full row.
- Sync/Save no longer collapses Positions back to the baseline or discards source-derived edits.
- Creating custom registry rows should reload as exactly one custom row.
- Riley Consulting remains blocked from active Companies when classified client-only, while required source companies such as Fleetwood Australia and GHD remain restored.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `assets/js/registry-reconciliation.js`
- `functions/_shared/registry-reconciliation.js`
- `functions/api/admin/cms/[[collection]].js`
- `tests/registry-overlay-persistence.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation Notes

- Run targeted syntax, source-audit, registry reconciliation, overlay persistence, diff, npm check/build, and MCP/browser edit/save/reload validation before release.

### Risks / Follow-Ups

- Live production KV migration should be observed on a Pages-compatible dev/runtime environment with `DC_ADMIN_KV` configured before promoting this as a production data migration.
- Public-site publishing/hydration from Admin storage remains future work.

## Emergency Static Module Load Hotfix

### Technical Notes

- Added `assets/js/registry-reconciliation.js` as the browser-served registry reconciliation helper.
- Updated `assets/js/admin-app.js` to import reconciliation code from the static asset path instead of `functions/_shared`, because hosted/static routes can rewrite Function-source paths to `index.html` and fail strict module MIME checks.
- Kept `functions/_shared/registry-reconciliation.js` in place for the Cloudflare Pages CMS Function.

### Human-Readable Notes

- The dashboard shell/sidebar can boot again in static/hosted mode instead of failing on a module MIME error before render.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `assets/js/registry-reconciliation.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check assets/js/admin-app.js`, `node --check assets/js/registry-reconciliation.js`, focused registry tests, and a local browser load check for `#/companies`.

## Emergency Registry Reconciliation And Stale Cache Repair Milestone

### Technical Notes

- Added shared registry reconciliation under `functions/_shared/registry-reconciliation.js` with schema `danielclancy-admin.registries.v2`.
- Companies, Platforms, and Positions now start from source-derived baselines and merge localStorage/KV/admin rows only after source-audit reconciliation.
- Legacy bare-array localStorage rows under the existing Companies/Platforms/Positions keys are read through reconciliation and migrated to the v2 wrapper.
- Stale rows that conflict with source-audit client-only classification are excluded from active Companies and reported in reconciliation metadata/status.
- Source-required Companies from the employment/studio baseline are restored even when localStorage/KV lacks them.
- Riley Consulting remains excluded from Companies when source-audit classifies it as client-only; project client/provenance text remains preserved separately.
- Projects editor company selectors and Positions company selectors use reconciled active Companies only.
- CMS API GET/PUT for Companies, Platforms, and Positions now returns reconciled baseline-plus-KV payloads with `reconciled`, `staleRowsExcluded`, `sourceRequiredRowsRestored`, `storageSource`, `warnings`, and excluded-row metadata.
- Added a scoped “Reset local registry cache” action for registry cache keys only; it does not clear auth/session data, Projects, Media, disabled Alerts compatibility data, or unrelated CMS content.
- Added stale-data simulation tests covering the old broken Companies list, Riley exclusion, Fleetwood/GHD restoration, project selector behavior, and Positions company resolution.
- DanielClancy public website was read-only.
- No employment/company/client/software/CV facts were invented.
- Alerts editor remains removed/disabled.
- OAuth users are still not auto-promoted.
- Manual env-backed admin access remains preserved.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Static fallback mode can no longer let old browser cache rows hide Fleetwood Australia/GHD or reintroduce Riley Consulting as a Company.
- Production KV rows for Companies/Platforms/Positions are treated as overlays on the audited baseline, not as full replacement authority.
- The UI now shows a compact reconciliation notice when local registry data is repaired or stale/client-only rows are excluded.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `functions/_shared/registry-reconciliation.js`
- `functions/api/admin/cms/[[collection]].js`
- `index.html`
- `tests/registry-reconciliation.test.mjs`
- `tests/source-audit-completeness.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run targeted syntax, source-audit, registry-reconciliation, diff, npm check/build, and MCP/browser stale-localStorage validation before release.

### Risks / Follow-Ups

- Hosted production should be rechecked after deployment with live `DC_ADMIN_KV` to confirm any older KV payloads are reported as reconciled and cannot replace the source baseline.

## Corrected Organization Classification And Registry Guardrail Milestone

### Technical Notes

- Re-audited the read-only DanielClancy public CV/portfolio source, WorkSet CSV-derived project data, brand/logo references, copied Admin preview assets, and existing Admin baseline JSON with explicit organization classification buckets.
- Regenerated `assets/data/source-audit-report.json` with `employersFound`, `studiosFound`, `clientsFound`, `vendorsFound`, `ambiguousOrganizations`, `companiesPromotedToRegistry`, `clientsExcludedFromCompanies`, `requiredCompanyAssertions`, and `warnings`.
- Corrected the Companies baseline so employer/studio source classifications become Companies, while client-only names remain client/provenance and are excluded from the Company/Studio selector.
- Rebuilt the source-derived baselines as 9 Companies, 6 platforms/software records, 9 employment positions, and 16 protected public project records.
- Preserved Riley Consulting on the Cue Roadhouse project as client/provenance text only and removed it from Companies/company selector data because the source treatment is client-only for this correction.
- Enforced Fleetwood Australia and GHD guardrails: if either appears in employment source data, the completeness test fails unless the matching Companies record exists.
- Enforced position company links so every employment position has a `companyId` that resolves to the Companies registry.
- Stopped project records from auto-promoting unknown `studio`/company labels into Companies during Admin fallback seeding; source-derived Companies remain the selector authority.
- Normalized legacy project software labels such as `AutoCAD`, `Revit`, and `Sketchup` to audited platform registry IDs without adding duplicate runtime platform rows.
- Restored Projects table row-open behavior by keeping `data-project-row-id` on rendered project rows while preserving interactive-control exclusions.
- Added display-only Admin asset preview URL resolution so stored public project paths remain unchanged while local/Admin previews render from copied `public/media` and `public/docs` files.
- Updated `tests/source-audit-completeness.test.mjs` to fail when audited companies, platforms, positions, project relationships, required routes/nav entries, copied asset catalog paths, employer company links, Fleetwood/GHD guardrails, or client-only exclusion rules drift from generated Admin baselines.
- MCP/browser validation ran against local static preview `http://127.0.0.1:4176/`: `#/companies`, `#/positions`, and `#/projects` loaded without blank-page failures, Fleetwood/GHD were visible and searchable when source-derived, Riley Consulting was not visible as a Company, and the Projects company selector followed the corrected registry.
- Alerts rule editor remains removed/disabled and is not restored as a normal nav item.
- OAuth users are still not auto-promoted.
- Manual env-backed admin access remains preserved.
- DanielClancy public website was read-only for this repair; no CV/employment/company/client/software facts were invented.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Admin now has corrected source-derived Companies, Platforms, and Positions registries instead of client-promoted scaffold data.
- Projects editor selectors use the corrected company and platform registries, support multiple platforms, and open from row clicks without hijacking buttons, inputs, checkboxes, links, or resize controls.
- Riley Consulting remains preserved as client/provenance text where sourced, but it is not a Company/Studio option.
- Fleetwood Australia and GHD are protected by source-audit hard-fail tests because both are employment-source companies.
- Company logos render as current-color masks, software logos stay full color, and project asset previews load from Admin-local copied preview files.

### Files / Areas Changed

- `assets/data/admin-companies-baseline.json`
- `assets/data/admin-platforms-baseline.json`
- `assets/data/admin-positions-baseline.json`
- `assets/data/public-projects-baseline.json`
- `assets/data/source-audit-report.json`
- `assets/js/admin-app.js`
- `tests/source-audit-completeness.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Ran `node --check assets/js/admin-app.js`.
- Ran `node --check assets/js/admin-auth.js`.
- Ran `node --test tests/alerts-disabled.test.mjs tests/source-audit-completeness.test.mjs`.
- Ran `git diff --check`; only Git line-ending normalization warnings were reported.
- Ran `npm run check --if-present` and `npm run build --if-present`; both exited cleanly with no scripts configured.
- Ran MCP/Playwright browser validation against a local static preview on `http://127.0.0.1:4176/` using the local scaffold unlock. The final pass verified `#/companies`, `#/positions`, and `#/projects` rendered nonblank, Companies included/search-found Fleetwood Australia and GHD, Companies excluded/search-excluded client-only Riley Consulting, Positions rendered 9 source-derived rows whose companies exist in Companies, the Projects editor company selector included Fleetwood Australia and GHD, and the selector excluded Riley Consulting. Static preview reported expected API 404s for unavailable local Pages Functions; no unexpected page/runtime console errors were reported.

### Risks / Follow-Ups

- The audit preserves missing/ambiguous source fields as blank values plus provenance instead of inventing facts.
- Several source project gallery/document page filenames exist as source references but are not all copied as standalone local preview images; the completeness guard verifies copied asset catalog paths that are present in Admin preview folders.
- Production KV/R2 behavior still depends on deployed Cloudflare bindings and should be rechecked after deployment.

## Admin Shell, Assets, Registries, Positions, And Analytics Polish Milestone

### Technical Notes

- Hotfixed Admin shell startup so Positions seed data is loaded after `CV_POSITION_SEED` is initialized, preventing the `Cannot access 'CV_POSITION_SEED' before initialization` crash that blocked the entire shell.
- Replaced brittle sidebar/topbar UI icon mask rendering with direct local SVG image rendering plus dark-theme filtering so the icon files visibly paint in the Admin shell.
- Copied DanielClancy public preview assets into matching Admin public paths under `public/media/portfolio/thumbs`, `public/media/portfolio`, and `public/docs`, then regenerated `assets/data/public-asset-catalog.json` from those Admin-local files while retaining `DanielClancy` source metadata.
- Copied public `company-*` and `software-*` SVG logo assets into Admin `assets/logos`.
- Fixed sidebar/topbar icon rendering to use local `assets/icons/ui` SVG images instead of missing or invisible placeholders.
- Moved the topbar loader to the bottom edge of the topbar and matched the StreamSuites-Dashboard purple gradient/motion pattern.
- Split sidebar controls into persisted collapse and hide actions, added a hidden-mode reopen button, kept icon-only collapsed navigation, removed redundant OPEN-style navigation copy, and kept brand subtext as `ADMIN DASHBOARD`.
- Corrected footer/topbar/sidebar shell quality toward StreamSuites-Dashboard behavior without copying StreamSuites branding.
- Kept the topbar user widget/dropdown session-aware with avatar/initials fallback and Accounts, Settings, Public Site, and Logout actions.
- Seeded Companies from the public CV/source employment and project-company data; company logos use `assets/logos/company-*` monochrome SVGs rendered in current UI color.
- Seeded Platforms from the public CV/source software data; software logos use `assets/logos/software-*` full-color SVGs rendered as normal images.
- Added Positions CMS/dashboard route at `#/positions` with `cms:positions`, KV/local fallback, table/filtering, create/edit modal, archive/delete confirmation, company selector, and platform multi-selector.
- Projects editor supports multiple predefined software/platform selections from the Platforms registry and preserves compatibility labels/fields.
- Projects table rows are clickable/focusable and open the editor modal while excluding checkboxes, buttons, links, inputs, dropdowns, resize handles, and other interactive controls.
- Replaced the analytics empty-dot map presentation with a dark internal SVG/grid map-style panel, mapped/unmapped metrics, exact city-coordinate plotting only, and no fake sample dots in live mode.
- Alerts rule editor remains removed/disabled; direct Alerts route remains a non-editable notice only.
- DanielClancy public website was read-only in this task.
- StreamSuites and StreamSuites-Dashboard were read-only references and were not mutated.

### Human-Readable Notes

- Admin editor asset previews now resolve locally because the public preview files exist inside DanielClancy-Admin at the same public paths used by project records.
- Company, software, sidebar, and topbar icons/logos should now be visible on the dark Admin UI with the correct color treatment.
- The dashboard has a proper Positions workspace and a more credible analytics location panel without pretending sample geography is live data.

### Files / Areas Changed

- `index.html`
- `assets/css/admin.css`
- `assets/js/admin-app.js`
- `assets/js/admin-auth.js`
- `assets/data/public-asset-catalog.json`
- `assets/logos/company-*.svg`
- `assets/logos/software-*.svg`
- `functions/api/admin/cms/[[collection]].js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check assets/js/admin-app.js`.
- Run `node --check assets/js/admin-auth.js`.
- Run `node --check functions/api/admin/cms/[[collection]].js`.
- Run focused `node --test` only for existing cheap tests still practical.
- Run `git diff --check`.
- No MCP browser tests, Playwright MCP checks, or rendered browser smoke tests are part of this pass.

### Risks / Follow-Ups

- Public project rendering fixes remain the next task.
- Hosted KV/R2 behavior and real rendered UI confirmation still need deployment/browser verification outside this no-browser pass.
- OAuth users are still not auto-promoted, and manual env-backed admin access remains preserved.

## Projects CMS Usability, Registries, Sidebar, And Profile Editing Milestone

### Technical Notes

- Added generated `assets/data/public-asset-catalog.json` from the current public DanielClancy repo paths for `/public/media/portfolio/thumbs`, `/public/media/portfolio`, and `/public/docs`; no binary public assets were copied.
- Upgraded Projects editor asset controls with current-value display, existing-asset dropdowns, previews, upload buttons, document/PDF support, and a reorderable gallery thumbnail grid with move up/down and remove controls.
- Added Companies and Platforms admin pages backed by the existing CMS API/KV path (`cms:companies`, `cms:platforms`) with local fallback, active/archive status, create/edit modals, logo path selection, and upload controls when `DC_ADMIN_ASSETS_R2` is configured.
- Projects company/studio and software/platform fields now use predefined registry selections only, storing stable IDs plus compatibility labels.
- Added Projects table column resize handles with widths persisted under `danielclancy-admin.projects.table.columns.v1` and a reset action.
- Updated the sidebar to support persisted expanded/collapsed/hidden modes, use SVG icons from `assets/icons/ui`, remove redundant `OPEN` labels, and display `ADMIN DASHBOARD` in the brand subtext.
- Added current-user account profile editing for display name and avatar URL/path through `/api/admin/accounts/profile`; role/status/admin-level changes remain master-admin-only and env-backed master role controls remain locked.
- Expanded `/api/admin/assets/upload` to support image/PDF uploads and structured keys for thumbnails, project images, documents, and account avatars.
- OAuth users are still not auto-promoted.
- Manual env-backed admin access remains preserved.
- Alerts rule editor remains removed/disabled; StreamSuites-Dashboard remains the rule-management surface.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Project editing is now much closer to a usable CMS workflow: pick known public assets, preview selections, reorder gallery images, and choose company/platform values from managed registries instead of free text.
- Admin shell navigation is less cramped and can be collapsed or hidden while retaining icon navigation.
- Account owners can maintain their visible admin profile metadata without changing account authority rules.

### Files / Areas Changed

- `index.html`
- `assets/data/public-asset-catalog.json`
- `assets/js/admin-app.js`
- `assets/js/admin-auth.js`
- `assets/css/admin.css`
- `functions/_shared/admin-accounts.js`
- `functions/api/admin/accounts/[[path]].js`
- `functions/api/admin/assets/upload.js`
- `functions/api/admin/cms/[[collection]].js`
- `.env.example`
- `README.md`
- `BUMP_NOTES.md`

### Validation

- Run `node --check` on changed frontend JS and Pages Function/helper files.
- Run focused `node --test` only if existing cheap tests remain practical.
- Run `git diff --check`.
- No MCP browser tests, Playwright MCP checks, or rendered browser smoke tests are part of this pass.

### Risks / Follow-Ups

- Public site project rendering fixes are the next task.
- Analytics dark map fix is the next task.
- Hosted R2/KV behavior still needs deployment-side verification with real Cloudflare bindings.

## Emergency Auth Turnstile Removal And Alert Geo Context Milestone

### Technical Notes

- Removed Turnstile from admin login/signup/OAuth auth flows; `assets/js/admin-auth.js` no longer renders the auth Turnstile widget, disables sign-in on a Turnstile token, or appends `turnstileToken` to OAuth starts.
- Removed server-side Turnstile verification from manual login, signup scaffold, and OAuth start in `functions/api/auth/[[path]].js`; password/secret comparison and signed session cookies are unchanged.
- Preserved env-backed master admins through `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1` and `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2`.
- Expanded the admin alert sender to forward sanitized Cloudflare request metadata, including host/origin, page/referrer fields, request method, client IP, user agent, browser/device/platform, timezone, colo, `geo.*`, country flag, display/user/account fields, and auth provider.
- Auth, CMS, and page_visit alerts remain event-only and continue stripping rule/configuration/manifest fields before posting to StreamSuites.
- OAuth users are still not auto-promoted, and the Alerts editor remains removed/disabled.

### Human-Readable Notes

- Admin login and OAuth access no longer depend on a fragile Turnstile token lifecycle.
- StreamSuites alert templates can now receive real Cloudflare location/client context from admin auth, CMS, and page visits.

### Files / Areas Changed

- `assets/js/admin-auth.js`
- `functions/_shared/alert-sender.js`
- `functions/api/admin/cms/[[collection]].js`
- `functions/api/auth/[[path]].js`
- `functions/api/track/page-visit.js`
- `README.md`
- `BUMP_NOTES.md`

### Validation

- Run `node --check` on changed frontend JS and Pages Function/helper files.
- Run `git diff --check`.

## Public Analytics Ingest, Live Location Map, And Projects Asset Upload Milestone

### Technical Notes

- Added shared page-visit analytics storage helper for bounded `DC_ADMIN_KV` recent events and rollups at `analytics:page_visits:recent` and `analytics:page_visits:rollup`, capped at 1000 recent events.
- Added unauthenticated-but-secret-protected `POST /api/analytics/ingest/page-visit` for public DanielClancy page visits using `X-DanielClancy-Analytics-Secret` and server-side `DANIELCLANCY_ANALYTICS_INGEST_SECRET`.
- Public/admin page visits now write the same page_visit KV shape with Cloudflare `request.cf` city/region/country/timezone/colo when Cloudflare provides it; raw IP addresses are still not stored.
- Updated Analytics API output so zero page-visit events returns “No page-visit events have been captured yet.” and country-only rows remain `precision: "country"` instead of being represented as fake city rows.
- Replaced the fake sample-dot map panel with a live map-style SVG/CSS panel driven by page_visit KV location rows; only exact known city coordinates are plotted and unknown city coordinates are not invented.
- Added `POST /api/admin/assets/upload` with signed admin-session enforcement, `DC_ADMIN_ASSETS_R2` persistence, image MIME validation, 10MB size limit, structured project asset keys, optional `DC_ADMIN_ASSETS_PUBLIC_BASE_URL`, and honest `storage_not_configured` fallback.
- Added Projects CMS upload controls for hero image, thumbnail, and gallery image paths while preserving manual path editing and appending gallery uploads instead of replacing existing paths.
- Document/PDF path remains manually editable; PDF upload is a follow-up.
- Added `.env.example` entries for `DANIELCLANCY_ANALYTICS_INGEST_SECRET` and `DC_ADMIN_ASSETS_PUBLIC_BASE_URL`, and documented the `DC_ADMIN_ASSETS_R2` binding.
- OAuth users are still not auto-promoted.
- Manual env-backed admin access remains preserved.
- Alerts rule editor remains removed/disabled.
- StreamSuites and StreamSuites-Dashboard were not mutated.
- No MCP browser tests or Playwright MCP checks were run.

### Human-Readable Notes

- Admin Analytics can now accumulate usable city-level rows from real Cloudflare request geo metadata once the public site forwarding secret/URL are configured.
- Empty analytics now shows a real empty state, not sample markers masquerading as live map data.
- Projects editors can upload image assets when R2 is configured, or preview selected files and get a clear storage-not-configured error when it is not.

### Files / Areas Changed

- `.env.example`
- `functions/_shared/analytics-store.js`
- `functions/api/analytics/ingest/page-visit.js`
- `functions/api/admin/analytics.js`
- `functions/api/admin/assets/upload.js`
- `functions/api/track/page-visit.js`
- `assets/js/admin-app.js`
- `assets/css/admin.css`
- `tests/analytics-ingest-and-assets.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation

- Run `node --check` on changed frontend JS and Pages Function/helper files.
- Run `node --test tests/analytics-helpers.test.mjs tests/analytics-ingest-and-assets.test.mjs`.
- Run `git diff --check`.

### Risks / Follow-Ups

- Hosted Cloudflare Pages verification is still required for live `request.cf` geo, KV writes, and R2 writes.
- Public page visits require matching `DANIELCLANCY_ANALYTICS_INGEST_SECRET` and `DANIELCLANCY_ADMIN_ANALYTICS_INGEST_URL` in the public repo environment.
- Unknown city coordinates remain intentionally unplotted until an authoritative coordinate source or explicit lookup expansion is added.
- Document/PDF asset upload remains future work.

## Live Cloudflare Analytics And City Rollup Milestone

### Technical Notes

- Replaced the placeholder-only Analytics API with a Cloudflare Pages-compatible GraphQL query foundation using `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID_DANIELCLANCY`, and `CLOUDFLARE_API_TOKEN_ANALYTICS`.
- The Analytics API now attempts conservative Cloudflare GraphQL sections for totals, top pages, referrers, countries, browsers, devices, and best-effort city rows, with safe per-section error summaries and no secret/token exposure.
- Added bounded `DC_ADMIN_KV` page-visit analytics storage at `analytics:page_visits:recent` and `analytics:page_visits:rollup`.
- Page-visit storage preserves safe request metadata including page path/title/referrer host and Cloudflare `request.cf` country/region/city/timezone/colo fields when available; raw client IP is not stored in analytics KV.
- The combined analytics response prefers page-visit KV city rows, falls back to Cloudflare GraphQL city rows when available, and labels region/country fallback rows without pretending they are city-level data.
- Updated the Analytics UI to show Cloudflare connected/error/missing config state, page-visit KV connected/unavailable state, last checked, source/precision labels, top pages, referrers, and browser/device cards.
- Added the topbar loader strip and authenticated user dropdown with Accounts, Settings, Public Site, and Logout actions.
- Updated `.env.example` to keep analytics env var names without sample secret/token values.
- OAuth users are still not auto-promoted.
- Manual env-backed admin access remains preserved.
- Turnstile remains preserved.
- Alerts rule editor remains removed/disabled.
- StreamSuites repos and StreamSuites-Dashboard were not mutated.
- No MCP browser tests or Playwright MCP checks were run; validation stayed to cheap static and mocked checks.

### Human-Readable Notes

- Analytics no longer gets stuck as scaffold-only when the three Cloudflare analytics vars are configured.
- City detail is reported only when real page-visit request geo metadata or a supported Cloudflare dataset provides it.
- Country-only rows are labelled as country precision, and the UI says “City detail unavailable from current data source” when city data is missing.
- Sample fallback rows remain clearly labelled and are not presented as real visitor counts.

### Files / Areas Changed

- `.env.example`
- `index.html`
- `assets/css/admin.css`
- `assets/js/admin-auth.js`
- `assets/js/admin-app.js`
- `functions/api/admin/analytics.js`
- `functions/api/track/page-visit.js`
- `tests/analytics-helpers.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation

- Run `node --check` on changed frontend JS and Pages Function files.
- Run `node --test tests/analytics-helpers.test.mjs`.
- Run `git diff --check`.

### Risks / Follow-Ups

- Hosted Cloudflare Pages verification is still required to confirm the configured token can access the DanielClancy zone analytics datasets.
- Cloudflare GraphQL city dimensions may not be available for every account/plan/dataset; page-visit KV request geo remains the primary city-detail source.
- Public-site page visits currently send path/title/referrer to their own endpoint; cross-surface public city rollup requires hosted routing/storage alignment if public events must land in the Admin KV namespace.

## Emergency Alert Rule Isolation Guard

### Technical Notes

- Removed the Alerts rule editor from the main navigation and replaced direct `#/alerts` visits with a non-editable notice: “Alert rules are managed in StreamSuites-Dashboard only.”
- Disabled the reachable create/edit/delete/bulk/import/reset/copy/sync rule-management controls by removing them from the Alerts route render path.
- Hardened the shared alert sender so event payload/context objects recursively strip rule-definition manifest/configuration fields before posting to StreamSuites ingest.
- DanielClancy-Admin may leave existing `cms:alerts` / `danielclancy-admin.alerts.scaffold.v1` data untouched, but the UI no longer surfaces an editor or sync/export controls for it.
- Kept `page_visit` alert type support available for DanielClancy public/admin page visit events.

### Human-Readable Notes

- DanielClancy-Admin sends alert events only when the ingest URL/secret are configured.
- DanielClancy-Admin cannot manage, sync, export, replace, or overwrite StreamSuites canonical alert rule definitions.
- StreamSuites rule management remains authoritative in StreamSuites and StreamSuites-Dashboard.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `functions/_shared/alert-sender.js`
- `tests/alerts-disabled.test.mjs`
- `README.md`
- `BUMP_NOTES.md`

### Validation

- Run `node --check` on changed frontend JS and Pages Function/helper files.
- Run `node --test tests/alerts-disabled.test.mjs`.
- Run `git diff --check`.

## Emergency Turnstile Reliability And Live Alert Sender Wiring

### Technical Notes

- Stabilized the admin Turnstile controller with token issue timestamps, per-controller reset/remove handling, and compact user-facing states.
- Updated the admin auth gate so submit-time status updates do not rebuild the whole gate, which preserves the active widget and typed email/password values during retry paths.
- Kept manual email/password collapsed by default and preserved OAuth callback behavior without Turnstile gating.
- Added shared Cloudflare Pages alert sender helper using server-only `DANIELCLANCY_ALERT_INGEST_URL` and `DANIELCLANCY_ALERT_INGEST_SECRET`.
- Wired successful manual admin login to `auth_admin_login` alerts and successful OAuth callbacks to `auth_oauth_login` alerts; OAuth users remain regular/non-admin unless explicitly promoted by authority.
- Wired successful Projects, Media, and Alerts CMS saves to `project_cms_update`, `media_cms_update`, and `alerts_cms_update` alerts with safe metadata only.
- Added `/api/track/page-visit` and route-deduped authenticated admin page visit posting for `page_visit` alerts.
- Expanded `/api/admin/status` and Overview readiness cards to report alert bridge URL/secret configured/missing status without exposing values.
- Updated `.env.example` and README docs for ingest URL/secret generation and non-blocking alert delivery.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- The admin login gate should no longer uncheck/reset Turnstile during normal login/OAuth attempts or status updates.
- Admin auth, CMS save, and page visit alerts now post to the StreamSuites ingest route when configured.
- Alert sender failures are logged server-side and do not block login, CMS saves, or navigation.

### Files / Areas Changed

- `.env.example`
- `README.md`
- `assets/js/admin-auth.js`
- `assets/js/admin-app.js`
- `assets/js/turnstile.js`
- `functions/_shared/alert-sender.js`
- `functions/api/admin/cms/[[collection]].js`
- `functions/api/admin/status.js`
- `functions/api/auth/[[path]].js`
- `functions/api/track/page-visit.js`
- `BUMP_NOTES.md`

### Validation

- Run `node --check` on changed frontend JS and Pages Function/helper files.
- Run `git diff --check`.

### Follow-Ups

- Hosted Cloudflare Pages testing should confirm the configured alert ingest URL reaches the intended StreamSuites runtime/API host.
- Hosted OAuth provider callbacks still depend on provider app/env/callback configuration.

## Analytics Foundation And Page Visit Alerts Milestone

### Technical Notes

- Added admin-session-protected `GET /api/admin/analytics` as a Cloudflare Pages-compatible analytics readiness endpoint.
- The analytics endpoint returns `configured`, `source`, site/admin origin details, empty live metric panel placeholders, map placeholder status, `lastChecked`, and required/missing Cloudflare Analytics env var names without exposing values.
- Analytics UI now hydrates from `/api/admin/analytics` when available and clearly reports `Cloudflare analytics not configured` instead of inventing live page-view, referrer, country, region, or map numbers.
- Existing scaffold/sample analytics cards remain available only as labelled fallback/demo data.
- Added `page_visit` / Page visit trigger support to the DanielClancy-Admin Alerts selector and exported alert rule contract.
- Page-visit rules can carry optional page path and exact/starts_with/contains match type fields while preserving existing localStorage/KV CMS alert behavior.
- Existing auth, manual env-backed master admin access, OAuth non-admin behavior, Turnstile checks, account registry, Projects, Media, and Alerts CMS storage behavior remain intact.
- No MCP browser tests or Playwright MCP checks were run; validation stayed to cheap static checks.

### Human-Readable Notes

- Analytics now has an operational status foundation for future Cloudflare wiring, but it still refuses to present fake live metrics when the Cloudflare Analytics env vars are missing.
- DanielClancy alert planning can now define page visit rules using the stable `triggerType: "page_visit"` contract.
- Live page visit alert delivery still needs sender/tracking event wiring into the StreamSuites runtime ingest path.

### Files / Areas Changed

- `functions/api/admin/analytics.js`
- `assets/js/admin-app.js`
- `assets/js/scaffold-data.js`
- `README.md`
- `BUMP_NOTES.md`

### Validation

- Run `node --check assets/js/admin-app.js`, `node --check assets/js/scaffold-data.js`, and `node --check functions/api/admin/analytics.js`.
- Run `git diff --check`.

### Follow-Ups

- Wire and test the Cloudflare Analytics API query path only after `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID_DANIELCLANCY`, and `CLOUDFLARE_API_TOKEN_ANALYTICS` are provisioned.
- Add the actual DanielClancy page visit sender/tracking event path before treating page visit alerts as live.

## Operational Accounts, Settings, And Overview Hydration Milestone

### Technical Notes

- Added shared Pages Function account/session helpers for signed cookie reading, env-backed master admin synthesis, durable KV account registry access, OAuth account registration, and admin/master authorization checks.
- `DC_ADMIN_KV` now backs the durable account role registry at key `accounts:registry`.
- Env-backed manual master admins remain protected, locked, and synthesized at runtime from `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1` and `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2`.
- OAuth callback handling now registers known OAuth accounts as `regular` accounts by default when `DC_ADMIN_KV` is available.
- OAuth users are still not auto-promoted to admin.
- No passwords, OAuth access tokens, or OAuth refresh tokens are stored in KV.
- Added `/api/admin/accounts` read and master-only promote/demote/enable/disable/update endpoints.
- Added `/api/admin/status` so Overview can hydrate signed-in admin, account registry, CMS storage, public baseline, Turnstile, OAuth provider, and alert ingest-secret presence status without exposing secrets.
- Updated CMS admin checks to resolve roles through env masters and the KV account registry instead of trusting only the raw session payload.
- Accounts page can hydrate/manage roles through the admin API.
- Settings account-access section now reflects the real registry status, current role source, Turnstile posture, and alert-secret handling.
- Overview page now shows operational status from APIs.
- Existing Projects/Media/Alerts KV CMS behavior remains intact.
- Turnstile auth protection remains intact.
- Manual email/password remains collapsed by default in the auth gate.
- Public site publishing/hydration remains future work.
- Alert posting from DanielClancy/Admin to StreamSuites remains future work unless implemented elsewhere.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- The admin dashboard now has the durable account foundation needed after OAuth login succeeds.
- Master admins can review known OAuth accounts and promote/demote/enable/disable them from the Accounts UI.
- Regular OAuth users remain blocked from the admin dashboard until explicitly promoted by a master admin.
- Settings and Overview now report real operational readiness instead of presenting account access as a local-only scaffold.

### Files / Areas Changed

- `.env.example`
- `assets/css/admin.css`
- `assets/js/admin-app.js`
- `functions/_shared/admin-accounts.js`
- `functions/api/admin/accounts/[[path]].js`
- `functions/api/admin/cms/[[collection]].js`
- `functions/api/admin/status.js`
- `functions/api/auth/[[path]].js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check` on changed frontend JS and Pages Function files.
- Run `git diff --check`.
- Package scripts are not available in this repo yet; validation is syntax/check focused unless served through a Pages-compatible runtime with `DC_ADMIN_KV`.
- Cloudflare KV behavior still needs hosted/Pages-compatible smoke testing with real bindings.

### Risks / Follow-Ups

- Live OAuth profile/token exchange requires provider env vars and redirect URIs to be configured in Cloudflare Pages.
- Live registry persistence requires `DC_ADMIN_KV` in the Pages environment.
- Public-site publishing/hydration from admin CMS storage remains future work.
- Alert event posting to the StreamSuites runtime remains future work.

## Alerts Runtime Contract Compatibility

### Technical Notes

- Normalized the local Alerts scaffold target contract from the older `desktop` label to the StreamSuites runtime destination name `windows_client`, while still accepting legacy stored/imported `desktop` rows as an alias.
- Updated the exported DanielClancy alert contract target list to `windows_client` and `pushover`.
- Kept the existing localStorage/KV scaffold behavior intact; this does not make DanielClancy-Admin write live StreamSuites runtime rules or send alerts.

### Human-Readable Notes

- DanielClancy-Admin alert exports now line up with the StreamSuites alert delivery contract for the desktop alerts client.
- Live delivery still requires the StreamSuites runtime ingest bridge, hosted env setup, and signed event posting.

## Turnstile admin auth protection milestone

### Technical Notes

- Added a Cloudflare Pages-compatible Turnstile Siteverify helper at `functions/_shared/turnstile.js`.
- Added `/api/turnstile/config` so the auth gate can fetch `DC_TURNSTILE_SITE_KEY` without exposing `DC_TURNSTILE_SECRET_KEY`.
- Added `assets/js/turnstile.js` as a small explicit-rendering helper for the static admin auth gate.
- Added Turnstile to the admin auth gate/login/signup UI while preserving `assets/logos/logo.webp`, local OAuth provider icons, sign in/create account toggle, and collapsed manual email/password by default.
- Manual email/password login now verifies Turnstile server-side before checking env-backed credentials.
- Email signup scaffold now verifies Turnstile server-side before returning the durable-account-store-required response.
- OAuth start flows now require a Turnstile token and verify it server-side before redirecting to GitHub, Google, or Twitter/X. OAuth callbacks are not Turnstile-gated.
- CMS endpoints remain signed-session protected and were not Turnstile-gated or given widgets inside operational admin pages.
- Added `DC_TURNSTILE_SITE_KEY`, `DC_TURNSTILE_SECRET_KEY`, and `DC_TURNSTILE_DEV_BYPASS=false` to `.env.example`.
- Turnstile secret remains server-only.
- Existing manual env-backed admin auth is preserved.
- OAuth users are still not auto-promoted to admin.
- StreamSuites and StreamSuites-Dashboard were not mutated.
- Alert delivery bridge remains the next separate task.

### Human-Readable Notes

- The admin gate now requires a real server-verified anti-abuse challenge before protected auth actions.
- Already-authenticated admin sessions can still view the dashboard without solving Turnstile again.
- Local static/file views can show Turnstile unavailable until Pages Functions and env bindings are available; local scaffold unlock remains only for UI smoke testing.

### Files / Areas Changed

- `.env.example`
- `assets/css/admin.css`
- `assets/js/admin-auth.js`
- `assets/js/turnstile.js`
- `functions/_shared/turnstile.js`
- `functions/api/auth/[[path]].js`
- `functions/api/turnstile/config.js`
- `index.html`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check functions/api/auth/[[path]].js`, `node --check functions/_shared/turnstile.js`, `node --check functions/api/turnstile/config.js`, `node --check assets/js/turnstile.js`, `node --check assets/js/admin-auth.js`, and `git diff --check`.
- Smoke test auth gate render, Turnstile container, collapsed email/password expansion, OAuth button presence/start gating, local/static unavailable messaging, local scaffold unlock, `#/overview`, `#/projects`, `#/media`, `#/alerts`, and mobile sanity.

### Risks / Follow-Ups

- Live Turnstile verification requires the Cloudflare Pages deployment to have matching `DC_TURNSTILE_SITE_KEY` and `DC_TURNSTILE_SECRET_KEY` values.
- Hosted OAuth start and callback testing still depends on provider app/env/callback configuration.

## Projects Public Baseline And KV Overlay Safety Milestone

### Technical Notes

- Added `assets/data/public-projects-baseline.json`, generated from the public DanielClancy repo's WorkSet-derived portfolio pipeline.
- Updated `functions/api/admin/cms/[[collection]].js` so `projects` loads the protected public baseline before KV and returns a merged `baseline_plus_kv` result with `baselineCount`, `kvCount`, `mergedCount`, `baselineProtected`, and `partialKvMerged` metadata.
- Legacy Projects KV shapes remain readable, including bare arrays, wrapper objects with `items`, and the previous partial three-row scaffold data.
- Projects PUT now stores a `baseline_overlay` wrapper and rejects unsafe saves that omit protected baseline records unless hiding is explicit.
- Updated Projects UI/local fallback so baseline records are merged with local/admin overlay data, imports are treated as overlays when partial, reconcile saves a safe merged wrapper, and baseline deletes become archived/hidden soft-delete actions.
- Media and Alerts behavior is not the focus of this fix and remains on the existing scaffold/KV/local fallback path.
- Manual env-backed admin access remains preserved.
- OAuth users are still not auto-promoted to admin.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Projects CMS now treats the existing DanielClancy public-site projects as a protected baseline.
- Partial KV/scaffold data no longer replaces the full project list or collapses Projects to the old small seed.
- Existing public baseline records are protected from hard delete; deleting a baseline row archives/hides it through admin overlay metadata.
- KV now acts as overlay/reconciled admin storage for Projects.
- Public-site publishing/hydration from DanielClancy-Admin remains future work.

### Files / Areas Changed

- `assets/data/public-projects-baseline.json`
- `functions/api/admin/cms/[[collection]].js`
- `assets/js/admin-app.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check functions/api/admin/cms/[[collection]].js` and `node --check assets/js/admin-app.js`.
- Run `node --check assets/js/scaffold-data.js` to confirm unchanged scaffold data still parses.
- Run `git diff --check`.
- Validate by inspection that the generated public baseline has 16 projects, which is greater than the previous three-row scaffold/KV sample.
- Validate by inspection that Projects GET cannot return only partial KV rows when the baseline asset exists, baseline deletes become archive/hidden updates, and admin-created rows can still be hard-deleted.

### Risks / Follow-Ups

- Hosted Cloudflare Pages verification should confirm the `ASSETS` binding serves `assets/data/public-projects-baseline.json` to the Pages Function.
- The public DanielClancy.net publishing/hydration bridge remains future work.
- If the public portfolio source changes, regenerate the admin baseline snapshot from the public repo before relying on it as current.

## Admin CMS API, Hydration, And Auth UI Polish Milestone

### Technical Notes

- Added a Cloudflare Pages Functions admin CMS API at `functions/api/admin/cms/[[collection]].js` for `projects`, `media`, and `alerts`.
- The CMS API requires the existing signed admin session cookie, rejects unauthenticated requests, rejects authenticated non-admin users, allowlists collection names, validates JSON row shape, and uses safe error codes.
- Added first production storage contract around Cloudflare KV binding `DC_ADMIN_KV` with keys `cms:projects`, `cms:media`, and `cms:alerts`.
- Wired Projects, Media, and Alerts to attempt API hydration/save through `/api/admin/cms/<collection>` and to keep the existing localStorage scaffold fallback when Pages Functions, auth, or KV storage are unavailable.
- Added per-page admin storage status/sync UI for connected, not configured, saving/checking, and local browser fallback states.
- Kept existing table editors, create/edit/detail modals, bulk editing, JSON copy/import/reset controls, and local persistence fallback behavior intact.
- Updated the admin auth gate top mark to `assets/logos/logo.webp`, removed internal setup copy from the surfaced login UI, and kept manual email/password collapsed by default.
- Preserved manual env-backed master admins and did not auto-promote OAuth users to admin.
- StreamSuites and StreamSuites-Dashboard were not mutated.

### Human-Readable Notes

- Projects, Media, and Alerts now start behaving like operational admin pages when the hosted admin session and `DC_ADMIN_KV` binding are available.
- Static/local views still work in local browser fallback mode and do not lose the existing scaffold workflows.
- The login gate now uses the requested DanielClancy logo and avoids exposing setup notes to users.
- Durable account-role storage remains future work.
- Next step after this is Cloudflare KV binding setup and live CMS save/load verification.

### Files / Areas Changed

- `.env.example`
- `functions/api/admin/cms/[[collection]].js`
- `assets/css/admin.css`
- `assets/js/admin-auth.js`
- `assets/js/admin-app.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check functions/api/admin/cms/[[collection]].js`, `node --check functions/api/auth/[[path]].js`, `node --check assets/js/admin-auth.js`, `node --check assets/js/admin-app.js`, `node --check assets/js/scaffold-data.js`, and `git diff --check`.
- Static-server smoke should verify auth gate logo/copy, collapsed manual email/password, local scaffold unlock, Projects/Media/Alerts fallback status, create/edit/save fallback, Overview/Settings loading, and mobile sanity.
- Hosted/Pages-compatible smoke is still required after `DC_ADMIN_KV` is configured.

### Risks / Follow-Ups

- `DC_ADMIN_KV` is required for production CMS persistence and is not claimed configured live by this repo update.
- Durable account-role storage remains future work.
- The CMS API currently duplicates the smallest signed-session verification logic from the auth function; a future cleanup can extract shared helpers once the Pages Functions deployment shape is proven.

## Auth UX polish and signup scaffold milestone

### Technical Notes

- Rebuilt the admin auth gate presentation with a DC mark, OAuth-first provider actions, a sign in/create account toggle, and a collapsed manual email/password section.
- Added local GitHub, Google, and Twitter/X icon usage for OAuth buttons from existing repo assets.
- Preserved manual env-backed master admin login as the immediate production admin path through `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1` and `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2`.
- Added `/api/auth/signup` as an honest scaffold endpoint that returns `durable_account_store_required`; it does not persist accounts or passwords.
- Kept OAuth sessions non-admin unless explicit future allowlist/promotion work exists. OAuth live env setup has been completed externally enough for provider flows to redirect, but durable account-role storage remains future work.
- Clarified Settings account-access copy so env-backed manual admins are production-authoritative and OAuth/public account rows are local scaffold only until durable role storage exists.

### Human-Readable Notes

- The login gate now looks like a finished DanielClancy-Admin access screen.
- Manual email/password admin login is collapsed by default and can be expanded when needed.
- OAuth non-admin users should see a clean admin-access-required state rather than a confusing login loop.
- Signup UI is scaffolded honestly: OAuth is the preferred route for now, and email signup explains the missing durable store.
- The next planned phase is making scaffolded admin pages operational/hydrated.

### Files / Areas Changed

- `functions/api/auth/[[path]].js`
- `assets/css/admin.css`
- `assets/js/admin-auth.js`
- `assets/js/admin-app.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check functions/api/auth/[[path]].js`, `node --check assets/js/admin-auth.js`, `node --check assets/js/admin-app.js`, and `git diff --check`.
- Smoke test auth gate render, OAuth button URLs, manual email expansion, signup limitation messaging, OAuth/non-admin denied messaging, local scaffold unlock, and existing `#/overview`, `#/projects`, `#/media`, and `#/alerts` route loading after local scaffold unlock.

### Risks / Follow-Ups

- Durable account store remains future work.
- OAuth admin promotion remains future explicit allowlist/durable-role work and must not be inferred from display names, provider usernames, or emails without server-side authority.
- Settings account-access rows remain local scaffold records only.

## Alerts Page And DanielClancy Alert Catchment Scaffold

### Technical Notes

- Enabled the Alerts navigation entry and added the `#/alerts` route in the static admin shell.
- Added a table-style Alerts scaffold with search/filtering, status cards, select-all/row selection, bulk enable/disable, bulk severity, bulk target channel, bulk tag add/remove, and confirmed bulk delete.
- Added a lightbox create/edit/detail modal with rule name and rule id/code validation, Escape/close handling, desktop/Pushover routing controls, and DanielClancy source domain controls.
- Added localStorage persistence under `danielclancy-admin.alerts.scaffold.v1`, repo seed rows, reset/reseed confirmation, JSON import, and JSON contract export for future bridge review.
- The exported contract identifies `project=DanielClancy`, `source_namespace=danielclancy`, `https://danielclancy.net`, `https://admin.danielclancy.net`, desktop/Pushover targets, and local scaffold rules.
- Existing StreamSuites alert behavior must remain preserved; this admin page does not write StreamSuites runtime alert rules or send Pushover notifications.

### Human-Readable Notes

- DanielClancy-Admin now has an Alerts CMS-style workspace for planning DanielClancy.net and admin.danielclancy.net alert rules.
- The page is explicitly local/scaffold-only until a safe StreamSuites/runtime export or API bridge is connected.
- Live desktop alert delivery and Pushover routing require runtime/env/config setup outside this local scaffold.
- Cloudflare Pages/DNS setup for `admin.danielclancy.net` is now due before live hosted/OAuth/admin testing.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `assets/js/scaffold-data.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check assets/js/admin-app.js` and `node --check assets/js/scaffold-data.js`.
- Run `git diff --check`.
- `package.json` exists only for module syntax parsing and has no npm lint/typecheck/build scripts yet.
- Smoke test `#/alerts`, create/edit/detail modal, bulk enable/disable/severity/target/tag/delete, localStorage reload, reset/reseed confirmation, JSON export/import, mobile viewport sanity, and existing `#/projects` / `#/media` routes.

### Risks / Follow-Ups

- Alerts CMS is local/scaffold unless a safe live bridge is implemented.
- Pushover live routing requires env/config setup if not already present.
- Cloudflare Pages project, `admin.danielclancy.net` custom domain/DNS, Cloudflare env vars, OAuth app setup, OAuth redirect URIs, and hosted dashboard confirmation are required before live OAuth callbacks or live admin testing.

## Auth/login foundation milestone

### Technical Notes

- Added Cloudflare Pages-compatible auth endpoints at `functions/api/auth/[[path]].js` for session, login, logout, and OAuth start/callback scaffolds.
- Manual email/password master admin login compares `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1` and `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2` server-side only, then issues an HMAC-signed HttpOnly session cookie using `DC_AUTH_SESSION_SECRET`.
- Added the admin session gate in `assets/js/admin-auth.js`; unauthenticated users see login, non-admin sessions see an admin-required state, and verified admin sessions can view dashboard routes.
- Added a clearly labelled local scaffold unlock for file/localhost/Pages-preview smoke testing only. It is not a production credential.
- Added Settings account-access scaffold storage under `danielclancy-admin.accounts.scaffold.v1`.
- Updated Accounts scaffold rows with account type/provider/identifier fields for consistency.
- Documented OAuth env vars, callback URIs, future allowlist vars, and the Cloudflare setup checkpoint.

### Human-Readable Notes

- DanielClancy-Admin now has an admin login/session gate instead of an always-open static shell.
- Manual email/password env-backed master admin accounts are the first production admin path:
  - `mail@danielclancy.net` via `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1`
  - `daniel@brainstream.media` via `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2`
- OAuth login methods require Cloudflare env vars and provider redirect URI setup before live testing.
- OAuth users are not automatically master admins unless explicitly allowlisted or promoted through the future durable account-role system.
- Public session-aware content remains future work.
- Alerts page is now covered by a local scaffold workspace; live StreamSuites/runtime delivery remains future work.
- Cloudflare Pages/DNS setup checkpoint is now approaching and should be completed before real OAuth production testing.

### Files / Areas Changed

- `.env.example`
- `index.html`
- `package.json`
- `functions/api/auth/[[path]].js`
- `assets/css/admin.css`
- `assets/js/admin-auth.js`
- `assets/js/admin-app.js`
- `assets/js/scaffold-data.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing / Validation Notes

- Run `node --check functions/api/auth/[[path]].js`, `node --check assets/js/admin-auth.js`, `node --check assets/js/scaffold-data.js`, and `node --check assets/js/admin-app.js`.
- Run `git diff --check`.
- `package.json` exists only for module syntax parsing and has no npm lint/typecheck/build scripts yet.
- Smoke test unauthenticated gate, local scaffold unlock, Settings account-access scaffold, OAuth button URLs, and mobile viewport sanity.

### Risks / Follow-Ups

- Live OAuth cannot be verified until Cloudflare Pages, DNS/custom domain, provider OAuth apps, callback URLs, and env vars are configured.
- The Settings account-type controls are local scaffold storage only and are not production account authority.
- Durable account-role persistence requires a future backend/export/storage layer.

## Media CMS Local Scaffold

### Technical Notes

- Enabled the Media navigation entry and added the `#/media` route to the existing static hash-router shell while leaving Projects enabled.
- Added a table-style Media CMS scaffold with search, status filtering, platform filtering, local field-completeness filtering, row selection, detail/edit/delete actions, and media count/status cards.
- Added a Media lightbox editor modal for create, edit, and detail review flows with required title and slug/id validation.
- Added local bulk editing controls for selected media rows: status/visibility posture through status, platform, featured flag, add tag, remove tag, and confirmed bulk delete.
- Added localStorage persistence under `danielclancy-admin.media.scaffold.v1`, plus confirmed reseed/reset, JSON copy, and validated JSON import controls.
- Seed media rows are clearly fake scaffold rows aligned where practical to the current public `/watch` feed shape: id/slug, title, provider/platform, thumbnail path, embed URL, video URL, published date, summary/excerpt, and description. The scaffold also includes future livestream/replay fields.
- Media health is local field completeness only. It checks for missing title, slug/id, thumbnail, embed/video URL, archived livestream replay URL, scheduled stream date, tags, and draft/hidden status. It does not perform network checks or claim external link/feed verification.
- The public site `/watch` schema is only partially admin-ready because the public repo currently hydrates from a server-side YouTube feed rather than a local CMS export. The admin scaffold preserves a flexible schema until a real API/export contract is designed.

### Human-Readable Notes

- Media can now be planned in a polished admin UI scaffold for future DanielClancy.net `/watch` page management.
- Saves are local to the browser and do not publish to DanielClancy.net.
- The page is intentionally clear that StreamSuites profile embedding, YouTube/Rumble/external feed integration, public login/admin entry wiring, and real API/export wiring remain future work.

### Files / Areas Changed

- `index.html`
- `assets/css/admin.css`
- `assets/js/admin-app.js`
- `assets/js/scaffold-data.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing Notes

- Run `node --check assets/js/scaffold-data.js` and `node --check assets/js/admin-app.js`.
- Run `git diff --check`.
- No `package.json` exists in this repo, so npm lint/typecheck/build checks are unavailable unless a package workflow is added later.
- Perform a local static-server smoke check for `#/media`, create modal, edit modal, bulk status/platform/featured/tag controls, localStorage reload behavior, reset/reseed confirmation, and mobile viewport sanity.

### Risks / Follow-Ups

- Media CMS is scaffold/local-persistence only.
- It does not publish to DanielClancy.net yet.
- StreamSuites profile/media integration remains future work.
- YouTube/Rumble/external feed integration remains future work.
- Public login/admin entry wiring remains future work.
- Cloudflare Pages/DNS setup for `admin.danielclancy.net` remains a later checkpoint after Media CMS and public login/admin wiring are ready for production testing.

## Projects CMS Local Scaffold

### Technical Notes

- Enabled the Projects navigation entry and added the `#/projects` route to the existing static hash-router shell.
- Added a table-style Projects CMS scaffold with search, status filtering, local asset-completeness filtering, row selection, detail/edit/delete actions, and local project count/status cards.
- Added a reusable lightbox editor modal for create, edit, and detail review flows with required title and slug/id validation.
- Added local bulk editing controls for selected projects: status, featured flag, add tag, remove tag, and confirmed bulk delete.
- Added localStorage persistence under `danielclancy-admin.projects.scaffold.v1`, plus confirmed reseed/reset, JSON copy, and validated JSON import controls.
- Seed project rows are aligned to the public site's current WorkSet-derived portfolio shape where practical: slug/id, title, client, category/discipline, year/date, featured flag, image paths, gallery/source file names, document file names, live detail route, tags, studio, software, source folder, source confidence, and internal notes.
- Asset health is local field completeness only. It checks for empty image, document, gallery/source, live/detail link, and draft/hidden metadata fields; it does not perform network checks or claim external link/file verification.

### Human-Readable Notes

- Projects can now be managed in a polished admin UI scaffold for planning and QA of DanielClancy.net portfolio records.
- Saves are local to the browser and do not publish to DanielClancy.net.
- The page is intentionally clear that this is scaffold/local persistence until a real API or export pipeline exists.

### Files / Areas Changed

- `index.html`
- `assets/css/admin.css`
- `assets/js/admin-app.js`
- `assets/js/scaffold-data.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing Notes

- Run `node --check assets/js/scaffold-data.js` and `node --check assets/js/admin-app.js`.
- Run `git diff --check`.
- No `package.json` exists in this repo, so npm lint/typecheck/build checks are unavailable unless a package workflow is added later.
- Perform a local static-server smoke check for `#/projects`, create modal, edit modal, bulk controls, local persistence reload behavior, and mobile viewport sanity.

### Risks / Follow-Ups

- Projects CMS is scaffold/local-persistence only.
- Real API/export pipeline remains future work.
- Public DanielClancy project data integration remains future work; this task only seeded local scaffold rows aligned to the observed public WorkSet-derived shape.
- Media CMS remains future work.
- Public login/admin entry wiring remains future work.
- Cloudflare Pages/DNS setup for `admin.danielclancy.net` remains a later checkpoint after Projects CMS, Media CMS, and login/admin entry wiring are ready for production testing.

## Version Baseline Correction

### Technical Notes

- Corrected the prior unknown/dashboard-foundation placeholder milestone to the shared DanielClancy project baseline: `CURRENT VER= v0.1.2-beta / PENDING VER= v1.0`.
- Kept the existing dashboard foundation milestone details intact under the corrected version heading.
- StreamSuites and StreamSuites-Dashboard follow their own separate version formats and must not be altered as part of DanielClancy versioning.
- Cloudflare Pages/DNS setup for `admin.danielclancy.net` should be completed after the admin dashboard has the Projects CMS scaffold, Media CMS scaffold, and public-site login/admin entry wiring ready for production testing. It does not need to interrupt the current local dashboard build yet.

### Human-Readable Notes

- DanielClancy-Admin is now filed under the same version baseline as the public DanielClancy site.
- The Cloudflare admin deployment checkpoint remains documented as a later readiness step, not completed in this task.

### Files / Areas Changed

- `BUMP_NOTES.md`

### Testing Notes

- Documentation-only correction; no runtime code or package scripts were changed.
- `git diff --check` should be run for this repo after the edit.

### Risks / Follow-Ups

- Projects CMS remains a future task.
- Media CMS remains a future task.
- Public-site login/admin entry wiring remains a future task.
- Cloudflare Pages/DNS setup remains deferred until the dashboard is ready for production testing.

## Dashboard Foundation

### Technical Notes

- Added a static, Cloudflare Pages-compatible dashboard shell for `admin.danielclancy.net`.
- Added client-side routing for Overview, Analytics, Accounts, Account Detail, and Settings.
- Added scaffold-only data modules for placeholder analytics, account, readiness, and settings content.
- Added a Cloudflare Pages `_redirects` fallback for direct SPA route support.
- Used local DanielClancy assets and fonts only; no remote font or asset imports were added.

### Human-Readable Notes

- The admin dashboard now has an initial polished professional control-panel foundation.
- The layout borrows the StreamSuites-Dashboard shell approach: fixed topbar, left navigation, panel-based work surfaces, status footer, tables, detail pages, and map-style analytics panel.
- All values are visibly scaffold placeholders and should not be read as live analytics, real accounts, or real deployment state.

### Files / Areas Changed

- `index.html`
- `_redirects`
- `assets/css/admin.css`
- `assets/js/admin-app.js`
- `assets/js/scaffold-data.js`
- `README.md`
- `BUMP_NOTES.md`

### Testing Notes

- No npm/package scripts exist in this repo yet.
- Static syntax checks should be run against the JavaScript files when the implementation is validated.

### Risks / Follow-Ups

- Projects CMS remains a future task.
- Media CMS remains a future task.
- Public DanielClancy login widget wiring remains a future task.
- Live Cloudflare/DNS setup remains a future task.
- Real admin API, analytics provider, account authority, and auth/session handling are not wired yet.
