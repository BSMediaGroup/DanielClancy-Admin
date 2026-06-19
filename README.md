# DanielClancy-Admin

Static admin dashboard foundation for `admin.danielclancy.net`.

This repo is the admin surface for the professional DanielClancy.net portfolio/CV ecosystem. It is currently a Cloudflare Pages-compatible dashboard shell with server-side Pages Function auth, durable account-role registry endpoints, admin CMS endpoints for Projects, Media, Companies, Platforms, Positions, and disabled Alerts compatibility, and a real analytics API foundation. The CMS, account, and page-visit analytics paths use KV when configured and retain clearly labelled browser-local/sample fallback for static/dev views. Projects also carry protected public-site baseline and asset-catalog snapshots so existing DanielClancy.net portfolio records/assets are not treated as disposable scaffold rows.

## Local Use

Open `index.html` directly in a browser, or serve the folder with any static file server. `package.json` provides local manifest rebuild/check and focused registry test scripts; there is still no bundled frontend build step for this static Admin shell.

When Pages Functions are unavailable in local static/file mode, the login gate exposes a clearly labelled local scaffold unlock for UI smoke testing only. That local unlock is not a production credential and does not create a signed server session.

## Cloudflare Pages Compatibility

`_redirects` keeps direct dashboard routes on the SPA entrypoint. The auth endpoints under `functions/api/auth/[[path]].js`, account endpoints under `functions/api/admin/accounts/[[path]].js`, operational status endpoint under `functions/api/admin/status.js`, CMS endpoints under `functions/api/admin/cms/[[collection]].js`, and public publish endpoint under `functions/api/admin/publish/site-data.js` are Cloudflare Pages-compatible and use Web Crypto/HMAC signing for admin session checks, but this repo does not claim that DNS, the Cloudflare Pages project, provider OAuth apps, production env vars, or the KV binding have been configured live.

## Auth Foundation

Implemented endpoints:

- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/auth/oauth/github/start`
- `GET /api/auth/oauth/google/start`
- `GET /api/auth/oauth/twitter/start`
- `GET /api/auth/oauth/github/callback`
- `GET /api/auth/oauth/google/callback`
- `GET /api/auth/oauth/twitter/callback`

Manual email/password master admin accounts are the first production admin path:

- `mail@danielclancy.net` via `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1`
- `daniel@brainstream.media` via `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2`

Password verification happens only inside the Pages Function. Session cookies are signed with `DC_AUTH_SESSION_SECRET`, HttpOnly, SameSite=Lax, and Secure on HTTPS requests. Do not place `DC_ADMIN_SECRET_1`, `DC_ADMIN_SECRET_2`, or OAuth client secrets in frontend JavaScript.

The admin auth gate is a polished restricted-access screen with OAuth buttons first, a collapsed manual email/password admin login section, and a sign in/create account toggle. OAuth non-admin sessions render a clear "admin access required" state with sign out instead of looping through generic failed-login copy. Email/password signup is intentionally scaffold-only; `/api/auth/signup` returns a durable-account-store-required response and does not persist credentials.

The admin auth gate uses `assets/logos/logo.webp` as the top modal brand mark and keeps internal setup notes out of the surfaced login UI. Manual email/password remains collapsed by default. Manual login, signup scaffold responses, and OAuth start redirects do not render or require Turnstile. OAuth callbacks are unchanged. CMS pages and CMS API endpoints remain signed-session protected and do not render or require Turnstile widgets.

Required Cloudflare env vars:

- `DC_ADMIN_EMAIL_1`
- `DC_ADMIN_SECRET_1`
- `DC_ADMIN_EMAIL_2`
- `DC_ADMIN_SECRET_2`
- `DC_AUTH_SESSION_SECRET`
- `DC_PUBLIC_SITE_ORIGIN` - expected `https://danielclancy.net`
- `DC_ADMIN_SITE_ORIGIN` - expected `https://admin.danielclancy.net`
Required Cloudflare KV binding:

- `DC_ADMIN_KV` - production CMS persistence for Projects, Media, Companies, Platforms, Positions, disabled Alerts compatibility, and account/profile overlays
- `DC_ADMIN_KV` also stores the public published site-data snapshot at `public:site-data:published` and metadata at `public:site-data:publish-meta`.

Required shared analytics ingest secret:

- `DANIELCLANCY_ANALYTICS_INGEST_SECRET` - generated server-only secret used by public DanielClancy Pages Functions to post page visits into Admin analytics. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and set the same value in DanielClancy-Admin and DanielClancy public Pages Function env only.

