# DanielClancy-Admin

Static admin dashboard foundation for `admin.danielclancy.net`.

This repo is the admin surface for the professional DanielClancy.net portfolio/CV ecosystem. It is currently a Cloudflare Pages-compatible dashboard shell with server-side Pages Function auth scaffolding. Projects CMS, Media CMS, and account-type management rows remain browser-local scaffold persistence only; real API/export pipeline work and live Cloudflare/DNS setup are still pending.

## Local Use

Open `index.html` directly in a browser, or serve the folder with any static file server. `package.json` exists only so local syntax checks parse Cloudflare Pages Function modules correctly; there is no npm build/lint/test script in this repo yet.

When Pages Functions are unavailable in local static/file mode, the login gate exposes a clearly labelled local scaffold unlock for UI smoke testing only. That local unlock is not a production credential and does not create a signed server session.

## Cloudflare Pages Compatibility

`_redirects` keeps direct dashboard routes on the SPA entrypoint. The auth endpoints under `functions/api/auth/[[path]].js` are Cloudflare Pages-compatible and use Web Crypto/HMAC signing, but this repo does not claim that DNS, the Cloudflare Pages project, provider OAuth apps, or production env vars have been configured.

## Auth Foundation

Implemented endpoints:

- `GET /api/auth/session`
- `POST /api/auth/login`
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

Required Cloudflare env vars:

- `DC_ADMIN_EMAIL_1`
- `DC_ADMIN_SECRET_1`
- `DC_ADMIN_EMAIL_2`
- `DC_ADMIN_SECRET_2`
- `DC_AUTH_SESSION_SECRET`
- `DC_PUBLIC_SITE_ORIGIN` - expected `https://danielclancy.net`
- `DC_ADMIN_SITE_ORIGIN` - expected `https://admin.danielclancy.net`

Recommended shared-cookie env var:

- `DC_AUTH_COOKIE_DOMAIN` - recommended `.danielclancy.net`

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

- The two manual master admin accounts are shown as env-backed and non-removable.
- OAuth/public account rows can be marked `regular` or `admin` in local scaffold storage under `danielclancy-admin.accounts.scaffold.v1`.
- Local account-type edits are not production authority. Durable account-role persistence requires a future backend/export/storage layer.

## Cloudflare Setup Checkpoint

After local smoke testing, stop for Cloudflare setup before real OAuth/live auth testing:

- Create/confirm the Cloudflare Pages project for DanielClancy-Admin.
- Set `admin.danielclancy.net` DNS/custom domain.
- Add the Cloudflare env vars listed above.
- Create OAuth apps in GitHub, Google Cloud, and Twitter/X developer portals.
- Register callback URLs.
- Confirm cookies across `danielclancy.net` and `admin.danielclancy.net`.

## Repository Tree

```text
DanielClancy-Admin/
├── _redirects
├── assets/
│   ├── css/
│   │   └── admin.css
│   ├── fonts/
│   │   ├── Recharge-Bold.otf
│   │   ├── SuiGeneris-Regular.otf
│   │   ├── mono/
│   │   └── other/
│   ├── icons/
│   ├── js/
│   │   ├── admin-auth.js
│   │   ├── admin-app.js
│   │   └── scaffold-data.js
│   └── logos/
├── functions/
│   └── api/
│       └── auth/
│           └── [[path]].js
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
- Projects CMS scaffold with localStorage persistence, table editing, create/edit/detail modal, bulk actions, reset, and JSON copy/import controls.
- Media CMS scaffold with localStorage persistence, table editing, create/edit/detail modal, local field-completeness checks, bulk actions, reset, and JSON copy/import controls for future `/watch` page management.
- Media CMS does not publish to DanielClancy.net, fetch YouTube/Rumble feeds, or connect to StreamSuites.
- Alerts page remains future work.
