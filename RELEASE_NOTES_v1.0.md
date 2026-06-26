# DanielClancy-Admin v1.0

Date: 2026-06-26

## Release Summary

DanielClancy-Admin v1.0 is the stable release marker for the Admin dashboard that supports the DanielClancy.net public portfolio/CV ecosystem. The dashboard is a Cloudflare Pages-compatible admin surface with Pages Function auth, account registry endpoints, CMS endpoints, registry reconciliation, asset upload support, analytics, and sanitized public site-data publishing.

This release does not invent or change CV, employment, company, software/platform, or project facts. Source-backed baselines and overlays remain the basis for public content.

## Highlights

- Promotes the visible Admin shell/footer version label to `v1.0`.
- Keeps the Admin dashboard wording and visible live/fallback diagnostics.
- Documents the v1.0 release state in README and BUMP notes.
- Adds release metadata and a focused version consistency test.
- Keeps Alerts rule editing removed/disabled.

## Admin Dashboard Features Shipped

- Admin session gate backed by Cloudflare Pages Functions, signed session cookies, and env-backed master admin accounts.
- Accounts registry endpoints and UI for account/profile overlays, role/status/note actions, and locked env-backed master admin rows.
- Overview and Settings status surfaces for auth, accounts, storage, public publishing, Turnstile posture, provider readiness, and safe operational diagnostics.
- Analytics page backed by Admin session-protected APIs, selected `5m`, `15m`, `1h`, and `24h` windows, source/freshness diagnostics, local Admin KV page visits, optional StreamSuites live feed reads, optional Cloudflare GraphQL aggregates, and a real MapLibre location map.

## Projects CMS

- Projects CMS uses the protected public-site baseline plus safe Admin overlay data.
- Protected public-site records can be soft-hidden or archived; only admin-created rows can be hard-deleted.
- Projects support table editing, detail modals, bulk actions, local fallback, KV persistence when configured, registry-backed company/platform selectors, asset previews, and R2-backed image/PDF uploads when configured.

## Companies, Platforms, And Positions Registries

- Companies, Platforms, and Positions are seeded from source-derived baseline data.
- `registry-overlay.v3` reconciliation stores source-row edits as keyed overrides and admin-created rows as custom rows.
- Client-only organizations remain excluded from Companies while source client/provenance labels stay preserved on project rows where relevant.
- Positions must resolve to reconciled Companies, and platform/software selections stay registry-backed.

## Registry Overlay v3 Save / Sync Behavior

- API and local fallback paths use the same `registry-overlay.v3` wrapper shape.
- Older v1/v2 array data is migrated in memory.
- Full-row saves are converted into override patches/custom rows instead of replacing the source baseline.
- When live Admin API or `DC_ADMIN_KV` is unavailable, the UI labels edits as local-only instead of pretending remote persistence succeeded.

## Asset Catalog, Manifests, And Uploads

- `tools/rebuild-manifests.mjs` rebuilds local public preview manifests from the public DanielClancy repo.
- `assets/data/public-asset-catalog.json`, public project baselines, and source audit outputs document source-derived public assets and registry inputs.
- `POST /api/admin/assets/upload` supports image/PDF upload paths when `DC_ADMIN_ASSETS_R2` is configured and returns browser-ready URLs only when `DC_ADMIN_ASSETS_PUBLIC_BASE_URL` is configured.

## Public Site-Data Publish Workflow

- `GET /api/public/site-data` exposes sanitized public data only and never exposes account registry rows, auth/session state, secrets, KV binding names, overlay wrappers, excluded-row internals, or draft/edit-only metadata.
- `POST /api/admin/publish/site-data` requires an admin session and `DC_ADMIN_KV`, writes `public:site-data:published` and `public:site-data:publish-meta`, and returns revision, timestamp, counts, warnings, and a revisioned public URL.
- Save/Sync remains separate from Publish. Local-only edits are not published.

## Analytics / Admin Shell / Account / Profile

- Analytics reports Admin API, StreamSuites, KV, Cloudflare GraphQL, ingest, source breakdown, freshness, live/stale/sample counts, and last-live-event state separately.
- The Admin shell keeps topbar/sidebar/footer behavior, local UI icon assets, a persisted sidebar mode, and a topbar user menu.
- Account profile editing stores safe display/avatar overlays and does not store passwords or OAuth tokens.

## Alerts Editor Disabled

- Alerts rule editing remains removed/disabled in DanielClancy-Admin.
- Direct `#/alerts` visits show the disabled notice.
- DanielClancy-Admin sends alert events only and strips rule/configuration/manifest fields before posting to the StreamSuites ingest bridge.
- StreamSuites-Dashboard remains the only UI for alert rule definitions.

## Deployment Notes

- Deployment target: Cloudflare Pages for `admin.danielclancy.net`.
- Required Cloudflare env vars:
  - `DC_ADMIN_EMAIL_1`
  - `DC_ADMIN_SECRET_1`
  - `DC_ADMIN_EMAIL_2`
  - `DC_ADMIN_SECRET_2`
  - `DC_AUTH_SESSION_SECRET`
  - `DC_PUBLIC_SITE_ORIGIN`
  - `DC_ADMIN_SITE_ORIGIN`
- Required Cloudflare KV binding:
  - `DC_ADMIN_KV`
- Required shared analytics ingest secret:
  - `DANIELCLANCY_ANALYTICS_INGEST_SECRET`
- Optional OAuth env vars:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `TWITTER_CLIENT_ID`
  - `TWITTER_CLIENT_SECRET`
- Optional analytics/env integrations:
  - `STREAMSUITES_ANALYTICS_URL`
  - `DANIELCLANCY_ANALYTICS_READ_SECRET`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_ZONE_ID_DANIELCLANCY`
  - `CLOUDFLARE_API_TOKEN_ANALYTICS`
- Optional asset upload binding/env:
  - `DC_ADMIN_ASSETS_R2`
  - `DC_ADMIN_ASSETS_PUBLIC_BASE_URL`
- Recommended shared cookie env:
  - `DC_AUTH_COOKIE_DOMAIN=.danielclancy.net`

## Known Limitations / Follow-Ups

- Live Admin auth, KV persistence, public publishing, analytics, and uploads require the documented Cloudflare env vars/bindings.
- Cloudflare GraphQL schema support can vary by dataset/account/plan; unavailable sections are reported without exposing secrets.
- A simple static file server does not run Pages Functions, so local static views use local fallback mode.

## Validation / Tests Summary

- Added `tests/version-consistency.test.mjs` for v1.0 release metadata and visible pre-release label checks.
- Release validation for this task includes the focused version consistency test, existing source/registry/public-site-data/publish tests, syntax checks for changed JS/Functions/scripts, optional npm check/build commands, and `git diff --check`.