Optional Cloudflare R2 asset binding:

- `DC_ADMIN_ASSETS_R2` - required for persistent Projects image/document uploads, registry logo uploads, and account avatar uploads from the Admin dashboard
- `DC_ADMIN_ASSETS_PUBLIC_BASE_URL` - optional public base URL used to return browser-ready URLs after R2 upload; without it the upload API returns a relative key-style path

Recommended shared-cookie env var:

- `DC_AUTH_COOKIE_DOMAIN` - recommended `.danielclancy.net`

Turnstile helper files may remain for compatibility, but admin login/signup/OAuth auth flows no longer use `DC_TURNSTILE_SITE_KEY`, `DC_TURNSTILE_SECRET_KEY`, `DC_TURNSTILE_DEV_BYPASS`, `/api/turnstile/config`, or Cloudflare Siteverify.

`DANIELCLANCY_ALERT_INGEST_SECRET` is a generated shared secret, not a value found in Cloudflare. Generate it with:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set `DANIELCLANCY_ALERT_INGEST_URL` to the StreamSuites runtime/API `POST /api/alerts/danielclancy` endpoint. Use the same generated `DANIELCLANCY_ALERT_INGEST_SECRET` value only in server/runtime environments that need to verify or send DanielClancy alert ingest events, including the StreamSuites runtime/API environment hosting the receiver and this DanielClancy-Admin sender environment. Never expose this value in frontend code or display it in the UI. Alert delivery failures are logged server-side and do not block auth, CMS saves, or dashboard navigation.

Admin auth, CMS, and page-visit alert events forward sanitized Cloudflare request metadata when available, including host/origin, page/referrer fields, request method, client IP, user agent, browser/device/platform, timezone, colo, `geo.city`, `geo.region`, `geo.region_code`, `geo.country`, `geo.country_code`, derived country flag, display/user/account fields, and auth provider. DanielClancy-Admin sends alert events only; rule definitions/configuration are never sent, and the Alerts editor remains removed/disabled.

OAuth env vars:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`

Future-safe OAuth admin allowlist env vars:

- `DC_ADMIN_OAUTH_GITHUB_ALLOWLIST`
- `DC_ADMIN_OAUTH_GOOGLE_ALLOWLIST`
- `DC_ADMIN_OAUTH_TWITTER_ALLOWLIST`

OAuth users can start login only after the provider env vars and redirect URIs are configured. OAuth users must not automatically become master admins from display names or unverified profile text. Intended future/admin identities to verify before allowlisting are:

- GitHub email: `daniel@brainstream.media`
- Google email: `mail@danielclancy.net`
- Twitter/X username: `DanielClancy`
- Twitter/X email is generally not surfaced reliably and must not be required for admin matching.

Required OAuth redirect URIs:

- GitHub: `https://admin.danielclancy.net/api/auth/oauth/github/callback`
- Google: `https://admin.danielclancy.net/api/auth/oauth/google/callback`
- Twitter/X: `https://admin.danielclancy.net/api/auth/oauth/twitter/callback`

## Accounts API And Registry

Implemented endpoints:

- `GET /api/admin/accounts`
- `POST /api/admin/accounts/promote`
- `POST /api/admin/accounts/demote`
- `POST /api/admin/accounts/disable`
- `POST /api/admin/accounts/enable`
- `POST /api/admin/accounts/update`
- `POST /api/admin/accounts/profile`
- `PATCH /api/admin/accounts/:id`

The account registry uses Cloudflare KV binding `DC_ADMIN_KV` with key `accounts:registry`. The stored wrapper is `collection: "accounts"`, `updatedAt`, and `accounts`. Account records store safe identity/role/status fields such as provider, provider subject, email, username, display name, avatar URL, account type, admin level, status, first/last seen, last login, notes, source, and updated time. Passwords, OAuth access tokens, and OAuth refresh tokens are never stored.

The two manual master admin accounts are always synthesized at runtime from env vars and shown as locked `env_master` rows:

- `mail@danielclancy.net` via `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1`
- `daniel@brainstream.media` via `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2`

Locked env-backed master admins cannot be deleted, disabled, demoted, or edited for role/status through the UI/API. OAuth callback registration creates or updates known regular accounts by default. OAuth users are not automatically promoted to admin; a master admin must promote a KV-backed account through the Accounts UI/API. Non-master admins can read the account list but cannot change roles, status, or notes. The Accounts page can update the current signed-in user's display name/avatar as account overlay metadata; it does not store passwords or OAuth tokens.

