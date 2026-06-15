# DanielClancy-Admin

Static admin dashboard foundation for `admin.danielclancy.net`.

This repo is the admin surface for the professional DanielClancy.net portfolio/CV ecosystem. It is currently a Cloudflare Pages-compatible dashboard shell with server-side Pages Function auth, durable account-role registry endpoints, and first-pass admin CMS endpoints for Projects, Media, and Alerts. The CMS and account pages use KV when configured and retain clearly labelled browser-local fallback for static/dev views. Projects also carry a protected public-site baseline snapshot so existing DanielClancy.net portfolio records are not treated as disposable scaffold rows.

## Local Use

Open `index.html` directly in a browser, or serve the folder with any static file server. `package.json` exists only so local syntax checks parse Cloudflare Pages Function modules correctly; there is no npm build/lint/test script in this repo yet.

When Pages Functions are unavailable in local static/file mode, the login gate exposes a clearly labelled local scaffold unlock for UI smoke testing only. That local unlock is not a production credential and does not create a signed server session.

## Cloudflare Pages Compatibility

`_redirects` keeps direct dashboard routes on the SPA entrypoint. The auth endpoints under `functions/api/auth/[[path]].js`, account endpoints under `functions/api/admin/accounts/[[path]].js`, operational status endpoint under `functions/api/admin/status.js`, and CMS endpoints under `functions/api/admin/cms/[[collection]].js` are Cloudflare Pages-compatible and use Web Crypto/HMAC signing for admin session checks, but this repo does not claim that DNS, the Cloudflare Pages project, provider OAuth apps, production env vars, or the KV binding have been configured live.

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

The admin auth gate is a polished restricted-access screen with OAuth buttons first, Cloudflare Turnstile protection, a collapsed manual email/password admin login section, and a sign in/create account toggle. OAuth non-admin sessions render a clear "admin access required" state with sign out instead of looping through generic failed-login copy. Email/password signup is intentionally scaffold-only; `/api/auth/signup` returns a durable-account-store-required response and does not persist credentials.

The admin auth gate uses `assets/logos/logo.webp` as the top modal brand mark and keeps internal setup notes out of the surfaced login UI. Manual email/password remains collapsed by default. Turnstile tokens are verified server-side with Cloudflare Siteverify before manual login, signup scaffold responses, or OAuth start redirects. OAuth callbacks do not require Turnstile because the challenge belongs at start. CMS pages and CMS API endpoints remain signed-session protected and do not render or require Turnstile widgets.

Required Cloudflare env vars:

- `DC_ADMIN_EMAIL_1`
- `DC_ADMIN_SECRET_1`
- `DC_ADMIN_EMAIL_2`
- `DC_ADMIN_SECRET_2`
- `DC_AUTH_SESSION_SECRET`
- `DC_PUBLIC_SITE_ORIGIN` - expected `https://danielclancy.net`
- `DC_ADMIN_SITE_ORIGIN` - expected `https://admin.danielclancy.net`
- `DC_TURNSTILE_SITE_KEY`
- `DC_TURNSTILE_SECRET_KEY`

Required Cloudflare KV binding:

- `DC_ADMIN_KV` - production CMS persistence for Projects, Media, and Alerts

Recommended shared-cookie env var:

- `DC_AUTH_COOKIE_DOMAIN` - recommended `.danielclancy.net`

Optional dev/test Turnstile bypass:

- `DC_TURNSTILE_DEV_BYPASS=false` for normal production behavior; only set `true` in explicit dev/test environments

`DC_TURNSTILE_SITE_KEY` is exposed only through the safe `/api/turnstile/config` Pages Function response. `DC_TURNSTILE_SECRET_KEY` must remain server-side only; missing production secrets fail protected auth actions closed. A simple static/file server cannot run Pages Functions, so local static views may show a Turnstile unavailable state until served through a Pages-compatible runtime with env bindings.

`DANIELCLANCY_ALERT_INGEST_SECRET` is a generated shared secret, not a value found in Cloudflare. Generate it with:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set `DANIELCLANCY_ALERT_INGEST_URL` to the StreamSuites runtime/API `POST /api/alerts/danielclancy` endpoint. Use the same generated `DANIELCLANCY_ALERT_INGEST_SECRET` value only in server/runtime environments that need to verify or send DanielClancy alert ingest events, including the StreamSuites runtime/API environment hosting the receiver and this DanielClancy-Admin sender environment. Never expose this value in frontend code or display it in the UI. Alert delivery failures are logged server-side and do not block auth, CMS saves, or dashboard navigation.

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
- `PATCH /api/admin/accounts/:id`

