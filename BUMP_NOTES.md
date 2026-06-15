# CURRENT VER= v0.1.2-beta / PENDING VER= v1.0

## Emergency Alert Rule Isolation Guard

### Technical Notes

- Confirmed DanielClancy-Admin Alerts definitions remain scoped to DanielClancy admin storage (`DC_ADMIN_KV` key `cms:alerts`) or the local scaffold key `danielclancy-admin.alerts.scaffold.v1`.
- Hardened the shared alert sender so event payload/context objects strip rule-definition manifest fields before posting to StreamSuites ingest.
- Updated Alerts page copy to state that StreamSuites canonical alert rules are not edited here and that export/copy JSON is manual and non-destructive.
- Kept `page_visit` alert type support available for DanielClancy public/admin page visit events.

### Human-Readable Notes

- DanielClancy-Admin sends alert events only when the ingest URL/secret are configured.
- DanielClancy-Admin Alerts cannot overwrite StreamSuites canonical rules.
- StreamSuites rule management remains authoritative in StreamSuites and StreamSuites-Dashboard.

### Files / Areas Changed

- `assets/js/admin-app.js`
- `functions/_shared/alert-sender.js`
- `README.md`
- `BUMP_NOTES.md`

### Validation

- Run `node --check` on changed frontend JS and Pages Function/helper files.
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