`GET /api/auth/session` resolves role from env-backed manual master sessions first, then `accounts:registry`, then the signed session fallback. The frontend local scaffold account rows are not production authority and cannot override the server-resolved role.

## Overview Status API

Implemented endpoint:

- `GET /api/admin/status`

The Overview page uses this endpoint to show signed-in admin identity, account registry status/count, Projects/Media/Alerts CMS storage status/counts, protected public project baseline count when the asset binding is available, Turnstile configured status, OAuth provider configured status, alert ingest bridge configured/missing status, and last checked timestamp. It does not display secret values and does not invent analytics numbers or claim public publishing is complete.

## Analytics Status API

Implemented endpoint:

- `GET /api/admin/analytics`
- `POST /api/analytics/ingest/page-visit`

The Analytics page hydrates from this admin-session-protected Pages Function. Unauthenticated requests return `unauthenticated`, signed-in non-admin users return `admin_required`, and secret values are never returned. When Cloudflare Analytics configuration is missing, the endpoint returns `configured: false`, a clear `cloudflare_analytics_not_configured` source, `lastChecked`, and a `requiredConfig` / `missingConfig` list containing env var names only.

Cloudflare Analytics env vars:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID_DANIELCLANCY`
- `CLOUDFLARE_API_TOKEN_ANALYTICS`

When all three env vars are present, `GET /api/admin/analytics?window=5m|15m|1h|24h` attempts real Cloudflare Analytics GraphQL requests against the configured DanielClancy zone. The Analytics page exposes `5M`, `15M`, `1H`, and `24HRS` controls and sends the selected safe window to the API; unsupported values are normalized server-side and this page does not request one-week or wider Cloudflare ranges. Cloudflare GraphQL schema support can vary by dataset/account/plan, so per-section availability is grouped as live, partial, or unavailable without exposing token or zone/account IDs.

The same endpoint merges Cloudflare metrics with bounded page-visit analytics stored in `DC_ADMIN_KV`:

- `analytics:page_visits:recent` - latest recent page visit events, capped to a bounded list
- `analytics:page_visits:rollup` - aggregate counts derived from the bounded recent list

The page-visit endpoint stores non-secret metadata only: timestamp, optional safe session id, surface, page path/url/title, referrer host, country, region, city, timezone, colo, browser, device, platform, and safe admin/authenticated flags. It does not store raw client IP addresses. Page-visit reads are filtered by the selected analytics window; live rows outside the selected window or missing event timestamps are not mixed into the active map/table counts.

Public `danielclancy.net` page visits flow through the public repo's `POST /api/track/page-visit` Pages Function, which forwards server-side to `https://admin.danielclancy.net/api/analytics/ingest/page-visit` when `DANIELCLANCY_ADMIN_ANALYTICS_INGEST_URL` and `DANIELCLANCY_ANALYTICS_INGEST_SECRET` are configured in the public repo. The browser never receives the ingest secret. The admin ingest endpoint is intentionally not admin-session-gated because public visitors are anonymous, but it rejects requests without `X-DanielClancy-Analytics-Secret`.

City-level location detail comes from page-visit KV rows enriched with Cloudflare request geo metadata such as `request.cf.city`; the Analytics API does not query unsupported Cloudflare GraphQL city fields. Referrer host is returned from page-visit KV when available; if the current Cloudflare dataset does not expose a safe referrer dimension, Cloudflare referrers are reported as unavailable with the note “Referrer host is unavailable from the current Cloudflare dataset.” If only region/country rows are available, the API and UI mark those rows with `precision: "region"` or `precision: "country"` and do not pretend country rows are city rows. When zero page-visit events exist, the API/UI says “No page-visit events have been captured yet.”

The Analytics map/location panel uses a real interactive MapLibre GL map, modelled on the StreamSuites-Dashboard MapLibre analytics pattern. Runtime MapLibre assets are vendored locally under `assets/vendor/maplibre-gl/`, while the dark basemap uses CARTO `dark_all` raster tiles with the required OpenStreetMap/CARTO attribution shown by MapLibre. The map supports pan/zoom, local marker elements, popups, attribution, route/layout resize handling, and a visible empty overlay. Live markers are generated only from source-tagged live rows (`page_visit_kv` or `cloudflare_graphql`); sample/fallback/demo/mock/test rows and stale untagged legacy rows stay out of the map. Marker dot size represents distinct sessions when a session id is available; the larger halo/gradient represents requests/events. If session ids are unavailable, sessions render as `n/a` rather than being invented.

