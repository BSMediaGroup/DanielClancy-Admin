# DanielClancy-Admin

Static admin dashboard foundation for `admin.danielclancy.net`.

This repo is the admin surface for the professional DanielClancy.net portfolio/CV ecosystem. It is currently a Cloudflare Pages-compatible static dashboard shell with scaffold data only. Projects CMS and Media CMS editing are browser-local scaffold persistence only; public login widget wiring, real API/export pipeline work, and live Cloudflare/DNS setup are intentionally deferred.

## Local Use

Open `index.html` directly in a browser, or serve the folder with any static file server. There is no package manager or build step in this repo yet.

## Cloudflare Pages Compatibility

The current foundation is static/client-side only. `_redirects` keeps direct dashboard routes on the SPA entrypoint, but this repo does not claim that DNS or the Cloudflare Pages project has been configured.

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
│   │   ├── admin-app.js
│   │   └── scaffold-data.js
│   └── logos/
├── BUMP_NOTES.md
├── favicon.ico
└── index.html
```

## Current Scope

- Dashboard shell with topbar, sidebar navigation, footer/status area, and responsive behavior.
- Overview, Analytics, Accounts, Account Detail, Projects, and Settings pages.
- Clearly marked local scaffold data for layout and workflow shape only.
- Projects CMS scaffold with localStorage persistence, table editing, create/edit/detail modal, bulk actions, reset, and JSON copy/import controls.
- Media CMS scaffold with localStorage persistence, table editing, create/edit/detail modal, local field-completeness checks, bulk actions, reset, and JSON copy/import controls for future `/watch` page management.
- Media CMS does not publish to DanielClancy.net, fetch YouTube/Rumble feeds, connect to StreamSuites, or wire the public login/admin entry yet.
