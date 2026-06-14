# DanielClancy-Admin

Static admin dashboard foundation for `admin.danielclancy.net`.

This repo is the admin surface for the professional DanielClancy.net portfolio/CV ecosystem. It is currently a Cloudflare Pages-compatible dashboard shell with server-side Pages Function auth scaffolding and first-pass admin CMS endpoints for Projects, Media, and Alerts. The CMS pages use KV when configured and retain browser-local fallback for static/dev views. Projects also carry a protected public-site baseline snapshot so existing DanielClancy.net portfolio records are not treated as disposable scaffold rows. Durable account-role storage is still pending.

## Local Use

Open `index.html` directly in a browser, or serve the folder with any static file server. `package.json` exists only so local syntax checks parse Cloudflare Pages Function modules correctly; there is no npm build/lint/test script in this repo yet.

When Pages Functions are unavailable in local static/file mode, the login gate exposes a clearly labelled local scaffold unlock for UI smoke testing only. That local unlock is not a production credential and does not create a signed server session.

## Cloudflare Pages Compatibility

`_redirects` keeps direct dashboard routes on the SPA entrypoint. The auth endpoints under `functions/api/auth/[[path]].js` and CMS endpoints under `functions/api/admin/cms/[[collection]].js` are Cloudflare Pages-compatible and use Web Crypto/HMAC signing for admin session checks, but this repo does not claim that DNS, the Cloudflare Pages project, provider OAuth apps, production env vars, or the KV binding have been configured live.

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

## Account Access Scaffold

Settings includes an Account access section:

- The two manual master admin accounts are shown as env-backed, production-authoritative, and non-removable.
- OAuth/public account rows can be marked `regular` or `admin` in local scaffold storage under `danielclancy-admin.accounts.scaffold.v1`.
- Local account-type edits are not production authority and do not auto-promote signed-in OAuth users. Durable account-role persistence requires a future backend/export/storage layer.

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
│   │   └── turnstile.js
│   └── api/
│       ├── admin/
│       │   └── cms/
│       │       └── [[collection]].js
│       ├── auth/
│       │   └── [[path]].js
│       └── turnstile/
│           └── config.js
├── BUMP_NOTES.md
├── favicon.ico
├── index.html
└── package.json
```

## Current Scope

- Dashboard shell with topbar, sidebar navigation, footer/status area, and responsive behavior.
- Overview, Analytics, Accounts, Account Detail, Projects, and Settings pages.
- Admin session gate backed by Cloudflare Pages Functions, with local scaffold unlock only for local/static UI smoke testing.
- Clearly marked local scaffold data for layout and workflow shape only.
- Projects CMS with protected public-site baseline hydration, admin API/KV overlay reconciliation when `DC_ADMIN_KV` is configured, localStorage fallback, table editing, create/edit/detail modal, bulk actions, reset, and safe JSON copy/import controls.
- Media CMS scaffold with admin API/KV hydration when `DC_ADMIN_KV` is configured, localStorage fallback, table editing, create/edit/detail modal, local field-completeness checks, bulk actions, reset, and JSON copy/import controls for future `/watch` page management.
- Media CMS does not publish to DanielClancy.net, fetch YouTube/Rumble feeds, or connect to StreamSuites.
- Alerts scaffold with admin API/KV hydration when `DC_ADMIN_KV` is configured, localStorage fallback under `danielclancy-admin.alerts.scaffold.v1`, table editing, create/edit/detail modal, bulk enable/disable/severity/target/tag/delete controls, reset, JSON import, and JSON contract export.
- Alerts rows are not live runtime rules. Desktop app visibility, Pushover delivery, and hosted production testing require the StreamSuites/runtime bridge plus Cloudflare Pages/DNS/env setup for `admin.danielclancy.net`.