Known city coordinates are plotted only from trusted row `lat`/`lng` values or exact city/region/country matches in the built-in lookup; unknown city coordinates remain unplotted. Country-only rows plot only when a verified local country centroid exists and remain labelled as `precision: "country"`. The lookup is documented in `assets/data/geo-coordinate-lookup.json` and is intentionally limited to verified approximate city-center coordinates for exact matches such as Los Angeles, Portland, and Sydney. No analytics counts or cities are invented.

Country values render with the local `flag-icons` SVG set copied into `assets/icons/flags/`. In location tables, flags appear only in the Country column; City, Region, Precision, and Source remain text/badges only. Map marker labels, popups/tooltips, country chips, and country summary labels retain country flags. Unknown or unsupported country codes use the local `_fallback.svg` globe icon; no remote flag CDN, base64 flag, or emoji flag fallback is used as the primary implementation.

The Analytics page shows `Last refreshed`, `Last live page-visit event`, `Last Cloudflare GraphQL query`, grouped partial/unavailable query status, and a freshness state of `live_recent`, `live_stale`, `no_live_events`, `sample_only`, or `cloudflare_partial`. Raw GraphQL range/schema errors are kept out of the main visible notes. The Refresh analytics button performs a manual periodic refresh for the selected window; the UI does not claim realtime behavior. The admin-only Clear sample analytics rows action removes only rows explicitly tagged sample/fallback/demo/mock/test and keeps real `page_visit_kv` rows plus unverified stale legacy rows.

## Admin CMS API

Implemented endpoints:

- `GET /api/admin/cms/projects`
- `PUT /api/admin/cms/projects`
- `GET /api/admin/cms/media`
- `PUT /api/admin/cms/media`
- `GET /api/admin/cms/alerts`
- `PUT /api/admin/cms/alerts`
- `GET /api/admin/cms/companies`
- `PUT /api/admin/cms/companies`
- `GET /api/admin/cms/platforms`
- `PUT /api/admin/cms/platforms`
- `GET /api/admin/cms/positions`
- `PUT /api/admin/cms/positions`
- `POST /api/admin/assets/upload`

All CMS endpoints require a signed authenticated admin/master-admin session. Unauthenticated requests return `unauthenticated`, and signed-in non-admin users return `admin_required`. Collection names are allowlisted to `projects`, `media`, `alerts`, `companies`, `platforms`, and `positions`.

CMS endpoints are not Turnstile-gated because they are operational admin APIs behind the signed admin session.

Production storage uses Cloudflare KV binding `DC_ADMIN_KV` with keys:

- `accounts:registry`
- `cms:projects`
- `cms:media`
- `cms:alerts`
- `cms:companies`
- `cms:platforms`
- `cms:positions`

When `DC_ADMIN_KV` is unavailable, the API returns a clear storage-not-configured/fallback response instead of pretending to save. The dashboard keeps existing localStorage data available and labels this as local browser fallback. A simple static/Python server does not run Cloudflare Pages Functions, so local static views will use fallback mode unless served through a Pages-compatible dev runtime with bindings.

Projects are handled differently from Media, Companies, Platforms, and disabled Alerts compatibility. `assets/data/public-projects-baseline.json` is a generated snapshot from the public DanielClancy repo's WorkSet-derived portfolio pipeline (`cmsdata/wix/collection-tables/WorkSet.csv`, `src/content/workSetPortfolio.ts`, and the public portfolio routes). The Projects API loads that baseline first, then merges `cms:projects` KV data as admin edits, metadata, visibility/status changes, and admin-created additions. Legacy bare-array KV data and older partial scaffold rows are treated as overlays and must not collapse the Projects list to only those rows.

`assets/data/source-audit-report.json` records the current read-only source audit against the public DanielClancy CV/portfolio source and copied Admin preview catalogs. The audit separates organization-like names into `employersFound`, `studiosFound`, `clientsFound`, `vendorsFound`, and `ambiguousOrganizations`, then records `companiesPromotedToRegistry`, `clientsExcludedFromCompanies`, `requiredCompanyAssertions`, and `warnings`. `assets/data/admin-companies-baseline.json`, `assets/data/admin-platforms-baseline.json`, and `assets/data/admin-positions-baseline.json` are generated registry baselines from that audit. These registries are source-derived only; blank optional fields indicate missing source facts, not invented replacements. Companies, Platforms, Positions, and Projects should be rechecked with focused Node completeness tests plus MCP/browser validation whenever these baselines are regenerated or route-loading behavior is repaired.

