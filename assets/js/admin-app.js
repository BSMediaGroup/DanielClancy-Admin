(function () {
  const data = window.DC_ADMIN_SCAFFOLD_DATA;
  const app = document.getElementById("app");
  const nav = document.getElementById("sidebar-nav");
  const routeTitle = document.getElementById("route-title");
  const navToggle = document.getElementById("nav-toggle");
  const sidebarCollapseToggle = document.getElementById("sidebar-collapse-toggle");
  const sidebarHideToggle = document.getElementById("sidebar-hide-toggle");
  const sidebarReopenToggle = document.getElementById("sidebar-reopen-toggle");
  const topbarLoader = document.getElementById("topbar-loader");

  const routes = [
    { id: "overview", label: "Overview", icon: "home.svg", path: "#/overview" },
    { id: "analytics", label: "Analytics", icon: "globe.svg", path: "#/analytics" },
    { id: "accounts", label: "Accounts", icon: "identity.svg", path: "#/accounts" },
    { id: "settings", label: "Settings", icon: "cog.svg", path: "#/settings" },
    { id: "projects", label: "Projects", icon: "photostack.svg", path: "#/projects" },
    { id: "media", label: "Media", icon: "media.svg", path: "#/media" },
    { id: "companies", label: "Companies", icon: "profilecard.svg", path: "#/companies" },
    { id: "platforms", label: "Platforms", icon: "appspark.svg", path: "#/platforms" },
    { id: "positions", label: "Positions", icon: "idbadge.svg", path: "#/positions" }
  ];

  const PROJECTS_STORAGE_KEY = "danielclancy-admin.projects.scaffold.v1";
  const PROJECTS_BASELINE_URL = "/assets/data/public-projects-baseline.json";
  const PROJECTS_BASELINE_VERSION = "public-projects-baseline-2026-06-14";
  const PUBLIC_ASSET_CATALOG_URL = "/assets/data/public-asset-catalog.json";
  const PUBLIC_ASSET_CATALOG_STORAGE_KEY = "danielclancy-admin.public-asset-catalog.v1";
  const COMPANIES_STORAGE_KEY = "danielclancy-admin.companies.scaffold.v1";
  const PLATFORMS_STORAGE_KEY = "danielclancy-admin.platforms.scaffold.v1";
  const POSITIONS_STORAGE_KEY = "danielclancy-admin.positions.scaffold.v1";
  const PROJECT_COLUMNS_STORAGE_KEY = "danielclancy-admin.projects.table.columns.v1";
  const SIDEBAR_MODE_STORAGE_KEY = "danielclancy-admin.sidebar.mode.v1";
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
  const publicAssetCatalogState = {
    status: "checking",
    message: "Loading public asset catalog snapshot...",
    entries: [],
    metadata: null
  };
  const registryState = {
    companies: {
      items: loadRegistryItems(COMPANIES_STORAGE_KEY),
      search: "",
      modal: null,
      message: "Company registry uses admin storage when available and local fallback otherwise.",
      storage: { status: "checking", source: "local", message: "Checking Companies registry..." }
    },
    platforms: {
      items: loadRegistryItems(PLATFORMS_STORAGE_KEY),
      search: "",
      modal: null,
      message: "Platform registry uses admin storage when available and local fallback otherwise.",
      storage: { status: "checking", source: "local", message: "Checking Platforms registry..." }
    }
  };
  const positionsState = {
    items: [],
    search: "",
    status: "all",
    modal: null,
    message: "Positions are seeded from the public CV source and use admin storage when available.",
    storage: {
      status: "checking",
      source: "local",
      message: "Checking Positions registry..."
    }
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
    message: "DanielClancy alert definitions are isolated to Admin storage. StreamSuites canonical alert rules remain authoritative.",
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
  const CV_COMPANY_SEED = [
    { id: "richmond-ross", name: "Richmond+Ross", logoPath: "./assets/logos/company-richmondross-0.svg", location: "Crows Nest, NSW", website: "https://www.richmondross.com.au/", description: "Retail, public domain, fuel, tourism, and industrial documentation practice referenced by the public CV.", sortOrder: 10 },
    { id: "meriton-group", name: "Meriton Group", logoPath: "./assets/logos/company-meriton-0.svg", location: "Sydney, NSW", website: "https://www.meriton.com.au/", description: "Residential developer-builder referenced by the public CV.", sortOrder: 20 },
    { id: "leffler-simes-architects", name: "Leffler Simes Architects", logoPath: "./assets/logos/company-lefflersimes-0.svg", location: "Melbourne, VIC", website: "https://www.lefflersimes.com.au/", description: "Retail-focused architectural practice referenced by the public CV.", sortOrder: 30 },
    { id: "fleetwood-australia", name: "Fleetwood Australia", logoPath: "./assets/logos/company-fleetwood-0.svg", location: "Melbourne, VIC", website: "https://www.fleetwood.com.au/", description: "Modular construction company referenced by the public CV.", sortOrder: 40 },
    { id: "place-laboratory", name: "Place Laboratory", logoPath: "./assets/logos/company-placelab-0.svg", location: "Perth, WA", website: "https://www.placelaboratory.com/", description: "Public realm, urban, and landscape practice referenced by the public CV.", sortOrder: 50 },
    { id: "dc-design-studio", name: "DC Design Studio", logoPath: "./assets/logos/company-dcdesignstudio-0.svg", location: "Perth, WA", website: "https://www.danielclancy.net/", description: "Boutique design documentation consultancy referenced by the public CV.", sortOrder: 60 },
    { id: "urbis", name: "Urbis", logoPath: "./assets/logos/company-urbis-0.svg", location: "Perth, WA", website: "https://urbis.com.au/", description: "Multidisciplinary property, city, and community consultancy referenced by the public CV.", sortOrder: 70 },
    { id: "acce", name: "ACCE", logoPath: "./assets/logos/company-acce-0.svg", location: "Como, WA", website: "https://www.acce.net.au/", description: "Structural consulting engineering practice referenced by the public CV.", sortOrder: 80 },
    { id: "ghd", name: "GHD", logoPath: "./assets/logos/company-ghd-0.svg", location: "Geraldton & Perth, WA", website: "https://www.ghd.com/", description: "Multidisciplinary professional services company referenced by the public CV.", sortOrder: 90 },
    { id: "riley-consulting", name: "Riley Consulting", logoPath: "", location: "", website: "", description: "Project company/studio present in the public WorkSet portfolio source.", sortOrder: 120 }
  ];
  const CV_PLATFORM_SEED = [
    { id: "autodesk-autocad", name: "Autodesk AutoCAD", company: "Autodesk", vendor: "Autodesk", logoPath: "./assets/logos/software-autocad.svg", description: "Production drafting platform listed by the public CV.", sortOrder: 10 },
    { id: "autodesk-revit", name: "Autodesk Revit", company: "Autodesk", vendor: "Autodesk", logoPath: "./assets/logos/software-revit.svg", description: "BIM/documentation platform listed by the public CV.", sortOrder: 20 },
    { id: "adobe-creative-cloud", name: "Adobe Creative Cloud", company: "Adobe", vendor: "Adobe", logoPath: "./assets/logos/software-creativecloud.svg", description: "Presentation and creative software group listed by the public CV.", sortOrder: 30 },
    { id: "trimble-sketchup", name: "Trimble SketchUp", company: "Trimble", vendor: "Trimble", logoPath: "./assets/logos/software-sketchup.svg", description: "Concept modelling platform listed by the public CV.", sortOrder: 40 },
    { id: "microsoft-office", name: "Microsoft Office", company: "Microsoft", vendor: "Microsoft", logoPath: "./assets/logos/software-office365.svg", description: "Document/reporting software listed by the public CV.", sortOrder: 50 },
    { id: "qgis", name: "QGIS", company: "QGIS", vendor: "QGIS", logoPath: "./assets/logos/software-qgis.svg", description: "Spatial/GIS platform listed by the public CV.", sortOrder: 60 }
  ];
  const CV_POSITION_SEED = [
    { id: "richmond-ross-revit-draftsperson-technician", title: "Revit Draftsperson & Technician", companyId: "richmond-ross", companyName: "Richmond+Ross", location: "Crows Nest, NSW", startDate: "2019-10-01", endDate: "2021-11-01", current: false, summary: "Retail, public domain, fuel, tourism, and industrial documentation across projects ranging from small tenancies to large regional centres.", sortOrder: 10 },
    { id: "meriton-group-structural-revit-draftsman", title: "Structural Revit Draftsman", companyId: "meriton-group", companyName: "Meriton Group", location: "Sydney, NSW", startDate: "2019-03-01", endDate: "2019-05-01", current: false, summary: "Residential tower and apartment documentation within a major east coast developer-builder environment.", sortOrder: 20 },
    { id: "leffler-simes-architects-architectural-revit-draftsman", title: "Architectural Revit Draftsman", companyId: "leffler-simes-architects", companyName: "Leffler Simes Architects", location: "Melbourne, VIC", startDate: "2018-09-01", endDate: "2018-11-01", current: false, summary: "Retail-focused architectural drafting for a long-established Australian practice with national reach.", sortOrder: 30 },
    { id: "fleetwood-australia-revit-draftsperson", title: "Revit Draftsperson", companyId: "fleetwood-australia", companyName: "Fleetwood Australia", location: "Melbourne, VIC", startDate: "2018-07-01", endDate: "2018-08-01", current: false, summary: "Modular construction documentation support tied to housing and community infrastructure delivery.", sortOrder: 40 },
    { id: "place-laboratory-draftsman", title: "Draftsman", companyId: "place-laboratory", companyName: "Place Laboratory", location: "Perth, WA", startDate: "2017-01-01", endDate: "2018-01-01", current: false, summary: "Public realm, urban, and landscape-oriented drafting supporting walkable and socially engaged place-making work.", sortOrder: 50 },
    { id: "dc-design-studio-design-consultant", title: "Design Consultant", companyId: "dc-design-studio", companyName: "DC Design Studio", location: "Perth, WA", startDate: "2015-06-01", endDate: "2018-05-01", current: false, summary: "Boutique design documentation consultancy delivering CAD sketches, building plans, and supporting visual material.", sortOrder: 60 },
    { id: "urbis-drafting-technician", title: "Drafting Technician", companyId: "urbis", companyName: "Urbis", location: "Perth, WA", startDate: "2014-08-01", endDate: "2015-06-01", current: false, summary: "Property, city, and community documentation work within a multidisciplinary consulting environment.", sortOrder: 70 },
    { id: "acce-structural-draftsman", title: "Structural Draftsman", companyId: "acce", companyName: "ACCE", location: "Como, WA", startDate: "2012-01-01", endDate: "2014-03-01", current: false, summary: "Structural documentation across residential, commercial, industrial, and institutional projects.", sortOrder: 80 },
    { id: "ghd-draftsman", title: "Draftsman", companyId: "ghd", companyName: "GHD", location: "Geraldton & Perth, WA", startDate: "2008-08-01", endDate: "2011-11-01", current: false, summary: "Early-career multidisciplinary drafting across property, buildings, energy, resources, and transport-related work.", sortOrder: 90 }
  ];
  let loadingCount = 0;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function startTopbarLoader() {
    loadingCount += 1;
    if (topbarLoader) topbarLoader.classList.add("is-active");
  }

  function stopTopbarLoader() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (!loadingCount && topbarLoader) topbarLoader.classList.remove("is-active");
  }

  function normalizeProject(raw) {
    const fallbackId = createSlug(raw?.slug || raw?.id || raw?.title || `project-${Date.now()}`);
    const studio = normalizeProjectRegistryRefs(raw?.studio || raw?.companyIds || raw?.company || []);
    const software = normalizeProjectRegistryRefs(raw?.software || raw?.platformIds || raw?.platforms || []);
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
      studio,
      companyIds: normalizeProjectRegistryRefs(raw?.companyIds || studio),
      companyLabels: normalizeProjectRegistryRefs(raw?.companyLabels || studio),
      software,
      platformIds: normalizeProjectRegistryRefs(raw?.platformIds || software),
      platformLabels: normalizeProjectRegistryRefs(raw?.platformLabels || software),
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

  function normalizeProjectRegistryRefs(value) {
    return arrayFromValue(value)
      .map((item) => {
        if (item && typeof item === "object") return String(item.id || item.slug || item.name || item.label || "").trim();
        return String(item || "").trim();
      })
      .filter(Boolean);
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

  function loadRegistryItems(storageKey) {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      return Array.isArray(stored) ? stored.map(normalizeRegistryItem).filter((item) => item.id) : [];
    } catch {
      return [];
    }
  }

  function normalizeRegistryItem(raw = {}) {
    const name = String(raw.name || raw.label || raw.id || "").trim();
    const id = createSlug(raw.id || raw.slug || name);
    return {
      ...raw,
      id,
      slug: createSlug(raw.slug || id),
      name: name || id,
      logoPath: String(raw.logoPath || ""),
      location: String(raw.location || ""),
      company: String(raw.company || raw.vendor || ""),
      vendor: String(raw.vendor || raw.company || ""),
      website: String(raw.website || ""),
      description: String(raw.description || raw.details || ""),
      details: String(raw.details || raw.description || ""),
      status: String(raw.status || "active").toLowerCase() === "archived" ? "archived" : "active",
      sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 1000,
      sourceNotes: String(raw.sourceNotes || raw.source || ""),
      source: String(raw.source || raw.sourceNotes || "public_cv_source"),
      updatedAt: String(raw.updatedAt || new Date().toISOString())
    };
  }

  function loadPositions() {
    const seed = CV_POSITION_SEED.map(normalizePosition);
    try {
      const stored = JSON.parse(window.localStorage.getItem(POSITIONS_STORAGE_KEY) || "[]");
      const rows = Array.isArray(stored) ? stored : Array.isArray(stored?.items) ? stored.items : null;
      return rows ? mergeSeedRows(seed, rows.map(normalizePosition)) : seed;
    } catch {
      return seed;
    }
  }

  function normalizePosition(raw = {}) {
    const title = String(raw.title || raw.role || raw.id || "").trim();
    const companyId = createSlug(raw.companyId || raw.company || raw.companyName || "");
    const companyName = String(raw.companyName || registryLabel("companies", companyId) || raw.company || "").trim();
    return {
      ...raw,
      id: createSlug(raw.id || raw.slug || `${companyName}-${title}`),
      slug: createSlug(raw.slug || raw.id || `${companyName}-${title}`),
      title: title || "Untitled position",
      companyId,
      companyName,
      location: String(raw.location || ""),
      startDate: String(raw.startDate || ""),
      endDate: String(raw.endDate || ""),
      current: Boolean(raw.current),
      employmentType: String(raw.employmentType || ""),
      summary: String(raw.summary || ""),
      responsibilities: arrayFromValue(raw.responsibilities || raw.highlights || []),
      highlights: arrayFromValue(raw.highlights || raw.responsibilities || []),
      platformIds: normalizeProjectRegistryRefs(raw.platformIds || raw.technologies || raw.software || []),
      status: String(raw.status || "active").toLowerCase() === "archived" ? "archived" : "active",
      sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : 1000,
      source: String(raw.source || "public_cv_source"),
      updatedAt: String(raw.updatedAt || new Date().toISOString())
    };
  }

  function mergeSeedRows(seed, stored) {
    const byId = new Map(seed.map((item) => [item.id, item]));
    stored.forEach((item) => {
      byId.set(item.id, {
        ...(byId.get(item.id) || {}),
        ...item
      });
    });
    return Array.from(byId.values()).sort(compareRegistryItems);
  }

  function persistRegistryItems(kind) {
    const config = registryConfig(kind);
    if (!config) return;
    try {
      window.localStorage.setItem(config.storageKey, JSON.stringify(registryState[kind].items, null, 2));
    } catch {
      registryState[kind].message = `${config.label} saved in memory only because localStorage is unavailable.`;
    }
    persistCmsCollection(kind, registryState[kind].items);
  }

  function persistPositions() {
    try {
      window.localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positionsState.items, null, 2));
    } catch {
      positionsState.message = "Positions saved in memory only because localStorage is unavailable.";
    }
    persistCmsCollection("positions");
  }

  function registryConfig(kind) {
    if (kind === "companies") return { label: "Companies", singular: "Company", storageKey: COMPANIES_STORAGE_KEY, route: "companies" };
    if (kind === "platforms") return { label: "Platforms", singular: "Platform", storageKey: PLATFORMS_STORAGE_KEY, route: "platforms" };
    return null;
  }

  function logoPathForCompany(nameOrId) {
    const id = createSlug(nameOrId);
    const item = (registryState.companies.items || []).find((entry) => entry.id === id || entry.slug === id || createSlug(entry.name) === id);
    return item?.logoPath || "";
  }

  function logoPathForPlatform(nameOrId) {
    const id = createSlug(nameOrId);
    const item = (registryState.platforms.items || []).find((entry) => entry.id === id || entry.slug === id || createSlug(entry.name) === id);
    return item?.logoPath || platformLogoPath(nameOrId);
  }

  function seedRegistriesFromCvSource() {
    registryState.companies.items = mergeSeedRows(
      CV_COMPANY_SEED.map((item) => normalizeRegistryItem({ ...item, source: "public_cv_source" })),
      registryState.companies.items
    );
    registryState.platforms.items = mergeSeedRows(
      CV_PLATFORM_SEED.map((item) => normalizeRegistryItem({ ...item, source: "public_cv_source" })),
      registryState.platforms.items
    );
  }

  function seedRegistriesFromProjects() {
    const companyById = new Map(registryState.companies.items.map((item) => [item.id, item]));
    const platformById = new Map(registryState.platforms.items.map((item) => [item.id, item]));
    projectState.projects.forEach((project) => {
      normalizeProjectRegistryRefs(project.studio || project.companyLabels || project.companyIds).forEach((name, index) => {
        const id = createSlug(name);
        if (!id || companyById.has(id)) return;
        companyById.set(id, normalizeRegistryItem({ id, name, status: "active", sortOrder: 100 + index }));
      });
      normalizeProjectRegistryRefs(project.software || project.platformLabels || project.platformIds).forEach((name, index) => {
        const id = createSlug(name);
        if (!id || platformById.has(id)) return;
        platformById.set(id, normalizeRegistryItem({ id, name, status: "active", sortOrder: 100 + index, logoPath: platformLogoPath(name) }));
      });
    });
    registryState.companies.items = Array.from(companyById.values()).sort(compareRegistryItems);
    registryState.platforms.items = Array.from(platformById.values()).sort(compareRegistryItems);
  }

  function compareRegistryItems(left, right) {
    return (Number(left.sortOrder) || 1000) - (Number(right.sortOrder) || 1000) || String(left.name).localeCompare(String(right.name));
  }

  function activeRegistryItems(kind) {
    return (registryState[kind]?.items || []).filter((item) => item.status !== "archived").sort(compareRegistryItems);
  }

  function registryLabel(kind, idOrName) {
    const value = String(idOrName || "").trim();
    if (!value) return "";
    const id = createSlug(value);
    const found = (registryState[kind]?.items || []).find((item) => item.id === id || item.slug === id || item.name === value);
    return found?.name || value;
  }

  function selectedRegistryLabels(kind, values) {
    return normalizeProjectRegistryRefs(values).map((value) => registryLabel(kind, value)).filter(Boolean);
  }

  function platformLogoPath(nameOrId) {
    const label = registryLabel("platforms", nameOrId) || String(nameOrId || "");
    const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const map = {
      autocad: "./assets/logos/software-autocad.svg",
      autodeskautocad: "./assets/logos/software-autocad.svg",
      revit: "./assets/logos/software-revit.svg",
      autodeskrevit: "./assets/logos/software-revit.svg",
      adobecreativecloud: "./assets/logos/software-creativecloud.svg",
      trimblesketchup: "./assets/logos/software-sketchup.svg",
      sketchup: "./assets/logos/software-sketchup.svg",
      microsoftoffice: "./assets/logos/software-office365.svg",
      microsoftoffice365: "./assets/logos/software-office365.svg",
      qgis: "./assets/logos/software-qgis.svg"
    };
    return map[normalized] || "";
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

  function assetUploadEndpoint() {
    return "/api/admin/assets/upload";
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
    if (collection === "companies") {
      return {
        state: registryState.companies,
        storageKey: COMPANIES_STORAGE_KEY,
        getItems: () => registryState.companies.items,
        setItems: (items) => {
          registryState.companies.items = items.map(normalizeRegistryItem).sort(compareRegistryItems);
        },
        render: () => renderRegistryPage("companies")
      };
    }
    if (collection === "platforms") {
      return {
        state: registryState.platforms,
        storageKey: PLATFORMS_STORAGE_KEY,
        getItems: () => registryState.platforms.items,
        setItems: (items) => {
          registryState.platforms.items = items.map(normalizeRegistryItem).sort(compareRegistryItems);
        },
        render: () => renderRegistryPage("platforms")
      };
    }
    if (collection === "positions") {
      return {
        state: positionsState,
        storageKey: POSITIONS_STORAGE_KEY,
        getItems: () => positionsState.items,
        setItems: (items) => {
          positionsState.items = mergeSeedRows(CV_POSITION_SEED.map(normalizePosition), items.map(normalizePosition));
        },
        render: renderPositions
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

  async function hydratePublicAssetCatalog(renderAfter = false) {
    publicAssetCatalogState.status = "checking";
    try {
      const response = await fetch(PUBLIC_ASSET_CATALOG_URL, { cache: "no-store" });
      const payload = await response.json();
      const entries = Array.isArray(payload?.entries) ? payload.entries : [];
      Object.assign(publicAssetCatalogState, {
        status: "loaded",
        message: `Loaded ${entries.length} public asset catalog item(s).`,
        entries,
        metadata: payload?.metadata || null
      });
      try {
        window.localStorage.setItem(PUBLIC_ASSET_CATALOG_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Catalog caching is optional.
      }
    } catch {
      try {
        const cached = JSON.parse(window.localStorage.getItem(PUBLIC_ASSET_CATALOG_STORAGE_KEY) || "{}");
        const entries = Array.isArray(cached?.entries) ? cached.entries : [];
        Object.assign(publicAssetCatalogState, {
          status: entries.length ? "cached" : "fallback",
          message: entries.length ? `Using cached public asset catalog with ${entries.length} item(s).` : "Public asset catalog unavailable.",
          entries,
          metadata: cached?.metadata || null
        });
      } catch {
        Object.assign(publicAssetCatalogState, {
          status: "fallback",
          message: "Public asset catalog unavailable.",
          entries: [],
          metadata: null
        });
      }
    }
    if (renderAfter && activePageIs("projects")) renderProjects();
  }

  function catalogEntries(type) {
    return publicAssetCatalogState.entries.filter((entry) => entry.type === type);
  }

  function catalogOptions(type, currentValue = "") {
    const current = String(currentValue || "").trim();
    const options = catalogEntries(type);
    const hasCurrent = current && !options.some((entry) => entry.relativePath === current);
    return `
      ${hasCurrent ? `<option value="${escapeHtml(current)}">${escapeHtml(current)} (current/manual)</option>` : ""}
      ${options
        .map((entry) => `<option value="${escapeHtml(entry.relativePath)}">${escapeHtml(entry.label || entry.filename)}</option>`)
        .join("")}
    `;
  }

  function localLogoOptions(kind, currentValue = "") {
    const current = String(currentValue || "").trim();
    const prefix = kind === "companies" ? "company" : "software";
    const seed = kind === "companies" ? CV_COMPANY_SEED : CV_PLATFORM_SEED;
    const options = seed
      .map((item) => item.logoPath)
      .filter(Boolean)
      .filter((path, index, rows) => rows.indexOf(path) === index && path.includes(`/logos/${prefix}-`))
      .sort((left, right) => left.localeCompare(right));
    const hasCurrent = current && !options.includes(current);
    return `
      ${hasCurrent ? `<option value="${escapeHtml(current)}">${escapeHtml(current)} (current/manual)</option>` : ""}
      ${options.map((path) => `<option value="${escapeHtml(path)}"${path === current ? " selected" : ""}>${escapeHtml(path.split("/").pop())}</option>`).join("")}
    `;
  }

  function assetPreview(path, alt = "Selected asset preview") {
    const value = String(path || "").trim();
    if (!value) return `<span class="asset-preview-placeholder">No asset selected</span>`;
    if (/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value)) {
      return `<img src="${escapeHtml(value)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
    }
    return `<span class="selected-file-indicator">${escapeHtml(value.split("/").pop() || value)}</span>`;
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
    ["projects", "media", "alerts", "companies", "platforms", "positions"].forEach((collection) => hydrateCmsCollection(collection, activePageIs(collection)));
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
    startTopbarLoader();
    if (renderAfter && activePageIs("analytics")) renderAnalytics();
    try {
      const response = await fetch(adminAnalyticsEndpoint(), { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        analyticsStatusState.status = "fallback";
        analyticsStatusState.message = payload?.error || `Analytics API unavailable (${response.status}).`;
      } else {
        const hasKvEvents = Number(payload?.pageVisits?.events || 0) > 0;
        analyticsStatusState.status = payload.configured || hasKvEvents ? "connected" : "not-configured";
        analyticsStatusState.message = payload.configured
          ? `Cloudflare Analytics ${payload.cloudflare?.source?.includes("error") ? "returned an error" : "queried"}; page-visit storage is ${payload.pageVisits?.configured ? "connected" : "unavailable"}.`
          : hasKvEvents
            ? "Cloudflare analytics is not configured, but page-visit KV analytics are available."
            : "Cloudflare analytics not configured. Sample/local fallback rows are labelled below.";
        analyticsStatusState.payload = payload;
        analyticsStatusState.lastChecked = payload.lastChecked || new Date().toISOString();
      }
    } catch {
      analyticsStatusState.status = "fallback";
      analyticsStatusState.message = "Pages Functions are unavailable here. Analytics falls back to labelled local sample rows.";
    } finally {
      stopTopbarLoader();
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
      seedRegistriesFromProjects();
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

    if (!project.thumbnailPath) issues.push("missing thumbnail");
    if (!project.heroImage) issues.push("hero defaults to gallery");
    if (!project.documentPath && !project.documentationUrl) issues.push("missing document");
    if (!project.galleryPaths.length && !project.sourceFiles.length) issues.push("missing gallery");
    if (!normalizeProjectRegistryRefs(project.companyIds || project.studio).length) issues.push("missing company");
    if (!normalizeProjectRegistryRefs(project.platformIds || project.software).length) issues.push("missing platforms");
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

  function formSelectedValues(form, name) {
    const field = form.elements[name];
    if (field instanceof HTMLSelectElement) {
      return Array.from(field.selectedOptions).map((option) => option.value).filter(Boolean);
    }
    return textareaArray(formValue(form, name));
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
        const icon = `./assets/icons/ui/${route.icon || route.fallbackIcon || "dashboard.svg"}`;
        return `
          <a class="${classes}" href="${href}" title="${escapeHtml(route.label)}" ${route.disabled ? 'aria-disabled="true"' : ""}>
            <span class="nav-icon" aria-hidden="true"><img class="ui-img-icon" src="${escapeHtml(icon)}" alt="" loading="lazy" /></span>
            <span>${escapeHtml(route.label)}</span>
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

  function formatAnalyticsNumber(value) {
    if (value === null || value === undefined || value === "") return "Unavailable";
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return number.toLocaleString();
  }

  function hasRows(rows) {
    return Array.isArray(rows) && rows.length > 0;
  }

  function metricValue(row) {
    return row?.count ?? row?.visits ?? row?.requests ?? row?.events ?? null;
  }

  function sourceTone(source) {
    const text = String(source || "");
    if (text.includes("cloudflare") || text.includes("page_visit")) return "success";
    return "warn";
  }

  function analyticsList(rows, labelKey, valueLabel = "Events") {
    if (!hasRows(rows)) return `<div class="empty-state">No live rows available for this section.</div>`;
    return `
      <ul class="analytics-list">
        ${rows
          .slice(0, 8)
          .map((row) => {
            const label = row[labelKey] || row.path || row.host || row.browser || row.device || "Unavailable";
            return `<li><span>${escapeHtml(label)}</span><strong>${escapeHtml(formatAnalyticsNumber(metricValue(row)))}</strong><small>${escapeHtml(valueLabel)} · ${escapeHtml(row.source || "unknown")}</small></li>`;
          })
          .join("")}
      </ul>
    `;
  }

  function analyticsTable(headers, rows, rowMarkup, emptyText) {
    if (!hasRows(rows)) return `<div class="empty-state">${escapeHtml(emptyText || "No live analytics rows available.")}</div>`;
    return `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>${rows.map(rowMarkup).join("")}</tbody>
        </table>
      </div>
    `;
  }

  const CITY_COORDINATES = {
    "sydney|australia": { lat: -33.8688, lon: 151.2093 },
    "sydney|au": { lat: -33.8688, lon: 151.2093 },
    "perth|australia": { lat: -31.9523, lon: 115.8613 },
    "perth|au": { lat: -31.9523, lon: 115.8613 },
    "melbourne|australia": { lat: -37.8136, lon: 144.9631 },
    "melbourne|au": { lat: -37.8136, lon: 144.9631 },
    "brisbane|australia": { lat: -27.4698, lon: 153.0251 },
    "brisbane|au": { lat: -27.4698, lon: 153.0251 },
    "adelaide|australia": { lat: -34.9285, lon: 138.6007 },
    "adelaide|au": { lat: -34.9285, lon: 138.6007 },
    "canberra|australia": { lat: -35.2809, lon: 149.13 },
    "canberra|au": { lat: -35.2809, lon: 149.13 },
    "new york|united states": { lat: 40.7128, lon: -74.006 },
    "new york|us": { lat: 40.7128, lon: -74.006 },
    "los angeles|united states": { lat: 34.0522, lon: -118.2437 },
    "los angeles|us": { lat: 34.0522, lon: -118.2437 },
    "san francisco|united states": { lat: 37.7749, lon: -122.4194 },
    "san francisco|us": { lat: 37.7749, lon: -122.4194 },
    "chicago|united states": { lat: 41.8781, lon: -87.6298 },
    "chicago|us": { lat: 41.8781, lon: -87.6298 },
    "seattle|united states": { lat: 47.6062, lon: -122.3321 },
    "seattle|us": { lat: 47.6062, lon: -122.3321 },
    "london|united kingdom": { lat: 51.5072, lon: -0.1276 },
    "london|gb": { lat: 51.5072, lon: -0.1276 },
    "toronto|canada": { lat: 43.6532, lon: -79.3832 },
    "toronto|ca": { lat: 43.6532, lon: -79.3832 },
    "vancouver|canada": { lat: 49.2827, lon: -123.1207 },
    "vancouver|ca": { lat: 49.2827, lon: -123.1207 },
    "auckland|new zealand": { lat: -36.8509, lon: 174.7645 },
    "auckland|nz": { lat: -36.8509, lon: 174.7645 },
    "singapore|singapore": { lat: 1.3521, lon: 103.8198 },
    "singapore|sg": { lat: 1.3521, lon: 103.8198 }
  };

  function cityCoordinate(row) {
    const city = String(row?.city || "").trim().toLowerCase();
    const country = String(row?.country || "").trim().toLowerCase();
    if (!city) return null;
    return CITY_COORDINATES[`${city}|${country}`] || CITY_COORDINATES[city] || null;
  }

  function mapPointStyle(coord) {
    const x = ((coord.lon + 180) / 360) * 100;
    const y = ((90 - coord.lat) / 180) * 100;
    return `--x: ${Math.max(2, Math.min(98, x)).toFixed(2)}%; --y: ${Math.max(4, Math.min(96, y)).toFixed(2)}%;`;
  }

  function renderLocationMap(status, liveCities, liveCountries) {
    const pageVisits = status?.pageVisits || {};
    const location = status?.location || {};
    const plottedCities = liveCities
      .filter((row) => row.precision === "city" && cityCoordinate(row))
      .slice(0, 20)
      .map((row) => ({ row, coord: cityCoordinate(row) }));
    const cityDetailCount = Number(pageVisits.cityEvents || liveCities.length || 0);
    const countryOnlyCount = Number(pageVisits.countryOnlyEvents || 0);
    const unmappedLocationCount = Math.max(0, liveCities.filter((row) => row.precision === "city").length - plottedCities.length);
    const hasEvents = Number(pageVisits.events || location.events || 0) > 0;
    const source = location.source || (hasEvents ? "page_visit_kv" : "unavailable");
    const mapBody = plottedCities.length
      ? plottedCities
          .map(({ row, coord }) => {
            const label = [row.city, row.region, row.country].filter(Boolean).join(", ");
            const title = `${label} - ${formatAnalyticsNumber(metricValue(row))} event(s) - ${row.precision} - ${row.source || source}`;
            return `
              <span class="map-marker live" style="${mapPointStyle(coord)}" title="${escapeHtml(title)}">
                <span>${escapeHtml(row.city)}</span>
              </span>
            `;
          })
          .join("")
      : `<div class="map-empty">${escapeHtml(hasEvents ? "City coordinates unavailable for current live rows." : "No live page-visit location events captured yet.")}</div>`;
    return `
      <section class="panel">
        <header class="panel-header">
          <div>
            <h2>Live Location Map</h2>
            <p>${escapeHtml(hasEvents ? "Live page-visit locations only. Unknown coordinates are not invented." : "No live page-visit location events captured yet.")}</p>
          </div>
          <div class="panel-actions">
            ${badge(`Source: ${source}`, sourceTone(source))}
            ${badge(location.precision || (liveCities.length ? "city" : liveCountries.length ? "country" : "unavailable"), liveCities.length ? "success" : "warn")}
          </div>
        </header>
        <div class="panel-body">
          <div class="location-metrics">
            ${storageStatusCard("Tracked events", formatAnalyticsNumber(pageVisits.events || 0), "Bounded page_visit KV events.", pageVisits.configured ? "success" : "warn")}
            ${storageStatusCard("City detail", formatAnalyticsNumber(cityDetailCount), "Rows with city-level precision.", cityDetailCount ? "success" : "warn")}
            ${storageStatusCard("Country-only", formatAnalyticsNumber(countryOnlyCount), "Rows with country but no city.", countryOnlyCount ? "warn" : "success")}
            ${storageStatusCard("Mapped", formatAnalyticsNumber(plottedCities.length), "Exact built-in coordinate matches only.", plottedCities.length ? "success" : "warn")}
            ${storageStatusCard("Unmapped", formatAnalyticsNumber(unmappedLocationCount), "City rows without an exact coordinate lookup.", unmappedLocationCount ? "warn" : "success")}
          </div>
          <div class="map-shell live-map" role="img" aria-label="Live page-visit location map-style panel">
            <svg class="map-world" viewBox="0 0 1000 520" aria-hidden="true" focusable="false">
              <path d="M116 192l62-38 84 11 53 43-20 55-70 18-86-22-41-36zM353 168l80-42 128 10 35 45-18 71-74 42-114-20-50-54zM604 158l104-54 116 24 56 62-37 68-112 20-97-35zM260 319l64 18 22 58-50 62-74-27-22-66zM557 318l90 34 73 76-53 44-102-28-53-74zM777 348l75 22 36 53-34 35-72-24-37-50z" />
            </svg>
            <div class="map-graticule"></div>
            ${mapBody}
          </div>
        </div>
      </section>
    `;
  }

  function renderAnalytics() {
    routeTitle.textContent = "Analytics";
    const status = analyticsStatusState.payload;
    const configured = Boolean(status?.configured);
    const missingConfig = Array.isArray(status?.missingConfig) ? status.missingConfig : [];
    const sourceLabel = status?.source || (analyticsStatusState.status === "fallback" ? "local_function_unavailable" : "checking");
    const cloudflare = status?.cloudflare || {};
    const pageVisits = status?.pageVisits || {};
    const readiness = status?.readiness || {};
    const totals = status?.totals || {};
    const liveTopPages = hasRows(status?.topPages) ? status.topPages : [];
    const liveReferrers = hasRows(status?.referrers) ? status.referrers : [];
    const liveCities = hasRows(status?.cities) ? status.cities : [];
    const liveCountries = hasRows(status?.countries) ? status.countries : [];
    const liveBrowsers = hasRows(status?.browsers) ? status.browsers : [];
    const liveDevices = hasRows(status?.devices) ? status.devices : [];
    const hasLiveRows = hasRows(liveTopPages) || hasRows(liveReferrers) || hasRows(liveCities) || hasRows(liveCountries) || hasRows(liveBrowsers) || hasRows(liveDevices);
    const cityUnavailable = !liveCities.some((row) => row.precision === "city" && row.city);
    const sampleGeoRows = data.analytics.geoRows || [];
    const sampleRouteRows = data.analytics.routeRows || [];
    const operationalRows = [
      ["Cloudflare configured", configured ? "Yes" : "No"],
      ["Page-visit KV", pageVisits.configured ? "Connected" : "Unavailable"],
      ["Source", sourceLabel],
      ["Cloudflare result", cloudflare.lastResult || "Not checked"],
      ["Page-visit storage", pageVisits.storage?.lastResult || "Not checked"],
      ["Last checked", formatOperationalTimestamp(status?.lastChecked || analyticsStatusState.lastChecked)]
    ];
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Analytics",
          "Analytics",
          "Live Cloudflare metrics and page-visit KV analytics are separated by source, with location precision labelled per row.",
          `${badge(configured ? "Cloudflare Analytics connected" : "Cloudflare Analytics missing config", configured ? "success" : "warn")}
           ${badge(pageVisits.configured ? "Page-visit KV connected" : "Page-visit KV unavailable", pageVisits.configured ? "success" : "warn")}
           ${badge(`Source: ${sourceLabel}`, sourceTone(sourceLabel))}`
        )}

        ${panel(
          "Source status",
          analyticsStatusState.message,
          `<div class="grid grid-2">
            ${storageStatusCard("Cloudflare Analytics", configured ? "Connected" : "Missing config", configured ? `Last result: ${cloudflare.lastResult || "not checked"}` : `Missing: ${missingConfig.join(", ") || "unknown"}`, configured && !String(cloudflare.lastResult || "").includes("error") ? "success" : "warn")}
            ${storageStatusCard("Page-visit event storage", pageVisits.configured ? "Connected" : "Unavailable", pageVisits.configured ? `${formatAnalyticsNumber(pageVisits.events || 0)} event(s); ${formatAnalyticsNumber(pageVisits.cityEvents || 0)} with city detail` : "DC_ADMIN_KV is required for request.cf city rollups.", pageVisits.configured ? "success" : "warn")}
          </div>
          ${descriptionRows(operationalRows)}`
        )}

        <section class="grid grid-4">
          ${storageStatusCard("Requests", formatAnalyticsNumber(totals.requests), "Cloudflare GraphQL total when available.", totals.requests === null || totals.requests === undefined ? "warn" : "success")}
          ${storageStatusCard("Visits", formatAnalyticsNumber(totals.visits), "Cloudflare GraphQL visits when available.", totals.visits === null || totals.visits === undefined ? "warn" : "success")}
          ${storageStatusCard("Bandwidth", formatAnalyticsNumber(totals.bandwidth), "Cloudflare edge response bytes when available.", totals.bandwidth === null || totals.bandwidth === undefined ? "warn" : "success")}
          ${storageStatusCard("Page-visit events", formatAnalyticsNumber(totals.pageVisitEvents || 0), "KV event count from bounded recent storage.", pageVisits.configured ? "success" : "warn")}
        </section>

        ${renderLocationMap(status, liveCities, liveCountries)}

        <section class="grid analytics-grid">
          ${panel(
            "Location breakdown",
            cityUnavailable ? (pageVisits.emptyMessage || "City detail unavailable from current data source") : "City rows are sourced from page-visit KV request geo metadata when available.",
            analyticsTable(
              ["City", "Region", "Country", "Visits/Events", "Precision", "Source"],
              liveCities,
              (row) => `
                <tr>
                  <td><strong>${escapeHtml(row.city || "City detail unavailable from current data source")}</strong></td>
                  <td>${escapeHtml(row.region || "")}</td>
                  <td>${escapeHtml(row.country || "")}</td>
                  <td>${escapeHtml(formatAnalyticsNumber(metricValue(row)))}</td>
                  <td>${badge(row.precision || "unavailable", row.precision === "city" ? "success" : "warn")}</td>
                  <td>${badge(row.source || "unavailable", sourceTone(row.source))}</td>
                </tr>
              `,
              pageVisits.emptyMessage || "No city-level page-visit rows available."
            )
          )}
          ${panel(
            "Analytics readiness",
            "Missing setup is listed by env var name only; no values or tokens are exposed.",
            `<div class="grid">
              ${(status?.requiredConfig || ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_ZONE_ID_DANIELCLANCY", "CLOUDFLARE_API_TOKEN_ANALYTICS"])
                .map((name) => `<article class="card">${badge(readiness.cloudflare?.[name] ? "Configured" : "Missing", readiness.cloudflare?.[name] ? "success" : "warn")}<p><strong>${escapeHtml(name)}</strong></p></article>`)
                .join("")}
              <article class="card">${badge(readiness.dcAdminKvConfigured ? "Configured" : "Missing", readiness.dcAdminKvConfigured ? "success" : "warn")}<p><strong>DC_ADMIN_KV</strong></p></article>
              <article class="card">${badge("Cloudflare result", sourceTone(readiness.lastCloudflareQueryResult))}<p>${escapeHtml(readiness.lastCloudflareQueryResult || "Not checked")}</p></article>
              <article class="card">${badge("Page-visit result", sourceTone(readiness.lastPageVisitStorageResult))}<p>${escapeHtml(readiness.lastPageVisitStorageResult || "Not checked")}</p></article>
              ${(status?.notes || data.analytics.notes)
                .map((note) => `<article class="card">${badge("Note", "warn")}<p>${escapeHtml(note)}</p></article>`)
                .join("")}
            </div>`
          )}
        </section>

        <section class="grid analytics-grid">
          ${panel(
            "Country precision",
            hasRows(liveCountries) ? "Country-only rows remain labelled as country precision." : "No country precision rows available.",
            analyticsTable(
              ["Country", "Visits/Events", "Precision", "Source"],
              liveCountries,
              (row) => `<tr><td><strong>${escapeHtml(row.country || "Unavailable")}</strong></td><td>${escapeHtml(formatAnalyticsNumber(metricValue(row)))}</td><td>${badge(row.precision || "country", "warn")}</td><td>${badge(row.source || "unavailable", sourceTone(row.source))}</td></tr>`,
              pageVisits.emptyMessage || "No country precision rows available."
            )
          )}
          ${panel(
            "Location source rules",
            "City, region, and country precision are kept separate.",
            `<div class="grid">
              <article class="card">${badge("City", liveCities.length ? "success" : "warn")}<p>Rows require real Cloudflare request.cf.city or supported Cloudflare city data.</p></article>
              <article class="card">${badge("Country", liveCountries.length ? "warn" : "success")}<p>Country-only rows are never labelled as city detail.</p></article>
              <article class="card">${badge("Empty", "warn")}<p>${escapeHtml(pageVisits.emptyMessage || "No fake sample markers are shown as live map data.")}</p></article>
            </div>`
          )}
        </section>

        <section class="grid analytics-grid">
          ${panel(
            "Top pages",
            hasRows(liveTopPages) ? "Live rows from page-visit KV or Cloudflare GraphQL." : "No live top-page rows available.",
            analyticsTable(
              ["Page", "Visits/Events", "Source"],
              liveTopPages,
              (row) => `<tr><td><strong>${escapeHtml(row.path || "/")}</strong><br><span>${escapeHtml(row.title || "")}</span></td><td>${escapeHtml(formatAnalyticsNumber(metricValue(row)))}</td><td>${badge(row.source || "unknown", sourceTone(row.source))}</td></tr>`,
              "No live top pages available."
            )
          )}
          ${panel(
            "Referrers",
            hasRows(liveReferrers) ? "Live referrer rows from page visits or Cloudflare." : "No live referrer rows available.",
            analyticsList(liveReferrers, "host", "Events")
          )}
        </section>

        <section class="grid grid-2">
          ${panel("Browsers", hasRows(liveBrowsers) ? "Live browser data when available." : "No browser data available.", analyticsList(liveBrowsers, "browser", "Events"))}
          ${panel("Devices", hasRows(liveDevices) ? "Live device data when available." : "No device data available.", analyticsList(liveDevices, "device", "Events"))}
        </section>

        ${!hasLiveRows
          ? panel(
              "Sample fallback",
              "These rows are labelled sample data and are not real visitor counts.",
              `<div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr><th>Route / Location</th><th>Precision</th><th>Value</th><th>Source</th></tr>
                  </thead>
                  <tbody>
                    ${sampleGeoRows
                      .map((row) => `<tr><td><strong>${escapeHtml(row.location)}</strong></td><td>${escapeHtml(row.precision)}</td><td>${escapeHtml(row.sessions)}</td><td>${escapeHtml(row.source)}</td></tr>`)
                      .join("")}
                    ${sampleRouteRows
                      .map((row) => `<tr><td><strong>${escapeHtml(row.route)}</strong></td><td>${escapeHtml(row.surface)}</td><td>${escapeHtml(row.status)}</td><td>Sample fallback</td></tr>`)
                      .join("")}
                  </tbody>
                </table>
              </div>`
            )
          : ""}
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

        ${renderCurrentProfilePanel()}

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

  function renderCurrentProfilePanel() {
    const session = currentAdminSession() || {};
    const displayName = session.display_name || session.displayName || session.email || "";
    const avatarUrl = session.avatar_url || session.avatarUrl || "";
    return panel(
      "Current user profile",
      "Edit only your display name and avatar overlay. Role, admin level, password, and OAuth token data are not editable here.",
      `<form class="profile-form" data-account-profile-form>
        <label class="field"><span>Display name</span><input class="input" name="displayName" value="${escapeHtml(displayName)}" autocomplete="name" /></label>
        <label class="field project-upload-field">
          <span>Avatar image path/URL</span>
          <div class="input-with-action"><input class="input" name="avatarUrl" value="${escapeHtml(avatarUrl)}" /><button class="button button-secondary" type="button" data-account-action="upload-avatar">Upload</button></div>
          <span class="asset-preview">${assetPreview(avatarUrl, "Current avatar")}</span>
          <input class="asset-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-account-avatar-input />
          <span class="upload-status" data-account-avatar-status></span>
        </label>
        <div class="field-actions"><button class="button" type="submit">Save profile</button></div>
      </form>`
    );
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
          renderProjectTable(visibleProjects),
          `<button class="button button-secondary" type="button" data-project-action="reset-columns">Reset column widths</button>`
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

  function renderRegistryPage(kind) {
    const config = registryConfig(kind);
    if (!config) return;
    routeTitle.textContent = config.label;
    const state = registryState[kind];
    const term = state.search.trim().toLowerCase();
    const items = state.items.filter((item) => !term || [item.name, item.id, item.logoPath, item.website, item.location, item.company, item.vendor].join(" ").toLowerCase().includes(term));
    app.innerHTML = `
      <div class="page registry-page">
        ${pageHeader(
          `${config.label} registry`,
          config.label,
          `${config.label} are predefined options used by Projects. Project editor custom text entry is disabled for this field.`,
          `<button class="button" type="button" data-registry-action="create" data-registry-kind="${kind}">Create ${config.singular}</button>
           <button class="button button-secondary" type="button" data-registry-action="sync-cms" data-registry-kind="${kind}">Sync/save registry</button>`
        )}
        <div class="cms-storage-status">
          ${badge(cmsStatusText(state.storage), cmsStatusTone(state.storage))}
          <span>${escapeHtml(state.storage.message || state.message)}</span>
        </div>
        ${panel(
          `${config.label} options`,
          "Archived rows are retained for compatibility but hidden from the Projects editor selectors.",
          `<div class="cms-toolbar">
            <label class="field field-wide"><span>Search</span><input class="input" type="search" data-registry-filter="${kind}" value="${escapeHtml(state.search)}" placeholder="Name, ID, logo path, website" /></label>
            <div class="cms-toolbar-summary">${badge(`${items.length} visible`, "warn")}${badge(`${activeRegistryItems(kind).length} active`, "success")}</div>
          </div>
          <div class="table-wrap">
            <table class="table registry-table">
              <thead><tr><th>Name</th><th>ID</th><th>Status</th><th>${kind === "companies" ? "Logo / location" : "Logo / vendor"}</th><th>Website</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>${items.map((item) => registryRow(kind, item)).join("") || `<tr><td colspan="7"><div class="empty-state">No ${config.label.toLowerCase()} match this filter.</div></td></tr>`}</tbody>
            </table>
          </div>`
        )}
        ${state.modal ? renderRegistryModal(kind, state.modal) : ""}
      </div>
    `;
  }

  function renderPositions() {
    routeTitle.textContent = "Positions";
    const term = positionsState.search.trim().toLowerCase();
    const visible = positionsState.items
      .filter((item) => positionsState.status === "all" || item.status === positionsState.status)
      .filter((item) => !term || [item.title, item.companyName, item.location, item.summary, item.source].join(" ").toLowerCase().includes(term))
      .sort(compareRegistryItems);
    app.innerHTML = `
      <div class="page positions-page">
        ${pageHeader(
          "Positions dashboard",
          "Positions",
          "Employment positions are seeded from the public CV source. Admin storage can overlay edits without changing public CV rendering in this task.",
          `<button class="button" type="button" data-position-action="create">Create Position</button>
           <button class="button button-secondary" type="button" data-position-action="sync-cms">Sync/save positions</button>`
        )}
        <div class="cms-storage-status">
          ${badge(cmsStatusText(positionsState.storage), cmsStatusTone(positionsState.storage))}
          <span>${escapeHtml(positionsState.storage.message || positionsState.message)}</span>
        </div>
        ${panel(
          "Position records",
          "Archive keeps records available for compatibility while hiding them from the active view.",
          `<div class="cms-toolbar">
            <label class="field"><span>Search</span><input class="input" type="search" data-position-filter="search" value="${escapeHtml(positionsState.search)}" placeholder="Title, company, location, summary" /></label>
            <label class="field"><span>Status</span><select class="input" data-position-filter="status"><option value="all"${positionsState.status === "all" ? " selected" : ""}>All statuses</option><option value="active"${positionsState.status === "active" ? " selected" : ""}>active</option><option value="archived"${positionsState.status === "archived" ? " selected" : ""}>archived</option></select></label>
            <div class="cms-toolbar-summary">${badge(`${visible.length} visible`, "warn")}${badge(`${positionsState.items.filter((item) => item.status !== "archived").length} active`, "success")}</div>
          </div>
          <div class="table-wrap">
            <table class="table positions-table">
              <thead><tr><th>Title</th><th>Company</th><th>Dates</th><th>Location</th><th>Platforms</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>${visible.map(renderPositionRow).join("") || `<tr><td colspan="8"><div class="empty-state">No positions match this filter.</div></td></tr>`}</tbody>
            </table>
          </div>`
        )}
        ${positionsState.modal ? renderPositionModal(positionsState.modal) : ""}
      </div>
    `;
  }

  function renderPositionRow(item) {
    const company = registryLabel("companies", item.companyId) || item.companyName || "Company not recorded";
    return `
      <tr class="project-click-row" data-project-row-id="${escapeHtml(project.id)}" tabindex="0" role="button" aria-label="Edit ${escapeHtml(project.title)}">
        <td><strong>${escapeHtml(item.title)}</strong><br><span>${escapeHtml(item.summary || "No summary recorded")}</span></td>
        <td>${escapeHtml(company)}</td>
        <td>${escapeHtml([item.startDate, item.endDate || (item.current ? "Current" : "")].filter(Boolean).join(" - ") || "Dates not recorded")}</td>
        <td>${escapeHtml(item.location || "Not recorded")}</td>
        <td><div class="chip-row">${platformChips(item.platformIds).join("") || badge("No platforms", "warn")}</div></td>
        <td>${badge(item.status, item.status === "active" ? "success" : "warn")}</td>
        <td>${escapeHtml(formatTimestamp(item.updatedAt))}</td>
        <td><div class="row-actions">
          <button class="button button-secondary" type="button" data-position-action="edit" data-position-id="${escapeHtml(item.id)}">Edit</button>
          <button class="button button-danger" type="button" data-position-action="archive" data-position-id="${escapeHtml(item.id)}">${item.status === "archived" ? "Activate" : "Archive"}</button>
          <button class="button button-danger" type="button" data-position-action="delete" data-position-id="${escapeHtml(item.id)}">Delete</button>
        </div></td>
      </tr>
    `;
  }

  function isInteractiveProjectRowTarget(target) {
    return Boolean(
      target.closest(
        "a, button, input, select, textarea, label, summary, details, [data-project-select], [data-project-action], [data-project-upload], [data-gallery-move], [data-gallery-remove], .col-resizer, [data-resize-disabled='true'], [draggable='true']"
      )
    );
  }

  function openProjectRow(row) {
    const id = row?.getAttribute("data-project-row-id");
    const project = id ? projectState.projects.find((item) => item.id === id) : null;
    if (!project) return;
    projectState.modal = { mode: "edit", project };
    renderProjects();
  }

  function renderPositionModal(modal) {
    const item = normalizePosition(modal.item);
    return `
      <div class="modal-backdrop" data-position-modal-backdrop>
        <section class="modal position-modal" role="dialog" aria-modal="true" aria-labelledby="position-modal-title">
          <header class="modal-header">
            <div>
              <span class="section-kicker">Public CV source position</span>
              <h2 id="position-modal-title">${modal.mode === "create" ? "Create position" : "Edit position"}</h2>
              <p>Use only real CV/source-backed employment details. Public CV rendering is not changed by this task.</p>
            </div>
            <button class="icon-close" type="button" aria-label="Close position editor" data-position-action="close-modal">x</button>
          </header>
          <form class="modal-body project-form" data-position-form>
            <input type="hidden" name="originalId" value="${escapeHtml(item.id)}" />
            <div class="form-grid">
              ${field("Title", "title", item.title, "text", true, false)}
              ${field("ID / slug", "id", item.id, "text", true, false)}
              <label class="field">
                <span>Company *</span>
                <select class="input" name="companyId" required>
                  ${activeRegistryItems("companies").map((company) => `<option value="${escapeHtml(company.id)}"${company.id === item.companyId ? " selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}
                </select>
              </label>
              ${field("Location", "location", item.location, "text", false, false)}
              ${field("Start date", "startDate", item.startDate, "date", false, false)}
              ${field("End date", "endDate", item.endDate, "date", false, false)}
              <label class="checkbox-field"><input type="checkbox" name="current" ${item.current ? "checked" : ""} /><span>Current role</span></label>
              ${field("Employment type", "employmentType", item.employmentType, "text", false, false)}
              <label class="field"><span>Status</span><select class="input" name="status"><option value="active"${item.status === "active" ? " selected" : ""}>active</option><option value="archived"${item.status === "archived" ? " selected" : ""}>archived</option></select></label>
              ${field("Sort order", "sortOrder", item.sortOrder, "number", false, false)}
              ${registryMultiSelectField("Software / platforms", "platformIds", "platforms", item.platformIds, false)}
              ${textareaField("Summary", "summary", item.summary, false)}
              ${textareaField("Responsibilities / highlights", "responsibilities", item.responsibilities.join("\n"), false)}
            </div>
            <footer class="modal-footer">
              <button class="button button-secondary" type="button" data-position-action="close-modal">Cancel</button>
              <button class="button" type="submit">Save position</button>
            </footer>
          </form>
        </section>
      </div>
    `;
  }

  function registryRow(kind, item) {
    const logo = registryLogoMarkup(kind, item);
    return `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong><br><span>${escapeHtml(item.description || item.details || "No details recorded")}</span></td>
        <td><code>${escapeHtml(item.id)}</code></td>
        <td>${badge(item.status, item.status === "active" ? "success" : "warn")}</td>
        <td><div class="registry-logo-cell">${logo}<span>${escapeHtml(kind === "companies" ? item.location : item.vendor || item.company || "")}</span></div></td>
        <td>${item.website ? `<a class="path-text" href="${escapeHtml(item.website)}" rel="noreferrer">${escapeHtml(item.website)}</a>` : `<span class="muted">Not recorded</span>`}</td>
        <td>${escapeHtml(formatTimestamp(item.updatedAt))}</td>
        <td><div class="row-actions">
          <button class="button button-secondary" type="button" data-registry-action="edit" data-registry-kind="${kind}" data-registry-id="${escapeHtml(item.id)}">Edit</button>
          <button class="button button-danger" type="button" data-registry-action="archive" data-registry-kind="${kind}" data-registry-id="${escapeHtml(item.id)}">${item.status === "archived" ? "Activate" : "Archive"}</button>
        </div></td>
      </tr>
    `;
  }

  function renderRegistryModal(kind, modal) {
    const config = registryConfig(kind);
    const item = normalizeRegistryItem(modal.item);
    const logoOptions = localLogoOptions(kind, item.logoPath);
    return `
      <div class="modal-backdrop" data-registry-modal-backdrop>
        <section class="modal registry-modal" role="dialog" aria-modal="true" aria-labelledby="registry-modal-title">
          <header class="modal-header">
            <div>
              <span class="section-kicker">${escapeHtml(config.label)} registry</span>
              <h2 id="registry-modal-title">${modal.mode === "create" ? `Create ${config.singular}` : `Edit ${config.singular}`}</h2>
              <p>Optional fields stay blank unless real source data exists. Upload persistence requires DC_ADMIN_ASSETS_R2.</p>
            </div>
            <button class="icon-close" type="button" aria-label="Close registry editor" data-registry-action="close-modal" data-registry-kind="${kind}">x</button>
          </header>
          <form class="modal-body project-form" data-registry-form="${kind}">
            <input type="hidden" name="originalId" value="${escapeHtml(item.id)}" />
            <div class="form-grid">
              ${field("Name", "name", item.name, "text", true, false)}
              ${field("ID / slug", "id", item.id, "text", true, false)}
              <label class="field"><span>Status</span><select class="input" name="status"><option value="active"${item.status === "active" ? " selected" : ""}>active</option><option value="archived"${item.status === "archived" ? " selected" : ""}>archived</option></select></label>
              ${field("Sort order", "sortOrder", item.sortOrder, "number", false, false)}
              ${field(kind === "companies" ? "Location" : "Company/vendor", kind === "companies" ? "location" : "vendor", kind === "companies" ? item.location : item.vendor || item.company, "text", false, false)}
              ${field("Website", "website", item.website, "url", false, false)}
              <label class="field project-upload-field">
                <span>Logo path</span>
                <div class="input-with-action"><input class="input" type="text" name="logoPath" value="${escapeHtml(item.logoPath)}" /><button class="button button-secondary" type="button" data-registry-action="upload-logo" data-registry-kind="${kind}">Upload</button></div>
                <select class="input asset-picker" data-registry-logo-select><option value="">Choose existing asset</option>${logoOptions}</select>
                <span class="asset-preview">${registryLogoMarkup(kind, item)}</span>
                <input class="asset-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-registry-upload-input="${kind}" />
                <span class="upload-status" data-registry-upload-status></span>
              </label>
              ${textareaField("Description/details", "description", item.description || item.details, false)}
            </div>
            <footer class="modal-footer">
              <button class="button button-secondary" type="button" data-registry-action="close-modal" data-registry-kind="${kind}">Cancel</button>
              <button class="button" type="submit">Save ${config.singular}</button>
            </footer>
          </form>
        </section>
      </div>
    `;
  }

  function registryLogoMarkup(kind, item) {
    const path = String(item?.logoPath || "").trim();
    if (!path) return `<span class="asset-preview-placeholder">No logo</span>`;
    if (kind === "companies") {
      return `<span class="company-logo-mask" style="--icon-url: url('${escapeHtml(path)}')" title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)} logo"></span>`;
    }
    return `<img class="software-logo-img" src="${escapeHtml(path)}" alt="${escapeHtml(item.name)} logo" loading="lazy" />`;
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
    app.innerHTML = `
      <div class="page alerts-page">
        ${pageHeader(
          "Alerts disabled",
          "Alerts",
          "Alert rules are managed in StreamSuites-Dashboard only.",
          ""
        )}

        ${panel(
          "Rule management moved",
          "Alert rules are managed in StreamSuites-Dashboard only.",
          `<div class="grid grid-2">
            <article class="card">
              <span class="metric-label">Rules</span>
              <h3>Disabled here</h3>
              <p class="muted">DanielClancy-Admin cannot create, edit, delete, import, reset, reconcile, export, sync, or save StreamSuites alert rule definitions.</p>
            </article>
            <article class="card">
              <span class="metric-label">Events</span>
              <h3>Event-only</h3>
              <p class="muted">DanielClancy-Admin may send alert events such as auth, CMS save, and page_visit metadata through the StreamSuites event ingest bridge.</p>
            </article>
          </div>`
        )}
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
              <p>Save writes only to DanielClancy-Admin storage. StreamSuites canonical alert rules are managed outside this page.</p>
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
              <p>This editor does not send rule definitions, register desktop clients, write StreamSuites runtime rules, or contact Pushover. Export JSON is manual and non-destructive.</p>
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
        <table class="table project-table" data-project-resizable-table>
          <thead>
            <tr>
              <th data-col-key="select" data-resize-disabled="true"><input type="checkbox" aria-label="Select visible projects" data-project-select-all ${projects.every((project) => projectState.selected.has(project.id)) ? "checked" : ""} /></th>
              <th data-col-key="title">Title</th>
              <th data-col-key="slug">Slug / ID</th>
              <th data-col-key="category">Category</th>
              <th data-col-key="status">Status</th>
              <th data-col-key="year">Year</th>
              <th data-col-key="featured">Featured</th>
              <th data-col-key="assets">Image / document</th>
              <th data-col-key="tags">Tags</th>
              <th data-col-key="health">Asset health</th>
              <th data-col-key="updated">Updated</th>
              <th data-col-key="actions" data-resize-disabled="true">Actions</th>
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

  function loadProjectColumnWidths() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PROJECT_COLUMNS_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveProjectColumnWidths(widths) {
    try {
      window.localStorage.setItem(PROJECT_COLUMNS_STORAGE_KEY, JSON.stringify(widths));
    } catch {
      // Column widths are optional UI preferences.
    }
  }

  function initProjectTableResize() {
    const table = app.querySelector("[data-project-resizable-table]");
    if (!(table instanceof HTMLTableElement) || table.dataset.resizeBound === "1") return;
    table.dataset.resizeBound = "1";
    const widths = loadProjectColumnWidths();
    const headers = Array.from(table.querySelectorAll("thead th"));
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      table.insertBefore(colgroup, table.firstChild);
    }
    while (colgroup.children.length < headers.length) colgroup.appendChild(document.createElement("col"));
    headers.forEach((th, index) => {
      const key = th.getAttribute("data-col-key") || `col_${index}`;
      const col = colgroup.children[index];
      const savedWidth = Number(widths[key]);
      if (savedWidth > 0) setProjectColumnWidth(table, th, col, savedWidth);
      if (th.getAttribute("data-resize-disabled") === "true") return;
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "col-resizer";
      handle.setAttribute("aria-label", `Resize ${th.textContent || "column"}`);
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = th.getBoundingClientRect().width;
        document.body.classList.add("col-resizing-active");
        const onMove = (moveEvent) => {
          setProjectColumnWidth(table, th, col, Math.max(56, startWidth + moveEvent.clientX - startX));
        };
        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          document.body.classList.remove("col-resizing-active");
          saveProjectColumnWidths(collectProjectColumnWidths(table));
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp, { once: true });
      });
      th.classList.add("is-resizable");
      th.appendChild(handle);
    });
  }

  function setProjectColumnWidth(table, th, col, width) {
    const px = `${Math.round(width)}px`;
    if (col) col.style.width = px;
    th.style.width = px;
    th.style.minWidth = px;
    table.style.minWidth = "100%";
  }

  function collectProjectColumnWidths(table) {
    const widths = {};
    Array.from(table.querySelectorAll("thead th[data-col-key]")).forEach((th) => {
      if (th.getAttribute("data-resize-disabled") === "true") return;
      widths[th.getAttribute("data-col-key")] = Math.round(th.getBoundingClientRect().width);
    });
    return widths;
  }

  function resetProjectTableColumns() {
    try {
      window.localStorage.removeItem(PROJECT_COLUMNS_STORAGE_KEY);
    } catch {
      // Optional preference reset.
    }
    projectState.message = "Project table column widths reset.";
    renderProjects();
    initProjectTableResize();
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
              ${projectAssetField("Hero image path", "heroImage", project.heroImage, "portfolio_image", readOnly, "Optional. If empty, public display should default to the first ordered gallery image.")}
              ${projectAssetField("Thumbnail path", "thumbnailPath", project.thumbnailPath, "thumbnail", readOnly, "Required thumbnail source from /media/portfolio/thumbs.")}
              ${projectAssetField("Document/PDF path", "documentPath", project.documentPath, "document_pdf", readOnly, "Required document source from /docs. Upload persistence requires DC_ADMIN_ASSETS_R2.")}
              ${field("Documentation URL", "documentationUrl", project.documentationUrl, "url", false, readOnly)}
              ${field("Live/detail link", "livePage", project.livePage, "text", false, readOnly)}
              ${field("Source folder", "sourceFolder", project.sourceFolder, "text", false, readOnly)}
              ${textareaField("Summary", "summary", project.summary, readOnly)}
              ${textareaField("Description", "description", project.description, readOnly)}
              ${projectGalleryField(project.galleryPaths, readOnly)}
              ${textareaField("Tags", "tags", project.tags.join("\n"), readOnly)}
              ${registryMultiSelectField("Company / studio", "companyIds", "companies", project.companyIds || project.studio, readOnly)}
              ${registryMultiSelectField("Software / platforms", "platformIds", "platforms", project.platformIds || project.software, readOnly)}
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

  function projectAssetField(label, name, value, catalogType, readOnly = false, note = "") {
    const accept = catalogType === "document_pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp,image/gif";
    return `
      <label class="field project-upload-field">
        <span>${escapeHtml(label)}</span>
        <div class="input-with-action">
          <input class="input" type="text" name="${escapeHtml(name)}" value="${escapeHtml(value || "")}" ${readOnly ? "readonly" : ""} />
          ${readOnly ? "" : `<button class="button button-secondary" type="button" data-project-upload="${escapeHtml(name)}">Upload</button>`}
          ${!readOnly && name === "heroImage" ? `<button class="button button-secondary" type="button" data-project-clear="${escapeHtml(name)}">Clear</button>` : ""}
        </div>
        ${readOnly ? "" : `<select class="input asset-picker" data-project-asset-select="${escapeHtml(name)}"><option value="">Choose existing asset</option>${catalogOptions(catalogType, value)}</select>`}
        <span class="asset-preview">${assetPreview(value, label)}</span>
        ${note ? `<small class="muted">${escapeHtml(note)}</small>` : ""}
        ${readOnly ? "" : `<input class="asset-file-input" type="file" accept="${escapeHtml(accept)}" data-project-upload-input="${escapeHtml(name)}" />`}
        <span class="upload-status" data-project-upload-status="${escapeHtml(name)}"></span>
      </label>
    `;
  }

  function projectGalleryField(paths, readOnly = false) {
    const values = arrayFromValue(paths);
    return `
      <label class="field field-wide project-upload-field">
        <span>Gallery/image paths *</span>
        <textarea class="input textarea gallery-paths-input" name="galleryPaths" rows="4" ${readOnly ? "readonly" : ""}>${escapeHtml(values.join("\n"))}</textarea>
        <div class="gallery-grid" data-gallery-grid>
          ${values.map((path, index) => galleryTile(path, index, readOnly)).join("") || `<span class="asset-preview-placeholder">No gallery images selected</span>`}
        </div>
        ${readOnly ? "" : `<div class="field-actions">
          <select class="input asset-picker" data-project-gallery-select><option value="">Append existing /media/portfolio asset</option>${catalogOptions("portfolio_image")}</select>
          <button class="button button-secondary" type="button" data-project-upload="galleryPaths">Upload image to gallery</button>
        </div>`}
        ${readOnly ? "" : `<input class="asset-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-project-upload-input="galleryPaths" />`}
        <span class="upload-status" data-project-upload-status="galleryPaths"></span>
      </label>
    `;
  }

  function galleryTile(path, index, readOnly = false) {
    return `
      <div class="gallery-tile" data-gallery-index="${index}">
        ${assetPreview(path, `Gallery item ${index + 1}`)}
        <code>${escapeHtml(path)}</code>
        ${
          readOnly
            ? ""
            : `<div class="row-actions">
                <button class="button button-secondary" type="button" data-gallery-move="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Up</button>
                <button class="button button-secondary" type="button" data-gallery-move="${index}" data-direction="1">Down</button>
                <button class="button button-danger" type="button" data-gallery-remove="${index}">Remove</button>
              </div>`
        }
      </div>
    `;
  }

  function registryMultiSelectField(label, name, kind, selectedValues, readOnly = false) {
    const selected = new Set(normalizeProjectRegistryRefs(selectedValues).map(createSlug));
    const options = activeRegistryItems(kind);
    const chips = Array.from(selected)
      .map((id) => {
        const item = options.find((entry) => entry.id === id || entry.slug === id) || registryState[kind].items.find((entry) => entry.id === id || entry.slug === id);
        if (!item) return "";
        if (kind === "platforms") {
          const logo = logoPathForPlatform(item.id);
          return `<span class="platform-chip" title="${escapeHtml(item.name)}">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" />` : `<span>${escapeHtml(initialsFor(item.name))}</span>`}<span>${escapeHtml(item.name)}</span></span>`;
        }
        return badge(item.name);
      })
      .join("");
    return `
      <label class="field field-wide registry-select-field">
        <span>${escapeHtml(label)} *</span>
        <select class="input" name="${escapeHtml(name)}" multiple size="${Math.min(6, Math.max(3, options.length || 3))}" ${readOnly ? "disabled" : ""}>
          ${options.map((item) => `<option value="${escapeHtml(item.id)}"${selected.has(item.id) || selected.has(item.slug) ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
        </select>
        <div class="chip-row">${chips || badge(`No ${label.toLowerCase()} selected`, "warn")}</div>
        <small class="muted">Options are managed on the ${kind === "companies" ? "Companies" : "Platforms"} page; custom text is not accepted here.</small>
      </label>
    `;
  }

  function platformChips(values) {
    return normalizeProjectRegistryRefs(values)
      .map((value) => {
        const id = createSlug(value);
        const item = registryState.platforms.items.find((entry) => entry.id === id || entry.slug === id || createSlug(entry.name) === id);
        if (!item) return "";
        const logo = logoPathForPlatform(item.id);
        return `<span class="platform-chip" title="${escapeHtml(item.name)}">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" />` : `<span>${escapeHtml(initialsFor(item.name))}</span>`}<span>${escapeHtml(item.name)}</span></span>`;
      })
      .filter(Boolean);
  }

  function initialsFor(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "P";
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
        "Manual non-destructive contract copy only. StreamSuites/runtime alert rules remain canonical and must be managed in StreamSuites.",
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
    } else if (route.page === "companies") {
      renderRegistryPage("companies");
    } else if (route.page === "platforms") {
      renderRegistryPage("platforms");
    } else if (route.page === "positions") {
      renderPositions();
    } else if (route.page === "alerts") {
      renderAlerts();
    } else if (route.page === "settings") {
      renderSettings();
    } else {
      renderOverview();
    }

    if (route.page === "projects") initProjectTableResize();
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
    persistSidebarMode(document.body.classList.contains("nav-collapsed") ? "collapsed" : "expanded");
    navToggle.setAttribute("aria-expanded", String(!document.body.classList.contains("nav-collapsed")));
  });

  function applySidebarMode(mode) {
    const normalized = ["expanded", "collapsed", "hidden"].includes(mode) ? mode : "expanded";
    document.body.classList.toggle("nav-collapsed", normalized === "collapsed");
    document.body.classList.toggle("nav-hidden", normalized === "hidden");
    navToggle?.setAttribute("aria-expanded", String(normalized === "expanded"));
    sidebarCollapseToggle?.setAttribute("aria-pressed", String(normalized === "collapsed"));
    sidebarCollapseToggle?.setAttribute("aria-label", normalized === "collapsed" ? "Expand sidebar" : "Collapse sidebar");
    sidebarCollapseToggle?.setAttribute("title", normalized === "collapsed" ? "Expand sidebar" : "Collapse sidebar");
    sidebarHideToggle?.setAttribute("aria-pressed", String(normalized === "hidden"));
    sidebarHideToggle?.setAttribute("aria-label", "Hide sidebar");
    sidebarHideToggle?.setAttribute("title", "Hide sidebar");
    sidebarReopenToggle?.classList.toggle("is-visible", normalized === "hidden");
  }

  function persistSidebarMode(mode) {
    applySidebarMode(mode);
    try {
      window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, mode);
    } catch {
      // Optional UI preference.
    }
  }

  function initSidebarMode() {
    let stored = "expanded";
    try {
      stored = window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY) || "expanded";
    } catch {
      stored = "expanded";
    }
    applySidebarMode(stored);
  }

  sidebarCollapseToggle?.addEventListener("click", () => {
    const collapsed = document.body.classList.contains("nav-collapsed");
    persistSidebarMode(collapsed ? "expanded" : "collapsed");
  });

  sidebarHideToggle?.addEventListener("click", () => {
    persistSidebarMode("hidden");
  });

  sidebarReopenToggle?.addEventListener("click", () => {
    persistSidebarMode("expanded");
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

    if (target.matches("[data-registry-filter]")) {
      const kind = target.getAttribute("data-registry-filter");
      if (registryState[kind]) {
        registryState[kind].search = target.value;
        renderRegistryPage(kind);
      }
    }

    if (target.matches("[data-position-filter='search']")) {
      positionsState.search = target.value;
      renderPositions();
    }
  });

  app.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-project-upload-input]")) {
      uploadProjectAsset(target, target.getAttribute("data-project-upload-input"));
      return;
    }

    if (target.matches("[data-registry-upload-input]")) {
      uploadRegistryLogo(target, target.getAttribute("data-registry-upload-input"));
      return;
    }

    if (target.matches("[data-account-avatar-input]")) {
      uploadAccountAvatar(target);
      return;
    }

    if (target.matches("[data-project-asset-select]")) {
      const fieldName = target.getAttribute("data-project-asset-select");
      const form = target.closest("[data-project-form]");
      if (form && fieldName && target.value) updateProjectAssetField(form, fieldName, target.value);
      return;
    }

    if (target.matches("[data-project-gallery-select]")) {
      const form = target.closest("[data-project-form]");
      if (form && target.value) {
        updateProjectAssetField(form, "galleryPaths", target.value);
        renderProjectGalleryGrid(form);
        target.value = "";
      }
      return;
    }

    if (target.matches("[data-registry-logo-select]")) {
      const form = target.closest("[data-registry-form]");
      const input = form?.querySelector("[name='logoPath']");
      if (input && target.value) input.value = target.value;
      return;
    }

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

    if (target.matches("[data-position-filter='status']")) {
      positionsState.status = target.value;
      renderPositions();
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

    if (form.matches("[data-account-profile-form]")) {
      event.preventDefault();
      saveCurrentProfile(form);
      return;
    }

    if (form.matches("[data-alert-form]")) {
      event.preventDefault();
      saveAlertFromForm(form);
      return;
    }

    if (form.matches("[data-position-form]")) {
      event.preventDefault();
      savePositionFromForm(form);
      return;
    }

    const registryKind = form.getAttribute("data-registry-form");
    if (registryKind) {
      event.preventDefault();
      saveRegistryFromForm(registryKind, form);
      return;
    }

    if (!form.matches("[data-project-form]")) return;

    event.preventDefault();
    saveProjectFromForm(form);
  });

  app.addEventListener("click", (event) => {
    const projectRow = event.target instanceof HTMLElement ? event.target.closest("[data-project-row-id]") : null;
    if (projectRow && event.target instanceof HTMLElement && !isInteractiveProjectRowTarget(event.target)) {
      openProjectRow(projectRow);
      return;
    }

    const target = event.target.closest("[data-project-action], [data-project-upload], [data-project-clear], [data-gallery-move], [data-gallery-remove], [data-registry-action], [data-registry-modal-backdrop], [data-project-modal-backdrop], [data-media-action], [data-media-modal-backdrop], [data-alert-action], [data-alert-modal-backdrop], [data-position-action], [data-position-modal-backdrop], [data-account-access-action], [data-account-action]");
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute("data-project-action");
    const uploadField = target.getAttribute("data-project-upload");
    const clearField = target.getAttribute("data-project-clear");
    const mediaAction = target.getAttribute("data-media-action");
    const alertAction = target.getAttribute("data-alert-action");
    const accountAccessAction = target.getAttribute("data-account-access-action");
    const accountAction = target.getAttribute("data-account-action");
    const registryAction = target.getAttribute("data-registry-action");
    const registryKind = target.getAttribute("data-registry-kind");
    const registryId = target.getAttribute("data-registry-id");
    const positionAction = target.getAttribute("data-position-action");
    const positionId = target.getAttribute("data-position-id");
    const id = target.getAttribute("data-project-id");
    const mediaId = target.getAttribute("data-media-id");
    const alertId = target.getAttribute("data-alert-id");
    const accountAccessId = target.getAttribute("data-account-access-id");
    const accountId = target.getAttribute("data-account-id");

    if (accountAction === "refresh") {
      hydrateAccountRegistry(true);
      return;
    }

    if (accountAction === "upload-avatar") {
      app.querySelector("[data-account-avatar-input]")?.click();
      return;
    }

    if (uploadField) {
      app.querySelector(`[data-project-upload-input="${CSS.escape(uploadField)}"]`)?.click();
      return;
    }

    if (clearField) {
      const form = target.closest("[data-project-form]");
      const input = form?.querySelector(`[name="${CSS.escape(clearField)}"]`);
      if (input) input.value = "";
      return;
    }

    if (target.matches("[data-gallery-move]")) {
      const form = target.closest("[data-project-form]");
      moveGalleryItem(form, Number(target.getAttribute("data-gallery-move")), Number(target.getAttribute("data-direction")));
      return;
    }

    if (target.matches("[data-gallery-remove]")) {
      const form = target.closest("[data-project-form]");
      removeGalleryItem(form, Number(target.getAttribute("data-gallery-remove")));
      return;
    }

    if (registryAction) {
      handleRegistryAction(registryKind, registryAction, registryId);
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

    if (!action && !mediaAction && !alertAction && !positionAction && (target.matches("[data-project-modal-backdrop]") || target.matches("[data-media-modal-backdrop]") || target.matches("[data-alert-modal-backdrop]") || target.matches("[data-position-modal-backdrop]"))) {
      return;
    }

    if (positionAction === "create") {
      positionsState.modal = { mode: "create", item: normalizePosition({ id: "", title: "", status: "active" }) };
      renderPositions();
    } else if (positionAction === "edit") {
      const item = positionsState.items.find((entry) => entry.id === positionId);
      if (item) positionsState.modal = { mode: "edit", item };
      renderPositions();
    } else if (positionAction === "archive") {
      const item = positionsState.items.find((entry) => entry.id === positionId);
      if (item) {
        const nextStatus = item.status === "archived" ? "active" : "archived";
        if (nextStatus === "archived" && !window.confirm(`Archive ${item.title}?`)) return;
        item.status = nextStatus;
        item.updatedAt = new Date().toISOString();
        positionsState.message = `${item.title} ${nextStatus === "archived" ? "archived" : "activated"}.`;
        persistPositions();
        renderPositions();
      }
    } else if (positionAction === "delete") {
      deletePosition(positionId);
    } else if (positionAction === "close-modal") {
      positionsState.modal = null;
      renderPositions();
    } else if (positionAction === "sync-cms") {
      persistCmsCollection("positions", true, true);
    }

    if (positionAction) return;

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
    } else if (action === "reset-columns") {
      resetProjectTableColumns();
    }
  });

  app.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest("[data-project-row-id]");
    if (!row || isInteractiveProjectRowTarget(target)) return;
    event.preventDefault();
    openProjectRow(row);
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

  function handleRegistryAction(kind, action, id) {
    if (!registryState[kind]) return;
    const config = registryConfig(kind);
    if (action === "create") {
      registryState[kind].modal = { mode: "create", item: normalizeRegistryItem({ id: "", name: "", status: "active" }) };
      renderRegistryPage(kind);
      return;
    }
    if (action === "edit") {
      const item = registryState[kind].items.find((entry) => entry.id === id);
      if (item) registryState[kind].modal = { mode: "edit", item };
      renderRegistryPage(kind);
      return;
    }
    if (action === "archive") {
      const item = registryState[kind].items.find((entry) => entry.id === id);
      if (!item) return;
      const nextStatus = item.status === "archived" ? "active" : "archived";
      if (nextStatus === "archived" && !window.confirm(`Archive ${item.name}? It will be hidden from Project editor selectors but retained for compatibility.`)) return;
      item.status = nextStatus;
      item.updatedAt = new Date().toISOString();
      registryState[kind].message = `${config.singular} ${nextStatus === "archived" ? "archived" : "activated"}.`;
      persistRegistryItems(kind);
      renderRegistryPage(kind);
      return;
    }
    if (action === "close-modal") {
      registryState[kind].modal = null;
      renderRegistryPage(kind);
      return;
    }
    if (action === "sync-cms") {
      persistCmsCollection(kind, true, true);
      return;
    }
    if (action === "upload-logo") {
      app.querySelector(`[data-registry-upload-input="${CSS.escape(kind)}"]`)?.click();
    }
  }

  function saveRegistryFromForm(kind, form) {
    const name = formValue(form, "name");
    const id = createSlug(formValue(form, "id") || name);
    if (!name || !id) {
      registryState[kind].message = "Name and ID are required.";
      renderRegistryPage(kind);
      return;
    }
    const originalId = formValue(form, "originalId");
    const existingIndex = registryState[kind].items.findIndex((item) => item.id === originalId);
    const duplicate = registryState[kind].items.some((item, index) => item.id === id && index !== existingIndex);
    if (duplicate) {
      registryState[kind].message = "Another registry row already uses that ID.";
      renderRegistryPage(kind);
      return;
    }
    const saved = normalizeRegistryItem({
      ...(existingIndex >= 0 ? registryState[kind].items[existingIndex] : {}),
      id,
      slug: id,
      name,
      logoPath: formValue(form, "logoPath"),
      location: formValue(form, "location"),
      vendor: formValue(form, "vendor"),
      company: formValue(form, "vendor"),
      website: formValue(form, "website"),
      description: formValue(form, "description"),
      details: formValue(form, "description"),
      status: formValue(form, "status"),
      sortOrder: Number(formValue(form, "sortOrder") || 1000),
      updatedAt: new Date().toISOString()
    });
    if (existingIndex >= 0) {
      registryState[kind].items[existingIndex] = saved;
    } else {
      registryState[kind].items.unshift(saved);
    }
    registryState[kind].items.sort(compareRegistryItems);
    registryState[kind].modal = null;
    registryState[kind].message = `Saved ${saved.name}.`;
    persistRegistryItems(kind);
    renderRegistryPage(kind);
  }

  function savePositionFromForm(form) {
    const title = formValue(form, "title");
    const id = createSlug(formValue(form, "id") || title);
    const companyId = formValue(form, "companyId");
    if (!title || !id || !companyId) {
      positionsState.message = "Title, ID, and company are required.";
      renderPositions();
      return;
    }
    const originalId = formValue(form, "originalId");
    const existingIndex = positionsState.items.findIndex((item) => item.id === originalId);
    const duplicate = positionsState.items.some((item, index) => item.id === id && index !== existingIndex);
    if (duplicate) {
      positionsState.message = "Another position already uses that ID.";
      renderPositions();
      return;
    }
    const saved = normalizePosition({
      ...(existingIndex >= 0 ? positionsState.items[existingIndex] : {}),
      id,
      slug: id,
      title,
      companyId,
      companyName: registryLabel("companies", companyId),
      location: formValue(form, "location"),
      startDate: formValue(form, "startDate"),
      endDate: formValue(form, "endDate"),
      current: Boolean(form.querySelector("[name='current']")?.checked),
      employmentType: formValue(form, "employmentType"),
      summary: formValue(form, "summary"),
      responsibilities: textareaArray(formValue(form, "responsibilities")),
      highlights: textareaArray(formValue(form, "responsibilities")),
      platformIds: formSelectedValues(form, "platformIds"),
      status: formValue(form, "status"),
      sortOrder: Number(formValue(form, "sortOrder") || 1000),
      source: existingIndex >= 0 ? positionsState.items[existingIndex].source : "admin_created",
      updatedAt: new Date().toISOString()
    });
    if (existingIndex >= 0) {
      positionsState.items[existingIndex] = saved;
    } else {
      positionsState.items.unshift(saved);
    }
    positionsState.items.sort(compareRegistryItems);
    positionsState.modal = null;
    positionsState.message = `Saved ${saved.title}.`;
    persistPositions();
    renderPositions();
  }

  function deletePosition(id) {
    const item = positionsState.items.find((entry) => entry.id === id);
    if (!item) return;
    if (!window.confirm(`Delete position "${item.title}"? This only affects Admin storage/fallback and does not change the public CV.`)) return;
    positionsState.items = positionsState.items.filter((entry) => entry.id !== id);
    positionsState.message = `Deleted ${item.title}.`;
    persistPositions();
    renderPositions();
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

  function setProjectUploadStatus(fieldName, message, tone = "") {
    const status = app.querySelector(`[data-project-upload-status="${CSS.escape(fieldName)}"]`);
    if (!status) return;
    status.textContent = message || "";
    status.dataset.tone = tone;
  }

  function setProjectUploadPreview(fieldName, file) {
    const preview = app.querySelector(`[data-project-upload-preview="${CSS.escape(fieldName)}"]`);
    if (!preview) return;
    if (!file || !file.type?.startsWith("image/")) {
      preview.innerHTML = "";
      return;
    }
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="Selected upload preview" />`;
    const image = preview.querySelector("img");
    if (image) image.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  }

  function updateProjectAssetField(form, fieldName, value) {
    if (!value) return;
    const target = form.querySelector(`[name="${CSS.escape(fieldName)}"]`);
    if (!target) return;
    if (fieldName === "galleryPaths") {
      const existing = textareaArray(target.value);
      if (!existing.includes(value)) existing.push(value);
      target.value = existing.join("\n");
      renderProjectGalleryGrid(form);
      return;
    }
    target.value = value;
  }

  function renderProjectGalleryGrid(form) {
    const textarea = form?.querySelector("[name='galleryPaths']");
    const grid = form?.querySelector("[data-gallery-grid]");
    if (!(textarea instanceof HTMLTextAreaElement) || !grid) return;
    const values = textareaArray(textarea.value);
    grid.innerHTML = values.map((path, index) => galleryTile(path, index, false)).join("") || `<span class="asset-preview-placeholder">No gallery images selected</span>`;
  }

  function moveGalleryItem(form, index, direction) {
    const textarea = form?.querySelector("[name='galleryPaths']");
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    const values = textareaArray(textarea.value);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || index >= values.length || nextIndex >= values.length) return;
    const [item] = values.splice(index, 1);
    values.splice(nextIndex, 0, item);
    textarea.value = values.join("\n");
    renderProjectGalleryGrid(form);
  }

  function removeGalleryItem(form, index) {
    const textarea = form?.querySelector("[name='galleryPaths']");
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    const values = textareaArray(textarea.value);
    if (index < 0 || index >= values.length) return;
    values.splice(index, 1);
    textarea.value = values.join("\n");
    renderProjectGalleryGrid(form);
  }

  async function uploadProjectAsset(input, fieldName) {
    const form = input.closest("[data-project-form]");
    const file = input.files?.[0];
    if (!form || !fieldName || !file) return;
    setProjectUploadPreview(fieldName, file);
    setProjectUploadStatus(fieldName, `Selected ${file.name}; uploading...`, "pending");
    const payload = new FormData();
    payload.set("file", file);
    payload.set("projectSlug", formValue(form, "slug") || formValue(form, "title") || "project");
    payload.set("field", fieldName);
    try {
      const response = await fetch(assetUploadEndpoint(), {
        method: "POST",
        body: payload,
        credentials: "include"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const error = result.error || `upload_http_${response.status}`;
        setProjectUploadStatus(fieldName, error === "storage_not_configured" ? "Asset storage not configured." : `Upload failed: ${error}`, "error");
        input.value = "";
        return;
      }
      const assetPath = result.relativePath || result.path || result.url || result.key;
      updateProjectAssetField(form, fieldName, assetPath);
      setProjectUploadStatus(fieldName, `Uploaded ${result.originalName || file.name}.`, "success");
    } catch (error) {
      setProjectUploadStatus(fieldName, `Upload failed: ${error.message || "network_error"}`, "error");
    } finally {
      input.value = "";
    }
  }

  async function uploadRegistryLogo(input, kind) {
    const form = input.closest("[data-registry-form]");
    const file = input.files?.[0];
    const status = form?.querySelector("[data-registry-upload-status]");
    if (!form || !file) return;
    if (status) status.textContent = `Selected ${file.name}; uploading...`;
    const payload = new FormData();
    payload.set("file", file);
    payload.set("projectSlug", formValue(form, "id") || formValue(form, "name") || kind || "registry");
    payload.set("field", "gallery");
    try {
      const response = await fetch(assetUploadEndpoint(), { method: "POST", body: payload, credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        if (status) status.textContent = result.error === "storage_not_configured" ? "Asset storage not configured." : `Upload failed: ${result.error || response.status}`;
        input.value = "";
        return;
      }
      const logoInput = form.querySelector("[name='logoPath']");
      if (logoInput) logoInput.value = result.relativePath || result.path || result.url || result.key || "";
      if (status) status.textContent = `Uploaded ${result.originalName || file.name}.`;
    } catch (error) {
      if (status) status.textContent = `Upload failed: ${error.message || "network_error"}`;
    } finally {
      input.value = "";
    }
  }

  async function uploadAccountAvatar(input) {
    const form = input.closest("[data-account-profile-form]");
    const file = input.files?.[0];
    const status = form?.querySelector("[data-account-avatar-status]");
    if (!form || !file) return;
    if (status) status.textContent = `Selected ${file.name}; uploading...`;
    const payload = new FormData();
    payload.set("file", file);
    payload.set("projectSlug", "current-user");
    payload.set("field", "avatar");
    try {
      const response = await fetch(assetUploadEndpoint(), { method: "POST", body: payload, credentials: "include" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        if (status) status.textContent = result.error === "storage_not_configured" ? "Avatar storage not configured." : `Upload failed: ${result.error || response.status}`;
        input.value = "";
        return;
      }
      const avatarInput = form.querySelector("[name='avatarUrl']");
      if (avatarInput) avatarInput.value = result.relativePath || result.path || result.url || result.key || "";
      if (status) status.textContent = `Uploaded ${result.originalName || file.name}.`;
    } catch (error) {
      if (status) status.textContent = `Upload failed: ${error.message || "network_error"}`;
    } finally {
      input.value = "";
    }
  }

  async function saveCurrentProfile(form) {
    accountRegistryState.status = "saving";
    accountRegistryState.message = "Saving current profile...";
    renderAccounts();
    try {
      const response = await fetch(accountsEndpoint("profile"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: formValue(form, "displayName"),
          avatarUrl: formValue(form, "avatarUrl")
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        accountRegistryState.status = "fallback";
        accountRegistryState.message = `Profile save failed: ${payload.error || response.status}`;
        renderAccounts();
        return;
      }
      Object.assign(accountRegistryState, {
        status: payload.storageConfigured ? "connected" : "not-configured",
        message: "Profile overlay saved.",
        accounts: Array.isArray(payload.accounts) ? payload.accounts : accountRegistryState.accounts,
        meta: payload.meta || accountRegistryState.meta,
        session: payload.session || accountRegistryState.session,
        lastChecked: new Date().toISOString()
      });
      if (window.DC_ADMIN_AUTH?.refresh) {
        window.DC_ADMIN_AUTH.refresh();
      }
      renderAccounts();
    } catch {
      accountRegistryState.status = "fallback";
      accountRegistryState.message = "Profile save failed because Pages Functions are unavailable.";
      renderAccounts();
    }
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
    const companyIds = formSelectedValues(form, "companyIds");
    const platformIds = formSelectedValues(form, "platformIds");
    const companyLabels = selectedRegistryLabels("companies", companyIds);
    const platformLabels = selectedRegistryLabels("platforms", platformIds);
    const saved = normalizeProject({
      ...(originalProject || {}),
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
      studio: companyLabels,
      software: platformLabels,
      companyIds,
      companyLabels,
      platformIds,
      platformLabels,
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

  positionsState.items = loadPositions();
  if (!window.location.hash && ["/", "/index.html"].includes(window.location.pathname)) {
    window.location.hash = "#/overview";
  } else {
    render();
  }
  hydrateProjectBaseline(activePageIs("projects"));
  initSidebarMode();
  seedRegistriesFromCvSource();
  seedRegistriesFromProjects();
  hydratePublicAssetCatalog(activePageIs("projects"));
  hydrateCmsCollections();
  hydrateAccountRegistry(activePageIs("accounts") || activePageIs("settings"));
  hydrateOverviewStatus(activePageIs("overview"));
  hydrateAnalyticsStatus(activePageIs("analytics"));
})();
