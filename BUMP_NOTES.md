# CURRENT VER= v0.1.2-beta / PENDING VER= v1.0

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