Companies, Platforms, and Positions are reconciled through `functions/_shared/registry-reconciliation.js` using schema `registry-overlay.v3`. Reconciliation starts from the source baseline, then applies an overlay wrapper with `overrides`, `customRows`, `deletedCustomIds`, and `excludedRows`. Source baseline rows are never saved back as full localStorage/KV rows. Edits to source-derived Companies, Platforms, and Positions are stored as keyed override patches against the stable source ID; admin-created rows are stored as full `customRows`. This prevents full reconciled baseline snapshots from reloading as duplicate custom rows, and it prevents Sync/Save from deleting source-derived edits.

The registry overlay v3 wrapper has this shape: `schemaVersion`, `collection`, `updatedAt`, `overrides`, `customRows`, `deletedCustomIds`, and `excludedRows`. API `GET` migrates older v1/v2 arrays in memory, reconciles baseline plus overlay, and returns the reconciled rows with overlay counts, exclusions, warnings, and source-required restoration metadata. API `PUT` accepts either a v3 overlay or a full visible rows array, then converts full rows into override patches/custom rows before persisting. Local static fallback uses the same v3 overlay shape in localStorage. When the live admin API is unavailable or `DC_ADMIN_KV` is missing, the UI labels the result as local-only instead of pretending remote persistence succeeded.

Stale production KV rows or legacy local fallback arrays cannot remove source-required employers/studios such as Fleetwood Australia or GHD, and client-only organizations are excluded from active Companies. If the source audit classifies Riley Consulting as client-only, Riley remains preserved only in project client/provenance fields and is excluded from Companies and project company selectors even when stale localStorage, KV, scaffold, or import rows try to add it. The UI surfaces a compact reconciliation status with override/custom/excluded counts. The “Reconcile / repair local registry cache” action migrates old Companies/Platforms/Positions local data to overlay v3 without deleting valid custom rows; the “Reset local registry cache” action clears only the Companies/Platforms/Positions registry overlay cache after confirmation and does not clear auth/session storage, Projects, Media, disabled Alerts compatibility data, or unrelated CMS content.

The Companies and Platforms pages include a “Reset local registry cache” action. It clears only the registry cache keys for Companies, Platforms, Positions, and the registry schema marker, then reloads the source baselines. It does not clear auth/session storage, account data, Projects, Media, disabled Alerts compatibility data, or unrelated CMS content.

Projects saves use a `baseline_overlay` wrapper and reject unsafe payloads that are smaller than the protected baseline unless baseline hiding is explicit. In the dashboard, baseline project delete/archive actions soft-hide or archive protected public-site records; only admin-created rows can be hard-deleted. The "Reconcile with public site baseline" action rebuilds the merged manifest from the protected baseline plus existing admin overlay data and saves that safe shape back to KV when admin storage is available. Public-site publishing/hydration from this admin storage remains future work.

`public/media/portfolio/thumbs`, `public/media/portfolio`, and `public/docs` contain copied preview files from the public DanielClancy repo at the same relative public paths. This lets Admin editor previews resolve `/media/portfolio/thumbs/...`, `/media/portfolio/...`, and `/docs/...` locally without remote URLs or embedded assets. `assets/data/public-asset-catalog.json` is regenerated from those copied Admin files and records the original `DanielClancy` source repo/source directories.

Sidebar and topbar UI icons render from local `assets/icons/ui` SVG files using current UI color. Company logos render from local `assets/logos/company-*` monochrome SVGs as currentColor masks so black source SVGs are visible on the dark UI. Software/platform logos render from local `assets/logos/software-*` SVGs as normal full-color images.

Companies are seeded from public CV/source employment entries and project studio/company fields only. Employers and studios become Companies; client-only names remain client/provenance fields and are not Company/Studio options. Fleetwood Australia and GHD are enforced if they appear in employment source data. Riley Consulting is excluded from Companies when it is classified as client-only, while its source mention remains preserved on the relevant project client/provenance fields. Platforms are seeded from public CV/source software values and matched to `software-*` logo SVGs where available. The Positions page (`#/positions`) manages employment positions seeded from the public CV source and every position must resolve to a Companies registry record through `companyId`.

