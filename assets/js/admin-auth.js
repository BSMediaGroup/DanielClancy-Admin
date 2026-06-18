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
  const authUiState = {
    mode: "signin",
    emailOpen: false,
    email: "",
    password: ""
  };
  const PROVIDERS = [
    { id: "github", label: "GitHub", icon: "./assets/icons/github.svg" },
    { id: "google", label: "Google", icon: "./assets/icons/google.svg" },
    { id: "twitter", label: "Twitter/X", icon: "./assets/icons/x.svg" }
  ];

  function endpoint(path) {
    return `${AUTH_ORIGIN}/api/auth/${path}`;
  }

  function oauthReturnMessage() {
    const hash = String(window.location.hash || "");
    const match = hash.match(/[?&]oauth=([^&]+)/);
    if (!match) return "";
    const value = decodeURIComponent(match[1]);
    if (value === "not-ready") {
      return "OAuth returned without a usable callback code. Admin access is still restricted.";
    }
    if (value.endsWith("-callback-received")) {
      return "OAuth returned successfully. This account is not an admin unless explicitly granted admin access.";
    }
    return "OAuth did not unlock the admin dashboard. Admin access requires explicit admin authority.";
  }

  function setStatus(status, session, message, options = {}) {
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
    document.dispatchEvent(new CustomEvent("dc-admin-auth-status", { detail: window.DC_ADMIN_AUTH }));
    if (options.render !== false) {
      renderGate();
      renderTopbar();
    } else {
      updateAuthMessage(message);
    }
  }

  function updateAuthMessage(message) {
    sessionState.message = message || sessionState.message || "";
    const target = document.getElementById("admin-auth-message");
    if (target) target.textContent = sessionState.message;
  }

  function renderTopbar() {
    const target = document.getElementById("auth-status");
    const userTarget = document.getElementById("topbar-user");
    if (!target) return;
    if (sessionState.isAdmin) {
      const session = sessionState.session || {};
      const identity = session.email || session.username || session.display_name || "Admin";
      const initials = String(identity)
        .split(/[\s@._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "A";
      target.innerHTML = `<span class="environment-pill environment-pill-success">Admin session</span>`;
      if (userTarget) {
        const avatar = session.avatar_url || session.avatarUrl || "";
        userTarget.innerHTML = `
          <details class="topbar-user-menu">
            <summary aria-label="Open user menu">
              <span class="topbar-avatar">${avatar ? `<img src="${escapeHtml(avatar)}" alt="" />` : escapeHtml(initials)}</span>
              <span class="topbar-user-label">${escapeHtml(identity)}</span>
            </summary>
            <div class="topbar-user-popover">
              <a href="#/accounts">Accounts</a>
              <a href="#/settings">Settings</a>
              <a href="https://danielclancy.net" rel="noreferrer">Public Site</a>
              <button type="button" data-auth-action="logout">Logout</button>
            </div>
          </details>
        `;
      }
      return;
    }
    target.innerHTML = `<span class="environment-pill">Auth required</span>`;
    if (userTarget) {
      userTarget.innerHTML = `<a class="button button-secondary" href="https://danielclancy.net" rel="noreferrer">Public Site</a>`;
    }
  }

  function providerLinks() {
    return PROVIDERS
      .map(
        (provider) => `
          <button class="button button-secondary auth-provider-button" type="button" data-auth-oauth="${provider.id}">
            <img class="auth-provider-icon" src="${provider.icon}" alt="" />
            <span>${authUiState.mode === "signup" ? "Sign up with" : "Continue with"} ${provider.label}</span>
          </button>
        `
      )
      .join("");
  }

  function renderSignedInIdentity() {
    const session = sessionState.session;
    if (!session?.authenticated) return "";
    const identity = session.email || session.display_name || "Signed in account";
    const provider = session.provider ? ` via ${session.provider}` : "";
    return `
      <div class="auth-signed-in">
        <span class="section-kicker">Signed in, admin access required</span>
        <strong>${escapeHtml(identity)}</strong>
        <span>${escapeHtml(`Regular account${provider}`)}</span>
      </div>
    `;
  }

  function renderGate() {
    const gate = document.getElementById("admin-auth-gate");
    if (!gate) return;
    gate.hidden = sessionState.status === "allowed";
    const denied = sessionState.status === "denied";
    const signup = authUiState.mode === "signup";
    gate.innerHTML = `
      <section class="auth-card" aria-labelledby="admin-auth-title">
        <span class="auth-brand-mark" aria-hidden="true"><img src="./assets/logos/logo.webp" alt="" /></span>
        <div class="auth-card-header">
          <span class="section-kicker">Restricted dashboard</span>
          <h1 id="admin-auth-title">${denied ? "Admin access required" : signup ? "Create account" : "Sign in"}</h1>
          <p>
            ${denied ? "Admin access is required for this dashboard." : "Sign in to continue."}
          </p>
        </div>
        <div class="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button class="auth-mode-tab ${!signup ? "auth-mode-tab-active" : ""}" type="button" data-auth-mode="signin" aria-pressed="${!signup}">Sign in</button>
          <button class="auth-mode-tab ${signup ? "auth-mode-tab-active" : ""}" type="button" data-auth-mode="signup" aria-pressed="${signup}">Create account</button>
        </div>
        ${renderSignedInIdentity()}
        <div class="auth-provider-grid">
          ${providerLinks()}
        </div>
        <div class="auth-divider"><span>or</span></div>
        <div class="auth-email-section">
          <button class="auth-email-toggle" type="button" data-auth-action="toggle-email" aria-expanded="${authUiState.emailOpen}">
            <span>${signup ? "Use email signup" : "Use email instead"}</span>
            <span aria-hidden="true">${authUiState.emailOpen ? "-" : "+"}</span>
          </button>
          ${
            authUiState.emailOpen
              ? `<form class="auth-form" data-auth-login>
                  <label>
                    <span>Email</span>
                    <input name="email" type="email" autocomplete="email" required value="${escapeHtml(authUiState.email)}" />
                  </label>
                  <label>
                    <span>Password</span>
                    <input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required value="${escapeHtml(authUiState.password)}" />
                  </label>
                  <button class="button" type="submit">${signup ? "Request email signup" : "Sign in with email"}</button>
                  <p class="auth-note">${signup ? "Email signup is not available yet." : "Use an approved admin account."}</p>
                </form>`
              : ""
          }
        </div>
        <p class="auth-message" id="admin-auth-message" role="status" aria-live="polite">${escapeHtml(sessionState.message)}</p>
        ${denied ? `<button class="button button-secondary" type="button" data-auth-action="logout">Sign out</button>` : ""}
        ${
          isLocalDev
            ? `<button class="button button-secondary" type="button" data-auth-action="dev-unlock">Local scaffold unlock</button>
               <p class="auth-note">Local scaffold unlock is available only on file, localhost, or Pages preview hosts. It is not a production admin credential.</p>`
            : ""
        }
      </section>
    `;
  }

  function updateAuthModeCopy() {
    const signup = authUiState.mode === "signup";
    const title = document.getElementById("admin-auth-title");
    if (title && sessionState.status !== "denied") title.textContent = signup ? "Create account" : "Sign in";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const active = button.getAttribute("data-auth-mode") === authUiState.mode;
      button.classList.toggle("auth-mode-tab-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll("[data-auth-oauth]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      const provider = PROVIDERS.find((item) => item.id === button.getAttribute("data-auth-oauth"));
      const label = button.querySelector("span");
      if (provider && label) label.textContent = `${signup ? "Sign up with" : "Continue with"} ${provider.label}`;
    });
    const emailToggle = document.querySelector("[data-auth-action='toggle-email'] span");
    if (emailToggle) emailToggle.textContent = signup ? "Use email signup" : "Use email instead";
    const password = document.querySelector("[data-auth-login] input[name='password']");
    if (password instanceof HTMLInputElement) {
      password.autocomplete = signup ? "new-password" : "current-password";
    }
    updateAuthMessage(signup ? "Create an account for DanielClancy.net." : "Sign in to continue.");
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
        setStatus("required", null, oauthReturnMessage() || "Admin access is required for this dashboard.");
      }
    } catch {
      const oauthMessage = oauthReturnMessage();
      setStatus(
        "required",
        null,
        oauthMessage ||
          (isLocalDev
          ? "Auth endpoint is unavailable in this local/static view. Local scaffold unlock is available for UI smoke testing."
          : "Auth endpoint is unavailable.")
      );
    }
  }

  async function login(form) {
    if (authUiState.mode === "signup") {
      await signup(form);
      return;
    }
    const formData = new FormData(form);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    authUiState.email = email;
    authUiState.password = password;
    if (!email.trim() || !password) {
      setStatus("required", null, "Email and password are required.");
      return;
    }
    updateAuthMessage("Checking server-side credentials...");
    try {
      const response = await fetch(endpoint("login"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.session) {
        setStatus("required", null, payload?.message || "Sign in failed. Check credentials and try again.");
        return;
      }
      if (!payload.session.is_admin) {
        setStatus("denied", payload.session, "Signed in, but this account is not marked as admin.");
        return;
      }
      authUiState.password = "";
      setStatus("allowed", payload.session, "Admin session verified.");
    } catch {
      setStatus("required", null, "Auth endpoint is not reachable yet.");
    }
  }

  async function signup(form) {
    const formData = new FormData(form);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    authUiState.email = email;
    authUiState.password = password;
    if (!email.trim()) {
      setStatus("required", sessionState.session, "Email is required before checking signup availability.");
      return;
    }
    updateAuthMessage("Checking account creation availability...");
    try {
      const response = await fetch(endpoint("signup"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json().catch(() => null);
      setStatus(
        sessionState.status === "denied" ? "denied" : "required",
        sessionState.session,
        payload?.message || "Email signup is not available yet."
      );
    } catch {
      setStatus(
        sessionState.status === "denied" ? "denied" : "required",
        sessionState.session,
        "Email signup is not available yet."
      );
    }
  }

  function startOAuth(provider) {
    const target = new URL(endpoint(`oauth/${provider}/start`));
    window.location.assign(target.toString());
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
    if (action === "toggle-email") {
      authUiState.emailOpen = !authUiState.emailOpen;
      renderGate();
    }
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

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.closest("[data-auth-login]")) return;
    if (target.name === "email") authUiState.email = target.value;
    if (target.name === "password") authUiState.password = target.value;
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-auth-oauth]");
    if (!(target instanceof HTMLElement)) return;
    startOAuth(target.getAttribute("data-auth-oauth"));
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-auth-mode]");
    if (!(target instanceof HTMLElement)) return;
    authUiState.mode = target.getAttribute("data-auth-mode") === "signup" ? "signup" : "signin";
    sessionState.message =
      authUiState.mode === "signup"
        ? "Create an account for DanielClancy.net."
        : "Sign in to continue.";
    updateAuthModeCopy();
  });

  document.addEventListener("DOMContentLoaded", refresh);
})();
