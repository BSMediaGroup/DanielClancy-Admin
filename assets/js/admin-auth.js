(function () {
  "use strict";

  const AUTH_ORIGIN = (window.DC_AUTH_ORIGIN || window.location.origin || "https://admin.danielclancy.net").replace(/\/+$/, "");
  const LOCAL_DEV_HOSTS = new Set(["", "localhost", "127.0.0.1"]);
  const isLocalDev =
    window.location.protocol === "file:" ||
    LOCAL_DEV_HOSTS.has(window.location.hostname) ||
    window.location.hostname.endsWith(".pages.dev");
  const sessionState = {
    status: "pending",
    session: null,
    isAdmin: false,
    message: "Checking admin session..."
  };

  function endpoint(path) {
    return `${AUTH_ORIGIN}/api/auth/${path}`;
  }

  function setStatus(status, session, message) {
    sessionState.status = status;
    sessionState.session = session || null;
    sessionState.isAdmin = Boolean(session?.authenticated && session?.is_admin);
    sessionState.message = message || "";
    document.body.classList.toggle("auth-pending", status === "pending");
    document.body.classList.toggle("auth-allowed", status === "allowed");
    document.body.classList.toggle("auth-required", status === "required");
    document.body.classList.toggle("auth-denied", status === "denied");
    window.DC_ADMIN_AUTH = {
      ...sessionState,
      refresh,
      logout
    };
    renderGate();
    renderTopbar();
  }

  function renderTopbar() {
    const target = document.getElementById("auth-status");
    if (!target) return;
    if (sessionState.isAdmin) {
      target.innerHTML = `
        <span class="environment-pill environment-pill-success">Admin session</span>
        <button class="button button-secondary" type="button" data-auth-action="logout">Logout</button>
      `;
      return;
    }
    target.innerHTML = `<span class="environment-pill">Auth required</span>`;
  }

  function providerLinks() {
    return ["github", "google", "twitter"]
      .map(
        (provider) => `
          <a class="button button-secondary" href="${endpoint(`oauth/${provider}/start`)}">
            Continue with ${provider === "twitter" ? "Twitter/X" : provider[0].toUpperCase() + provider.slice(1)}
          </a>
        `
      )
      .join("");
  }

  function renderGate() {
    const gate = document.getElementById("admin-auth-gate");
    if (!gate) return;
    gate.hidden = sessionState.status === "allowed";
    const denied = sessionState.status === "denied";
    gate.innerHTML = `
      <section class="auth-card" aria-labelledby="admin-auth-title">
        <div class="auth-card-header">
          <span class="section-kicker">Restricted dashboard</span>
          <h1 id="admin-auth-title">${denied ? "Admin access required" : "Sign in to DanielClancy-Admin"}</h1>
          <p>
            Manual env-backed master admin accounts are the first production admin path. OAuth login is available only after Cloudflare env vars and provider redirect URIs are configured.
          </p>
        </div>
        <div class="auth-provider-grid">
          ${providerLinks()}
        </div>
        <form class="auth-form" data-auth-login>
          <label>
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autocomplete="current-password" required />
          </label>
          <button class="button" type="submit">Sign in</button>
        </form>
        <p class="auth-message" id="admin-auth-message" role="status" aria-live="polite">${escapeHtml(sessionState.message)}</p>
        ${
          isLocalDev
            ? `<button class="button button-secondary" type="button" data-auth-action="dev-unlock">Local scaffold unlock</button>
               <p class="auth-note">Local scaffold unlock is available only on file, localhost, or Pages preview hosts. It is not a production admin credential.</p>`
            : ""
        }
      </section>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function refresh() {
    setStatus("pending", null, "Checking admin session...");
    try {
      const response = await fetch(endpoint("session"), { credentials: "include" });
      const payload = await response.json();
      const session = payload?.session;
      if (session?.authenticated && session?.is_admin) {
        setStatus("allowed", session, "Admin session verified.");
      } else if (session?.authenticated) {
        setStatus("denied", session, "Signed in, but this account is not marked as admin.");
      } else {
        setStatus("required", null, "Sign in with a master admin email/password account.");
      }
    } catch {
      setStatus(
        "required",
        null,
        isLocalDev
          ? "Auth endpoint is unavailable in this local/static view. Use local scaffold unlock only for UI smoke testing."
          : "Auth endpoint is unavailable. Confirm Cloudflare Pages Functions and DNS setup."
      );
    }
  }

  async function login(form) {
    const formData = new FormData(form);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    if (!email.trim() || !password) {
      setStatus("required", null, "Email and password are required.");
      return;
    }
    setStatus("pending", null, "Checking server-side credentials...");
    try {
      const response = await fetch(endpoint("login"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.session) {
        setStatus("required", null, "Sign in failed. Check credentials and Cloudflare env vars.");
        return;
      }
      if (!payload.session.is_admin) {
        setStatus("denied", payload.session, "Signed in, but this account is not marked as admin.");
        return;
      }
      setStatus("allowed", payload.session, "Admin session verified.");
    } catch {
      setStatus("required", null, "Auth endpoint is not reachable yet.");
    }
  }

  async function logout() {
    try {
      await fetch(endpoint("logout"), { method: "POST", credentials: "include" });
    } catch {
      // Local/static previews may not have the Pages Function runtime.
    }
    setStatus("required", null, "Signed out.");
  }

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.matches("[data-auth-login]")) return;
    event.preventDefault();
    login(form);
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-auth-action]");
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute("data-auth-action");
    if (action === "logout") logout();
    if (action === "dev-unlock" && isLocalDev) {
      setStatus(
        "allowed",
        {
          authenticated: true,
          email: "local-scaffold@danielclancy.net",
          provider: "local-scaffold",
          account_type: "admin",
          admin_level: "local-scaffold",
          is_admin: true
        },
        "Local scaffold admin view unlocked for UI smoke testing only."
      );
    }
  });

  document.addEventListener("DOMContentLoaded", refresh);
})();