Projects now use autocomplete/dropdowns and previews for thumbnail (`/media/portfolio/thumbs`), gallery/hero (`/media/portfolio`), and document/PDF (`/docs`) paths. Gallery items render as an ordered thumbnail grid with move up/down and remove controls. Company/studio and software/platform fields are predefined registry selections only, backed by the Companies and Platforms pages. The Projects table supports locally persisted resizable columns with a reset action.

`POST /api/admin/assets/upload` requires a signed admin session and `DC_ADMIN_ASSETS_R2`. It accepts multipart image uploads for Projects image fields, registry logos, and account avatars, plus PDF uploads for document paths; validates common web image MIME types and `application/pdf`; enforces a 10MB cap; and stores files under `portfolio/thumbs/<project-slug>/`, `portfolio/projects/<project-slug>/`, `docs/projects/<project-slug>/`, or `accounts/avatars/` depending on the field. It returns the R2 key and a browser-ready URL only when `DC_ADMIN_ASSETS_PUBLIC_BASE_URL` is configured. When R2 is missing, the API returns `storage_not_configured`; the editor keeps manual/autocomplete path fields and unsaved form data intact.

## Public Site-Data Export

Implemented endpoint:

- `GET /api/public/site-data`
- `POST /api/admin/publish/site-data`

`GET /api/public/site-data` is intentionally public and read-only. It prefers the last published KV snapshot when one exists, otherwise it builds a reconciled live/baseline fallback. It does not require an admin session because it exposes only sanitized data needed by `danielclancy.net` public rendering. It does not expose account registry rows, auth/session state, secrets, KV binding names, overlay wrappers, excluded-row internals, draft/edit-only metadata, or admin-only implementation details.

`POST /api/admin/publish/site-data` requires a signed admin session and `DC_ADMIN_KV`. It builds the same sanitized public payload, applies registry reconciliation/client-only exclusions, writes `public:site-data:published`, writes `public:site-data:publish-meta`, and returns `revision`, `publishedAt`, collection counts, warnings, and `/api/public/site-data?rev=<revision>`. It does not mutate alert rules and does not publish localStorage-only edits.

The response contract is stable JSON:

- `ok`
- `schemaVersion: "danielclancy-public-site-data.v1"`
- `generatedAt`
- `source: "published_kv_snapshot" | "live_reconciled_fallback" | "baseline_fallback"`
- `revision`
- `publishedAt`
- `collections.projects`
- `collections.companies`
- `collections.platforms`
- `collections.positions`
- `assets.portfolioThumbs`
- `assets.portfolioImages`
- `assets.docs`
- `warnings`

Projects are built from the protected public Projects baseline plus safe `cms:projects` KV overlay when available. Companies, Platforms, and Positions use the same `registry-overlay.v3` reconciliation layer as the admin CMS endpoints. Client-only organizations remain excluded from public Companies; source client/provenance labels can remain on project rows where they are public metadata. If `DC_ADMIN_KV` is unavailable or a collection read fails, the endpoint returns reconciled baseline data with warnings instead of failing the public website.

CORS allows `GET` and `OPTIONS` for `https://danielclancy.net`, `https://www.danielclancy.net`, and local Vite/preview origins. It avoids wildcard origins and does not allow unsafe methods. Successful responses use short caching with `Cache-Control: public, max-age=60, stale-while-revalidate=300` plus an ETag when a revision exists; errors use `no-store`.

## Publishing Workflow

1. Save/Sync edits in the Projects, Companies, Platforms, or Positions CMS page.
2. Use Overview or Settings `Publish site data`.
3. Confirm the returned revision, published timestamp, and counts.
4. The public site should fetch `https://admin.danielclancy.net/api/public/site-data` when `VITE_ADMIN_PUBLIC_SITE_DATA_URL` is configured in the public Cloudflare Pages project.
5. Refresh the public site. Redeploy Public only when the env var changed, the committed fallback snapshot changed, rendering code changed, or public assets were added.

If Admin is in static/local-only mode or `DC_ADMIN_KV` is unavailable, the dashboard shows `Cannot publish: live Admin API/KV is unavailable. Current edits are local-only.` Save/Sync remains separate from Publish.

## Manifest Rebuild Workflow

After adding public repo assets or source data:

1. In DanielClancy-Admin run `npm run manifests:rebuild`.
2. Review `assets/data/public-asset-catalog.json` and the existing baseline/audit files.
3. In DanielClancy run `npm run data:rebuild`.
4. Run targeted checks/builds in both repos.
5. Commit both repos and deploy Admin first, then Public.