The account registry uses Cloudflare KV binding `DC_ADMIN_KV` with key `accounts:registry`. The stored wrapper is `collection: "accounts"`, `updatedAt`, and `accounts`. Account records store safe identity/role/status fields such as provider, provider subject, email, username, display name, avatar URL, account type, admin level, status, first/last seen, last login, notes, source, and updated time. Passwords, OAuth access tokens, and OAuth refresh tokens are never stored.

The two manual master admin accounts are always synthesized at runtime from env vars and shown as locked `env_master` rows:

- `mail@danielclancy.net` via `DC_ADMIN_EMAIL_1` / `DC_ADMIN_SECRET_1`
- `daniel@brainstream.media` via `DC_ADMIN_EMAIL_2` / `DC_ADMIN_SECRET_2`

Locked env-backed master admins cannot be deleted, disabled, demoted, or edited through the UI/API. OAuth callback registration creates or updates known regular accounts by default. OAuth users are not automatically promoted to admin; a master admin must promote a KV-backed account through the Accounts UI/API. Non-master admins can read the account list but cannot change roles, status, or notes.

`GET /api/auth/session` resolves role from env-backed manual master sessions first, then `accounts:registry`, then the signed session fallback. The frontend local scaffold account rows are not production authority and cannot override the server-resolved role.

## Overview Status API

Implemented endpoint:

- `GET /api/admin/status`

The Overview page uses this endpoint to show signed-in admin identity, account registry status/count, Projects/Media/Alerts CMS storage status/counts, protected public project baseline count when the asset binding is available, Turnstile configured status, OAuth provider configured status, alert ingest bridge configured/missing status, and last checked timestamp. It does not display secret values and does not invent analytics numbers or claim public publishing is complete.

## Analytics Status API

Implemented endpoint:

- `GET /api/admin/analytics`

The Analytics page hydrates from this admin-session-protected Pages Function. Unauthenticated requests return `unauthenticated`, signed-in non-admin users return `admin_required`, and secret values are never returned. When Cloudflare Analytics configuration is missing, the endpoint returns `configured: false`, a clear `cloudflare_analytics_not_configured` source, empty live metric panels, `lastChecked`, and a `requiredConfig` / `missingConfig` list containing env var names only.

