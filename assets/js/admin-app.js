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
    { id: "media", label: "Media", icon: "ME", path: "#/media" },
    { id: "alerts", label: "Alerts", icon: "AL", path: "#/alerts" }
  ];

  const PROJECTS_STORAGE_KEY = "danielclancy-admin.projects.scaffold.v1";
  const PROJECTS_BASELINE_URL = "/assets/data/public-projects-baseline.json";
  const PROJECTS_BASELINE_VERSION = "public-projects-baseline-2026-06-14";
  const MEDIA_STORAGE_KEY = "danielclancy-admin.media.scaffold.v1";
  const ALERTS_STORAGE_KEY = "danielclancy-admin.alerts.scaffold.v1";
  const ACCOUNT_ACCESS_STORAGE_KEY = "danielclancy-admin.accounts.scaffold.v1";
  const ALERT_SURFACES = ["danielclancy.net", "admin.danielclancy.net"];
  const ALERT_SEVERITIES = ["info", "warning", "critical"];
  const ALERT_MATCH_TYPES = ["exact", "starts_with", "contains"];
  const ALERT_TRIGGER_TYPES = [
    "contact_form",
    "auth_admin_login",
    "auth_oauth_login",
    "project_cms_update",
    "media_cms_update",
    "alerts_cms_update",
    "page_visit",
    "portfolio_update",
    "media_watch_update",
    "deployment",
    "analytics_threshold",
    "manual_test"
  ];
  const ALERT_CHANNEL_TARGETS = ["windows_client", "pushover", "both", "muted"];
  const cmsStorageState = {
    projects: {
      status: "checking",
      source: "local",
      message: "Checking admin storage...",
      lastSaved: "",
      lastLoaded: ""
    },
    media: {
      status: "checking",
      source: "local",
      message: "Checking admin storage...",
      lastSaved: "",
      lastLoaded: ""
    },
    alerts: {
      status: "checking",
      source: "local",
      message: "Checking admin storage...",
      lastSaved: "",
      lastLoaded: ""
    }
  };
  const MASTER_ADMIN_ACCOUNTS = [
    { email: "mail@danielclancy.net", envEmail: "DC_ADMIN_EMAIL_1", envSecret: "DC_ADMIN_SECRET_1" },
    { email: "daniel@brainstream.media", envEmail: "DC_ADMIN_EMAIL_2", envSecret: "DC_ADMIN_SECRET_2" }
  ];
  const projectBaselineState = {
    loaded: false,
    protected: false,
    partialKvMerged: false,
    baselineCount: 0,
    kvCount: 0,
    mergedCount: 0,
    adminCreatedCount: 0,
    source: "loading",
    message: "Loading protected public-site baseline...",
    meta: null,
    projects: []
  };
  const projectState = {
    projects: loadProjects(),
    search: "",
    status: "all",
    asset: "all",
    selected: new Set(),
    bulkMode: false,
    modal: null,
    message: "Local project data loaded. Protected public-site baseline will be merged when available.",
    storage: cmsStorageState.projects
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
    message: "Local media scaffold loaded. Changes stay in this browser only.",
    storage: cmsStorageState.media
  };
  const alertsState = {
    rules: loadAlertRules(),
    search: "",
    severity: "all",
    surface: "all",
    target: "all",
    selected: new Set(),
    bulkMode: false,
    modal: null,
    message: "Local alert scaffold loaded. Rules are not live until a StreamSuites/runtime bridge and hosted env setup exist.",
    storage: cmsStorageState.alerts
  };
  const accountAccessState = {
    accounts: loadAccountAccessScaffold(),
    message: "Local account access scaffold loaded. Changes stay in this browser only."
  };
  const accountRegistryState = {
    status: "checking",
    message: "Checking account registry...",
    accounts: [],
    meta: null,
    session: null,
    storageConfigured: false,
    lastChecked: ""
  };
  const overviewStatusState = {
    status: "checking",
    message: "Checking operational status...",
    payload: null,
    lastChecked: ""
  };
  const analyticsStatusState = {
    status: "checking",
    message: "Checking analytics status...",
    payload: null,
    lastChecked: ""
  };
  const pageVisitState = {
    lastPath: ""
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
      updatedAt: String(raw?.updatedAt || new Date().toISOString()),
      baselineProtected: Boolean(raw?.baselineProtected || raw?._baselineProtected),
      baselineVersion: String(raw?.baselineVersion || ""),
      source: String(raw?.source || "")
    };
  }

  function projectIdentity(project) {
    return String(project?.id || project?.slug || "").trim().toLowerCase();
  }

  function projectBaselineIds() {
    return new Set(projectBaselineState.projects.map(projectIdentity).filter(Boolean));
  }

  function isBaselineProject(project) {
    return Boolean(project?.baselineProtected) || projectBaselineIds().has(projectIdentity(project));
  }

  function mergeProjectsWithBaseline(items, options = {}) {
    const normalizedItems = Array.isArray(items) ? items.map(normalizeProject) : [];
    const baselineItems = projectBaselineState.projects.map((item) =>
      normalizeProject({
        ...item,
        baselineProtected: true,
        baselineVersion: PROJECTS_BASELINE_VERSION,
        source: "public_baseline"
      })
    );
    if (!baselineItems.length) {
      return normalizedItems;
    }

    const baselineIds = new Set(baselineItems.map(projectIdentity).filter(Boolean));
    const overlays = new Map();
    const adminCreated = [];

    normalizedItems.forEach((item) => {
      const id = projectIdentity(item);
      if (baselineIds.has(id)) {
        overlays.set(id, item);
      } else {
        adminCreated.push({
          ...item,
          baselineProtected: false,
          source: item.source || "admin_created"
        });
      }
    });

    const mergedBaseline = baselineItems.map((baselineProject) => {
      const overlay = overlays.get(projectIdentity(baselineProject)) || {};
      return normalizeProject({
        ...baselineProject,
        ...overlay,
        id: baselineProject.id,
        slug: baselineProject.slug,
        livePage: overlay.livePage || baselineProject.livePage,
        sourceFolder: baselineProject.sourceFolder,
        baselineProtected: true,
        baselineVersion: PROJECTS_BASELINE_VERSION,
        source: overlay.source || "public_baseline"
      });
    });
    projectBaselineState.baselineCount = baselineItems.length;
    projectBaselineState.kvCount = Number.isFinite(options.kvCount) ? options.kvCount : normalizedItems.length;
    projectBaselineState.mergedCount = mergedBaseline.length + adminCreated.length;
    projectBaselineState.adminCreatedCount = adminCreated.length;
    projectBaselineState.partialKvMerged =
      baselineItems.length > 0 && normalizedItems.length > 0 && normalizedItems.length < baselineItems.length;
    projectBaselineState.protected = true;
    return [...mergedBaseline, ...adminCreated];
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
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
      if (!rows) {
        return seed;
      }

      return rows.map(normalizeProject);
    } catch {
      return seed;
    }
  }

  function persistProjects() {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectsStoragePayload(), null, 2));
    persistCmsCollection("projects");
  }

  function projectsStoragePayload() {
    return {
      collection: "projects",
      mode: "baseline_overlay",
      baselineVersion: PROJECTS_BASELINE_VERSION,
      updatedAt: new Date().toISOString(),
      items: projectState.projects,
      adminCreatedItems: projectState.projects.filter((project) => !isBaselineProject(project)),
      hiddenBaselineIds: []
    };
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
    persistCmsCollection("media");
  }

  function normalizeAlertRule(raw) {
    const fallbackId = createSlug(raw?.id || raw?.slug || raw?.name || `alert-${Date.now()}`);
    const severity = String(raw?.severity || "info").toLowerCase();
    const triggerType = String(raw?.triggerType || raw?.trigger_type || "manual_test").toLowerCase();
    const target = normalizeAlertChannelTarget(raw?.channelTarget || raw?.channel_target || "windows_client");
    const sourceSurface = String(raw?.sourceSurface || raw?.source_surface || raw?.domain || "danielclancy.net").toLowerCase();
    const matchType = String(raw?.matchType || raw?.match_type || "exact").toLowerCase();

    return {
      id: createSlug(raw?.id || raw?.slug || fallbackId),
      name: String(raw?.name || raw?.ruleName || "Untitled alert rule scaffold"),
      enabled: Boolean(raw?.enabled),
      severity: ALERT_SEVERITIES.includes(severity) ? severity : "info",
      sourceSurface: ALERT_SURFACES.includes(sourceSurface) ? sourceSurface : "danielclancy.net",
      triggerType: ALERT_TRIGGER_TYPES.includes(triggerType) ? triggerType : "manual_test",
      pagePath: String(raw?.pagePath || raw?.page_path || ""),
      matchType: ALERT_MATCH_TYPES.includes(matchType) ? matchType : "exact",
      channelTarget: ALERT_CHANNEL_TARGETS.includes(target) ? target : "windows_client",
      desktopEnabled: raw?.desktopEnabled === undefined ? target === "windows_client" || target === "both" : Boolean(raw.desktopEnabled),
      pushoverEnabled: raw?.pushoverEnabled === undefined ? target === "pushover" || target === "both" : Boolean(raw.pushoverEnabled),
      titleTemplate: String(raw?.titleTemplate || raw?.title_template || raw?.title || ""),
      messageTemplate: String(raw?.messageTemplate || raw?.message_template || raw?.message || ""),
      tags: arrayFromValue(raw?.tags || []),
      notes: String(raw?.notes || raw?.internalNotes || ""),
      health: String(raw?.health || raw?.status || "scaffold"),
      updatedAt: String(raw?.updatedAt || raw?.updated_at || new Date().toISOString())
    };
  }

  function normalizeAlertChannelTarget(value) {
    const target = String(value || "windows_client").toLowerCase();
    if (target === "desktop") return "windows_client";
    return target;
  }

  function loadAlertRules() {
    const seed = Array.isArray(data.alerts) ? data.alerts.map(normalizeAlertRule) : [];

    try {
      const stored = window.localStorage.getItem(ALERTS_STORAGE_KEY);
      if (!stored) {
        return seed;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return seed;
      }

      return parsed.map(normalizeAlertRule);
    } catch {
      return seed;
    }
  }

  function persistAlertRules() {
    window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alertsState.rules, null, 2));
    persistCmsCollection("alerts");
  }

  function cmsEndpoint(collection) {
    return `/api/admin/cms/${collection}`;
  }

  function accountsEndpoint(path = "") {
    return `/api/admin/accounts${path ? `/${path}` : ""}`;
  }

  function adminStatusEndpoint() {
    return "/api/admin/status";
  }

  function adminAnalyticsEndpoint() {
    return "/api/admin/analytics";
  }

  function sendAdminPageVisit(path) {
    if (!window.DC_ADMIN_AUTH?.isAdmin || pageVisitState.lastPath === path) return;
    pageVisitState.lastPath = path;
    const payload = JSON.stringify({
      path,
      title: document.title,
      referrer: document.referrer
    });
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon && navigator.sendBeacon("/api/track/page-visit", blob)) {
      return;
    }
    fetch("/api/track/page-visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true
    }).catch(() => {
      // Page visit alert delivery must not affect dashboard navigation.
    });
  }

  function getCmsConfig(collection) {
    if (collection === "projects") {
      return {
        state: projectState,
        storageKey: PROJECTS_STORAGE_KEY,
        getItems: () => projectState.projects,
        setItems: (items) => {
          projectState.projects = items.map(normalizeProject);
        },
        render: renderProjects
      };
    }
    if (collection === "media") {
      return {
        state: mediaState,
        storageKey: MEDIA_STORAGE_KEY,
        getItems: () => mediaState.items,
        setItems: (items) => {
          mediaState.items = items.map(normalizeMediaItem);
        },
        render: renderMedia
      };
    }
    if (collection === "alerts") {
      return {
        state: alertsState,
        storageKey: ALERTS_STORAGE_KEY,
        getItems: () => alertsState.rules,
        setItems: (items) => {
          alertsState.rules = items.map(normalizeAlertRule);
        },
        render: renderAlerts
      };
    }
    return null;
  }

  function activePageIs(collection) {
    return parseRoute().page === collection;
  }

  function cmsStatusText(storage) {
    if (storage.status === "connected") return "Admin storage: connected";
    if (storage.status === "not-configured") return "Admin storage: not configured";
    if (storage.status === "saving") return "Admin storage: saving...";
    if (storage.status === "checking") return "Admin storage: checking...";
    return "Using local browser fallback";
  }

  function cmsStatusTone(storage) {
    if (storage.status === "connected") return "success";
    if (storage.status === "checking" || storage.status === "saving") return "warn";
    return "warn";
  }

  function accountRegistryTone() {
    if (accountRegistryState.status === "connected") return "success";
    if (accountRegistryState.status === "checking" || accountRegistryState.status === "saving") return "warn";
    return "warn";
  }

  function accountRegistryStatusText() {
    if (accountRegistryState.status === "connected") return "Account registry: connected";
    if (accountRegistryState.status === "checking") return "Account registry: checking...";
    if (accountRegistryState.status === "saving") return "Account registry: saving...";
    if (accountRegistryState.status === "not-configured") return "Account registry: storage not configured";
    return "Account registry: unavailable";
  }

  function currentAdminSession() {
    return window.DC_ADMIN_AUTH?.session || accountRegistryState.session || overviewStatusState.payload?.session || null;
  }

  function canManageAccounts() {
    const session = currentAdminSession();
    return Boolean(session?.is_master_admin);
  }

  function formatOperationalTimestamp(value) {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  }

  function cmsStatusMarkup(collection, actionName) {
    const config = getCmsConfig(collection);
    const storage = config.state.storage;
    const detail = storage.lastSaved
      ? `Last saved: ${formatTimestamp(storage.lastSaved)}`
      : storage.lastLoaded
        ? `Last loaded: ${formatTimestamp(storage.lastLoaded)}`
        : storage.message;
    return `
      <div class="cms-storage-status" data-cms-storage="${escapeHtml(collection)}">
        ${badge(cmsStatusText(storage), cmsStatusTone(storage))}
        <span>${escapeHtml(detail)}</span>
        <button class="button button-secondary" type="button" data-${actionName}="sync-cms">Sync/save to admin storage</button>
      </div>
    `;
  }

  function markCmsStorage(collection, status, message, extra = {}) {
    const config = getCmsConfig(collection);
    if (!config) return;
    Object.assign(config.state.storage, {
      status,
      message,
      ...extra
    });
  }

  async function hydrateCmsCollection(collection, renderAfter = false) {
    const config = getCmsConfig(collection);
    if (!config) return;
    markCmsStorage(collection, "checking", "Checking admin storage...");
    try {
      const response = await fetch(cmsEndpoint(collection), { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const error = payload?.error || `http_${response.status}`;
        const status = error === "storage_not_configured" ? "not-configured" : "fallback";
        markCmsStorage(collection, status, storageFallbackMessage(error), { source: "local" });
      } else if (payload.configured === false) {
        markCmsStorage(collection, "not-configured", "DC_ADMIN_KV is not configured. Using local browser fallback.", {
          source: payload.source || "local_fallback_unavailable"
        });
      } else if (Array.isArray(payload.items) && (payload.source === "kv" || collection === "projects")) {
        if (collection === "projects") {
          Object.assign(projectBaselineState, {
            loaded: true,
            protected: Boolean(payload.meta?.baselineProtected),
            partialKvMerged: Boolean(payload.meta?.partialKvMerged),
            baselineCount: Number(payload.meta?.baselineCount || projectBaselineState.baselineCount || 0),
            kvCount: Number(payload.meta?.kvCount || 0),
            mergedCount: Number(payload.meta?.mergedCount || payload.items.length),
            adminCreatedCount: Number(payload.meta?.adminCreatedCount || 0),
            source: payload.source || "baseline_plus_kv",
            message: payload.meta?.message || "Loaded from protected public-site baseline with admin storage overlay.",
            meta: payload.meta?.baseline || projectBaselineState.meta
          });
        }
        config.setItems(payload.items);
        window.localStorage.setItem(
          config.storageKey,
          JSON.stringify(collection === "projects" ? projectsStoragePayload() : config.getItems(), null, 2)
        );
        markCmsStorage(collection, "connected", collection === "projects" ? "Loaded from protected public-site baseline with admin storage overlay." : "Loaded from admin storage.", {
          source: payload.source || "kv",
          lastLoaded: payload.meta?.updatedAt || new Date().toISOString()
        });
      } else {
        markCmsStorage(collection, "connected", "Admin storage is reachable. No saved collection exists yet; local browser data is still shown.", {
          source: payload.source || "seed"
        });
      }
    } catch {
      markCmsStorage(collection, "fallback", "Pages Functions are unavailable here. Using local browser fallback.", {
        source: "local"
      });
    }
    if (renderAfter && activePageIs(collection)) {
      config.render();
    }
  }

  async function persistCmsCollection(collection, renderAfter = false, force = false) {
    const config = getCmsConfig(collection);
    if (!config) return;
    const storage = config.state.storage;
    if (!force && (storage.status === "not-configured" || storage.status === "fallback")) {
      return;
    }
    markCmsStorage(collection, "saving", "Saving to admin storage...");
    if (renderAfter && activePageIs(collection)) config.render();
    try {
      const response = await fetch(cmsEndpoint(collection), {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(collection === "projects" ? projectsStoragePayload() : { items: config.getItems() })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const error = payload?.error || `http_${response.status}`;
        const status = error === "storage_not_configured" ? "not-configured" : "fallback";
        markCmsStorage(collection, status, storageFallbackMessage(error), { source: "local" });
      } else {
        if (collection === "projects" && payload.meta) {
          Object.assign(projectBaselineState, {
            loaded: true,
            protected: Boolean(payload.meta.baselineProtected),
            partialKvMerged: Boolean(payload.meta.partialKvMerged),
            baselineCount: Number(payload.meta.baselineCount || projectBaselineState.baselineCount || 0),
            kvCount: Number(payload.meta.kvCount || config.getItems().length),
            mergedCount: Number(payload.meta.mergedCount || config.getItems().length),
            adminCreatedCount: Number(payload.meta.adminCreatedCount || 0),
            source: payload.source || "baseline_overlay_saved",
            message: "Saved reconciled Projects baseline overlay to admin storage."
          });
        }
        markCmsStorage(collection, "connected", "Saved to admin storage.", {
          source: payload.source || "kv",
          lastSaved: payload.meta?.updatedAt || new Date().toISOString()
        });
      }
    } catch {
      markCmsStorage(collection, "fallback", "Pages Functions are unavailable here. Saved to local browser fallback only.", {
        source: "local"
      });
    }
    if (renderAfter && activePageIs(collection)) {
      config.render();
    }
  }

  function storageFallbackMessage(error) {
    if (error === "storage_not_configured") return "DC_ADMIN_KV is not configured. Using local browser fallback.";
    if (error === "unauthenticated") return "Admin session is required. Using local browser fallback.";
    if (error === "admin_required") return "Signed-in account is not an admin. Using local browser fallback.";
    return "Admin storage is unavailable. Using local browser fallback.";
  }

  function hydrateCmsCollections() {
    ["projects", "media", "alerts"].forEach((collection) => hydrateCmsCollection(collection, activePageIs(collection)));
  }

  async function hydrateAccountRegistry(renderAfter = false) {
    accountRegistryState.status = "checking";
    accountRegistryState.message = "Checking account registry...";
    if (renderAfter && (activePageIs("accounts") || activePageIs("settings"))) render();
    try {
      const response = await fetch(accountsEndpoint(), { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        const error = payload?.error || `http_${response.status}`;
        Object.assign(accountRegistryState, {
          status: error === "storage_not_configured" ? "not-configured" : "fallback",
          message:
            error === "storage_not_configured"
              ? "DC_ADMIN_KV is not configured. Env master admins remain visible; local scaffold rows are non-authoritative."
              : "Account registry API is unavailable or the session is not authorized.",
          lastChecked: new Date().toISOString()
        });
      } else {
        Object.assign(accountRegistryState, {
          status: payload.storageConfigured ? "connected" : "not-configured",
          message: payload.storageConfigured
            ? "Loaded durable account registry from DC_ADMIN_KV."
            : "DC_ADMIN_KV is not configured. Env master admins are synthesized only.",
          accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
          meta: payload.meta || null,
          session: payload.session || currentAdminSession(),
          storageConfigured: Boolean(payload.storageConfigured),
          lastChecked: new Date().toISOString()
        });
      }
    } catch {
      Object.assign(accountRegistryState, {
        status: "fallback",
        message: "Pages Functions are unavailable here. Local scaffold rows are shown only as non-authoritative reference.",
        lastChecked: new Date().toISOString()
      });
    }
    if (renderAfter && (activePageIs("accounts") || activePageIs("settings"))) render();
  }

  async function hydrateOverviewStatus(renderAfter = false) {
    overviewStatusState.status = "checking";
    overviewStatusState.message = "Checking operational status...";
    if (renderAfter && activePageIs("overview")) renderOverview();
    try {
      const response = await fetch(adminStatusEndpoint(), { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        overviewStatusState.status = "fallback";
        overviewStatusState.message = payload?.error || `Status API unavailable (${response.status}).`;
      } else {
        overviewStatusState.status = "connected";
        overviewStatusState.message = "Operational status loaded from admin APIs.";
        overviewStatusState.payload = payload;
        overviewStatusState.lastChecked = payload.checkedAt || new Date().toISOString();
      }
    } catch {
      overviewStatusState.status = "fallback";
      overviewStatusState.message = "Pages Functions are unavailable here. Overview cannot claim live operational status.";
    }
    if (renderAfter && activePageIs("overview")) renderOverview();
  }

  async function hydrateAnalyticsStatus(renderAfter = false) {
    analyticsStatusState.status = "checking";
    analyticsStatusState.message = "Checking analytics status...";
    if (renderAfter && activePageIs("analytics")) renderAnalytics();
    try {
      const response = await fetch(adminAnalyticsEndpoint(), { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        analyticsStatusState.status = "fallback";
        analyticsStatusState.message = payload?.error || `Analytics API unavailable (${response.status}).`;
      } else {
        analyticsStatusState.status = payload.configured ? "connected" : "not-configured";
        analyticsStatusState.message = payload.configured
          ? "Cloudflare Analytics configuration is present; live query implementation is still pending."
          : "Cloudflare analytics not configured. Sample/local fallback rows are labelled below.";
        analyticsStatusState.payload = payload;
        analyticsStatusState.lastChecked = payload.lastChecked || new Date().toISOString();
      }
    } catch {
      analyticsStatusState.status = "fallback";
      analyticsStatusState.message = "Pages Functions are unavailable here. Analytics falls back to labelled local sample rows.";
    }
    if (renderAfter && activePageIs("analytics")) renderAnalytics();
  }

  async function mutateAccountRegistry(action, id, body = {}) {
    if (!id) return;
    accountRegistryState.status = "saving";
    accountRegistryState.message = `Applying account ${action}...`;
    if (activePageIs("accounts") || activePageIs("settings")) render();
    try {
      const response = await fetch(accountsEndpoint(action), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...body })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        accountRegistryState.status = "fallback";
        accountRegistryState.message = `Account action failed: ${payload?.error || response.status}`;
      } else {
        Object.assign(accountRegistryState, {
          status: payload.storageConfigured ? "connected" : "not-configured",
          message: `Account ${action} saved to durable registry.`,
          accounts: Array.isArray(payload.accounts) ? payload.accounts : accountRegistryState.accounts,
          meta: payload.meta || accountRegistryState.meta,
          session: payload.session || accountRegistryState.session,
          storageConfigured: Boolean(payload.storageConfigured),
          lastChecked: new Date().toISOString()
        });
      }
    } catch {
      accountRegistryState.status = "fallback";
      accountRegistryState.message = "Account action failed because Pages Functions are unavailable.";
    }
    if (activePageIs("accounts") || activePageIs("settings")) render();
  }

  async function hydrateProjectBaseline(renderAfter = false) {
    try {
      const response = await fetch(PROJECTS_BASELINE_URL, { cache: "no-store" });
      const payload = await response.json();
      const baselineProjects = Array.isArray(payload?.projects) ? payload.projects : [];
      if (!response.ok || !baselineProjects.length) {
        throw new Error("baseline_unavailable");
      }
      Object.assign(projectBaselineState, {
        loaded: true,
        protected: true,
        source: "public_baseline_asset",
        message: "Protected public-site Projects baseline loaded.",
        meta: payload.meta || null,
        projects: baselineProjects.map(normalizeProject),
        baselineCount: baselineProjects.length
      });
      projectState.projects = mergeProjectsWithBaseline(projectState.projects);
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectsStoragePayload(), null, 2));
      if (projectState.projects.length > (data.projects || []).length) {
        projectState.message = "Loaded from protected public-site baseline with local/admin storage overlay.";
      }
    } catch {
      Object.assign(projectBaselineState, {
        loaded: false,
        protected: false,
        source: "baseline_unavailable",
        message: "Public baseline asset is unavailable in this browser context; using existing local fallback rows."
      });
    }
    if (renderAfter && activePageIs("projects")) {
      renderProjects();
    }
  }

  function normalizeAccountAccess(raw) {
    const provider = String(raw?.provider || "github").toLowerCase();
    const identifier = String(raw?.identifier || raw?.email || raw?.username || "").trim();
    const fallbackId = createSlug(`${provider}-${identifier || raw?.id || Date.now()}`);
    const accountType = String(raw?.accountType || raw?.account_type || "regular").toLowerCase() === "admin" ? "admin" : "regular";
    return {
      id: String(raw?.id || fallbackId),
      provider: ["github", "google", "twitter", "password", "scaffold"].includes(provider) ? provider : "github",
      identifier,
      accountType,
      notes: String(raw?.notes || ""),
      updatedAt: String(raw?.updatedAt || new Date().toISOString())
    };
  }

  function loadAccountAccessScaffold() {
    try {
      const stored = window.localStorage.getItem(ACCOUNT_ACCESS_STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(normalizeAccountAccess);
    } catch {
      return [];
    }
  }

  function persistAccountAccessScaffold() {
    window.localStorage.setItem(ACCOUNT_ACCESS_STORAGE_KEY, JSON.stringify(accountAccessState.accounts, null, 2));
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

  function alertSearchBlob(rule) {
    return [
      rule.name,
      rule.id,
      rule.severity,
      rule.sourceSurface,
      rule.triggerType,
      rule.channelTarget,
      rule.titleTemplate,
      rule.messageTemplate,
      rule.tags.join(" "),
      rule.notes,
      rule.health
    ]
      .join(" ")
      .toLowerCase();
  }

  function filteredAlertRules() {
    const term = alertsState.search.trim().toLowerCase();
    return alertsState.rules.filter((rule) => {
      if (alertsState.severity !== "all" && rule.severity !== alertsState.severity) return false;
      if (alertsState.surface !== "all" && rule.sourceSurface !== alertsState.surface) return false;
      if (alertsState.target !== "all" && rule.channelTarget !== alertsState.target) return false;
      return !term || alertSearchBlob(rule).includes(term);
    });
  }

  function alertHealthTone(rule) {
    if (rule.enabled && (rule.desktopEnabled || rule.pushoverEnabled) && rule.name && rule.id) return "success";
    if (!rule.enabled || rule.channelTarget === "muted") return "warn";
    return "danger";
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

  function alertTriggerLabel(trigger) {
    if (trigger === "page_visit") return "Page visit";
    return String(trigger || "").replace(/_/g, " ");
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

  function storageStatusCard(label, status, detail, tone = "warn") {
    return `
      <article class="card metric-card">
        ${badge(label, tone)}
        <strong>${escapeHtml(status)}</strong>
        <p>${escapeHtml(detail)}</p>
      </article>
    `;
  }

  function boolStatus(value) {
    return value ? "Configured" : "Missing";
  }

  function boolTone(value) {
    return value ? "success" : "warn";
  }

  function accountIdentity(account) {
    return account.email || account.username || account.providerSubject || account.id || "Unknown account";
  }

  function accountActions(account) {
    if (account.locked || account.source === "env_master") return badge("Locked", "success");
    if (!canManageAccounts()) return badge("View only");
    const buttons = [];
    if (account.accountType === "admin") {
      buttons.push(`<button class="button button-secondary" type="button" data-account-action="demote" data-account-id="${escapeHtml(account.id)}">Demote</button>`);
    } else {
      buttons.push(`<button class="button" type="button" data-account-action="promote" data-account-id="${escapeHtml(account.id)}">Promote</button>`);
    }
    if (account.status === "disabled") {
      buttons.push(`<button class="button button-secondary" type="button" data-account-action="enable" data-account-id="${escapeHtml(account.id)}">Enable</button>`);
    } else {
      buttons.push(`<button class="button button-danger" type="button" data-account-action="disable" data-account-id="${escapeHtml(account.id)}">Disable</button>`);
    }
    buttons.push(`<button class="button button-secondary" type="button" data-account-action="notes" data-account-id="${escapeHtml(account.id)}">Notes</button>`);
    return `<div class="row-actions">${buttons.join("")}</div>`;
  }

  function accountRows(accounts) {
    if (!accounts.length) {
      return `<tr><td colspan="9"><div class="empty-state">No durable account records are available yet.</div></td></tr>`;
    }
    return accounts
      .map(
        (account) => `
          <tr>
            <td><strong>${escapeHtml(account.displayName || accountIdentity(account))}</strong><br><span>${escapeHtml(accountIdentity(account))}</span></td>
            <td>${escapeHtml(account.provider || "unknown")}</td>
            <td>${escapeHtml(account.providerSubject || "Not recorded")}</td>
            <td>${escapeHtml(account.accountType || "regular")}</td>
            <td>${escapeHtml(account.adminLevel || "none")}</td>
            <td>${escapeHtml(account.status || "active")}</td>
            <td>${escapeHtml(account.source || "unknown")}${account.locked ? "<br><span>Protected</span>" : ""}</td>
            <td>${escapeHtml(formatOperationalTimestamp(account.lastLoginAt || account.lastSeenAt || account.firstSeenAt))}</td>
            <td>${accountActions(account)}</td>
          </tr>
        `
      )
      .join("");
  }

  function registryFallbackReference() {
    if (accountRegistryState.status !== "fallback" && accountRegistryState.status !== "not-configured") return "";
    const rows = accountAccessState.accounts.length
      ? accountAccessState.accounts
          .map(
            (account) => `
              <article class="account-access-row">
                <div class="account-access-meta">
                  <strong>${escapeHtml(account.identifier || "(missing identifier)")}</strong>
                  <span class="muted">${escapeHtml(account.provider)} · ${escapeHtml(account.accountType)} · Non-authoritative local reference</span>
                  ${account.notes ? `<span>${escapeHtml(account.notes)}</span>` : ""}
                </div>
                ${badge("Local only", "warn")}
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">No local account reference rows are stored in this browser.</div>`;
    return `
      ${panel(
        "Local reference fallback",
        "These rows are old browser-local scaffold data. They are not production account authority and cannot promote OAuth users.",
        `<div class="account-access-list">${rows}</div>`
      )}
    `;
  }

  function renderOverview() {
    const status = overviewStatusState.payload;
    const session = status?.session || currentAdminSession() || {};
    const cms = status?.cms || {};
    routeTitle.textContent = "Overview";
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Admin command overview",
          "Overview",
          "Operational posture from signed admin APIs. Counts are shown only where a configured source reports them.",
          badge(overviewStatusState.status === "connected" ? "API status" : "Status pending", overviewStatusState.status === "connected" ? "success" : "warn")
        )}

        <section class="panel">
          <div class="panel-body grid hero-grid">
            <div class="card">
              <span class="section-kicker">Signed-in admin</span>
              <h2>${escapeHtml(session.display_name || session.email || "Session not resolved")}</h2>
              <p class="muted">
                ${escapeHtml(session.email || session.username || "No signed account details available")} · ${escapeHtml(session.provider || "unknown provider")} · ${escapeHtml(session.roleSource || "pending role source")}
              </p>
              <div class="toolbar">
                <button class="button" type="button" data-account-action="refresh-overview">Refresh status</button>
                <a class="button button-secondary" href="#/accounts">Review Accounts</a>
                <a class="button button-secondary" href="#/settings">Open Settings</a>
              </div>
            </div>
            <div class="card">
              <h3>Authority boundary</h3>
              <p class="muted">
                Accounts and CMS state resolve through Pages Functions and DC_ADMIN_KV where configured. Alert delivery uses the StreamSuites ingest bridge when configured.
              </p>
              ${badge(overviewStatusState.message, overviewStatusState.status === "connected" ? "success" : "warn")}
            </div>
          </div>
        </section>

        ${panel(
          "Operational status",
          `Last checked: ${escapeHtml(formatOperationalTimestamp(status?.checkedAt || overviewStatusState.lastChecked))}`,
          `<div class="grid grid-4">
            ${storageStatusCard(
              "Account registry",
              status?.accounts?.configured ? `${status.accounts.count} account(s)` : "Storage missing",
              status?.accounts?.configured ? `Key ${status.accounts.key}; ${status.accounts.envMasterCount} env master row(s).` : "DC_ADMIN_KV is required for durable OAuth/admin roles.",
              status?.accounts?.configured ? "success" : "warn"
            )}
            ${storageStatusCard(
              "Projects CMS",
              cms.projects?.configured ? `${cms.projects.count} KV row(s)` : "Storage missing",
              cms.projects?.configured ? `Key ${cms.projects.key}; public baseline count shown separately.` : "Falls back to protected public baseline/local browser data when unavailable.",
              cms.projects?.configured ? "success" : "warn"
            )}
            ${storageStatusCard(
              "Media CMS",
              cms.media?.configured ? `${cms.media.count} KV row(s)` : "Storage missing",
              cms.media?.configured ? `Key ${cms.media.key}` : "No live media publishing is claimed.",
              cms.media?.configured ? "success" : "warn"
            )}
            ${storageStatusCard(
              "Alerts CMS",
              cms.alerts?.configured ? `${cms.alerts.count} KV row(s)` : "Storage missing",
              cms.alerts?.configured ? `Key ${cms.alerts.key}` : "Alert posting remains future bridge work.",
              cms.alerts?.configured ? "success" : "warn"
            )}
          </div>`
        )}

        ${panel(
          "Configuration readiness",
          "Secret values are never displayed.",
          `<div class="grid grid-4">
            ${storageStatusCard("Public baseline", status?.publicProjectsBaseline?.count ? `${status.publicProjectsBaseline.count} project(s)` : "Unavailable", status?.publicProjectsBaseline?.source || "No baseline response yet", status?.publicProjectsBaseline?.count ? "success" : "warn")}
            ${storageStatusCard("Turnstile", boolStatus(status?.turnstile?.siteKeyConfigured && status?.turnstile?.secretConfigured), `Site key: ${boolStatus(status?.turnstile?.siteKeyConfigured)}; secret: ${boolStatus(status?.turnstile?.secretConfigured)}`, boolTone(status?.turnstile?.siteKeyConfigured && status?.turnstile?.secretConfigured))}
            ${storageStatusCard("OAuth providers", `${["github", "google", "twitter"].filter((name) => status?.oauth?.[`${name}Configured`]).length}/3 configured`, "GitHub, Google, and Twitter/X report configured status only.", boolTone(status?.oauth?.githubConfigured || status?.oauth?.googleConfigured || status?.oauth?.twitterConfigured))}
            ${storageStatusCard("Alert ingest bridge", boolStatus(status?.alerts?.alertIngestConfigured), `URL: ${boolStatus(status?.alerts?.alertIngestUrlConfigured)}; secret: ${boolStatus(status?.alerts?.alertIngestSecretConfigured)}`, boolTone(status?.alerts?.alertIngestConfigured))}
          </div>`
        )}

        ${panel(
          "Implementation boundaries",
          "Current constraints that should remain explicit.",
          `<div class="grid grid-2">
            <article class="card">${badge("Boundary")}<p>OAuth users register as regular accounts and are not auto-promoted to admin.</p></article>
            <article class="card">${badge("Boundary")}<p>Env-backed manual master admins remain the protected root authority.</p></article>
            <article class="card">${badge("Boundary")}<p>Projects, Media, and Alerts keep their existing KV CMS behavior.</p></article>
            <article class="card">${badge("Boundary")}<p>Alert sender failures are logged server-side and do not block auth, CMS saves, or navigation.</p></article>
          </div>`
        )}
      </div>
    `;
  }

  function renderAnalytics() {
    routeTitle.textContent = "Analytics";
    const status = analyticsStatusState.payload;
    const configured = Boolean(status?.configured);
    const missingConfig = Array.isArray(status?.missingConfig) ? status.missingConfig : [];
    const sourceLabel = status?.source || (analyticsStatusState.status === "fallback" ? "local_function_unavailable" : "checking");
    const sampleMarkers = data.analytics.markers || [];
    const sampleGeoRows = data.analytics.geoRows || [];
    const sampleRouteRows = data.analytics.routeRows || [];
    const operationalRows = [
      ["Configured", configured ? "Yes" : "No"],
      ["Source", sourceLabel],
      ["Site origin", status?.site?.origin || "https://danielclancy.net"],
      ["Admin origin", status?.site?.adminOrigin || "https://admin.danielclancy.net"],
      ["Last checked", formatOperationalTimestamp(status?.lastChecked || analyticsStatusState.lastChecked)]
    ];
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Analytics readiness",
          "Analytics",
          "Cloudflare-ready analytics status surface. It reports configuration/readiness first and labels sample fallback data without inventing live visitor numbers.",
          `${badge(configured ? "Cloudflare config present" : "Cloudflare analytics not configured", configured ? "success" : "warn")}
           ${badge(`Source: ${sourceLabel}`, configured ? "success" : "warn")}`
        )}

        ${panel(
          "Analytics API status",
          analyticsStatusState.message,
          `<div class="grid grid-2">
            ${storageStatusCard("Cloudflare Analytics", configured ? "Configured" : "Not configured", configured ? "Required env vars are present; live API querying remains a future tested integration." : "Required env vars are missing, so no live metrics are returned.", configured ? "success" : "warn")}
            ${storageStatusCard("Dashboard data mode", configured ? "Ready placeholder" : "Sample/local fallback", configured ? "Panels return explicit no-live-query placeholders." : "Scaffold cards and map rows remain visible only as labelled demo data.", configured ? "success" : "warn")}
          </div>
          ${descriptionRows(operationalRows)}`
        )}

        <section class="panel">
          <header class="panel-header">
            <div>
              <h2>Global Sessions Map</h2>
              <p>${escapeHtml(configured ? status?.map?.message || "Cloudflare config is present; live map query is pending." : "Cloudflare analytics not configured. Markers shown here are sample/local fallback only.")}</p>
            </div>
            <div class="panel-actions">
              ${badge(configured ? "Cloudflare-ready placeholder" : "Map sample", configured ? "success" : "warn")}
              ${badge(configured ? "No live query yet" : "No live telemetry", "warn")}
            </div>
          </header>
          <div class="panel-body">
            <div class="map-shell" role="img" aria-label="Scaffold map-style analytics panel">
              ${sampleMarkers
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
            configured ? "Cloudflare config is present, but live country/region query output is not enabled yet." : "Reference-style location table using labelled sample/local rows only.",
            `<div class="table-wrap">
              <table class="table">
                <thead>
                  <tr><th>Location</th><th>Precision</th><th>Sessions</th><th>Source</th></tr>
                </thead>
                <tbody>
                  ${sampleGeoRows
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
            "Analytics readiness",
            "Missing setup is listed by env var name only; no values or tokens are exposed.",
            `<div class="grid">
              ${(status?.requiredConfig || ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID_DANIELCLANCY", "CLOUDFLARE_API_TOKEN_ANALYTICS"])
                .map((name) => `<article class="card">${badge(missingConfig.includes(name) ? "Missing" : "Present", missingConfig.includes(name) ? "warn" : "success")}<p><strong>${escapeHtml(name)}</strong></p></article>`)
                .join("")}
              ${(status?.notes || data.analytics.notes)
                .map((note) => `<article class="card">${badge("Note", "warn")}<p>${escapeHtml(note)}</p></article>`)
                .join("")}
            </div>`
          )}
        </section>

        ${panel(
          "Top routes / resources",
          configured ? "Top-page API output is still pending; route rows below are sample/admin shell references." : "Static route table shown as sample/local fallback only.",
          `<div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Route</th><th>Surface</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${sampleRouteRows
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
    const accounts = accountRegistryState.accounts;
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Admin workspace",
          "Accounts",
          "Durable account registry backed by DC_ADMIN_KV when configured. Env-backed master admins are synthesized and locked.",
          badge(accountRegistryStatusText(), accountRegistryTone())
        )}

        ${panel(
          "Registry status",
          accountRegistryState.message,
          `<div class="cms-storage-status">
            ${badge(accountRegistryStatusText(), accountRegistryTone())}
            <span>${escapeHtml(accountRegistryState.meta?.key || "accounts:registry")} · Last checked: ${escapeHtml(formatOperationalTimestamp(accountRegistryState.lastChecked))}</span>
            <button class="button button-secondary" type="button" data-account-action="refresh">Refresh accounts</button>
          </div>`
        )}

        ${panel(
          "Account registry",
          canManageAccounts()
            ? "Master admins can promote, demote, enable, disable, and edit notes on KV-backed accounts. Locked env master rows cannot be changed."
            : "Signed-in admins can view accounts. Role changes require an env-backed master admin session.",
          `<div class="table-wrap">
            <table class="table accounts-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Provider</th>
                  <th>Provider subject</th>
                  <th>Type</th>
                  <th>Admin level</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>Last login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${accountRows(accounts)}
              </tbody>
            </table>
          </div>`
        )}

        ${panel(
          "Access boundary",
          "Production account authority rules.",
          descriptionRows([
            ["Root authority", "Manual env-backed master admins remain protected and locked"],
            ["OAuth default", "OAuth users become regular known accounts only and are not auto-promoted"],
            ["Durable store", "DC_ADMIN_KV key accounts:registry stores role/status/notes only"],
            ["Secret safety", "No passwords, OAuth access tokens, or OAuth refresh tokens are stored"]
          ])
        )}
        ${registryFallbackReference()}
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
          "Projects CMS",
          "Projects",
          "Loaded from protected public-site baseline with admin storage overlay. Changes here do not publish to DanielClancy.net until the public export/hydration bridge is wired.",
          `<button class="button" type="button" data-project-action="create">Create Project</button>
           <button class="button button-secondary" type="button" data-project-action="copy-json">Copy JSON</button>
           <button class="button button-secondary" type="button" data-project-action="import-json">Import JSON</button>
           <button class="button button-secondary" type="button" data-project-action="reconcile">Reconcile with public site baseline</button>
           <button class="button button-secondary" type="button" data-project-action="reset">Reset baseline</button>`
        )}

        ${cmsStatusMarkup("projects", "project-action")}

        ${panel(
          "Baseline and storage status",
          "Existing public projects are protected. Admin storage stores edits, metadata, hidden/archived posture, and admin-created additions as an overlay.",
          metricCards([
            { label: "Public baseline", value: String(projectBaselineState.baselineCount || projectBaselineState.projects.length), note: projectBaselineState.protected ? "Protected public-site project records." : projectBaselineState.message, tone: projectBaselineState.protected ? "success" : "warn" },
            { label: "Admin storage rows", value: String(projectBaselineState.kvCount || projectState.projects.length), note: projectState.storage.status === "connected" ? "KV overlay/manifest rows." : "Browser-local fallback overlay.", tone: projectState.storage.status === "connected" ? "success" : "warn" },
            { label: "Merged projects", value: String(projectBaselineState.mergedCount || projectState.projects.length), note: projectBaselineState.partialKvMerged ? "Partial legacy/scaffold data merged with baseline." : "Baseline protection active when available.", tone: projectBaselineState.partialKvMerged ? "warn" : "success" },
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
          "Manage future /watch page media metadata. Admin storage is used when available; local browser fallback remains available for static/dev views.",
          `<button class="button" type="button" data-media-action="create">Create Media Item</button>
           <button class="button button-secondary" type="button" data-media-action="copy-json">Copy JSON</button>
           <button class="button button-secondary" type="button" data-media-action="import-json">Import JSON</button>
           <button class="button button-secondary" type="button" data-media-action="reset">Reset seed</button>`
        )}

        ${cmsStatusMarkup("media", "media-action")}

        ${panel(
          "CMS status",
          "This editor does not publish content, fetch YouTube/Rumble feeds, embed StreamSuites profiles, or write public exports. Completeness checks are local field checks only.",
          metricCards([
            { label: "Media rows", value: String(mediaState.items.length), note: mediaState.storage.status === "connected" ? "Rows loaded from admin storage or local seed." : "Rows in local browser fallback.", tone: "warn" },
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

  function renderAlerts() {
    routeTitle.textContent = "Alerts";
    const visibleRules = filteredAlertRules();
    const selectedVisible = visibleRules.filter((rule) => alertsState.selected.has(rule.id)).length;
    const enabledCount = alertsState.rules.filter((rule) => rule.enabled).length;
    const desktopCount = alertsState.rules.filter((rule) => rule.desktopEnabled && rule.channelTarget !== "muted").length;
    const pushoverCount = alertsState.rules.filter((rule) => rule.pushoverEnabled && rule.channelTarget !== "muted").length;
    const mutedCount = alertsState.rules.filter((rule) => rule.channelTarget === "muted").length;

    app.innerHTML = `
      <div class="page alerts-page">
        ${pageHeader(
          "Alerts scaffold",
          "Alerts",
          "Manage DanielClancy.net alert-rule drafts. Admin storage is used when available; local browser fallback remains available for static/dev views.",
          `<button class="button" type="button" data-alert-action="create">Create Alert Rule</button>
           <button class="button button-secondary" type="button" data-alert-action="copy-json">Copy JSON contract</button>
           <button class="button button-secondary" type="button" data-alert-action="import-json">Import JSON</button>
           <button class="button button-secondary" type="button" data-alert-action="reset">Reset seed</button>`
        )}

        ${cmsStatusMarkup("alerts", "alert-action")}

        ${panel(
          "CMS status",
          "Routing fields are shaped for windows_client and Pushover delivery, but this page only edits local scaffold JSON.",
          metricCards([
            { label: "Rules", value: String(alertsState.rules.length), note: alertsState.storage.status === "connected" ? "Rows loaded from admin storage or local seed." : "Rows in local browser fallback.", tone: "warn" },
            { label: "Enabled", value: String(enabledCount), note: "Local enabled flags only.", tone: "warn" },
            { label: "Desktop targets", value: String(desktopCount), note: "Prepared for StreamSuites Alerts client catchment.", tone: "warn" },
            { label: "Pushover targets", value: String(pushoverCount), note: "Requires runtime env/config before live delivery.", tone: pushoverCount ? "warn" : "" }
          ])
        )}

        ${panel(
          "Catchment contract",
          "DanielClancy alert rules should be exported as a future runtime-owned contract, not treated as production delivery from this static page.",
          `<div class="grid grid-2">
            <article class="card">
              <span class="metric-label">Contract</span>
              <h3>danielclancy</h3>
              <p class="muted">Project: DanielClancy; public origin: https://danielclancy.net; admin origin: https://admin.danielclancy.net; targets: windows_client, pushover.</p>
            </article>
            <article class="card">
              <span class="metric-label">Delivery checkpoint</span>
              <h3>Not live</h3>
              <p class="muted">Live delivery requires StreamSuites/runtime bridge/export/API work plus Cloudflare Pages, DNS, auth/session env vars, OAuth redirect URIs, and Pushover env/config where applicable.</p>
            </article>
          </div>`
        )}

        ${panel(
          "Filters and bulk controls",
          "Search alert rules, select rows, and apply confirmed bulk changes to local scaffold rows.",
          renderAlertControls(visibleRules.length, selectedVisible, mutedCount)
        )}

        ${panel(
          "Alert rule table editor",
          "Table-style rule editor for DanielClancy source surfaces and future StreamSuites desktop/Pushover routing.",
          renderAlertTable(visibleRules)
        )}

        ${alertsState.modal ? renderAlertModal(alertsState.modal) : ""}
      </div>
    `;
  }

  function renderAlertControls(visibleCount, selectedVisible, mutedCount) {
    return `
      <div class="cms-toolbar alerts-toolbar" data-alert-controls>
        <label class="field field-wide">
          <span>Search</span>
          <input class="input" type="search" value="${escapeHtml(alertsState.search)}" placeholder="Name, rule id, domain, trigger, template, tag" data-alert-filter="search" />
        </label>
        <label class="field">
          <span>Severity</span>
          <select class="input" data-alert-filter="severity">
            <option value="all"${alertsState.severity === "all" ? " selected" : ""}>All severities</option>
            ${ALERT_SEVERITIES.map((severity) => `<option value="${severity}"${alertsState.severity === severity ? " selected" : ""}>${severity}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Surface / domain</span>
          <select class="input" data-alert-filter="surface">
            <option value="all"${alertsState.surface === "all" ? " selected" : ""}>All domains</option>
            ${ALERT_SURFACES.map((surface) => `<option value="${surface}"${alertsState.surface === surface ? " selected" : ""}>${surface}</option>`).join("")}
          </select>
        </label>
        <label class="field">
          <span>Target</span>
          <select class="input" data-alert-filter="target">
            <option value="all"${alertsState.target === "all" ? " selected" : ""}>All targets</option>
            ${ALERT_CHANNEL_TARGETS.map((target) => `<option value="${target}"${alertsState.target === target ? " selected" : ""}>${target}</option>`).join("")}
          </select>
        </label>
        <div class="cms-toolbar-summary">
          ${badge(`${visibleCount} visible`, "warn")}
          ${badge(`${alertsState.selected.size} selected`, selectedVisible ? "success" : "warn")}
          ${badge(`${mutedCount} muted`, mutedCount ? "warn" : "")}
          ${badge("Local scaffold only", "warn")}
        </div>
      </div>
      <div class="bulk-panel ${alertsState.bulkMode ? "is-open" : ""}">
        <div>
          <strong>Bulk editing mode</strong>
          <p class="muted">Bulk actions update ${escapeHtml(ALERTS_STORAGE_KEY)} only. Delete requires confirmation and does not affect StreamSuites runtime alerts.</p>
        </div>
        <div class="toolbar">
          <button class="button button-secondary" type="button" data-alert-action="toggle-bulk">${alertsState.bulkMode ? "Close bulk mode" : "Open bulk mode"}</button>
          <button class="button button-secondary" type="button" data-alert-action="select-visible">Select visible</button>
          <button class="button button-secondary" type="button" data-alert-action="clear-selection">Clear selection</button>
          <button class="button button-secondary" type="button" data-alert-action="bulk-enable" ${alertsState.selected.size ? "" : "disabled"}>Enable</button>
          <button class="button button-secondary" type="button" data-alert-action="bulk-disable" ${alertsState.selected.size ? "" : "disabled"}>Disable</button>
          <select class="input input-compact" data-alert-bulk-field="severity" ${alertsState.selected.size ? "" : "disabled"}>
            <option value="">Set severity</option>
            ${ALERT_SEVERITIES.map((severity) => `<option value="${severity}">${severity}</option>`).join("")}
          </select>
          <select class="input input-compact" data-alert-bulk-field="target" ${alertsState.selected.size ? "" : "disabled"}>
            <option value="">Set target</option>
            ${ALERT_CHANNEL_TARGETS.map((target) => `<option value="${target}">${target}</option>`).join("")}
          </select>
          <input class="input input-compact" type="text" placeholder="Tag" data-alert-bulk-tag ${alertsState.selected.size ? "" : "disabled"} />
          <button class="button button-secondary" type="button" data-alert-action="bulk-add-tag" ${alertsState.selected.size ? "" : "disabled"}>Add tag</button>
          <button class="button button-secondary" type="button" data-alert-action="bulk-remove-tag" ${alertsState.selected.size ? "" : "disabled"}>Remove tag</button>
          <button class="button button-danger" type="button" data-alert-action="bulk-delete" ${alertsState.selected.size ? "" : "disabled"}>Delete selected</button>
        </div>
        <div class="project-message" role="status">${escapeHtml(alertsState.message)}</div>
      </div>
    `;
  }

  function renderAlertTable(rules) {
    if (!rules.length) {
      return `<div class="empty-state">No local alert rules match the current filters. Create a rule or reset the seed rows.</div>`;
    }

    return `
      <div class="table-wrap">
        <table class="table project-table alerts-table">
          <thead>
            <tr>
              <th><input type="checkbox" aria-label="Select visible alert rules" data-alert-select-all ${rules.every((rule) => alertsState.selected.has(rule.id)) ? "checked" : ""} /></th>
              <th>Rule</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Source surface</th>
              <th>Trigger</th>
              <th>Target channel</th>
              <th>Routing</th>
              <th>Template</th>
              <th>Tags</th>
              <th>Health</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rules.map(renderAlertRow).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderAlertRow(rule) {
    return `
      <tr>
        <td><input type="checkbox" aria-label="Select ${escapeHtml(rule.name)}" data-alert-select="${escapeHtml(rule.id)}" ${alertsState.selected.has(rule.id) ? "checked" : ""} /></td>
        <td><strong>${escapeHtml(rule.name)}</strong><br><code>${escapeHtml(rule.id)}</code></td>
        <td>${badge(rule.enabled ? "Enabled" : "Disabled", rule.enabled ? "success" : "warn")}</td>
        <td>${badge(rule.severity, rule.severity === "critical" ? "danger" : rule.severity === "warning" ? "warn" : "")}</td>
        <td>${badge(rule.sourceSurface)}</td>
        <td>${escapeHtml(alertTriggerLabel(rule.triggerType))}</td>
        <td>${badge(rule.channelTarget, rule.channelTarget === "muted" ? "warn" : "")}</td>
        <td>${badge(`Desktop ${rule.desktopEnabled ? "on" : "off"}`, rule.desktopEnabled ? "success" : "warn")} ${badge(`Pushover ${rule.pushoverEnabled ? "on" : "off"}`, rule.pushoverEnabled ? "success" : "warn")}</td>
        <td><strong>${escapeHtml(rule.titleTemplate || "No title template")}</strong><br><span>${escapeHtml(rule.messageTemplate || "No message template")}</span></td>
        <td><div class="chip-row">${rule.tags.slice(0, 4).map((tag) => badge(tag)).join("") || badge("No tags", "warn")}</div></td>
        <td>${badge(rule.health, alertHealthTone(rule))}<br><small>Scaffold/export readiness only</small></td>
        <td>${escapeHtml(formatTimestamp(rule.updatedAt))}</td>
        <td>
          <div class="row-actions">
            <button class="button button-secondary" type="button" data-alert-action="detail" data-alert-id="${escapeHtml(rule.id)}">Detail</button>
            <button class="button button-secondary" type="button" data-alert-action="edit" data-alert-id="${escapeHtml(rule.id)}">Edit</button>
            <button class="button button-danger" type="button" data-alert-action="delete" data-alert-id="${escapeHtml(rule.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderAlertModal(modal) {
    const rule = modal.rule;
    const readOnly = modal.mode === "detail";
    const title = modal.mode === "create" ? "Create alert rule" : modal.mode === "detail" ? "Alert rule detail" : "Edit alert rule";
    return `
      <div class="modal-backdrop" data-alert-modal-backdrop>
        <section class="modal media-modal" role="dialog" aria-modal="true" aria-labelledby="alert-modal-title">
          <header class="modal-header">
            <div>
              <span class="section-kicker">DanielClancy alert scaffold</span>
              <h2 id="alert-modal-title">${escapeHtml(title)}</h2>
              <p>Save writes only to ${escapeHtml(ALERTS_STORAGE_KEY)}. Live desktop/Pushover delivery requires StreamSuites/runtime bridge and hosted env setup.</p>
            </div>
            <button class="icon-close" type="button" aria-label="Close alert editor" data-alert-action="close-modal">x</button>
          </header>
          <form class="modal-body project-form" data-alert-form>
            <input type="hidden" name="originalId" value="${escapeHtml(rule.id)}" />
            <div class="form-grid">
              ${field("Rule name", "name", rule.name, "text", true, readOnly)}
              ${field("Rule id / code", "id", rule.id, "text", true, readOnly)}
              <label class="field">
                <span>Source surface / domain</span>
                <select class="input" name="sourceSurface" ${readOnly ? "disabled" : ""}>
                  ${ALERT_SURFACES.map((surface) => `<option value="${surface}"${rule.sourceSurface === surface ? " selected" : ""}>${surface}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Severity</span>
                <select class="input" name="severity" ${readOnly ? "disabled" : ""}>
                  ${ALERT_SEVERITIES.map((severity) => `<option value="${severity}"${rule.severity === severity ? " selected" : ""}>${severity}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Trigger type</span>
                <select class="input" name="triggerType" ${readOnly ? "disabled" : ""}>
                  ${ALERT_TRIGGER_TYPES.map((trigger) => `<option value="${trigger}"${rule.triggerType === trigger ? " selected" : ""}>${alertTriggerLabel(trigger)}</option>`).join("")}
                </select>
                <small>Page visit: Alert when a tracked public/admin page visit event is received.</small>
              </label>
              ${field("Page path", "pagePath", rule.pagePath, "text", false, readOnly)}
              <label class="field">
                <span>Page path match</span>
                <select class="input" name="matchType" ${readOnly ? "disabled" : ""}>
                  ${ALERT_MATCH_TYPES.map((matchType) => `<option value="${matchType}"${rule.matchType === matchType ? " selected" : ""}>${matchType.replace(/_/g, " ")}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Channel target</span>
                <select class="input" name="channelTarget" ${readOnly ? "disabled" : ""}>
                  ${ALERT_CHANNEL_TARGETS.map((target) => `<option value="${target}"${rule.channelTarget === target ? " selected" : ""}>${target}</option>`).join("")}
                </select>
              </label>
              <label class="checkbox-field">
                <input type="checkbox" name="enabled" ${rule.enabled ? "checked" : ""} ${readOnly ? "disabled" : ""} />
                <span>Rule enabled</span>
              </label>
              <label class="checkbox-field">
                <input type="checkbox" name="desktopEnabled" ${rule.desktopEnabled ? "checked" : ""} ${readOnly ? "disabled" : ""} />
                <span>Desktop alert enabled</span>
              </label>
              <label class="checkbox-field">
                <input type="checkbox" name="pushoverEnabled" ${rule.pushoverEnabled ? "checked" : ""} ${readOnly ? "disabled" : ""} />
                <span>Pushover enabled</span>
              </label>
              ${textareaField("Title template", "titleTemplate", rule.titleTemplate, readOnly)}
              ${textareaField("Message template", "messageTemplate", rule.messageTemplate, readOnly)}
              ${textareaField("Tags", "tags", rule.tags.join("\n"), readOnly)}
              ${textareaField("Notes", "notes", rule.notes, readOnly)}
            </div>
            <aside class="asset-status-box">
              <h3>Scaffold-only warning</h3>
              <p>This editor does not send alerts, register desktop clients, write StreamSuites runtime rules, or contact Pushover. Export JSON for review and future bridge wiring.</p>
              <div class="chip-row">
                ${badge("Project DanielClancy", "warn")}
                ${badge("Namespace danielclancy", "warn")}
                ${badge(rule.sourceSurface)}
              </div>
            </aside>
            <footer class="modal-footer">
              <button class="button button-secondary" type="button" data-alert-action="close-modal">Cancel</button>
              ${readOnly ? `<button class="button" type="button" data-alert-action="edit" data-alert-id="${escapeHtml(rule.id)}">Edit</button>` : `<button class="button" type="submit">Save local scaffold</button>`}
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
          ${badge(projectBaselineState.protected ? "Baseline protection active" : "Browser-local fallback", projectBaselineState.protected ? "success" : "warn")}
        </div>
      </div>
      <div class="bulk-panel ${projectState.bulkMode ? "is-open" : ""}">
        <div>
          <strong>Bulk editing mode</strong>
          <p class="muted">Baseline rows are protected. Delete archives/hides public baseline records and hard-deletes only admin-created rows.</p>
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
    const baseline = isBaselineProject(project);
    return `
      <tr>
        <td><input type="checkbox" aria-label="Select ${escapeHtml(project.title)}" data-project-select="${escapeHtml(project.id)}" ${projectState.selected.has(project.id) ? "checked" : ""} /></td>
        <td><strong>${escapeHtml(project.title)}</strong><br><span>${escapeHtml(project.client || "No client field")}</span><br>${baseline ? badge("Protected baseline", "success") : badge("Admin-created", "warn")}</td>
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
            <button class="button button-danger" type="button" data-project-action="delete" data-project-id="${escapeHtml(project.id)}">${baseline ? "Archive" : "Delete"}</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderProjectModal(modal) {
    const project = modal.project;
    const readOnly = modal.mode === "detail";
    const issues = projectAssetIssues(project);
    const title = modal.mode === "create" ? "Create admin project" : modal.mode === "detail" ? "Project detail" : "Edit project overlay";
    const baseline = isBaselineProject(project);
    return `
      <div class="modal-backdrop" data-project-modal-backdrop>
        <section class="modal project-modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
          <header class="modal-header">
            <div>
              <span class="section-kicker">${baseline ? "Protected baseline record" : "Admin-created record"}</span>
              <h2 id="project-modal-title">${escapeHtml(title)}</h2>
              <p>Save writes to admin overlay storage when available and to ${escapeHtml(PROJECTS_STORAGE_KEY)} as browser-local fallback. Public-site publishing remains future work.</p>
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
              ${readOnly ? `<button class="button" type="button" data-project-action="edit" data-project-id="${escapeHtml(project.id)}">Edit</button>` : `<button class="button" type="submit">Save overlay</button>`}
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

  function emptyAlertRule() {
    return normalizeAlertRule({
      id: `alert-${Date.now()}`,
      name: "",
      enabled: false,
      severity: "info",
      sourceSurface: "danielclancy.net",
      triggerType: "manual_test",
      pagePath: "",
      matchType: "exact",
      channelTarget: "windows_client",
      desktopEnabled: true,
      pushoverEnabled: false,
      titleTemplate: "DanielClancy alert",
      messageTemplate: "Scaffold alert rule triggered for DanielClancy.",
      tags: ["scaffold"],
      notes: "Created in DanielClancy-Admin local alert scaffold. Not live."
    });
  }

  function alignAlertTargetFlags(rule, target) {
    target = normalizeAlertChannelTarget(target);
    if (target === "both") {
      return { ...rule, channelTarget: target, desktopEnabled: true, pushoverEnabled: true };
    }
    if (target === "windows_client") {
      return { ...rule, channelTarget: target, desktopEnabled: true, pushoverEnabled: false };
    }
    if (target === "pushover") {
      return { ...rule, channelTarget: target, desktopEnabled: false, pushoverEnabled: true };
    }
    if (target === "muted") {
      return { ...rule, channelTarget: target, desktopEnabled: false, pushoverEnabled: false };
    }
    return rule;
  }

  function buildAlertContract() {
    return {
      project: "DanielClancy",
      source_namespace: "danielclancy",
      public_origin: "https://danielclancy.net",
      admin_origin: "https://admin.danielclancy.net",
      targets: ["windows_client", "pushover"],
      storage_key: ALERTS_STORAGE_KEY,
      delivery_status: "scaffold_only",
      requirements: [
        "StreamSuites/runtime export or API bridge must accept these rules before live delivery.",
        "Cloudflare Pages project, admin.danielclancy.net DNS, auth/session env vars, and OAuth redirect URIs must be configured before live hosted testing.",
        "Pushover API/user env or routing config must be configured before DanielClancy Pushover delivery."
      ],
      rules: alertsState.rules.map(normalizeAlertRule)
    };
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
              ["Account type", account.accountType || "regular"],
              ["Provider", account.provider || "scaffold"],
              ["Identifier", account.identifier || account.email],
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

  function renderMasterAdminRows() {
    return MASTER_ADMIN_ACCOUNTS.map(
      (account) => `
        <article class="account-access-row">
          <div class="account-access-meta">
            <strong>${escapeHtml(account.email)}</strong>
            <span class="muted">Env-backed master admin: ${escapeHtml(account.envEmail)} / ${escapeHtml(account.envSecret)}</span>
          </div>
          ${badge("Not removable", "success")}
        </article>
      `
    ).join("");
  }

  function renderAccountAccessScaffold() {
    const session = currentAdminSession() || {};
    const registryRows = accountRegistryState.accounts.length
      ? accountRegistryState.accounts
          .map(
            (account) => `
              <article class="account-access-row">
                <div class="account-access-meta">
                  <strong>${escapeHtml(account.displayName || accountIdentity(account))}</strong>
                  <span class="muted">${escapeHtml(accountIdentity(account))} · ${escapeHtml(account.provider)} · ${escapeHtml(account.accountType)} / ${escapeHtml(account.adminLevel || "none")}</span>
                  <span>${escapeHtml(account.source || "unknown")} · ${escapeHtml(account.status || "active")}${account.locked ? " · locked" : ""}</span>
                </div>
                ${account.locked ? badge("Protected", "success") : badge("KV managed", account.accountType === "admin" ? "success" : "warn")}
              </article>
            `
          )
          .join("")
      : `<div class="empty-state">No account registry rows are loaded yet.</div>`;

    return `
      <div class="cms-storage-status">
        ${badge(accountRegistryStatusText(), accountRegistryTone())}
        <span>${escapeHtml(accountRegistryState.message)}</span>
        <button class="button button-secondary" type="button" data-account-action="refresh">Refresh accounts</button>
      </div>
      <hr class="panel-divider" />
      ${descriptionRows([
        ["Current signed-in role", `${session.account_type || "unknown"} / ${session.admin_level || "none"} from ${session.roleSource || "pending"}`],
        ["Manual master admins", "Env-backed, root-authoritative, locked, and not removable or downgradeable in the UI"],
        ["OAuth users", "Registered as regular accounts unless a master admin promotes them"],
        ["Durable account store", "DC_ADMIN_KV key accounts:registry stores role/status/notes; no passwords or OAuth tokens"],
        ["Turnstile", "Auth gate login/signup and OAuth start flows remain Turnstile-protected"],
        ["Alert ingest secret", "DANIELCLANCY_ALERT_INGEST_SECRET is a shared generated secret; Settings never displays the value"]
      ])}
      <hr class="panel-divider" />
      <div class="account-access-list">
        ${registryRows}
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
          "Operational settings posture for auth, account registry, CMS storage, and environment readiness. Secret values are never displayed.",
          badge("Operational settings", "success")
        )}

        <section class="panel">
          <div class="panel-body grid hero-grid">
            <div class="card">
              <span class="section-kicker">System posture</span>
              <h2>Account authority is server-side</h2>
              <p class="muted">Manual master admins are env-backed and locked. OAuth users remain regular until a master admin promotes them through the durable registry.</p>
            </div>
            <div class="card">
              <h3>Storage and security</h3>
              <p class="muted">DC_ADMIN_KV stores CMS rows and account roles. Turnstile protects auth actions. Secrets stay server-only.</p>
            </div>
          </div>
        </section>

        ${panel(
          "Admin CMS storage readiness",
          "Production CMS persistence depends on Cloudflare Pages Functions and KV.",
          descriptionRows([
            ["CMS API", "Projects, Media, and Alerts call /api/admin/cms/<collection> when an admin session is available"],
            ["KV binding", "DC_ADMIN_KV is required for production persistence"],
            ["Fallback", "localStorage fallback is browser-local only and remains available for static/dev views"],
            ["Account roles", "DC_ADMIN_KV key accounts:registry stores durable account roles; OAuth users are not auto-promoted"]
          ])
        )}

        ${panel(
          "Account access",
          "Manual master admins are env-backed and production-authoritative. OAuth/public accounts are regular until promoted by a master admin.",
          renderAccountAccessScaffold()
        )}

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
            ["Secrets", "Manual admin passwords stay in Cloudflare Pages Function env vars only"],
            ["Cloudflare Pages", "Functions auth, account registry, status, and CMS endpoints added"],
            ["Admin CMS storage", "DC_ADMIN_KV required for production Projects, Media, and Alerts persistence"],
            ["Account registry", "accounts:registry is the durable KV key for known OAuth accounts and role/status notes"],
            ["Alert ingest secret", "Generate DANIELCLANCY_ALERT_INGEST_SECRET with node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\" and reuse the same value only in server/runtime sender environments"],
            ["DNS / live deployment", "Hosted Cloudflare bindings still need live environment confirmation"]
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
    sendAdminPageVisit(route.id ? `#/${route.page}/${route.id}` : `#/${route.page}`);
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
    } else if (route.page === "alerts") {
      renderAlerts();
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

    if (target.matches("[data-alert-filter='search']")) {
      alertsState.search = target.value;
      renderAlerts();
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

    if (target.matches("[data-alert-filter='severity']")) {
      alertsState.severity = target.value;
      renderAlerts();
      return;
    }

    if (target.matches("[data-alert-filter='surface']")) {
      alertsState.surface = target.value;
      renderAlerts();
      return;
    }

    if (target.matches("[data-alert-filter='target']")) {
      alertsState.target = target.value;
      renderAlerts();
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

    if (target.matches("[data-alert-select]")) {
      const id = target.getAttribute("data-alert-select");
      if (target.checked) {
        alertsState.selected.add(id);
      } else {
        alertsState.selected.delete(id);
      }
      renderAlerts();
      return;
    }

    if (target.matches("[data-alert-select-all]")) {
      filteredAlertRules().forEach((rule) => {
        if (target.checked) {
          alertsState.selected.add(rule.id);
        } else {
          alertsState.selected.delete(rule.id);
        }
      });
      renderAlerts();
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
      return;
    }

    if (target.matches("[data-alert-bulk-field='severity']") && target.value) {
      bulkUpdateAlerts((rule) => ({ ...rule, severity: target.value, updatedAt: new Date().toISOString() }));
      alertsState.message = `Updated severity for ${alertsState.selected.size} selected alert rule scaffold row(s).`;
      persistAlertRules();
      renderAlerts();
      return;
    }

    if (target.matches("[data-alert-bulk-field='target']") && target.value) {
      bulkUpdateAlerts((rule) => alignAlertTargetFlags({ ...rule, updatedAt: new Date().toISOString() }, target.value));
      alertsState.message = `Updated target channel for ${alertsState.selected.size} selected alert rule scaffold row(s).`;
      persistAlertRules();
      renderAlerts();
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

    if (form.matches("[data-account-access-form]")) {
      event.preventDefault();
      saveAccountAccessFromForm(form);
      return;
    }

    if (form.matches("[data-alert-form]")) {
      event.preventDefault();
      saveAlertFromForm(form);
      return;
    }

    if (!form.matches("[data-project-form]")) return;

    event.preventDefault();
    saveProjectFromForm(form);
  });

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-project-action], [data-project-modal-backdrop], [data-media-action], [data-media-modal-backdrop], [data-alert-action], [data-alert-modal-backdrop], [data-account-access-action], [data-account-action]");
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute("data-project-action");
    const mediaAction = target.getAttribute("data-media-action");
    const alertAction = target.getAttribute("data-alert-action");
    const accountAccessAction = target.getAttribute("data-account-access-action");
    const accountAction = target.getAttribute("data-account-action");
    const id = target.getAttribute("data-project-id");
    const mediaId = target.getAttribute("data-media-id");
    const alertId = target.getAttribute("data-alert-id");
    const accountAccessId = target.getAttribute("data-account-access-id");
    const accountId = target.getAttribute("data-account-id");

    if (accountAction === "refresh") {
      hydrateAccountRegistry(true);
      return;
    }

    if (accountAction === "refresh-overview") {
      hydrateOverviewStatus(true);
      return;
    }

    if (["promote", "demote", "disable", "enable"].includes(accountAction)) {
      mutateAccountRegistry(accountAction, accountId);
      return;
    }

    if (accountAction === "notes") {
      const account = accountRegistryState.accounts.find((item) => item.id === accountId);
      const notes = window.prompt("Update account notes. Do not enter secrets.", account?.notes || "");
      if (notes !== null) mutateAccountRegistry("update", accountId, { notes });
      return;
    }

    if (accountAccessAction === "remove") {
      removeAccountAccess(accountAccessId);
      return;
    }

    if (!action && !mediaAction && !alertAction && (target.matches("[data-project-modal-backdrop]") || target.matches("[data-media-modal-backdrop]") || target.matches("[data-alert-modal-backdrop]"))) {
      return;
    }

    if (alertAction === "create") {
      alertsState.modal = { mode: "create", rule: emptyAlertRule() };
      renderAlerts();
    } else if (alertAction === "detail") {
      const rule = alertsState.rules.find((entry) => entry.id === alertId);
      if (rule) alertsState.modal = { mode: "detail", rule };
      renderAlerts();
    } else if (alertAction === "edit") {
      const rule = alertId ? alertsState.rules.find((entry) => entry.id === alertId) : alertsState.modal?.rule;
      if (rule) alertsState.modal = { mode: "edit", rule };
      renderAlerts();
    } else if (alertAction === "delete") {
      deleteAlertRule(alertId);
    } else if (alertAction === "close-modal") {
      alertsState.modal = null;
      renderAlerts();
    } else if (alertAction === "toggle-bulk") {
      alertsState.bulkMode = !alertsState.bulkMode;
      renderAlerts();
    } else if (alertAction === "select-visible") {
      filteredAlertRules().forEach((rule) => alertsState.selected.add(rule.id));
      alertsState.message = "Visible alert scaffold rows selected.";
      renderAlerts();
    } else if (alertAction === "clear-selection") {
      alertsState.selected.clear();
      alertsState.message = "Selection cleared.";
      renderAlerts();
    } else if (alertAction === "bulk-enable") {
      bulkUpdateAlerts((rule) => ({ ...rule, enabled: true, updatedAt: new Date().toISOString() }));
      alertsState.message = `Enabled ${alertsState.selected.size} selected alert scaffold row(s).`;
      persistAlertRules();
      renderAlerts();
    } else if (alertAction === "bulk-disable") {
      bulkUpdateAlerts((rule) => ({ ...rule, enabled: false, updatedAt: new Date().toISOString() }));
      alertsState.message = `Disabled ${alertsState.selected.size} selected alert scaffold row(s).`;
      persistAlertRules();
      renderAlerts();
    } else if (alertAction === "bulk-add-tag") {
      bulkAlertTag("add");
    } else if (alertAction === "bulk-remove-tag") {
      bulkAlertTag("remove");
    } else if (alertAction === "bulk-delete") {
      bulkDeleteAlerts();
    } else if (alertAction === "copy-json") {
      copyAlertsJson();
    } else if (alertAction === "import-json") {
      importAlertsJson();
    } else if (alertAction === "reset") {
      resetAlerts();
    } else if (alertAction === "sync-cms") {
      persistCmsCollection("alerts", true, true);
    }

    if (alertAction) return;

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
    } else if (mediaAction === "sync-cms") {
      persistCmsCollection("media", true, true);
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
    } else if (action === "reconcile") {
      reconcileProjects();
    } else if (action === "reset") {
      resetProjects();
    } else if (action === "sync-cms") {
      persistCmsCollection("projects", true, true);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && alertsState.modal) {
      alertsState.modal = null;
      renderAlerts();
      return;
    }

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

  function saveAccountAccessFromForm(form) {
    const identifier = formValue(form, "identifier");
    if (!identifier) {
      accountAccessState.message = "Identifier, email, username, or provider subject is required.";
      renderSettings();
      return;
    }
    const saved = normalizeAccountAccess({
      provider: formValue(form, "provider"),
      accountType: formValue(form, "accountType"),
      identifier,
      notes: formValue(form, "notes"),
      updatedAt: new Date().toISOString()
    });
    const existingIndex = accountAccessState.accounts.findIndex(
      (account) => account.provider === saved.provider && account.identifier.toLowerCase() === saved.identifier.toLowerCase()
    );
    if (existingIndex >= 0) {
      accountAccessState.accounts[existingIndex] = saved;
      accountAccessState.message = "Updated local account access scaffold row. This is not production authority.";
    } else {
      accountAccessState.accounts.unshift(saved);
      accountAccessState.message = "Saved local account access scaffold row. This is not production authority.";
    }
    persistAccountAccessScaffold();
    renderSettings();
  }

  function removeAccountAccess(id) {
    const account = accountAccessState.accounts.find((item) => item.id === id);
    if (!account) return;
    if (!window.confirm(`Remove local scaffold row for "${account.identifier}"? This does not affect production auth.`)) {
      return;
    }
    accountAccessState.accounts = accountAccessState.accounts.filter((item) => item.id !== id);
    persistAccountAccessScaffold();
    accountAccessState.message = "Removed local account access scaffold row.";
    renderSettings();
  }

  function saveProjectFromForm(form) {
    const title = formValue(form, "title");
    const slug = createSlug(formValue(form, "slug") || title);

    if (!title || !slug) {
      projectState.message = "Title and slug/id are required before saving.";
      renderProjects();
      return;
    }

    const originalId = formValue(form, "originalId");
    const originalProject = projectState.projects.find((project) => project.id === originalId);
    const protectedBaseline = originalProject && isBaselineProject(originalProject);
    const saved = normalizeProject({
      id: protectedBaseline ? originalProject.id : slug,
      slug: protectedBaseline ? originalProject.slug : slug,
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
      sourceFolder: protectedBaseline ? originalProject.sourceFolder : formValue(form, "sourceFolder"),
      summary: formValue(form, "summary"),
      description: formValue(form, "description"),
      galleryPaths: textareaArray(formValue(form, "galleryPaths")),
      tags: textareaArray(formValue(form, "tags")),
      studio: textareaArray(formValue(form, "studio")),
      software: textareaArray(formValue(form, "software")),
      internalNotes: formValue(form, "internalNotes"),
      updatedAt: new Date().toISOString(),
      baselineProtected: protectedBaseline,
      baselineVersion: protectedBaseline ? PROJECTS_BASELINE_VERSION : "",
      source: protectedBaseline ? "admin_overlay" : "admin_created"
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

  function saveAlertFromForm(form) {
    const name = formValue(form, "name");
    const id = createSlug(formValue(form, "id") || name);

    if (!name || !id) {
      alertsState.message = "Rule name and rule id/code are required before saving.";
      renderAlerts();
      return;
    }

    const originalId = formValue(form, "originalId");
    const saved = normalizeAlertRule({
      id,
      name,
      enabled: Boolean(form.querySelector("[name='enabled']")?.checked),
      severity: formValue(form, "severity"),
      sourceSurface: formValue(form, "sourceSurface"),
      triggerType: formValue(form, "triggerType"),
      pagePath: formValue(form, "pagePath"),
      matchType: formValue(form, "matchType"),
      channelTarget: formValue(form, "channelTarget"),
      desktopEnabled: Boolean(form.querySelector("[name='desktopEnabled']")?.checked),
      pushoverEnabled: Boolean(form.querySelector("[name='pushoverEnabled']")?.checked),
      titleTemplate: formValue(form, "titleTemplate"),
      messageTemplate: formValue(form, "messageTemplate"),
      tags: textareaArray(formValue(form, "tags")),
      notes: formValue(form, "notes"),
      health: "scaffold",
      updatedAt: new Date().toISOString()
    });

    const existingIndex = alertsState.rules.findIndex((rule) => rule.id === originalId);
    const duplicate = alertsState.rules.some((rule, index) => rule.id === saved.id && index !== existingIndex);
    if (duplicate) {
      alertsState.message = "An alert scaffold row already uses that rule id/code.";
      renderAlerts();
      return;
    }

    if (existingIndex >= 0) {
      alertsState.rules[existingIndex] = saved;
    } else {
      alertsState.rules.unshift(saved);
    }

    if (originalId !== saved.id) {
      alertsState.selected.delete(originalId);
    }

    persistAlertRules();
    alertsState.modal = null;
    alertsState.message = `Saved ${saved.name} locally. This does not write StreamSuites runtime alert rules or send Pushover notifications.`;
    renderAlerts();
  }

  function deleteProject(id) {
    const project = projectState.projects.find((item) => item.id === id);
    if (!project) return;

    if (isBaselineProject(project)) {
      if (!window.confirm(`Archive protected public-site baseline project "${project.title}"? Baseline records cannot be hard-deleted here; this will mark the admin overlay as archived/hidden instead.`)) {
        return;
      }
      projectState.projects = projectState.projects.map((item) =>
        item.id === id
          ? normalizeProject({
              ...item,
              status: "archived",
              visibility: "hidden",
              updatedAt: new Date().toISOString(),
              internalNotes: `${item.internalNotes ? `${item.internalNotes}\n` : ""}Protected baseline row archived from DanielClancy-Admin.`
            })
          : item
      );
      projectState.selected.delete(id);
      persistProjects();
      projectState.message = `Archived protected baseline project: ${project.title}.`;
      renderProjects();
      return;
    }

    if (!window.confirm(`Delete admin-created project "${project.title}"? This removes only the admin overlay row and does not hard-delete public baseline records.`)) {
      return;
    }
    projectState.projects = projectState.projects.filter((item) => item.id !== id);
    projectState.selected.delete(id);
    persistProjects();
    projectState.message = `Deleted admin-created row: ${project.title}.`;
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

  function deleteAlertRule(id) {
    const rule = alertsState.rules.find((entry) => entry.id === id);
    if (!rule) return;

    if (!window.confirm(`Delete local scaffold alert rule "${rule.name || rule.id}"? This will not affect StreamSuites runtime alerts.`)) {
      return;
    }

    alertsState.rules = alertsState.rules.filter((entry) => entry.id !== id);
    alertsState.selected.delete(id);
    persistAlertRules();
    alertsState.message = `Deleted local alert scaffold row: ${rule.name || rule.id}.`;
    renderAlerts();
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

  function bulkUpdateAlerts(mutator) {
    alertsState.rules = alertsState.rules.map((rule) =>
      alertsState.selected.has(rule.id) ? normalizeAlertRule(mutator(rule)) : rule
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

  function bulkAlertTag(mode) {
    const input = app.querySelector("[data-alert-bulk-tag]");
    const tag = String(input?.value || "").trim();
    if (!tag) {
      alertsState.message = "Enter a tag before applying a bulk tag action.";
      renderAlerts();
      return;
    }

    bulkUpdateAlerts((rule) => {
      const tags = new Set(rule.tags);
      if (mode === "add") tags.add(tag);
      if (mode === "remove") tags.delete(tag);
      return { ...rule, tags: Array.from(tags), updatedAt: new Date().toISOString() };
    });
    persistAlertRules();
    alertsState.message = `${mode === "add" ? "Added" : "Removed"} tag "${tag}" on selected local alert scaffold row(s).`;
    renderAlerts();
  }

  function bulkDelete() {
    const count = projectState.selected.size;
    if (!count) return;
    const selectedProjects = projectState.projects.filter((project) => projectState.selected.has(project.id));
    const baselineCount = selectedProjects.filter(isBaselineProject).length;
    const adminCreatedCount = selectedProjects.length - baselineCount;
    if (!window.confirm(`Apply delete/archive to ${count} selected project row(s)? ${baselineCount} protected baseline row(s) will be archived/hidden, and ${adminCreatedCount} admin-created row(s) will be hard-deleted.`)) {
      return;
    }

    projectState.projects = projectState.projects
      .map((project) =>
        projectState.selected.has(project.id) && isBaselineProject(project)
          ? normalizeProject({
              ...project,
              status: "archived",
              visibility: "hidden",
              updatedAt: new Date().toISOString()
            })
          : project
      )
      .filter((project) => !projectState.selected.has(project.id) || isBaselineProject(project));
    projectState.selected.clear();
    persistProjects();
    projectState.message = `Archived ${baselineCount} protected baseline row(s) and deleted ${adminCreatedCount} admin-created row(s).`;
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

  function bulkDeleteAlerts() {
    const count = alertsState.selected.size;
    if (!count) return;
    if (!window.confirm(`Delete ${count} selected local alert scaffold row(s)? This will not affect StreamSuites runtime alerts.`)) {
      return;
    }

    alertsState.rules = alertsState.rules.filter((rule) => !alertsState.selected.has(rule.id));
    alertsState.selected.clear();
    persistAlertRules();
    alertsState.message = `Deleted ${count} local alert scaffold row(s).`;
    renderAlerts();
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

  function copyAlertsJson() {
    const json = JSON.stringify(buildAlertContract(), null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(
        () => {
          alertsState.message = "Copied DanielClancy alert scaffold contract JSON to the clipboard.";
          renderAlerts();
        },
        () => {
          window.prompt("Copy DanielClancy alert scaffold contract JSON", json);
        }
      );
      return;
    }

    window.prompt("Copy DanielClancy alert scaffold contract JSON", json);
  }

  function importProjectsJson() {
    const value = window.prompt("Paste a Projects JSON array or wrapper. Partial imports are treated as an overlay on the protected public-site baseline.");
    if (!value) return;

    try {
      const parsed = JSON.parse(value);
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : null;
      if (!rows) {
        throw new Error("Expected a JSON array or wrapper with an items array.");
      }

      const normalized = rows.map(normalizeProject);
      const ids = new Set(normalized.map((project) => project.id));
      if (ids.size !== normalized.length) {
        throw new Error("Project slug/id values must be unique.");
      }

      const baselineIds = projectBaselineIds();
      const overlapCount = normalized.filter((project) => baselineIds.has(projectIdentity(project))).length;
      const partialImport = projectBaselineState.baselineCount && normalized.length < projectBaselineState.baselineCount;
      const confirmMessage = partialImport
        ? `Import ${normalized.length} row(s) as an overlay? This is smaller than the ${projectBaselineState.baselineCount} protected baseline records, so it will merge instead of replacing the baseline. ${overlapCount} imported row(s) overlap baseline IDs.`
        : `Import ${normalized.length} project row(s) and reconcile with the protected public-site baseline? ${overlapCount} imported row(s) overlap baseline IDs.`;
      if (!window.confirm(confirmMessage)) {
        return;
      }

      projectState.projects = mergeProjectsWithBaseline(normalized);
      projectState.selected.clear();
      persistProjects();
      projectState.message = "Imported Projects JSON as a protected-baseline overlay.";
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

  function importAlertsJson() {
    const value = window.prompt("Paste a JSON array of alert scaffold rows, or the exported DanielClancy alert contract. This replaces local browser data only.");
    if (!value) return;

    try {
      const parsed = JSON.parse(value);
      const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.rules) ? parsed.rules : null;
      if (!rows) {
        throw new Error("Expected a JSON array or a contract object with a rules array.");
      }

      const normalized = rows.map(normalizeAlertRule);
      const ids = new Set(normalized.map((rule) => rule.id));
      if (ids.size !== normalized.length) {
        throw new Error("Alert rule id/code values must be unique.");
      }

      if (!window.confirm(`Import ${normalized.length} alert scaffold row(s) into local browser storage?`)) {
        return;
      }

      alertsState.rules = normalized;
      alertsState.selected.clear();
      persistAlertRules();
      alertsState.message = "Imported alert scaffold JSON into local browser storage.";
      renderAlerts();
    } catch (error) {
      alertsState.message = `Import failed: ${error.message}`;
      renderAlerts();
    }
  }

  function resetProjects() {
    if (!window.confirm("Reset Projects CMS to the protected public-site baseline? Local/admin overlay edits will be replaced, but existing public baseline records remain protected.")) {
      return;
    }

    projectState.projects = projectBaselineState.projects.length
      ? mergeProjectsWithBaseline([])
      : (data.projects || []).map(normalizeProject);
    projectState.selected.clear();
    persistProjects();
    projectState.message = "Projects CMS reset to the protected public-site baseline.";
    renderProjects();
  }

  function reconcileProjects() {
    if (!projectBaselineState.projects.length) {
      projectState.message = "Public baseline asset is not loaded yet; using current local fallback rows.";
      renderProjects();
      return;
    }
    projectState.projects = mergeProjectsWithBaseline(projectState.projects);
    projectState.selected.clear();
    persistCmsCollection("projects", true, true);
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projectsStoragePayload(), null, 2));
    projectState.message = "Reconciled Projects with the protected public-site baseline.";
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

  function resetAlerts() {
    if (!window.confirm("Reset Alerts scaffold rows to the repo seed data? Local browser edits will be replaced.")) {
      return;
    }

    alertsState.rules = (data.alerts || []).map(normalizeAlertRule);
    alertsState.selected.clear();
    persistAlertRules();
    alertsState.message = "Alerts scaffold reset to repo seed data.";
    renderAlerts();
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("popstate", render);
  document.addEventListener("dc-admin-auth-status", (event) => {
    if (event.detail?.isAdmin) {
      hydrateCmsCollections();
      hydrateAccountRegistry(activePageIs("accounts") || activePageIs("settings"));
      hydrateOverviewStatus(activePageIs("overview"));
      hydrateAnalyticsStatus(activePageIs("analytics"));
    }
  });

  if (!window.location.hash && ["/", "/index.html"].includes(window.location.pathname)) {
    window.location.hash = "#/overview";
  } else {
    render();
  }
  hydrateProjectBaseline(activePageIs("projects"));
  hydrateCmsCollections();
  hydrateAccountRegistry(activePageIs("accounts") || activePageIs("settings"));
  hydrateOverviewStatus(activePageIs("overview"));
  hydrateAnalyticsStatus(activePageIs("analytics"));
})();