`npm run manifests:check` reports stale generated output without writing it. The rebuild tool scans `../DanielClancy` by default and accepts `DANIELCLANCY_PUBLIC_ROOT=...`. It copies public preview files into `public/media/portfolio/thumbs`, `public/media/portfolio`, and `public/docs`.

Public asset paths are metadata-only and must stay clean:

- thumbnails: `/media/portfolio/thumbs/...`
- gallery/hero images: `/media/portfolio/...`
- documents: `/docs/...`

Absolute HTTPS CDN/R2 URLs may pass through when they are already stored in public-safe fields. Binary assets are not embedded in the response.

## Cloudflare Setup Checkpoint

After local smoke testing, stop for Cloudflare setup before real OAuth/live auth testing:

- Create/confirm the Cloudflare Pages project for DanielClancy-Admin.
- Set `admin.danielclancy.net` DNS/custom domain.
- Add the Cloudflare env vars listed above.
- Create OAuth apps in GitHub, Google Cloud, and Twitter/X developer portals.
- Register callback URLs.
- Add any Pushover env/config needed before DanielClancy alerts can route through StreamSuites.
- Confirm the hosted admin dashboard loads and OAuth callbacks return to the clean admin-required state for non-admin sessions.
- Confirm cookies across `danielclancy.net` and `admin.danielclancy.net`.
- Add Cloudflare Analytics env vars before relying on live Cloudflare totals. The dashboard reports missing/failed config safely and does not show fake analytics metrics as real data.

## Repository Tree

```text
DanielClancy-Admin/
├── _redirects
├── assets/
│   ├── css/
│   │   └── admin.css
│   ├── data/
│   │   ├── admin-companies-baseline.json
│   │   ├── admin-platforms-baseline.json
│   │   ├── admin-positions-baseline.json
│   │   ├── geo-coordinate-lookup.json
│   │   ├── public-asset-catalog.json
│   │   ├── public-projects-baseline.json
│   │   └── source-audit-report.json
│   ├── fonts/
│   │   ├── Recharge-Bold.otf
│   │   ├── SuiGeneris-Regular.otf
│   │   ├── mono/
│   │   └── other/
│   ├── icons/
│   │   └── flags/
│   │       ├── _fallback.svg
│   │       └── *.svg (local flag-icons 4x3 country flag set)
│   ├── js/
│   │   ├── admin-auth.js
│   │   ├── admin-app.js
│   │   ├── registry-reconciliation.js
│   │   ├── scaffold-data.js
│   │   └── turnstile.js
│   ├── vendor/
│   │   └── maplibre-gl/
│   │       ├── LICENSE.txt
│   │       ├── maplibre-gl.css
│   │       └── maplibre-gl.js
│   └── logos/
│       ├── company-*.svg
│       ├── software-*.svg
│       └── logo*.png/webp
├── functions/
│   ├── _shared/
│   │   ├── admin-accounts.js
│   │   ├── analytics-store.js
│   │   ├── alert-sender.js
│   │   ├── public-site-data.js
│   │   ├── registry-reconciliation.js
│   │   └── turnstile.js
│   └── api/
│       ├── analytics/
│       │   └── ingest/
│       │       └── page-visit.js
│       ├── admin/
│       │   ├── accounts/
│       │   │   └── [[path]].js
│       │   ├── assets/
│       │   │   └── upload.js
│       │   ├── analytics.js
│       │   ├── cms/
│       │   │   └── [[collection]].js
│       │   ├── publish/
│       │   │   └── site-data.js
│       │   └── status.js
│       ├── auth/
│       │   └── [[path]].js
│       ├── public/
│       │   └── site-data.js
│       ├── track/
│       │   └── page-visit.js
│       └── turnstile/
│           └── config.js
├── tests/
│   ├── alerts-disabled.test.mjs
│   ├── analytics-ingest-and-assets.test.mjs
│   ├── analytics-helpers.test.mjs
│   ├── analytics-map-flags.test.mjs
│   ├── public-site-data-export.test.mjs
│   ├── registry-overlay-persistence.test.mjs
│   ├── registry-reconciliation.test.mjs
│   └── source-audit-completeness.test.mjs
├── tools/
│   └── rebuild-manifests.mjs
├── BUMP_NOTES.md
├── favicon.ico
├── index.html
├── package.json
└── public/
    ├── docs/
    └── media/
        └── portfolio/
            └── thumbs/
```

