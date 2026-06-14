(function () {
  const data = window.DC_ADMIN_SCAFFOLD_DATA;
  const app = document.getElementById("app");
  const nav = document.getElementById("sidebar-nav");
  const routeTitle = document.getElementById("route-title");
  const navToggle = document.getElementById("nav-toggle");

  const routes = [
    { id: "overview", label: "Overview", icon: "OV", path: "#/overview" },
    { id: "analytics", label: "Analytics", icon: "AN", path: "#/analytics" },
    { id: "accounts", label: "Accounts", icon: "AC", path: "#/accounts" },
    { id: "settings", label: "Settings", icon: "SE", path: "#/settings" },
    { id: "projects", label: "Projects", icon: "PR", path: "#/projects" },
    { id: "media", label: "Media", icon: "ME", path: "#/media" }
  ];

  const PROJECTS_STORAGE_KEY = "danielclancy-admin.projects.scaffold.v1";
  const MEDIA_STORAGE_KEY = "danielclancy-admin.media.scaffold.v1";
  const projectState = {
    projects: loadProjects(),
    search: "",
    status: "all",
    asset: "all",
    selected: new Set(),
    bulkMode: false,
    modal: null,
    message: "Local scaffold data loaded. Changes stay in this browser only."
  };
  const mediaState = {
    items: loadMediaItems(),
    search: "",
    status: "all",
    platform: "all",
    health: "all",
    selected: new Set(),
    bulkMode: false,
    modal: null,
    message: "Local media scaffold loaded. Changes stay in this browser only."
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeProject(raw) {
    const fallbackId = createSlug(raw?.slug || raw?.id || raw?.title || `project-${Date.now()}`);
    return {
      id: String(raw?.id || fallbackId),
      slug: createSlug(raw?.slug || raw?.id || raw?.title || fallbackId),
      title: String(raw?.title || "Untitled project scaffold"),
      client: String(raw?.client || ""),
      category: String(raw?.category || raw?.discipline || ""),
      discipline: String(raw?.discipline || raw?.category || ""),
      status: ["published", "draft", "hidden", "archived"].includes(String(raw?.status || "").toLowerCase())
        ? String(raw.status).toLowerCase()
        : "draft",
      visibility: ["public", "private", "hidden"].includes(String(raw?.visibility || "").toLowerCase())
        ? String(raw.visibility).toLowerCase()
        : "private",
      year: String(raw?.year || ""),
      dateLabel: String(raw?.dateLabel || ""),
      featured: Boolean(raw?.featured),
      role: String(raw?.role || raw?.responsibility || ""),
      summary: String(raw?.summary || ""),
      description: String(raw?.description || ""),
      heroImage: String(raw?.heroImage || raw?.image || ""),
      thumbnailPath: String(raw?.thumbnailPath || raw?.image || raw?.heroImage || ""),
      galleryPaths: arrayFromValue(raw?.galleryPaths || raw?.media || []),
      documentPath: String(raw?.documentPath || raw?.documentationFileName || ""),
      documentationUrl: String(raw?.documentationUrl || ""),
      livePage: String(raw?.livePage || (raw?.slug ? `/portfolio/${raw.slug}` : "")),
      tags: arrayFromValue(raw?.tags || raw?.subtypes || []),
      studio: arrayFromValue(raw?.studio || []),
      software: arrayFromValue(raw?.software || []),
      sourceFolder: String(raw?.sourceFolder || "cmsdata/wix/collection-tables/WorkSet.csv"),
      sourceFiles: arrayFromValue(raw?.sourceFiles || []),
      sourceConfidence: String(raw?.sourceConfidence || "Medium"),
      internalNotes: String(raw?.internalNotes || raw?.internalSourceNote || ""),
      updatedAt: String(raw?.updatedAt || new Date().toISOString())
    };
  }

  function arrayFromValue(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === "string" ? item : item?.fileName || item?.src || item?.path || item?.label || ""))
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    return String(value || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function createSlug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/^\/workset\//, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project-scaffold";
  }

  function loadProjects() {
    const seed = Array.isArray(data.projects) ? data.projects.map(normalizeProject) : [];

    try {
      const stored = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!stored) {
        return seed;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return seed;
      }

      return parsed.map(normalizeProject);
    } catch {
      return seed;
    }
  }

  function persistProjects() {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectState.projects, null, 2));
  }

  function normalizeMediaItem(raw) {
    const fallbackId = createSlug(raw?.slug || raw?.id || raw?.title || `media-${Date.now()}`);
    const status = String(raw?.status || raw?.visibility || "draft").toLowerCase();
    const platform = String(raw?.platform || raw?.provider || "local").toLowerCase();
    const type = String(raw?.type || raw?.kind || "video").toLowerCase();

    return {
      id: String(raw?.id || fallbackId),
      slug: createSlug(raw?.slug || raw?.id || raw?.title || fallbackId),
      title: String(raw?.title || ""),
      type: ["livestream", "video", "short", "clip", "podcast", "upload", "embed"].includes(type) ? type : "video",
      status: ["draft", "scheduled", "live", "archived", "hidden", "published"].includes(status) ? status : "draft",
      visibility: ["public", "draft", "hidden", "private"].includes(String(raw?.visibility || "").toLowerCase())
        ? String(raw.visibility).toLowerCase()
        : status === "published" || status === "live" ? "public" : status === "hidden" ? "hidden" : "draft",
      platform: ["youtube", "rumble", "streamsuites", "local", "external"].includes(platform) ? platform : "external",
      scheduledAt: String(raw?.scheduledAt || raw?.scheduled_at || ""),
      publishedAt: String(raw?.publishedAt || raw?.published_at || raw?.date || ""),
      featured: Boolean(raw?.featured),
      thumbnailPath: String(raw?.thumbnailPath || raw?.thumbnailUrl || ""),
      embedUrl: String(raw?.embedUrl || ""),
      videoUrl: String(raw?.videoUrl || raw?.url || ""),
      replayUrl: String(raw?.replayUrl || ""),
      externalPageUrl: String(raw?.externalPageUrl || raw?.pageUrl || ""),
      summary: String(raw?.summary || raw?.excerpt || ""),
      description: String(raw?.description || ""),
      tags: arrayFromValue(raw?.tags || []),
      internalNotes: String(raw?.internalNotes || ""),
      updatedAt: String(raw?.updatedAt || new Date().toISOString())
    };
  }

  function loadMediaItems() {
    const seed = Array.isArray(data.media) ? data.media.map(normalizeMediaItem) : [];

    try {
      const stored = window.localStorage.getItem(MEDIA_STORAGE_KEY);
      if (!stored) {
        return seed;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return seed;
      }

      return parsed.map(normalizeMediaItem);
    } catch {
      return seed;
    }
  }

  function persistMediaItems() {
    window.localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(mediaState.items, null, 2));
  }

  function projectAssetIssues(project) {
    const issues = [];

    if (!project.heroImage && !project.thumbnailPath) issues.push("missing image");
    if (!project.documentPath && !project.documentationUrl) issues.push("missing document");
    if (!project.galleryPaths.length && !project.sourceFiles.length) issues.push("missing gallery");
    if (!project.livePage) issues.push("missing detail link");
    if (project.status !== "published" || project.visibility !== "public") issues.push("draft/hidden");

    return issues;
  }

  function projectAssetTone(project) {
    const issues = projectAssetIssues(project);
    if (!issues.length) return "success";
    if (issues.length <= 2) return "warn";
    return "danger";
  }

  function projectStatusTone(value) {
    if (value === "published") return "success";
    if (value === "archived" || value === "hidden") return "danger";
    return "warn";
  }

  function mediaCompletenessIssues(item) {
    const issues = [];

    if (!item.title) issues.push("missing title");
    if (!item.slug) issues.push("missing slug/id");
    if (!item.thumbnailPath) issues.push("missing thumbnail");
    if (!item.embedUrl && !item.videoUrl) issues.push("missing embed/video URL");
    if (item.type === "livestream" && item.status === "archived" && !item.replayUrl) issues.push("missing replay URL");
    if (item.status === "scheduled" && !item.scheduledAt) issues.push("missing scheduled date");
    if (!item.tags.length) issues.push("missing tags");
    if (item.status === "draft" || item.status === "hidden" || item.visibility !== "public") issues.push("hidden/draft status");

    return issues;
  }

  function mediaHealthTone(item) {
    const issues = mediaCompletenessIssues(item);
    if (!issues.length) return "success";
    if (issues.length <= 2) return "warn";
    return "danger";
  }

  function mediaStatusTone(value) {
    if (value === "live" || value === "published") return "success";
    if (value === "archived" || value === "hidden") return "danger";
    return "warn";
  }

  function mediaSearchBlob(item) {
    return [
      item.title,
      item.slug,
      item.type,
      item.status,
      item.visibility,
      item.platform,
      item.scheduledAt,
      item.publishedAt,
      item.thumbnailPath,
      item.embedUrl,
      item.videoUrl,
      item.replayUrl,
      item.externalPageUrl,
      item.summary,
      item.description,
      item.tags.join(" ")
    ]
      .join(" ")
      .toLowerCase();
  }

  function filteredMediaItems() {
    const term = mediaState.search.trim().toLowerCase();
    return mediaState.items.filter((item) => {
      if (mediaState.status !== "all" && item.status !== mediaState.status) {
        return false;
      }

      if (mediaState.platform !== "all" && item.platform !== mediaState.platform) {
        return false;
      }

      const issues = mediaCompletenessIssues(item);
      if (mediaState.health === "issues" && !issues.length) return false;
      if (mediaState.health === "complete" && issues.length) return false;

      return !term || mediaSearchBlob(item).includes(term);
    });
  }

  function uniqueValues(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
  }

  function projectSearchBlob(project) {
    return [
      project.title,
      project.slug,
      project.client,
      project.category,
      project.discipline,
      project.status,
      project.visibility,
      project.year,
      project.tags.join(" "),
      project.studio.join(" "),
      project.software.join(" ")
    ]
      .join(" ")
      .toLowerCase();
  }

  function filteredProjects() {
    const term = projectState.search.trim().toLowerCase();
    return projectState.projects.filter((project) => {
      if (projectState.status !== "all" && project.status !== projectState.status) {
        return false;
      }

      const issues = projectAssetIssues(project);
      if (projectState.asset === "issues" && !issues.length) return false;
      if (projectState.asset === "complete" && issues.length) return false;

      return !term || projectSearchBlob(project).includes(term);
    });
  }

  function formValue(form, name) {
    return String(new FormData(form).get(name) || "").trim();
  }

  function textareaArray(value) {
    return String(value || "")
      .split(/\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function panel(title, description, body, actions = "") {
    return `
      <section class="panel">
        <header class="panel-header">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(description)}</p>
          </div>
          ${actions ? `<div class="panel-actions">${actions}</div>` : ""}
        </header>
        <div class="panel-body">${body}</div>
      </section>
    `;
  }

  function badge(text, tone = "") {
    const toneClass = tone ? ` badge-${tone}` : "";
    return `<span class="badge${toneClass}">${escapeHtml(text)}</span>`;
  }

  function pageHeader(kicker, title, copy, actions = "") {
    return `
      <header class="page-header">
        <div class="page-title">
          <span class="section-kicker">${escapeHtml(kicker)}</span>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(copy)}</p>
        </div>
        ${actions ? `<div class="panel-actions">${actions}</div>` : ""}
      </header>
    `;
  }

  function metricCards(items) {
    return `
      <div class="grid grid-4">
        ${items
          .map(
            (item) => `
              <article class="card metric-card">
                <span class="metric-label">${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.value)}</strong>
                <p>${escapeHtml(item.note || "")}</p>
                ${badge(item.tone === "warn" ? "Scaffold" : "Ready", item.tone)}
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function simpleCards(items) {
    return `
      <div class="grid grid-4">
        ${items
          .map(
            (item) => `
              <article class="card">
                <span class="metric-label">${escapeHtml(item.label)}</span>
                <h3>${escapeHtml(item.value)}</h3>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  function renderNav(activeRoute) {
    nav.innerHTML = routes
      .map((route) => {
        const isActive = route.id === activeRoute;
        const classes = ["nav-link", isActive ? "is-active" : "", route.disabled ? "is-disabled" : ""]
          .filter(Boolean)
          .join(" ");
        const href = route.disabled ? "javascript:void(0)" : route.path;
        const meta = route.disabled ? "Future" : "Open";
        return `
          <a class="${classes}" href="${href}" ${route.disabled ? 'aria-disabled="true"' : ""}>
            <span class="nav-icon">${escapeHtml(route.icon)}</span>
            <span>${escapeHtml(route.label)}</span>
            <small class="nav-meta">${escapeHtml(meta)}</small>
          </a>
        `;
      })
      .join("");
  }

  function renderOverview() {
    routeTitle.textContent = "Overview";
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Admin command overview",
          "Overview",
          "Operational posture for the DanielClancy.net admin foundation. This page summarizes scaffold readiness without claiming live metrics or backend authority.",
          badge(data.generatedLabel, "warn")
        )}

        <section class="panel">
          <div class="panel-body grid hero-grid">
            <div class="card">
              <span class="section-kicker">Foundation milestone</span>
              <h2>Professional portfolio administration shell</h2>
              <p class="muted">
                This first dashboard pass establishes the shared layout, route structure, status framing, and review-ready content areas for a clean employer-facing portfolio ecosystem.
              </p>
              <div class="toolbar">
                <a class="button" href="#/analytics">Review Analytics</a>
                <a class="button button-secondary" href="#/accounts">Review Accounts</a>
                <a class="button button-secondary" href="#/settings">Open Settings</a>
              </div>
            </div>
            <div class="card">
              <h3>Authority boundary</h3>
              <p class="muted">
                The dashboard does not own canonical portfolio content, real analytics, account state, auth sessions, or deployment state yet.
              </p>
              ${badge("No live API", "warn")}
            </div>
          </div>
        </section>

        ${panel(
          "Status summary",
          "Scaffold-only status cards for the requested admin foundation.",
          metricCards(data.overview.summary)
        )}

        ${panel(
          "Portfolio ecosystem readiness",
          "Visible workstream posture without inventing shipped CMS or login capabilities.",
          simpleCards(data.overview.readiness)
        )}

        ${panel(
          "Implementation boundaries",
          "Current constraints that should remain explicit until later milestones wire real authority.",
          `<div class="grid grid-2">${data.overview.posture
            .map((item) => `<article class="card">${badge("Boundary")}<p>${escapeHtml(item)}</p></article>`)
            .join("")}</div>`
        )}
      </div>
    `;
  }

  function renderAnalytics() {
    routeTitle.textContent = "Analytics";
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Analytics scaffold",
          "Analytics",
          "Map-led analytics layout adapted from the reference dashboard. All geography, route, and activity values are local placeholders until a real analytics source is wired.",
          badge("Placeholder data", "warn")
        )}

        <section class="panel">
          <header class="panel-header">
            <div>
              <h2>Global Sessions Map</h2>
              <p>Country and region marker layout placeholder. No visitor counts are real.</p>
            </div>
            <div class="panel-actions">
              ${badge("Map scaffold", "warn")}
              ${badge("No telemetry")}
            </div>
          </header>
          <div class="panel-body">
            <div class="map-shell" role="img" aria-label="Scaffold map-style analytics panel">
              ${data.analytics.markers
                .map(
                  (marker) => `
                    <span class="map-marker" style="--x: ${escapeHtml(marker.x)}; --y: ${escapeHtml(marker.y)};">
                      <span>${escapeHtml(marker.label)}</span>
                    </span>
                  `
                )
                .join("")}
            </div>
          </div>
        </section>

        <section class="grid analytics-grid">
          ${panel(
            "Geographic breakdown",
            "Reference-style location table using scaffold rows only.",
            `<div class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th>Location</th><th>Precision</th><th>Sessions</th><th>Source</th></tr>
                </thead>
                <tbody>
                  ${data.analytics.geoRows
                    .map(
                      (row) => `
                        <tr>
                          <td><strong>${escapeHtml(row.location)}</strong></td>
                          <td>${escapeHtml(row.precision)}</td>
                          <td>${escapeHtml(row.sessions)}</td>
                          <td>${escapeHtml(row.source)}</td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          )}
          ${panel(
            "Analytics readiness notes",
            "Explicit non-live status for this foundation milestone.",
            `<div class="grid">${data.analytics.notes
              .map((note) => `<article class="card">${badge("Note", "warn")}<p>${escapeHtml(note)}</p></article>`)
              .join("")}</div>`
          )}
        </section>

        ${panel(
          "Top routes / resources",
          "Static route table matching the admin shell pages established in this task.",
          `<div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Route</th><th>Surface</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${data.analytics.routeRows
                  .map(
                    (row) => `
                      <tr>
                        <td><strong>${escapeHtml(row.route)}</strong></td>
                        <td>${escapeHtml(row.surface)}</td>
                        <td>${escapeHtml(row.status)}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        )}
      </div>
    `;
  }

  function renderAccounts() {
    routeTitle.textContent = "Accounts";
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Admin workspace",
          "Accounts",
          "Reference-style account list using scaffold identities only. Authentication, real user records, and public login widget wiring are not connected.",
          badge("Scaffold accounts", "warn")
        )}

        ${panel(
          "Account access summary",
          "Placeholder rows for future admin account review and detail routing.",
          `<div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Account</th><th>Role</th><th>Access</th><th>Status</th><th>Detail</th></tr>
              </thead>
              <tbody>
                ${data.accounts
                  .map(
                    (account) => `
                      <tr>
                        <td><strong>${escapeHtml(account.name)}</strong><br><span>${escapeHtml(account.email)}</span></td>
                        <td>${escapeHtml(account.role)}</td>
                        <td>${escapeHtml(account.access)}</td>
                        <td>${escapeHtml(account.status)}</td>
                        <td><a class="row-link" href="#/accounts/${encodeURIComponent(account.id)}">Open detail</a></td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        )}

        ${panel(
          "Access boundary",
          "No real authentication or account mutation controls are implemented in this foundation.",
          `<div class="empty-state">Future account authority must come from a real admin/auth API. This page currently proves layout, routing, and detail presentation only.</div>`
        )}
      </div>
    `;
  }

  function renderProjects() {
    routeTitle.textContent = "Projects";
    const visibleProjects = filteredProjects();
    const selectedVisible = visibleProjects.filter((project) => projectState.selected.has(project.id)).length;
    const issueCount = projectState.projects.filter((project) => projectAssetIssues(project).length).length;
    const featuredCount = projectState.projects.filter((project) => project.featured).length;
    const publishedCount = projectState.projects.filter((project) => project.status === "published").length;
    const statuses = uniqueValues(projectState.projects.map((project) => project.status));

    app.innerHTML = `
      <div class="page projects-page">
        ${pageHeader(
          "Projects CMS scaffold",
          "Projects",
          "Manage portfolio listing metadata in a browser-local scaffold. Saves use localStorage only and do not publish changes to DanielClancy.net.",
          `<button class="button" type="button" data-project-action="create">Create Project</button>
           <button class="button button-secondary" type="button" data-project-action="copy-json">Copy JSON</button>
           <button class="button button-secondary" type="button" data-project-action="import-json">Import JSON</button>
           <button class="button button-secondary" type="button" data-project-action="reset">Reset seed</button>`
        )}

        ${panel(
          "Local scaffold status",
          "Field completeness is checked locally only. No network checks, public-site writes, or backend export pipeline are active.",
          metricCards([
            { label: "Projects", value: String(projectState.projects.length), note: "Rows in local browser storage.", tone: "warn" },
            { label: "Published", value: String(publishedCount), note: "Local visibility metadata only.", tone: "warn" },
            { label: "Featured", value: String(featuredCount), note: "Local homepage/archive flag only.", tone: "warn" },
            { label: "Asset issues", value: String(issueCount), note: "Missing-field checks only; links are not externally verified.", tone: issueCount ? "warn" : "" }
          ])
        )}

        ${panel(
          "Filters and bulk controls",
          "Search project metadata, select rows, and apply confirmed bulk changes to the local scaffold.",
          renderProjectControls(statuses, visibleProjects.length, selectedVisible)
        )}

        ${panel(
          "Project table editor",
          "Table-style CMS editor aligned to the public WorkSet-derived portfolio fields where practical.",
          renderProjectTable(visibleProjects)
        )}

        ${projectState.modal ? renderProjectModal(projectState.modal) : ""}
      </div>
    `;
  }

  function renderMedia() {
    routeTitle.textContent = "Media";
    const visibleItems = filteredMediaItems();
    const selectedVisible = visibleItems.filter((item) => mediaState.selected.has(item.id)).length;
    const issueCount = mediaState.items.filter((item) => mediaCompletenessIssues(item).length).length;
    const featuredCount = mediaState.items.filter((item) => item.featured).length;
    const liveOrPublishedCount = mediaState.items.filter((item) => item.status === "live" || item.status === "published").length;
    const archivedCount = mediaState.items.filter((item) => item.status === "archived").length;
    const statuses = uniqueValues(mediaState.items.map((item) => item.status));
    const platforms = uniqueValues(mediaState.items.map((item) => item.platform));

    app.innerHTML = `
      <div class="page media-page">
        ${pageHeader(
          "Media CMS scaffold",
          "Media",
          "Manage future /watch page media metadata in a browser-local scaffold. Saves use localStorage only and do not update DanielClancy.net.",
          `<button class="button" type="button" data-media-action="create">Create Media Item</button>
           <button class="button button-secondary" type="button" data-media-action="copy-json">Copy JSON</button>
           <button class="button button-secondary" type="button" data-media-action="import-json">Import JSON</button>
           <button class="button button-secondary" type="button" data-media-action="reset">Reset seed</button>`
        )}

        ${panel(
          "Local scaffold status",
          "This editor does not publish content, fetch YouTube/Rumble feeds, embed StreamSuites profiles, or write public exports. Completeness checks are local field checks only.",
          metricCards([
            { label: "Media rows", value: String(mediaState.items.length), note: "Rows in local browser storage.", tone: "warn" },
            { label: "Live/published", value: String(liveOrPublishedCount), note: "Local status metadata only.", tone: "warn" },
            { label: "Archived", value: String(archivedCount), note: "Future replay/history planning only.", tone: "warn" },
            { label: "Field issues", value: String(issueCount), note: "Missing-field checks only; links are not externally verified.", tone: issueCount ? "warn" : "" }
          ])
        )}

        ${panel(
          "Filters and bulk controls",
          "Search media metadata, select rows, and apply bulk changes to local scaffold rows.",
          renderMediaControls(statuses, platforms, visibleItems.length, selectedVisible, featuredCount)
        )}

        ${panel(
          "Media table editor",
          "Table-style CMS editor aligned to the current public /watch feed shape where practical, with room for livestream and replay metadata.",
          renderMediaTable(visibleItems)
        )}

        ${mediaState.modal ? renderMediaModal(mediaState.modal) : ""}
      </div>
    `;
  }

  function renderMediaControls(statuses, platforms, visibleCount, selectedVisible, featuredCount) {
    return `
      <div class="cms-toolbar" data-media-controls>
        <label class="field field-wide">
          <span>Search</span>
          <input class="input" type="search" value="${escapeHtml(mediaState.search)}" placeholder="Title, slug, platform, URL, tag, status" data-media-filter="search" />
        </label>
        <label class="field">
          <span>Status</span>
          <select class="input" data-media-filter="status">
            <option value="all"${mediaState.status === "all" ? " selected" : ""}>All statuses</option>
            ${statuses
              .map((status) => `<option value="${escapeHtml(status)}"${mediaState.status === status ? " selected" : ""}>${escapeHtml(status)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Platform</span>
          <select class="input" data-media-filter="platform">
            <option value="all"${mediaState.platform === "all" ? " selected" : ""}>All platforms</option>
            ${platforms
              .map((platform) => `<option value="${escapeHtml(platform)}"${mediaState.platform === platform ? " selected" : ""}>${escapeHtml(platform)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Health</span>
          <select class="input" data-media-filter="health">
            <option value="all"${mediaState.health === "all" ? " selected" : ""}>All rows</option>
            <option value="issues"${mediaState.health === "issues" ? " selected" : ""}>Needs fields</option>
            <option value="complete"${mediaState.health === "complete" ? " selected" : ""}>Complete fields</option>
          </select>
        </label>
        <div class="cms-toolbar-summary">
          ${badge(`${visibleCount} visible`, "warn")}
          ${badge(`${mediaState.selected.size} selected`, selectedVisible ? "success" : "warn")}
          ${badge(`${featuredCount} featured`, "warn")}
          ${badge("Browser local only", "warn")}
        </div>
      </div>
      <div class="bulk-panel ${mediaState.bulkMode ? "is-open" : ""}">
        <div>
          <strong>Bulk editing mode</strong>
          <p class="muted">Selected-row actions update ${escapeHtml(MEDIA_STORAGE_KEY)} only. Delete requires confirmation and never affects DanielClancy.net.</p>
        </div>
        <div class="toolbar">
          <button class="button button-secondary" type="button" data-media-action="toggle-bulk">${mediaState.bulkMode ? "Close bulk mode" : "Open bulk mode"}</button>
          <button class="button button-secondary" type="button" data-media-action="select-visible">Select visible</button>
          <button class="button button-secondary" type="button" data-media-action="clear-selection">Clear selection</button>
          <select class="input input-compact" data-media-bulk-field="status" ${mediaState.selected.size ? "" : "disabled"}>
            <option value="">Set status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
            <option value="hidden">Hidden</option>
          </select>
          <select class="input input-compact" data-media-bulk-field="platform" ${mediaState.selected.size ? "" : "disabled"}>
            <option value="">Set platform</option>
            <option value="youtube">YouTube</option>
            <option value="rumble">Rumble</option>
            <option value="streamsuites">StreamSuites</option>
            <option value="local">Local</option>
            <option value="external">External</option>
          </select>
          <select class="input input-compact" data-media-bulk-field="featured" ${mediaState.selected.size ? "" : "disabled"}>
            <option value="">Set featured</option>
            <option value="true">Featured yes</option>
            <option value="false">Featured no</option>
          </select>
          <input class="input input-compact" type="text" placeholder="Tag" data-media-bulk-tag ${mediaState.selected.size ? "" : "disabled"} />
          <button class="button button-secondary" type="button" data-media-action="bulk-add-tag" ${mediaState.selected.size ? "" : "disabled"}>Add tag</button>
          <button class="button button-secondary" type="button" data-media-action="bulk-remove-tag" ${mediaState.selected.size ? "" : "disabled"}>Remove tag</button>
          <button class="button button-danger" type="button" data-media-action="bulk-delete" ${mediaState.selected.size ? "" : "disabled"}>Delete selected</button>
        </div>
        <div class="project-message" role="status">${escapeHtml(mediaState.message)}</div>
      </div>
    `;
  }

  function renderMediaTable(items) {
    if (!items.length) {
      return `<div class="empty-state">No local scaffold media items match the current filters. Create a media item or reset the seed rows.</div>`;
    }

    return `
      <div class="table-wrap media-table-wrap">
        <table class="table project-table media-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select visible media items" data-media-select-all ${items.every((item) => mediaState.selected.has(item.id)) ? "checked" : ""} /></th>
              <th>Title</th>
              <th>Slug / ID</th>
              <th>Type</th>
              <th>Status / visibility</th>
              <th>Platform</th>
              <th>Date</th>
              <th>Featured</th>
              <th>URLs / thumbnail</th>
              <th>Tags</th>
              <th>Media health</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(renderMediaRow).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderMediaRow(item) {
    const issues = mediaCompletenessIssues(item);
    const issueLabel = issues.length ? issues.join(", ") : "complete fields";
    const dateLabel = item.scheduledAt || item.publishedAt || "Undated";
    return `
      <tr>
        <td><input type="checkbox" aria-label="Select ${escapeHtml(item.title || item.slug)}" data-media-select="${escapeHtml(item.id)}" ${mediaState.selected.has(item.id) ? "checked" : ""} /></td>
        <td><strong>${escapeHtml(item.title || "Untitled media scaffold")}</strong><br><span>${escapeHtml(item.summary || "No summary field")}</span></td>
        <td><code>${escapeHtml(item.slug)}</code></td>
        <td>${badge(item.type)}</td>
        <td>${badge(item.status, mediaStatusTone(item.status))}<br>${badge(item.visibility, item.visibility === "public" ? "success" : "warn")}</td>
        <td>${badge(item.platform)}</td>
        <td>${escapeHtml(dateLabel)}</td>
        <td>${item.featured ? badge("Featured", "success") : badge("Standard")}</td>
        <td>
          <span class="path-text">${escapeHtml(item.thumbnailPath || "Missing thumbnail")}</span>
          <span class="path-text">${escapeHtml(item.embedUrl || item.videoUrl || "Missing embed/video URL")}</span>
          <span class="path-text">${escapeHtml(item.replayUrl || "No replay URL")}</span>
        </td>
        <td><div class="chip-row">${item.tags.slice(0, 4).map((tag) => badge(tag)).join("") || badge("No tags", "warn")}</div></td>
        <td>${badge(issueLabel, mediaHealthTone(item))}<br><small>Local field completeness only</small></td>
        <td>${escapeHtml(formatTimestamp(item.updatedAt))}</td>
        <td>
          <div class="row-actions">
            <button class="button button-secondary" type="button" data-media-action="detail" data-media-id="${escapeHtml(item.id)}">Detail</button>
            <button class="button button-secondary" type="button" data-media-action="edit" data-media-id="${escapeHtml(item.id)}">Edit</button>
            <button class="button button-danger" type="button" data-media-action="delete" data-media-id="${escapeHtml(item.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderMediaModal(modal) {
    const item = modal.item;
    const readOnly = modal.mode === "detail";
    const issues = mediaCompletenessIssues(item);
    const title = modal.mode === "create" ? "Create media scaffold" : modal.mode === "detail" ? "Media detail" : "Edit media scaffold";
    return `
      <div class="modal-backdrop" data-media-modal-backdrop>
        <section class="modal media-modal" role="dialog" aria-modal="true" aria-labelledby="media-modal-title">
          <header class="modal-header">
            <div>
              <span class="section-kicker">Local /watch scaffold editor</span>
              <h2 id="media-modal-title">${escapeHtml(title)}</h2>
              <p>Save writes only to ${escapeHtml(MEDIA_STORAGE_KEY)} in this browser. It does not update DanielClancy.net or fetch external feeds.</p>
            </div>
            <button class="icon-close" type="button" aria-label="Close media editor" data-media-action="close-modal">x</button>
          </header>
          <form class="modal-body project-form media-form" data-media-form>
            <input type="hidden" name="originalId" value="${escapeHtml(item.id)}" />
            <div class="form-grid">
              ${field("Title", "title", item.title, "text", true, readOnly)}
              ${field("Slug / ID", "slug", item.slug, "text", true, readOnly)}
              <label class="field">
                <span>Type</span>
                <select class="input" name="type" ${readOnly ? "disabled" : ""}>
                  ${["livestream", "video", "short", "clip", "podcast", "upload", "embed"].map((type) => `<option value="${type}"${item.type === type ? " selected" : ""}>${type}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Status</span>
                <select class="input" name="status" ${readOnly ? "disabled" : ""}>
                  ${["draft", "scheduled", "live", "published", "archived", "hidden"].map((status) => `<option value="${status}"${item.status === status ? " selected" : ""}>${status}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Visibility</span>
                <select class="input" name="visibility" ${readOnly ? "disabled" : ""}>
                  ${["public", "draft", "hidden", "private"].map((visibility) => `<option value="${visibility}"${item.visibility === visibility ? " selected" : ""}>${visibility}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Platform</span>
                <select class="input" name="platform" ${readOnly ? "disabled" : ""}>
                  ${["youtube", "rumble", "streamsuites", "local", "external"].map((platform) => `<option value="${platform}"${item.platform === platform ? " selected" : ""}>${platform}</option>`).join("")}
                </select>
              </label>
              ${field("Scheduled/live date", "scheduledAt", item.scheduledAt, "datetime-local", false, readOnly)}
              ${field("Published date", "publishedAt", item.publishedAt, "datetime-local", false, readOnly)}
              <label class="checkbox-field">
                <input type="checkbox" name="featured" ${item.featured ? "checked" : ""} ${readOnly ? "disabled" : ""} />
                <span>Featured media item</span>
              </label>
              ${field("Thumbnail path", "thumbnailPath", item.thumbnailPath, "text", false, readOnly)}
              ${field("Embed URL", "embedUrl", item.embedUrl, "url", false, readOnly)}
              ${field("Video URL", "videoUrl", item.videoUrl, "url", false, readOnly)}
              ${field("Replay URL", "replayUrl", item.replayUrl, "url", false, readOnly)}
              ${field("External page URL", "externalPageUrl", item.externalPageUrl, "url", false, readOnly)}
              ${textareaField("Summary / excerpt", "summary", item.summary, readOnly)}
              ${textareaField("Description", "description", item.description, readOnly)}
              ${textareaField("Tags", "tags", item.tags.join("\n"), readOnly)}
              ${textareaField("Internal notes", "internalNotes", item.internalNotes, readOnly)}
            </div>
            <aside class="asset-status-box">
              <h3>Media health</h3>
              <p>Local field completeness only. No network checks, feed verification, external embed validation, or public publishing is performed.</p>
              <div class="chip-row">
                ${issues.length ? issues.map((issue) => badge(issue, "warn")).join("") : badge("Complete local fields", "success")}
              </div>
            </aside>
            <footer class="modal-footer">
              <button class="button button-secondary" type="button" data-media-action="close-modal">Cancel</button>
              ${readOnly ? `<button class="button" type="button" data-media-action="edit" data-media-id="${escapeHtml(item.id)}">Edit</button>` : `<button class="button" type="submit">Save local scaffold</button>`}
            </footer>
          </form>
        </section>
      </div>
    `;
  }

  function renderProjectControls(statuses, visibleCount, selectedVisible) {
    return `
      <div class="cms-toolbar" data-project-controls>
        <label class="field field-wide">
          <span>Search</span>
          <input class="input" type="search" value="${escapeHtml(projectState.search)}" placeholder="Title, slug, studio, tag, asset path" data-project-filter="search" />
        </label>
        <label class="field">
          <span>Status</span>
          <select class="input" data-project-filter="status">
            <option value="all"${projectState.status === "all" ? " selected" : ""}>All statuses</option>
            ${statuses
              .map((status) => `<option value="${escapeHtml(status)}"${projectState.status === status ? " selected" : ""}>${escapeHtml(status)}</option>`)
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Asset status</span>
          <select class="input" data-project-filter="asset">
            <option value="all"${projectState.asset === "all" ? " selected" : ""}>All rows</option>
            <option value="issues"${projectState.asset === "issues" ? " selected" : ""}>Needs fields</option>
            <option value="complete"${projectState.asset === "complete" ? " selected" : ""}>Complete fields</option>
          </select>
        </label>
        <div class="cms-toolbar-summary">
          ${badge(`${visibleCount} visible`, "warn")}
          ${badge(`${projectState.selected.size} selected`, selectedVisible ? "success" : "warn")}
          ${badge("Browser local only", "warn")}
        </div>
      </div>
      <div class="bulk-panel ${projectState.bulkMode ? "is-open" : ""}">
        <div>
          <strong>Bulk editing mode</strong>
          <p class="muted">Selected-row actions update localStorage only after confirmation for destructive changes.</p>
        </div>
        <div class="toolbar">
          <button class="button button-secondary" type="button" data-project-action="toggle-bulk">${projectState.bulkMode ? "Close bulk mode" : "Open bulk mode"}</button>
          <button class="button button-secondary" type="button" data-project-action="select-visible">Select visible</button>
          <button class="button button-secondary" type="button" data-project-action="clear-selection">Clear selection</button>
          <select class="input input-compact" data-bulk-field="status" ${projectState.selected.size ? "" : "disabled"}>
            <option value="">Set status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
            <option value="archived">Archived</option>
          </select>
          <select class="input input-compact" data-bulk-field="featured" ${projectState.selected.size ? "" : "disabled"}>
            <option value="">Set featured</option>
            <option value="true">Featured yes</option>
            <option value="false">Featured no</option>
          </select>
          <input class="input input-compact" type="text" placeholder="Tag" data-bulk-tag ${projectState.selected.size ? "" : "disabled"} />
          <button class="button button-secondary" type="button" data-project-action="bulk-add-tag" ${projectState.selected.size ? "" : "disabled"}>Add tag</button>
          <button class="button button-secondary" type="button" data-project-action="bulk-remove-tag" ${projectState.selected.size ? "" : "disabled"}>Remove tag</button>
          <button class="button button-danger" type="button" data-project-action="bulk-delete" ${projectState.selected.size ? "" : "disabled"}>Delete selected</button>
        </div>
        <div class="project-message" role="status">${escapeHtml(projectState.message)}</div>
      </div>
    `;
  }

  function renderProjectTable(projects) {
    if (!projects.length) {
      return `<div class="empty-state">No local scaffold projects match the current filters. Create a project or reset the seed rows.</div>`;
    }

    return `
      <div class="table-wrap project-table-wrap">
        <table class="table project-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select visible projects" data-project-select-all ${projects.every((project) => projectState.selected.has(project.id)) ? "checked" : ""} /></th>
              <th>Title</th>
              <th>Slug / ID</th>
              <th>Category</th>
              <th>Status</th>
              <th>Year</th>
              <th>Featured</th>
              <th>Image / document</th>
              <th>Tags</th>
              <th>Asset health</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(renderProjectRow).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderProjectRow(project) {
    const issues = projectAssetIssues(project);
    const issueLabel = issues.length ? issues.join(", ") : "complete fields";
    return `
      <tr>
        <td><input type="checkbox" aria-label="Select ${escapeHtml(project.title)}" data-project-select="${escapeHtml(project.id)}" ${projectState.selected.has(project.id) ? "checked" : ""} /></td>
        <td><strong>${escapeHtml(project.title)}</strong><br><span>${escapeHtml(project.client || "No client field")}</span></td>
        <td><code>${escapeHtml(project.slug)}</code></td>
        <td>${escapeHtml(project.category || project.discipline || "Uncategorized")}</td>
        <td>${badge(project.status, projectStatusTone(project.status))}<br>${badge(project.visibility, project.visibility === "public" ? "success" : "warn")}</td>
        <td>${escapeHtml(project.year || project.dateLabel || "Undated")}</td>
        <td>${project.featured ? badge("Featured", "success") : badge("Standard")}</td>
        <td>
          <span class="path-text">${escapeHtml(project.thumbnailPath || project.heroImage || "Missing image path")}</span>
          <span class="path-text">${escapeHtml(project.documentPath || project.documentationUrl || "Missing document path")}</span>
          <span class="path-text">${escapeHtml(project.livePage || "Missing live/detail link")}</span>
        </td>
        <td><div class="chip-row">${project.tags.slice(0, 4).map((tag) => badge(tag)).join("") || badge("No tags", "warn")}</div></td>
        <td>${badge(issueLabel, projectAssetTone(project))}<br><small>Local completeness only</small></td>
        <td>${escapeHtml(formatTimestamp(project.updatedAt))}</td>
        <td>
          <div class="row-actions">
            <button class="button button-secondary" type="button" data-project-action="detail" data-project-id="${escapeHtml(project.id)}">Detail</button>
            <button class="button button-secondary" type="button" data-project-action="edit" data-project-id="${escapeHtml(project.id)}">Edit</button>
            <button class="button button-danger" type="button" data-project-action="delete" data-project-id="${escapeHtml(project.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderProjectModal(modal) {
    const project = modal.project;
    const readOnly = modal.mode === "detail";
    const issues = projectAssetIssues(project);
    const title = modal.mode === "create" ? "Create project scaffold" : modal.mode === "detail" ? "Project detail" : "Edit project scaffold";
    return `
      <div class="modal-backdrop" data-project-modal-backdrop>
        <section class="modal project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
          <header class="modal-header">
            <div>
              <span class="section-kicker">Local scaffold editor</span>
              <h2 id="project-modal-title">${escapeHtml(title)}</h2>
              <p>Save writes only to ${escapeHtml(PROJECTS_STORAGE_KEY)} in this browser.</p>
            </div>
            <button class="icon-close" type="button" aria-label="Close project editor" data-project-action="close-modal">x</button>
          </header>
          <form class="modal-body project-form" data-project-form>
            <input type="hidden" name="originalId" value="${escapeHtml(project.id)}" />
            <div class="form-grid">
              ${field("Title", "title", project.title, "text", true, readOnly)}
              ${field("Slug / ID", "slug", project.slug, "text", true, readOnly)}
              ${field("Client", "client", project.client, "text", false, readOnly)}
              ${field("Category / discipline", "category", project.category, "text", false, readOnly)}
              ${field("Role / responsibility", "role", project.role, "text", false, readOnly)}
              ${field("Year / date", "year", project.year || project.dateLabel, "text", false, readOnly)}
              <label class="field">
                <span>Status</span>
                <select class="input" name="status" ${readOnly ? "disabled" : ""}>
                  ${["published", "draft", "hidden", "archived"].map((status) => `<option value="${status}"${project.status === status ? " selected" : ""}>${status}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Visibility</span>
                <select class="input" name="visibility" ${readOnly ? "disabled" : ""}>
                  ${["public", "private", "hidden"].map((visibility) => `<option value="${visibility}"${project.visibility === visibility ? " selected" : ""}>${visibility}</option>`).join("")}
                </select>
              </label>
              <label class="checkbox-field">
                <input type="checkbox" name="featured" ${project.featured ? "checked" : ""} ${readOnly ? "disabled" : ""} />
                <span>Featured project</span>
              </label>
              ${field("Hero image path", "heroImage", project.heroImage, "text", false, readOnly)}
              ${field("Thumbnail path", "thumbnailPath", project.thumbnailPath, "text", false, readOnly)}
              ${field("Document/PDF path", "documentPath", project.documentPath, "text", false, readOnly)}
              ${field("Documentation URL", "documentationUrl", project.documentationUrl, "url", false, readOnly)}
              ${field("Live/detail link", "livePage", project.livePage, "text", false, readOnly)}
              ${field("Source folder", "sourceFolder", project.sourceFolder, "text", false, readOnly)}
              ${textareaField("Summary", "summary", project.summary, readOnly)}
              ${textareaField("Description", "description", project.description, readOnly)}
              ${textareaField("Gallery/image paths", "galleryPaths", project.galleryPaths.join("\n"), readOnly)}
              ${textareaField("Tags", "tags", project.tags.join("\n"), readOnly)}
              ${textareaField("Studio", "studio", project.studio.join("\n"), readOnly)}
              ${textareaField("Software", "software", project.software.join("\n"), readOnly)}
              ${textareaField("Internal notes", "internalNotes", project.internalNotes, readOnly)}
            </div>
            <aside class="asset-status-box">
              <h3>Asset completeness</h3>
              <p>Local field completeness only. No links or files are externally verified.</p>
              <div class="chip-row">
                ${issues.length ? issues.map((issue) => badge(issue, "warn")).join("") : badge("Complete local fields", "success")}
              </div>
            </aside>
            <footer class="modal-footer">
              <button class="button button-secondary" type="button" data-project-action="close-modal">Cancel</button>
              ${readOnly ? `<button class="button" type="button" data-project-action="edit" data-project-id="${escapeHtml(project.id)}">Edit</button>` : `<button class="button" type="submit">Save local scaffold</button>`}
            </footer>
          </form>
        </section>
      </div>
    `;
  }

  function field(label, name, value, type = "text", required = false, readOnly = false) {
    return `
      <label class="field">
        <span>${escapeHtml(label)}${required ? " *" : ""}</span>
        <input class="input" type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${required ? "required" : ""} ${readOnly ? "readonly" : ""} />
      </label>
    `;
  }

  function textareaField(label, name, value, readOnly = false) {
    return `
      <label class="field field-wide">
        <span>${escapeHtml(label)}</span>
        <textarea class="input textarea" name="${escapeHtml(name)}" rows="4" ${readOnly ? "readonly" : ""}>${escapeHtml(value || "")}</textarea>
      </label>
    `;
  }

  function emptyProject() {
    return normalizeProject({
      id: `project-${Date.now()}`,
      slug: "",
      title: "",
      status: "draft",
      visibility: "private",
      featured: false,
      sourceFolder: "cmsdata/wix/collection-tables/WorkSet.csv",
      internalNotes: "Created in DanielClancy-Admin local scaffold. Not published."
    });
  }

  function emptyMediaItem() {
    return normalizeMediaItem({
      id: `media-${Date.now()}`,
      slug: "",
      title: "",
      type: "video",
      status: "draft",
      visibility: "draft",
      platform: "local",
      featured: false,
      internalNotes: "Created in DanielClancy-Admin local media scaffold. Not published."
    });
  }

  function formatTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "Unknown";
    return date.toISOString().slice(0, 10);
  }

  function descriptionRows(rows) {
    return `
      <dl class="description-list">
        ${rows
          .map(
            ([term, value]) => `
              <div class="description-row">
                <dt>${escapeHtml(term)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    `;
  }

  function renderAccountDetail(id) {
    const account = data.accounts.find((item) => item.id === id);
    routeTitle.textContent = "Account Detail";

    if (!account) {
      app.innerHTML = `
        <div class="page">
          ${pageHeader(
            "Unknown account",
            "Account not found",
            "The requested scaffold account ID does not exist in the local placeholder data.",
            `<a class="button button-secondary" href="#/accounts">Back to Accounts</a>`
          )}
          <div class="empty-state">Unknown account ID: ${escapeHtml(id || "(missing)")}</div>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Account detail",
          account.name,
          "Individual scaffold account detail layout for future identity, access, and profile review.",
          `<a class="button button-secondary" href="#/accounts">Back to Accounts</a>`
        )}

        <section class="panel">
          <div class="panel-body detail-hero">
            <div class="avatar">${escapeHtml(account.initials)}</div>
            <div>
              <span class="section-kicker">${escapeHtml(account.role)}</span>
              <h2>${escapeHtml(account.name)}</h2>
              <p class="muted">${escapeHtml(account.profile)}</p>
            </div>
            ${badge(account.status, "warn")}
          </div>
        </section>

        <section class="grid grid-3">
          ${panel(
            "Identity and profile",
            "Scaffold identity fields only.",
            descriptionRows([
              ["Email", account.email],
              ["Display role", account.role],
              ["Last seen", account.lastSeen]
            ])
          )}
          ${panel(
            "Access posture",
            "Future access model preview without auth claims.",
            descriptionRows([
              ["Access", account.access],
              ["Session", "Not connected"],
              ["Provider", "Pending integration"]
            ])
          )}
          ${panel(
            "Admin status",
            "No account lifecycle actions are active.",
            descriptionRows([
              ["Status", account.status],
              ["Mutation controls", "Not implemented"],
              ["Audit trail", "Pending real API"]
            ])
          )}
        </section>

        ${panel(
          "Detail-page boundary",
          "Unknown or unsupported account IDs fail gracefully and no local data is treated as authoritative.",
          `<div class="empty-state">This detail page is ready for future API hydration, but currently renders local scaffold records only.</div>`
        )}
      </div>
    `;
  }

  function renderSettings() {
    routeTitle.textContent = "Settings";
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Control posture",
          "Settings",
          "Settings layout scaffold for admin profile/display, site preferences, deployment notes, and access/auth readiness. Destructive controls are intentionally omitted.",
          badge("Safe scaffold", "warn")
        )}

        <section class="panel">
          <div class="panel-body grid hero-grid">
            <div class="card">
              <span class="section-kicker">System posture</span>
              <h2>Change boundaries stay visible</h2>
              <p class="muted">This settings surface documents what can be reviewed now and what still requires a real admin contract before it can be changed.</p>
            </div>
            <div class="card">
              <h3>Deferred integrations</h3>
              <p class="muted">Projects CMS is local scaffold-only. Media CMS, public login widget wiring, API/export pipeline work, and Cloudflare/DNS setup remain future tasks.</p>
            </div>
          </div>
        </section>

        ${panel(
          "Settings sections",
          "Reference-style settings blocks with non-destructive local controls.",
          `<div class="grid grid-2">
            ${data.settings
              .map(
                (item) => `
                  <article class="card settings-control">
                    <div>
                      <h3>${escapeHtml(item.title)}</h3>
                      <p>${escapeHtml(item.description)}</p>
                    </div>
                    <span class="fake-toggle ${item.enabled ? "is-on" : ""}" aria-hidden="true"></span>
                  </article>
                `
              )
              .join("")}
          </div>`
        )}

        ${panel(
          "Environment and deployment notes",
          "Truthful static deployment posture for the current foundation.",
          descriptionRows([
            ["Runtime requirement", "No request-time Node runtime"],
            ["Secrets", "None in frontend logic"],
            ["Cloudflare Pages", "Static-compatible fallback added"],
            ["DNS / live deployment", "Not completed by this task"]
          ])
        )}
      </div>
    `;
  }

  function parseRoute() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const path = hash || window.location.pathname.replace(/^\/+/, "") || "overview";
    const parts = path.split("/").filter(Boolean);
    return {
      page: parts[0] || "overview",
      id: parts[1] || ""
    };
  }

  function render() {
    const route = parseRoute();
    const active = route.page === "accounts" ? "accounts" : route.page;
    renderNav(active);

    if (route.page === "analytics") {
      renderAnalytics();
    } else if (route.page === "accounts" && route.id) {
      renderAccountDetail(decodeURIComponent(route.id));
    } else if (route.page === "accounts") {
      renderAccounts();
    } else if (route.page === "projects") {
      renderProjects();
    } else if (route.page === "media") {
      renderMedia();
    } else if (route.page === "settings") {
      renderSettings();
    } else {
      renderOverview();
    }

    app.focus({ preventScroll: true });
    document.body.classList.remove("mobile-nav-open");
    navToggle.setAttribute("aria-expanded", String(!document.body.classList.contains("nav-collapsed")));
  }

  navToggle.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 860px)").matches) {
      document.body.classList.toggle("mobile-nav-open");
      navToggle.setAttribute("aria-expanded", String(document.body.classList.contains("mobile-nav-open")));
      return;
    }

    document.body.classList.toggle("nav-collapsed");
    navToggle.setAttribute("aria-expanded", String(!document.body.classList.contains("nav-collapsed")));
  });

  app.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-project-filter='search']")) {
      projectState.search = target.value;
      renderProjects();
    }

    if (target.matches("[data-media-filter='search']")) {
      mediaState.search = target.value;
      renderMedia();
    }
  });

  app.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-project-filter='status']")) {
      projectState.status = target.value;
      renderProjects();
      return;
    }

    if (target.matches("[data-project-filter='asset']")) {
      projectState.asset = target.value;
      renderProjects();
      return;
    }

    if (target.matches("[data-media-filter='status']")) {
      mediaState.status = target.value;
      renderMedia();
      return;
    }

    if (target.matches("[data-media-filter='platform']")) {
      mediaState.platform = target.value;
      renderMedia();
      return;
    }

    if (target.matches("[data-media-filter='health']")) {
      mediaState.health = target.value;
      renderMedia();
      return;
    }

    if (target.matches("[data-project-select]")) {
      const id = target.getAttribute("data-project-select");
      if (target.checked) {
        projectState.selected.add(id);
      } else {
        projectState.selected.delete(id);
      }
      renderProjects();
      return;
    }

    if (target.matches("[data-project-select-all]")) {
      filteredProjects().forEach((project) => {
        if (target.checked) {
          projectState.selected.add(project.id);
        } else {
          projectState.selected.delete(project.id);
        }
      });
      renderProjects();
      return;
    }

    if (target.matches("[data-media-select]")) {
      const id = target.getAttribute("data-media-select");
      if (target.checked) {
        mediaState.selected.add(id);
      } else {
        mediaState.selected.delete(id);
      }
      renderMedia();
      return;
    }

    if (target.matches("[data-media-select-all]")) {
      filteredMediaItems().forEach((item) => {
        if (target.checked) {
          mediaState.selected.add(item.id);
        } else {
          mediaState.selected.delete(item.id);
        }
      });
      renderMedia();
      return;
    }

    if (target.matches("[data-bulk-field='status']") && target.value) {
      bulkUpdate((project) => ({ ...project, status: target.value, updatedAt: new Date().toISOString() }));
      projectState.message = `Updated status for ${projectState.selected.size} selected project scaffold row(s).`;
      persistProjects();
      renderProjects();
      return;
    }

    if (target.matches("[data-bulk-field='featured']") && target.value) {
      const featured = target.value === "true";
      bulkUpdate((project) => ({ ...project, featured, updatedAt: new Date().toISOString() }));
      projectState.message = `Updated featured flag for ${projectState.selected.size} selected project scaffold row(s).`;
      persistProjects();
      renderProjects();
      return;
    }

    if (target.matches("[data-media-bulk-field='status']") && target.value) {
      bulkUpdateMedia((item) => ({ ...item, status: target.value, updatedAt: new Date().toISOString() }));
      mediaState.message = `Updated status for ${mediaState.selected.size} selected media scaffold row(s).`;
      persistMediaItems();
      renderMedia();
      return;
    }

    if (target.matches("[data-media-bulk-field='platform']") && target.value) {
      bulkUpdateMedia((item) => ({ ...item, platform: target.value, updatedAt: new Date().toISOString() }));
      mediaState.message = `Updated platform for ${mediaState.selected.size} selected media scaffold row(s).`;
      persistMediaItems();
      renderMedia();
      return;
    }

    if (target.matches("[data-media-bulk-field='featured']") && target.value) {
      const featured = target.value === "true";
      bulkUpdateMedia((item) => ({ ...item, featured, updatedAt: new Date().toISOString() }));
      mediaState.message = `Updated featured flag for ${mediaState.selected.size} selected media scaffold row(s).`;
      persistMediaItems();
      renderMedia();
    }
  });

  app.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.matches("[data-media-form]")) {
      event.preventDefault();
      saveMediaFromForm(form);
      return;
    }

    if (!form.matches("[data-project-form]")) return;

    event.preventDefault();
    saveProjectFromForm(form);
  });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-project-action], [data-project-modal-backdrop], [data-media-action], [data-media-modal-backdrop]");
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute("data-project-action");
    const mediaAction = target.getAttribute("data-media-action");
    const id = target.getAttribute("data-project-id");
    const mediaId = target.getAttribute("data-media-id");

    if (!action && !mediaAction && (target.matches("[data-project-modal-backdrop]") || target.matches("[data-media-modal-backdrop]"))) {
      return;
    }

    if (mediaAction === "create") {
      mediaState.modal = { mode: "create", item: emptyMediaItem() };
      renderMedia();
    } else if (mediaAction === "detail") {
      const item = mediaState.items.find((entry) => entry.id === mediaId);
      if (item) mediaState.modal = { mode: "detail", item };
      renderMedia();
    } else if (mediaAction === "edit") {
      const item = mediaId ? mediaState.items.find((entry) => entry.id === mediaId) : mediaState.modal?.item;
      if (item) mediaState.modal = { mode: "edit", item };
      renderMedia();
    } else if (mediaAction === "delete") {
      deleteMediaItem(mediaId);
    } else if (mediaAction === "close-modal") {
      mediaState.modal = null;
      renderMedia();
    } else if (mediaAction === "toggle-bulk") {
      mediaState.bulkMode = !mediaState.bulkMode;
      renderMedia();
    } else if (mediaAction === "select-visible") {
      filteredMediaItems().forEach((item) => mediaState.selected.add(item.id));
      mediaState.message = "Visible media scaffold rows selected.";
      renderMedia();
    } else if (mediaAction === "clear-selection") {
      mediaState.selected.clear();
      mediaState.message = "Selection cleared.";
      renderMedia();
    } else if (mediaAction === "bulk-add-tag") {
      bulkMediaTag("add");
    } else if (mediaAction === "bulk-remove-tag") {
      bulkMediaTag("remove");
    } else if (mediaAction === "bulk-delete") {
      bulkDeleteMedia();
    } else if (mediaAction === "copy-json") {
      copyMediaJson();
    } else if (mediaAction === "import-json") {
      importMediaJson();
    } else if (mediaAction === "reset") {
      resetMedia();
    }

    if (mediaAction) return;

    if (action === "create") {
      projectState.modal = { mode: "create", project: emptyProject() };
      renderProjects();
    } else if (action === "detail") {
      const project = projectState.projects.find((item) => item.id === id);
      if (project) projectState.modal = { mode: "detail", project };
      renderProjects();
    } else if (action === "edit") {
      const project = id ? projectState.projects.find((item) => item.id === id) : projectState.modal?.project;
      if (project) projectState.modal = { mode: "edit", project };
      renderProjects();
    } else if (action === "delete") {
      deleteProject(id);
    } else if (action === "close-modal") {
      projectState.modal = null;
      renderProjects();
    } else if (action === "toggle-bulk") {
      projectState.bulkMode = !projectState.bulkMode;
      renderProjects();
    } else if (action === "select-visible") {
      filteredProjects().forEach((project) => projectState.selected.add(project.id));
      projectState.message = "Visible scaffold rows selected.";
      renderProjects();
    } else if (action === "clear-selection") {
      projectState.selected.clear();
      projectState.message = "Selection cleared.";
      renderProjects();
    } else if (action === "bulk-add-tag") {
      bulkTag("add");
    } else if (action === "bulk-remove-tag") {
      bulkTag("remove");
    } else if (action === "bulk-delete") {
      bulkDelete();
    } else if (action === "copy-json") {
      copyProjectsJson();
    } else if (action === "import-json") {
      importProjectsJson();
    } else if (action === "reset") {
      resetProjects();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mediaState.modal) {
      mediaState.modal = null;
      renderMedia();
      return;
    }

    if (event.key === "Escape" && projectState.modal) {
      projectState.modal = null;
      renderProjects();
    }
  });

  function saveProjectFromForm(form) {
    const title = formValue(form, "title");
    const slug = createSlug(formValue(form, "slug") || title);

    if (!title || !slug) {
      projectState.message = "Title and slug/id are required before saving.";
      renderProjects();
      return;
    }

    const originalId = formValue(form, "originalId");
    const saved = normalizeProject({
      id: slug,
      slug,
      title,
      client: formValue(form, "client"),
      category: formValue(form, "category"),
      discipline: formValue(form, "category"),
      role: formValue(form, "role"),
      year: formValue(form, "year"),
      status: formValue(form, "status"),
      visibility: formValue(form, "visibility"),
      featured: Boolean(form.querySelector("[name='featured']")?.checked),
      heroImage: formValue(form, "heroImage"),
      thumbnailPath: formValue(form, "thumbnailPath"),
      documentPath: formValue(form, "documentPath"),
      documentationUrl: formValue(form, "documentationUrl"),
      livePage: formValue(form, "livePage") || `/portfolio/${slug}`,
      sourceFolder: formValue(form, "sourceFolder"),
      summary: formValue(form, "summary"),
      description: formValue(form, "description"),
      galleryPaths: textareaArray(formValue(form, "galleryPaths")),
      tags: textareaArray(formValue(form, "tags")),
      studio: textareaArray(formValue(form, "studio")),
      software: textareaArray(formValue(form, "software")),
      internalNotes: formValue(form, "internalNotes"),
      updatedAt: new Date().toISOString()
    });

    const existingIndex = projectState.projects.findIndex((project) => project.id === originalId);
    const duplicate = projectState.projects.some((project, index) => project.id === saved.id && index !== existingIndex);
    if (duplicate) {
      projectState.message = "A project scaffold row already uses that slug/id.";
      renderProjects();
      return;
    }

    if (existingIndex >= 0) {
      projectState.projects[existingIndex] = saved;
    } else {
      projectState.projects.unshift(saved);
    }

    if (originalId !== saved.id) {
      projectState.selected.delete(originalId);
    }

    persistProjects();
    projectState.modal = null;
    projectState.message = `Saved ${saved.title} locally. This does not publish to DanielClancy.net.`;
    renderProjects();
  }

  function saveMediaFromForm(form) {
    const title = formValue(form, "title");
    const slug = createSlug(formValue(form, "slug") || title);

    if (!title || !slug) {
      mediaState.message = "Title and slug/id are required before saving.";
      renderMedia();
      return;
    }

    const originalId = formValue(form, "originalId");
    const saved = normalizeMediaItem({
      id: slug,
      slug,
      title,
      type: formValue(form, "type"),
      status: formValue(form, "status"),
      visibility: formValue(form, "visibility"),
      platform: formValue(form, "platform"),
      scheduledAt: formValue(form, "scheduledAt"),
      publishedAt: formValue(form, "publishedAt"),
      featured: Boolean(form.querySelector("[name='featured']")?.checked),
      thumbnailPath: formValue(form, "thumbnailPath"),
      embedUrl: formValue(form, "embedUrl"),
      videoUrl: formValue(form, "videoUrl"),
      replayUrl: formValue(form, "replayUrl"),
      externalPageUrl: formValue(form, "externalPageUrl"),
      summary: formValue(form, "summary"),
      description: formValue(form, "description"),
      tags: textareaArray(formValue(form, "tags")),
      internalNotes: formValue(form, "internalNotes"),
      updatedAt: new Date().toISOString()
    });

    const existingIndex = mediaState.items.findIndex((item) => item.id === originalId);
    const duplicate = mediaState.items.some((item, index) => item.id === saved.id && index !== existingIndex);
    if (duplicate) {
      mediaState.message = "A media scaffold row already uses that slug/id.";
      renderMedia();
      return;
    }

    if (existingIndex >= 0) {
      mediaState.items[existingIndex] = saved;
    } else {
      mediaState.items.unshift(saved);
    }

    if (originalId !== saved.id) {
      mediaState.selected.delete(originalId);
    }

    persistMediaItems();
    mediaState.modal = null;
    mediaState.message = `Saved ${saved.title} locally. This does not publish to DanielClancy.net.`;
    renderMedia();
  }

  function deleteProject(id) {
    const project = projectState.projects.find((item) => item.id === id);
    if (!project) return;

    if (!window.confirm(`Delete local scaffold project "${project.title}"? This will not affect DanielClancy.net.`)) {
      return;
    }

    projectState.projects = projectState.projects.filter((item) => item.id !== id);
    projectState.selected.delete(id);
    persistProjects();
    projectState.message = `Deleted local scaffold row: ${project.title}.`;
    renderProjects();
  }

  function deleteMediaItem(id) {
    const item = mediaState.items.find((entry) => entry.id === id);
    if (!item) return;

    if (!window.confirm(`Delete local scaffold media item "${item.title || item.slug}"? This will not affect DanielClancy.net.`)) {
      return;
    }

    mediaState.items = mediaState.items.filter((entry) => entry.id !== id);
    mediaState.selected.delete(id);
    persistMediaItems();
    mediaState.message = `Deleted local scaffold row: ${item.title || item.slug}.`;
    renderMedia();
  }

  function bulkUpdate(mutator) {
    projectState.projects = projectState.projects.map((project) =>
      projectState.selected.has(project.id) ? normalizeProject(mutator(project)) : project
    );
  }

  function bulkUpdateMedia(mutator) {
    mediaState.items = mediaState.items.map((item) =>
      mediaState.selected.has(item.id) ? normalizeMediaItem(mutator(item)) : item
    );
  }

  function bulkTag(mode) {
    const input = app.querySelector("[data-bulk-tag]");
    const tag = String(input?.value || "").trim();
    if (!tag) {
      projectState.message = "Enter a tag before applying a bulk tag action.";
      renderProjects();
      return;
    }

    bulkUpdate((project) => {
      const tags = new Set(project.tags);
      if (mode === "add") tags.add(tag);
      if (mode === "remove") tags.delete(tag);
      return { ...project, tags: Array.from(tags), updatedAt: new Date().toISOString() };
    });
    persistProjects();
    projectState.message = `${mode === "add" ? "Added" : "Removed"} tag "${tag}" on selected local scaffold row(s).`;
    renderProjects();
  }

  function bulkMediaTag(mode) {
    const input = app.querySelector("[data-media-bulk-tag]");
    const tag = String(input?.value || "").trim();
    if (!tag) {
      mediaState.message = "Enter a tag before applying a bulk tag action.";
      renderMedia();
      return;
    }

    bulkUpdateMedia((item) => {
      const tags = new Set(item.tags);
      if (mode === "add") tags.add(tag);
      if (mode === "remove") tags.delete(tag);
      return { ...item, tags: Array.from(tags), updatedAt: new Date().toISOString() };
    });
    persistMediaItems();
    mediaState.message = `${mode === "add" ? "Added" : "Removed"} tag "${tag}" on selected local media scaffold row(s).`;
    renderMedia();
  }

  function bulkDelete() {
    const count = projectState.selected.size;
    if (!count) return;
    if (!window.confirm(`Delete ${count} selected local scaffold project row(s)? This will not affect DanielClancy.net.`)) {
      return;
    }

    projectState.projects = projectState.projects.filter((project) => !projectState.selected.has(project.id));
    projectState.selected.clear();
    persistProjects();
    projectState.message = `Deleted ${count} local scaffold row(s).`;
    renderProjects();
  }

  function bulkDeleteMedia() {
    const count = mediaState.selected.size;
    if (!count) return;
    if (!window.confirm(`Delete ${count} selected local scaffold media row(s)? This will not affect DanielClancy.net.`)) {
      return;
    }

    mediaState.items = mediaState.items.filter((item) => !mediaState.selected.has(item.id));
    mediaState.selected.clear();
    persistMediaItems();
    mediaState.message = `Deleted ${count} local media scaffold row(s).`;
    renderMedia();
  }

  function copyProjectsJson() {
    const json = JSON.stringify(projectState.projects, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => {
          projectState.message = "Copied local scaffold JSON to the clipboard.";
          renderProjects();
        },
        () => {
          window.prompt("Copy local scaffold JSON", json);
        }
      );
      return;
    }

    window.prompt("Copy local scaffold JSON", json);
  }

  function copyMediaJson() {
    const json = JSON.stringify(mediaState.items, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => {
          mediaState.message = "Copied local media scaffold JSON to the clipboard.";
          renderMedia();
        },
        () => {
          window.prompt("Copy local media scaffold JSON", json);
        }
      );
      return;
    }

    window.prompt("Copy local media scaffold JSON", json);
  }

  function importProjectsJson() {
    const value = window.prompt("Paste a JSON array of project scaffold rows. This replaces local browser data only.");
    if (!value) return;

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error("Expected a JSON array.");
      }

      const normalized = parsed.map(normalizeProject);
      const ids = new Set(normalized.map((project) => project.id));
      if (ids.size !== normalized.length) {
        throw new Error("Project slug/id values must be unique.");
      }

      if (!window.confirm(`Import ${normalized.length} project scaffold row(s) into local browser storage?`)) {
        return;
      }

      projectState.projects = normalized;
      projectState.selected.clear();
      persistProjects();
      projectState.message = "Imported project scaffold JSON into local browser storage.";
      renderProjects();
    } catch (error) {
      projectState.message = `Import failed: ${error.message}`;
      renderProjects();
    }
  }

  function importMediaJson() {
    const value = window.prompt("Paste a JSON array of media scaffold rows. This replaces local browser data only.");
    if (!value) return;

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        throw new Error("Expected a JSON array.");
      }

      const normalized = parsed.map(normalizeMediaItem);
      const ids = new Set(normalized.map((item) => item.id));
      if (ids.size !== normalized.length) {
        throw new Error("Media slug/id values must be unique.");
      }

      if (!window.confirm(`Import ${normalized.length} media scaffold row(s) into local browser storage?`)) {
        return;
      }

      mediaState.items = normalized;
      mediaState.selected.clear();
      persistMediaItems();
      mediaState.message = "Imported media scaffold JSON into local browser storage.";
      renderMedia();
    } catch (error) {
      mediaState.message = `Import failed: ${error.message}`;
      renderMedia();
    }
  }

  function resetProjects() {
    if (!window.confirm("Reset Projects CMS scaffold rows to the repo seed data? Local browser edits will be replaced.")) {
      return;
    }

    projectState.projects = (data.projects || []).map(normalizeProject);
    projectState.selected.clear();
    persistProjects();
    projectState.message = "Projects CMS scaffold reset to repo seed data.";
    renderProjects();
  }

  function resetMedia() {
    if (!window.confirm("Reset Media CMS scaffold rows to the repo seed data? Local browser edits will be replaced.")) {
      return;
    }

    mediaState.items = (data.media || []).map(normalizeMediaItem);
    mediaState.selected.clear();
    persistMediaItems();
    mediaState.message = "Media CMS scaffold reset to repo seed data.";
    renderMedia();
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", render);

  if (!window.location.hash && ["/", "/index.html"].includes(window.location.pathname)) {
    window.location.hash = "#/overview";
  } else {
    render();
  }
})();