Optional future Cloudflare Analytics env vars:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID_DANIELCLANCY`
- `CLOUDFLARE_API_TOKEN_ANALYTICS`

These env vars are not required for the dashboard to load. Until the Cloudflare Analytics API query contract is implemented and tested, the Analytics page keeps map/table scaffold data visible only as labelled sample/local fallback and does not claim live visitor, page-view, referrer, country, or region numbers.

## Admin CMS API

Implemented endpoints:

- `GET /api/admin/cms/projects`
- `PUT /api/admin/cms/projects`
- `GET /api/admin/cms/media`
- `PUT /api/admin/cms/media`
- `GET /api/admin/cms/alerts`
- `PUT /api/admin/cms/alerts`

All CMS endpoints require a signed authenticated admin/master-admin session. Unauthenticated requests return `unauthenticated`, and signed-in non-admin users return `admin_required`. Collection names are allowlisted to `projects`, `media`, and `alerts`.

CMS endpoints are not Turnstile-gated because they are operational admin APIs behind the signed admin session.

Production storage uses Cloudflare KV binding `DC_ADMIN_KV` with keys:

- `accounts:registry`
- `cms:projects`
- `cms:media`
- `cms:alerts`

When `DC_ADMIN_KV` is unavailable, the API returns a clear storage-not-configured/fallback response instead of pretending to save. The dashboard keeps existing localStorage data available and labels this as local browser fallback. A simple static/Python server does not run Cloudflare Pages Functions, so local static views will use fallback mode unless served through a Pages-compatible dev runtime with bindings.

Projects are handled differently from Media and Alerts. `assets/data/public-projects-baseline.json` is a generated snapshot from the public DanielClancy repo's WorkSet-derived portfolio pipeline (`cmsdata/wix/collection-tables/WorkSet.csv`, `src/content/workSetPortfolio.ts`, and the public portfolio routes). The Projects API loads that baseline first, then merges `cms:projects` KV data as admin edits, metadata, visibility/status changes, and admin-created additions. Legacy bare-array KV data and older partial scaffold rows are treated as overlays and must not collapse the Projects list to only those rows.

Projects saves use a `baseline_overlay` wrapper and reject unsafe payloads that are smaller than the protected baseline unless baseline hiding is explicit. In the dashboard, baseline project delete/archive actions soft-hide or archive protected public-site records; only admin-created rows can be hard-deleted. The "Reconcile with public site baseline" action rebuilds the merged manifest from the protected baseline plus existing admin overlay data and saves that safe shape back to KV when admin storage is available. Public-site publishing/hydration from this admin storage remains future work.

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
- Add Cloudflare Analytics env vars only when ready to wire and test the live query path; the dashboard currently reports missing config instead of fake analytics metrics.

## Repository Tree

```text
DanielClancy-Admin/
├── _redirects
├── assets/
│   ├── css/
│   │   └── admin.css
│   ├── data/
│   │   └── public-projects-baseline.json
│   ├── fonts/
│   │   ├── Recharge-Bold.otf
│   │   ├── SuiGeneris-Regular.otf
│   │   ├── mono/
│   │   └── other/
│   ├── icons/
│   ├── js/
│   │   ├── admin-auth.js
│   │   ├── admin-app.js
│   │   ├── scaffold-data.js
│   │   └── turnstile.js
│   └── logos/
├── functions/
│   ├── _shared/
│   │   ├── admin-accounts.js
│   │   ├── alert-sender.js
│   │   └── turnstile.js
│   └── api/
│       ├── admin/
│       │   ├── accounts/
│       │   │   └── [[path]].js
│       │   ├── analytics.js
│       │   ├── cms/
│       │   │   └── [[collection]].js
│       │   └── status.js
│       ├── auth/
│       │   └── [[path]].js
│       ├── track/
│       │   └── page-visit.js
│       └── turnstile/
│           └── config.js
├── tests/
│   └── alerts-disabled.test.mjs
├── BUMP_NOTES.md
├── favicon.ico
├── index.html
└── package.json
```

## Current Scope

- Dashboard shell with topbar, sidebar navigation, footer/status area, and responsive behavior.
- Overview, Analytics, Accounts, Account Detail, Projects, and Settings pages.
- Admin session gate backed by Cloudflare Pages Functions, with local scaffold unlock only for local/static UI smoke testing.
- Accounts page hydrates from the `accounts:registry` KV role store when `DC_ADMIN_KV` is configured, with locked env-backed master admins and master-only role/status/note actions.
- Settings account-access section reflects the same durable account registry, current session role source, Turnstile posture, and secret-safety notes.
- Overview page hydrates operational status from `/api/admin/status` without inventing analytics or exposing secrets.
- Analytics page hydrates Cloudflare readiness from `/api/admin/analytics`; missing Cloudflare Analytics config is reported clearly, and sample map/table rows remain labelled as fallback/demo data.
- Clearly marked local scaffold data for layout and workflow shape only.
- Projects CMS with protected public-site baseline hydration, admin API/KV overlay reconciliation when `DC_ADMIN_KV` is configured, localStorage fallback, table editing, create/edit/detail modal, bulk actions, reset, and safe JSON copy/import controls.
- Media CMS scaffold with admin API/KV hydration when `DC_ADMIN_KV` is configured, localStorage fallback, table editing, create/edit/detail modal, local field-completeness checks, bulk actions, reset, and JSON copy/import controls for future `/watch` page management.
- Media CMS does not publish to DanielClancy.net, fetch YouTube/Rumble feeds, or connect to StreamSuites.
- Alerts rule editing is disabled in DanielClancy-Admin. Alerts is removed from main navigation, direct `#/alerts` visits show the non-editable notice “Alert rules are managed in StreamSuites-Dashboard only,” and create/edit/delete/bulk/import/reset/copy/sync controls are not rendered.
- Admin page visits, successful manual/OAuth auth, and successful Projects/Media/Alerts CMS saves may post DanielClancy alert events to the StreamSuites ingest bridge when `DANIELCLANCY_ALERT_INGEST_URL` and `DANIELCLANCY_ALERT_INGEST_SECRET` are configured. Event payload/context data is stripped of rule/configuration/manifest fields before sending.
- DanielClancy-Admin cannot manage, sync, export, replace, or overwrite StreamSuites canonical alert rule definitions. StreamSuites-Dashboard is the only UI for alert rule definitions.