## Current Scope

- Dashboard shell with topbar, sidebar navigation, footer/status area, and responsive behavior.
- Overview, Analytics, Accounts, Account Detail, Projects, Media, Companies, Platforms, Positions, and Settings pages.
- Admin session gate backed by Cloudflare Pages Functions, with local scaffold unlock only for local/static UI smoke testing.
- Accounts page hydrates from the `accounts:registry` KV role store when `DC_ADMIN_KV` is configured, with locked env-backed master admins, master-only role/status/note actions, and current-user display-name/avatar profile editing.
- Settings account-access section reflects the same durable account registry, current session role source, Turnstile posture, and secret-safety notes.
- Overview page hydrates operational status from `/api/admin/status` without inventing analytics or exposing secrets.
- Overview, Settings, Projects, Companies, Platforms, and Positions show public site-data publish status, source, revision, counts, and warnings. `Publish site data` writes only a sanitized snapshot when live Admin KV is available.
- Analytics page hydrates Cloudflare GraphQL and page-visit KV readiness from `/api/admin/analytics`; missing/failed Cloudflare config is reported clearly, city precision is labelled per row, and the location section uses a real dark MapLibre GL map with local markers/popups. Empty live analytics shows “No live page-visit location events captured yet.” over the real basemap and no fake sample markers.
- Clearly marked local scaffold data for layout and workflow shape only.
- Projects CMS with protected public-site baseline hydration, admin API/KV overlay reconciliation when `DC_ADMIN_KV` is configured, localStorage fallback, table editing, clickable rows that open the editor, resizable/stored table columns, create/edit/detail modal, existing asset dropdowns/previews for thumbnail/gallery/hero/document paths, R2-backed image/PDF upload controls when `DC_ADMIN_ASSETS_R2` is configured, registry-only company/platform selectors, multiple software/platform selection with icon chips, bulk actions, reset, and safe JSON copy/import controls.
- Companies page for predefined company/studio options used by Projects, seeded from public employer/studio source data only, with registry overlay v3 reconciliation, client-only names excluded, source-required employers restored from baseline, source/provenance/override/custom classification shown, KV/local fallback, active/archive status, local registry cache repair/reset, `company-*` monochrome SVG logos rendered in current UI color, logo path selection, and optional logo upload.
- Platforms page for predefined software/platform options used by Projects, seeded from the public CV/source data, with KV/local fallback, active/archive status, `software-*` full-color SVG logos, selected-platform icon chips, and optional logo upload.
- Positions page for CV-derived employment position records, with KV/local fallback, source-baseline reconciliation, table view, search/status filter, create/edit modal, archive/delete confirmation, company selector, and platform/software multi-selector. Position company IDs must resolve to reconciled Companies.
- Sidebar has separate collapse and hide controls; the mode is persisted locally, hidden mode exposes a reopen control, SVG UI icons are rendered from `assets/icons/ui`, and the brand subtext reads `ADMIN DASHBOARD`.
- The topbar loading strip sits on the bottom edge of the topbar and uses the StreamSuites-style purple gradient motion. The topbar user dropdown includes session identity details plus Accounts, Settings, Public Site, and Logout actions.
- Media CMS scaffold with admin API/KV hydration when `DC_ADMIN_KV` is configured, localStorage fallback, table editing, create/edit/detail modal, local field-completeness checks, bulk actions, reset, and JSON copy/import controls for future `/watch` page management.
- Media CMS does not publish to DanielClancy.net, fetch YouTube/Rumble feeds, or connect to StreamSuites.
- Alerts rule editing is disabled in DanielClancy-Admin. Alerts is removed from main navigation, direct `#/alerts` visits show the non-editable notice “Alert rules are managed in StreamSuites-Dashboard only,” and create/edit/delete/bulk/import/reset/copy/sync controls are not rendered.
- Admin page visits, successful manual/OAuth auth, and successful Projects/Media/Alerts CMS saves may post DanielClancy alert events to the StreamSuites ingest bridge when `DANIELCLANCY_ALERT_INGEST_URL` and `DANIELCLANCY_ALERT_INGEST_SECRET` are configured. Event payload/context data is stripped of rule/configuration/manifest fields before sending.
- DanielClancy-Admin cannot manage, sync, export, replace, or overwrite StreamSuites canonical alert rule definitions. StreamSuites-Dashboard is the only UI for alert rule definitions.
