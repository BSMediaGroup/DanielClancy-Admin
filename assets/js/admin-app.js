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
    { id: "projects", label: "Projects", icon: "PR", path: "", disabled: true },
    { id: "media", label: "Media", icon: "ME", path: "", disabled: true }
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
              <p class="muted">Projects CMS, Media CMS, public login widget wiring, and Cloudflare/DNS setup remain future tasks.</p>
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

  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", render);

  if (!window.location.hash && ["/", "/index.html"].includes(window.location.pathname)) {
    window.location.hash = "#/overview";
  } else {
    render();
  }
})();
