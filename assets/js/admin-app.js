import {
  REGISTRY_SCHEMA_VERSION,
  createRegistrySlug,
  extractClientOnlyIds,
  extractRequiredCompanyIds,
  normalizePositionRegistryItem,
  normalizeRegistryItem as reconcileNormalizeRegistryItem,
  reconcilePositionsCollection,
  reconcileRegistryCollection,
  registryStoragePayload,
  unpackRegistryStorage
} from "./registry-reconciliation.js";
import {
  buildLocationFeatures,
  initAnalyticsMap,
  resizeAnalyticsMap as resizeAnalyticsMapModule,
  updateAnalyticsMap
} from "./analytics-map.js";

(function () {
  const data = window.DC_ADMIN_SCAFFOLD_DATA;
  const app = document.getElementById("app");
  const nav = document.getElementById("sidebar-nav");
  const routeTitle = document.getElementById("route-title");
  const navToggle = document.getElementById("nav-toggle");
  const sidebarCollapseToggle = document.getElementById("sidebar-collapse-toggle");
  const sidebarHideToggle = document.getElementById("sidebar-hide-toggle");
  const sidebarReopenToggle = document.getElementById("sidebar-reopen-toggle");
  const sidebarStatusNote = document.getElementById("sidebar-status-note");
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
  const REGISTRY_SCHEMA_STORAGE_KEY = REGISTRY_SCHEMA_VERSION;
  const PUBLIC_SITE_DATA_URL = "/api/public/site-data";
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
      items: [],
      search: "",
      modal: null,
      message: "Company registry uses admin storage when available and local fallback otherwise.",
      storage: { status: "checking", source: "local", message: "Checking Companies registry..." },
      reconciliation: { reconciled: true, staleRowsExcluded: 0, sourceRequiredRowsRestored: 0, warnings: [] }
    },
    platforms: {
      items: [],
      search: "",
      modal: null,
      message: "Platform registry uses admin storage when available and local fallback otherwise.",
      storage: { status: "checking", source: "local", message: "Checking Platforms registry..." },
      reconciliation: { reconciled: true, staleRowsExcluded: 0, sourceRequiredRowsRestored: 0, warnings: [] }
    }
  };
  const positionsState = {
    items: [],
    search: "",
    status: "all",
    modal: null,
    message: "Positions are seeded from the public CV source and use admin storage when available.",
    reconciliation: { reconciled: true, staleRowsExcluded: 0, sourceRequiredRowsRestored: 0, warnings: [] },
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
    lastChecked: "",
    selectedWindow: "5m"
  };
  const publishState = {
    status: "checking",
    message: "Checking public site-data publish status...",
    source: "unknown",
    revision: "",
    publishedAt: "",
    generatedAt: "",
    publicUrl: PUBLIC_SITE_DATA_URL,
    counts: { projects: 0, companies: 0, platforms: 0, positions: 0, assets: 0 },
    warnings: []
  };
  const pageVisitState = {
    lastPath: ""
  };
  const CV_COMPANY_SEED = [
      {
          "id": "richmond-ross",
          "slug": "richmond-ross",
          "name": "Richmond+Ross",
          "logoPath": "./assets/logos/company-richmondross-0.svg",
          "location": "Crows Nest, NSW",
          "website": "https://www.richmondross.com.au/",
          "description": "Richmond + Ross have over 30 years of experience in the design of retail facilities, including shopping centres, fast food, public domain, bulk fuel & retail, 5 star & tourism, institutional and industrial projects. The scale and type of retail developments range from simple 75m² standalone tenancies all the way through to 50,000+m²Regional Centres",
          "status": "active",
          "sortOrder": 10,
          "classificationSource": "employer_and_studio",
          "sourceNotes": "Promoted from employment and project studio/company source fields.",
          "provenance": [
              {
                  "rawName": "Richmond+Ross",
                  "normalizedName": "Richmond+Ross",
                  "normalizedId": "richmond-ross",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "a646f50f-eeba-46ac-959f-e10e16ca89d9",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "richmond-ross-revit-draftsperson-and-technician"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              },
              {
                  "rawName": "Richmond+Ross",
                  "normalizedName": "Richmond+Ross",
                  "normalizedId": "richmond-ross",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "redevelopment-of-highway-service-center-pheasants-nest-m31-north-26-south",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "redevelopment-of-highway-service-center-pheasants-nest-m31-north-26-south"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "Richmond+Ross",
                  "normalizedName": "Richmond+Ross",
                  "normalizedId": "richmond-ross",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "upss-homebush-2c-nsw",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "upss-homebush-2c-nsw"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "Richmond+Ross",
                  "normalizedName": "Richmond+Ross",
                  "normalizedId": "richmond-ross",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "upss-beacon-hill-2c-nsw",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "upss-beacon-hill-2c-nsw"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "Richmond+Ross",
                  "normalizedName": "Richmond+Ross",
                  "normalizedId": "richmond-ross",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "upss-wyoming-2c-nsw",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "upss-wyoming-2c-nsw"
                  ],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "meriton-group",
          "slug": "meriton-group",
          "name": "Meriton Group",
          "logoPath": "",
          "location": "Sydney, NSW",
          "website": "https://www.meriton.com.au/",
          "description": "Established in 1963, Meriton has made a significant impact on the Australian landscape. The private company has designed, developed and built more than 75,000 apartments and some of the tallest residential towers across the east coast of Australia. Meriton has spearheaded the apartment revolution with sophisticated, high-quality apartments. Its founder and managing director, billionaire property entrepreneur Harry Triguboff, is still passionately involved in the design and construction of all projects",
          "status": "active",
          "sortOrder": 20,
          "classificationSource": "employer",
          "sourceNotes": "Promoted from employment/position source fields.",
          "provenance": [
              {
                  "rawName": "Meriton Group",
                  "normalizedName": "Meriton Group",
                  "normalizedId": "meriton-group",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "c8d8ca96-ae87-4224-a5fb-b634736bd304",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "meriton-group-structural-revit-draftsman"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "leffler-simes-architects",
          "slug": "leffler-simes-architects",
          "name": "Leffler Simes Architects",
          "logoPath": "./assets/logos/company-lefflersimes-0.svg",
          "location": "Melbourne, VIC",
          "website": "https://www.lefflersimes.com.au/",
          "description": "Leffler Simes Architects (LSA) is well recognised as one of Australia’s leading architectural practices with offices in Sydney, Melbourne and Brisbane. Established in the late 1960s, Leffler Simes was at the forefront of the dramatic expansion of the retail sector throughout Australia and designed a majority of the large shopping centres built at this time. With a solid retail pedigree founded in the 1970s and 80s, Leffler Simes have maintained a role as a major retail practice since.",
          "status": "active",
          "sortOrder": 30,
          "classificationSource": "employer",
          "sourceNotes": "Promoted from employment/position source fields.",
          "provenance": [
              {
                  "rawName": "Leffler Simes Architects",
                  "normalizedName": "Leffler Simes Architects",
                  "normalizedId": "leffler-simes-architects",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "a604cfa4-d498-4397-806f-d1ad3e574091",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "leffler-simes-architects-architectural-revit-draftsman"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "fleetwood-australia",
          "slug": "fleetwood-australia",
          "name": "Fleetwood Australia",
          "logoPath": "",
          "location": "Melbourne, VIC",
          "website": "https://www.fleetwood.com.au/",
          "description": "At Fleetwood, we come together with a shared purpose: to make a positive difference wherever Australians live, work and explore. Established in 1964, we’ve been at the forefront of Australia’s modular construction and RV industries, delivering solutions that support growing communities. Guided by our values, we deliver innovative solutions that help people and businesses thrive.",
          "status": "active",
          "sortOrder": 40,
          "classificationSource": "employer",
          "sourceNotes": "Promoted from employment/position source fields.",
          "provenance": [
              {
                  "rawName": "Fleetwood Australia",
                  "normalizedName": "Fleetwood Australia",
                  "normalizedId": "fleetwood-australia",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "4beb6983-ee39-43f9-9ec2-61405ebe6389",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "fleetwood-australia-revit-draftsperson"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "place-laboratory",
          "slug": "place-laboratory",
          "name": "Place Laboratory",
          "logoPath": "./assets/logos/company-placelab-0.svg",
          "location": "Perth, WA",
          "website": "https://www.placelaboratory.com/",
          "description": "At PLACE Laboratory we believe that the public realm is the stage for life. When the public realm is designed well, the combinations and possibilities of life’s acts are infinite. The interplay between buildings and open space sets the stage. We do not advocate design for designs sake. We believe the role of the designer is to interpret the cultural underpinnings of a society and give life and meaning in three dimensions to the physical form of space. Spaces, which are engaging, meaningful, delightful, walkable, welcoming, attractive and vital. Places that exhibit the qualities of good design have great social, economic and environmental value. They bring positive tangible results that are increasingly being recognised by the urban development industry.",
          "status": "active",
          "sortOrder": 50,
          "classificationSource": "employer_and_studio",
          "sourceNotes": "Promoted from employment and project studio/company source fields.",
          "provenance": [
              {
                  "rawName": "Place Laboratory",
                  "normalizedName": "Place Laboratory",
                  "normalizedId": "place-laboratory",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "91185310-a4f5-422d-8420-4d590d590584",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "place-laboratory-drafstman"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              },
              {
                  "rawName": "Place Laboratory",
                  "normalizedName": "Place Laboratory",
                  "normalizedId": "place-laboratory",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "curtin-creative-quarter-misc-details",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "curtin-creative-quarter-misc-details"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "Place Laboratory",
                  "normalizedName": "Place Laboratory",
                  "normalizedId": "place-laboratory",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "cottesloe-beach-house-landscape-design",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "cottesloe-beach-house-landscape-design"
                  ],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "dc-design-studio",
          "slug": "dc-design-studio",
          "name": "DC Design Studio",
          "logoPath": "./assets/logos/company-dcdesignstudio-0.svg",
          "location": "Perth, WA",
          "website": "https://danielclancy.net",
          "description": "DC Design Studio is a boutique design documentation consultancy based in the Perth Central Business District. It offers a diverse range of design documentation solutions for any sized project. Whether you require a quick and simple 2D CAD Sketch for a custom part manufacture or a full scale discipline specific set of building plans, or even a simple Business card graphic or promotional banner, DC Design Studio utilizes a range of Industry standard software and computer hardware to achieve timely results",
          "status": "active",
          "sortOrder": 60,
          "classificationSource": "employer_and_studio",
          "sourceNotes": "Promoted from employment and project studio/company source fields.",
          "provenance": [
              {
                  "rawName": "DC Design Studio",
                  "normalizedName": "DC Design Studio",
                  "normalizedId": "dc-design-studio",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "b44da0e1-bdd9-49b1-8870-c44b4d0682d0",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "dc-design-studio-design-consultant"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              },
              {
                  "rawName": "DC Design Studio",
                  "normalizedName": "DC Design Studio",
                  "normalizedId": "dc-design-studio",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "proposed-boundary-re-alignment-of-lot-1-on-dp-d073414-234-jull-st-2c-armadale-6112",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "proposed-boundary-re-alignment-of-lot-1-on-dp-d073414-234-jull-st-2c-armadale-6112"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "DC Design Studio",
                  "normalizedName": "DC Design Studio",
                  "normalizedId": "dc-design-studio",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "lot-500-eighth-road-land-resumption",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "lot-500-eighth-road-land-resumption"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "DC Design Studio",
                  "normalizedName": "DC Design Studio",
                  "normalizedId": "dc-design-studio",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "spratt-residence-proposed-addition",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "spratt-residence-proposed-addition"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "DC Design Studio",
                  "normalizedName": "DC Design Studio",
                  "normalizedId": "dc-design-studio",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "wungong-urban-water-master-plan",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "wungong-urban-water-master-plan"
                  ],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "urbis",
          "slug": "urbis",
          "name": "Urbis",
          "logoPath": "./assets/logos/company-urbis-0.svg",
          "location": "Perth, WA",
          "website": "https://urbis.com.au/",
          "description": "Urbis is a professional consulting firm operating in Australia, Asia and the Middle East advising on the use, development, investment and governance of property, cities and communities. Urbis operates at the forefront of urban and societal change and provides multi-disciplinary capability through recruiting and retaining the most talented people providing collaborative professional services",
          "status": "active",
          "sortOrder": 70,
          "classificationSource": "employer_and_studio",
          "sourceNotes": "Promoted from employment and project studio/company source fields.",
          "provenance": [
              {
                  "rawName": "Urbis Pty Ltd",
                  "normalizedName": "Urbis",
                  "normalizedId": "urbis",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "df505d0e-9be8-466b-aa25-47af54808b32",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "urbis-drafting-technician"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              },
              {
                  "rawName": "Urbis",
                  "normalizedName": "Urbis",
                  "normalizedId": "urbis",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "cockburn-coast",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "cockburn-coast"
                  ],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "acce",
          "slug": "acce",
          "name": "ACCE",
          "logoPath": "./assets/logos/company-acce-0.svg",
          "location": "Como, WA",
          "website": "https://www.acce.net.au/",
          "description": "Since its establishment in 1980, Andreotta Cardenosa Consulting Engineers have been providing the construction industry with quality personal service and expertise in the structural discipline. The firm has extensive experience in residential, commercial, industrial and institutional structures, providing them with the ability to manage all projects with efficiency and precision",
          "status": "active",
          "sortOrder": 80,
          "classificationSource": "employer_and_studio",
          "sourceNotes": "Promoted from employment and project studio/company source fields.",
          "provenance": [
              {
                  "rawName": "ACCE Pty Ltd",
                  "normalizedName": "ACCE",
                  "normalizedId": "acce",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "ece6e62b-4bb0-4977-9d93-f355ecacc093",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "acce-structural-draftsman"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              },
              {
                  "rawName": "ACCE",
                  "normalizedName": "ACCE",
                  "normalizedId": "acce",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "proposed-retail-development-for-dawesville-iga",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "proposed-retail-development-for-dawesville-iga"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "ACCE",
                  "normalizedName": "ACCE",
                  "normalizedId": "acce",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "henry-street-residence-structural-documentation",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "henry-street-residence-structural-documentation"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "ACCE",
                  "normalizedName": "ACCE",
                  "normalizedId": "acce",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "lake-joondalup-baptist-college-new-arts-building-structural-plans",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "lake-joondalup-baptist-college-new-arts-building-structural-plans"
                  ],
                  "notes": ""
              },
              {
                  "rawName": "ACCE",
                  "normalizedName": "ACCE",
                  "normalizedId": "acce",
                  "classification": "studio",
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "geraldton-fire-station-structural-documentation",
                  "sourceField": "company",
                  "linkedPositionIds": [],
                  "linkedProjectIds": [
                      "geraldton-fire-station-structural-documentation"
                  ],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "ghd",
          "slug": "ghd",
          "name": "GHD",
          "logoPath": "./assets/logos/company-ghd-0.svg",
          "location": "Geraldton & Perth, WA",
          "website": "https://www.ghd.com/",
          "description": "GHD is a large, international professional services company providing a vast range of services all over the globe in property and buildings, energy and resources, mining and industry, water, transportation",
          "status": "active",
          "sortOrder": 90,
          "classificationSource": "employer",
          "sourceNotes": "Promoted from employment/position source fields.",
          "provenance": [
              {
                  "rawName": "GHD Pty Ltd",
                  "normalizedName": "GHD",
                  "normalizedId": "ghd",
                  "classification": "employer",
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "a53d41af-2258-44e7-987d-6437f7804d93",
                  "sourceField": "Company Name",
                  "linkedPositionIds": [
                      "ghd-draftsman"
                  ],
                  "linkedProjectIds": [],
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      }
  ];
  const CV_PLATFORM_SEED = [
      {
          "id": "autodesk-autocad",
          "slug": "autodesk-autocad",
          "name": "Autodesk AutoCAD",
          "vendor": "Autodesk",
          "company": "Autodesk",
          "logoPath": "./assets/logos/software-autocad.svg",
          "website": "",
          "description": "Software/platform value found in the public CV and/or WorkSet portfolio source.",
          "status": "active",
          "sortOrder": 10,
          "sourceNotes": "Canonical platform alias: Autodesk AutoCAD",
          "provenance": [
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Autodesk AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": ""
              },
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Autodesk AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": ""
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "proposed-retail-development-for-dawesville-iga",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "cue-roadhouse",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "redevelopment-of-highway-service-center-pheasants-nest-m31-north-and-south",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "proposed-boundary-re-alignment-of-lot-1-on-dp-d073414-234-jull-st-armadale-6112",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "curtin-creative-quarter-misc-details",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "lot-500-eighth-road-land-resumption",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "cockburn-coast",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "spratt-residence-proposed-addition",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "upss-homebush-nsw",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "wungong-urban-water-master-plan",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "upss-beacon-hill-nsw",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "henry-street-residence-structural-documentation",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "lake-joondalup-baptist-college-new-arts-building-structural-plans",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "cottesloe-beach-house-landscape-design",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "upss-wyoming-nsw",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "geraldton-fire-station-structural-documentation",
                  "sourceField": "softwarePlatform",
                  "rawValue": "AutoCAD",
                  "normalizedId": "autodesk-autocad",
                  "notes": "Canonical platform alias: Autodesk AutoCAD"
              }
          ],
          "updatedAt": "2026-06-18T12:37:45.837Z"
      },
      {
          "id": "autodesk-revit",
          "slug": "autodesk-revit",
          "name": "Autodesk Revit",
          "vendor": "Autodesk",
          "company": "Autodesk",
          "logoPath": "./assets/logos/software-revit.svg",
          "website": "",
          "description": "Software/platform value found in the public CV and/or WorkSet portfolio source.",
          "status": "active",
          "sortOrder": 20,
          "sourceNotes": "Canonical platform alias: Autodesk Revit",
          "provenance": [
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Autodesk Revit",
                  "normalizedId": "autodesk-revit",
                  "notes": ""
              },
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Autodesk Revit",
                  "normalizedId": "autodesk-revit",
                  "notes": ""
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "redevelopment-of-highway-service-center-pheasants-nest-m31-north-and-south",
                  "sourceField": "softwarePlatform",
                  "rawValue": "Revit",
                  "normalizedId": "autodesk-revit",
                  "notes": "Canonical platform alias: Autodesk Revit"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "curtin-creative-quarter-misc-details",
                  "sourceField": "softwarePlatform",
                  "rawValue": "Revit",
                  "normalizedId": "autodesk-revit",
                  "notes": "Canonical platform alias: Autodesk Revit"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "cottesloe-beach-house-landscape-design",
                  "sourceField": "softwarePlatform",
                  "rawValue": "Revit",
                  "normalizedId": "autodesk-revit",
                  "notes": "Canonical platform alias: Autodesk Revit"
              }
          ],
          "updatedAt": "2026-06-18T12:37:45.837Z"
      },
      {
          "id": "adobe-creative-cloud",
          "slug": "adobe-creative-cloud",
          "name": "Adobe Creative Cloud",
          "vendor": "Adobe",
          "company": "Adobe",
          "logoPath": "./assets/logos/software-creativecloud.svg",
          "website": "",
          "description": "Software/platform value listed by the public CV source.",
          "status": "active",
          "sortOrder": 30,
          "sourceNotes": "",
          "provenance": [
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Adobe Creative Cloud",
                  "normalizedId": "adobe-creative-cloud",
                  "notes": ""
              },
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Adobe Creative Cloud",
                  "normalizedId": "adobe-creative-cloud",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T12:37:45.837Z"
      },
      {
          "id": "trimble-sketchup",
          "slug": "trimble-sketchup",
          "name": "Trimble SketchUp",
          "vendor": "Trimble",
          "company": "Trimble",
          "logoPath": "./assets/logos/software-sketchup.svg",
          "website": "",
          "description": "Software/platform value found in the public CV and/or WorkSet portfolio source.",
          "status": "active",
          "sortOrder": 40,
          "sourceNotes": "Canonical platform alias: Trimble SketchUp",
          "provenance": [
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Trimble SketchUp",
                  "normalizedId": "trimble-sketchup",
                  "notes": ""
              },
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Trimble SketchUp",
                  "normalizedId": "trimble-sketchup",
                  "notes": ""
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "curtin-creative-quarter-misc-details",
                  "sourceField": "softwarePlatform",
                  "rawValue": "Sketchup",
                  "normalizedId": "trimble-sketchup",
                  "notes": "Canonical platform alias: Trimble SketchUp"
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "cottesloe-beach-house-landscape-design",
                  "sourceField": "softwarePlatform",
                  "rawValue": "Sketchup",
                  "normalizedId": "trimble-sketchup",
                  "notes": "Canonical platform alias: Trimble SketchUp"
              }
          ],
          "updatedAt": "2026-06-18T12:37:45.837Z"
      },
      {
          "id": "microsoft-office",
          "slug": "microsoft-office",
          "name": "Microsoft Office",
          "vendor": "Microsoft",
          "company": "Microsoft",
          "logoPath": "./assets/logos/software-office365.svg",
          "website": "",
          "description": "Software/platform value listed by the public CV source.",
          "status": "active",
          "sortOrder": 50,
          "sourceNotes": "",
          "provenance": [
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Microsoft Office",
                  "normalizedId": "microsoft-office",
                  "notes": ""
              },
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "Microsoft Office",
                  "normalizedId": "microsoft-office",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T12:37:45.837Z"
      },
      {
          "id": "qgis",
          "slug": "qgis",
          "name": "QGIS",
          "vendor": "QGIS",
          "company": "QGIS",
          "logoPath": "./assets/logos/software-qgis.svg",
          "website": "",
          "description": "Software/platform value found in the public CV and/or WorkSet portfolio source.",
          "status": "active",
          "sortOrder": 60,
          "sourceNotes": "",
          "provenance": [
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "QGIS",
                  "normalizedId": "qgis",
                  "notes": ""
              },
              {
                  "sourceFile": "src/content/siteContent.ts",
                  "sourceSection": "platformList",
                  "sourceField": "items[]",
                  "rawValue": "QGIS",
                  "normalizedId": "qgis",
                  "notes": ""
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "proposed-boundary-re-alignment-of-lot-1-on-dp-d073414-234-jull-st-armadale-6112",
                  "sourceField": "softwarePlatform",
                  "rawValue": "QGIS",
                  "normalizedId": "qgis",
                  "notes": ""
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "lot-500-eighth-road-land-resumption",
                  "sourceField": "softwarePlatform",
                  "rawValue": "QGIS",
                  "normalizedId": "qgis",
                  "notes": ""
              },
              {
                  "sourceFile": "cmsdata/wix/collection-tables/WorkSet.csv",
                  "sourceSection": "wungong-urban-water-master-plan",
                  "sourceField": "softwarePlatform",
                  "rawValue": "QGIS",
                  "normalizedId": "qgis",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T12:37:45.837Z"
      }
  ];
  const CV_POSITION_SEED = [
      {
          "id": "richmond-ross-revit-draftsperson-and-technician",
          "slug": "richmond-ross-revit-draftsperson-and-technician",
          "title": "Revit Draftsperson & Technician",
          "companyId": "richmond-ross",
          "companyName": "Richmond+Ross",
          "location": "Crows Nest, NSW",
          "startDate": "2019-10-01",
          "endDate": "2021-11-01",
          "current": false,
          "employmentType": "",
          "summary": "Richmond + Ross have over 30 years of experience in the design of retail facilities, including shopping centres, fast food, public domain, bulk fuel & retail, 5 star & tourism, institutional and industrial projects. The scale and type of retail developments range from simple 75m² standalone tenancies all the way through to 50,000+m²Regional Centres",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [
              "autodesk-revit"
          ],
          "projectIds": [],
          "status": "active",
          "sortOrder": 10,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "a646f50f-eeba-46ac-959f-e10e16ca89d9",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "Richmond+Ross | October 2019 – November 2021 | Revit Draftsperson & Technician",
                  "normalizedId": "richmond-ross-revit-draftsperson-and-technician",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "meriton-group-structural-revit-draftsman",
          "slug": "meriton-group-structural-revit-draftsman",
          "title": "Structural Revit Draftsman",
          "companyId": "meriton-group",
          "companyName": "Meriton Group",
          "location": "Sydney, NSW",
          "startDate": "2019-03-01",
          "endDate": "2019-05-01",
          "current": false,
          "employmentType": "",
          "summary": "Established in 1963, Meriton has made a significant impact on the Australian landscape. The private company has designed, developed and built more than 75,000 apartments and some of the tallest residential towers across the east coast of Australia. Meriton has spearheaded the apartment revolution with sophisticated, high-quality apartments. Its founder and managing director, billionaire property entrepreneur Harry Triguboff, is still passionately involved in the design and construction of all projects",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [
              "autodesk-revit"
          ],
          "projectIds": [],
          "status": "active",
          "sortOrder": 20,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "c8d8ca96-ae87-4224-a5fb-b634736bd304",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "Meriton Group | March 2019 – May 2019 | Structural Revit Draftsman",
                  "normalizedId": "meriton-group-structural-revit-draftsman",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "leffler-simes-architects-architectural-revit-draftsman",
          "slug": "leffler-simes-architects-architectural-revit-draftsman",
          "title": "Architectural Revit Draftsman",
          "companyId": "leffler-simes-architects",
          "companyName": "Leffler Simes Architects",
          "location": "Melbourne, VIC",
          "startDate": "2018-09-01",
          "endDate": "2018-11-01",
          "current": false,
          "employmentType": "",
          "summary": "Leffler Simes Architects (LSA) is well recognised as one of Australia’s leading architectural practices with offices in Sydney, Melbourne and Brisbane. Established in the late 1960s, Leffler Simes was at the forefront of the dramatic expansion of the retail sector throughout Australia and designed a majority of the large shopping centres built at this time. With a solid retail pedigree founded in the 1970s and 80s, Leffler Simes have maintained a role as a major retail practice since.",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [
              "autodesk-revit"
          ],
          "projectIds": [],
          "status": "active",
          "sortOrder": 30,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "a604cfa4-d498-4397-806f-d1ad3e574091",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "Leffler Simes Architects | September 2018 – November 2018 | Architectural Revit Draftsman",
                  "normalizedId": "leffler-simes-architects-architectural-revit-draftsman",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "fleetwood-australia-revit-draftsperson",
          "slug": "fleetwood-australia-revit-draftsperson",
          "title": "Revit Draftsperson",
          "companyId": "fleetwood-australia",
          "companyName": "Fleetwood Australia",
          "location": "Melbourne, VIC",
          "startDate": "2018-07-01",
          "endDate": "2018-08-01",
          "current": false,
          "employmentType": "",
          "summary": "At Fleetwood, we come together with a shared purpose: to make a positive difference wherever Australians live, work and explore. Established in 1964, we’ve been at the forefront of Australia’s modular construction and RV industries, delivering solutions that support growing communities. Guided by our values, we deliver innovative solutions that help people and businesses thrive.",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [
              "autodesk-revit"
          ],
          "projectIds": [],
          "status": "active",
          "sortOrder": 40,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "4beb6983-ee39-43f9-9ec2-61405ebe6389",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "Fleetwood Australia | July 2018 – August 2018 | Revit Draftsperson",
                  "normalizedId": "fleetwood-australia-revit-draftsperson",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "place-laboratory-drafstman",
          "slug": "place-laboratory-drafstman",
          "title": "Drafstman",
          "companyId": "place-laboratory",
          "companyName": "Place Laboratory",
          "location": "Perth, WA",
          "startDate": "2017-01-01",
          "endDate": "2018-01-01",
          "current": false,
          "employmentType": "",
          "summary": "At PLACE Laboratory we believe that the public realm is the stage for life. When the public realm is designed well, the combinations and possibilities of life’s acts are infinite. The interplay between buildings and open space sets the stage. We do not advocate design for designs sake. We believe the role of the designer is to interpret the cultural underpinnings of a society and give life and meaning in three dimensions to the physical form of space. Spaces, which are engaging, meaningful, delightful, walkable, welcoming, attractive and vital. Places that exhibit the qualities of good design have great social, economic and environmental value. They bring positive tangible results that are increasingly being recognised by the urban development industry.",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [],
          "projectIds": [],
          "status": "active",
          "sortOrder": 50,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "91185310-a4f5-422d-8420-4d590d590584",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "Place Laboratory | January 2017 – January 2018 | Drafstman",
                  "normalizedId": "place-laboratory-drafstman",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "dc-design-studio-design-consultant",
          "slug": "dc-design-studio-design-consultant",
          "title": "Design Consultant",
          "companyId": "dc-design-studio",
          "companyName": "DC Design Studio",
          "location": "Perth, WA",
          "startDate": "2015-06-01",
          "endDate": "2018-05-01",
          "current": false,
          "employmentType": "",
          "summary": "DC Design Studio is a boutique design documentation consultancy based in the Perth Central Business District. It offers a diverse range of design documentation solutions for any sized project. Whether you require a quick and simple 2D CAD Sketch for a custom part manufacture or a full scale discipline specific set of building plans, or even a simple Business card graphic or promotional banner, DC Design Studio utilizes a range of Industry standard software and computer hardware to achieve timely results",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [],
          "projectIds": [],
          "status": "active",
          "sortOrder": 60,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "b44da0e1-bdd9-49b1-8870-c44b4d0682d0",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "DC Design Studio | June 2015 – May 2018 | Design Consultant",
                  "normalizedId": "dc-design-studio-design-consultant",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "urbis-drafting-technician",
          "slug": "urbis-drafting-technician",
          "title": "Drafting Technician",
          "companyId": "urbis",
          "companyName": "Urbis",
          "location": "Perth, WA",
          "startDate": "2014-08-01",
          "endDate": "2015-06-01",
          "current": false,
          "employmentType": "",
          "summary": "Urbis is a professional consulting firm operating in Australia, Asia and the Middle East advising on the use, development, investment and governance of property, cities and communities. Urbis operates at the forefront of urban and societal change and provides multi-disciplinary capability through recruiting and retaining the most talented people providing collaborative professional services",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [],
          "projectIds": [],
          "status": "active",
          "sortOrder": 70,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "df505d0e-9be8-466b-aa25-47af54808b32",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "Urbis Pty Ltd | August 2014 – June 2015 | Drafting Technician",
                  "normalizedId": "urbis-drafting-technician",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "acce-structural-draftsman",
          "slug": "acce-structural-draftsman",
          "title": "Structural Draftsman",
          "companyId": "acce",
          "companyName": "ACCE",
          "location": "Como, WA",
          "startDate": "2012-01-01",
          "endDate": "2014-03-01",
          "current": false,
          "employmentType": "",
          "summary": "Since its establishment in 1980, Andreotta Cardenosa Consulting Engineers have been providing the construction industry with quality personal service and expertise in the structural discipline. The firm has extensive experience in residential, commercial, industrial and institutional structures, providing them with the ability to manage all projects with efficiency and precision",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [],
          "projectIds": [],
          "status": "active",
          "sortOrder": 80,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "ece6e62b-4bb0-4977-9d93-f355ecacc093",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "ACCE Pty Ltd | January 2012 – March 2014 | Structural Draftsman",
                  "normalizedId": "acce-structural-draftsman",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      },
      {
          "id": "ghd-draftsman",
          "slug": "ghd-draftsman",
          "title": "Draftsman",
          "companyId": "ghd",
          "companyName": "GHD",
          "location": "Geraldton & Perth, WA",
          "startDate": "2008-08-01",
          "endDate": "2011-11-01",
          "current": false,
          "employmentType": "",
          "summary": "GHD is a large, international professional services company providing a vast range of services all over the globe in property and buildings, energy and resources, mining and industry, water, transportation",
          "responsibilities": [],
          "highlights": [],
          "platformIds": [],
          "projectIds": [],
          "status": "active",
          "sortOrder": 90,
          "sourceNotes": "Derived from public Employment+History.csv; source values are preserved in provenance.",
          "provenance": [
              {
                  "sourceFile": "cmsdata/wix/collection-tables/Employment+History.csv",
                  "sourceSection": "a53d41af-2258-44e7-987d-6437f7804d93",
                  "sourceField": "Company Name/Employment Period/Employment Position/Company City (TXT)/CompanyProfile/Company URL",
                  "rawValue": "GHD Pty Ltd | August 2008 – November 2011 | Draftsman",
                  "normalizedId": "ghd-draftsman",
                  "notes": ""
              }
          ],
          "updatedAt": "2026-06-18T15:13:52.384Z"
      }
  ];
  const SOURCE_AUDIT_REGISTRY_RULES = {
    clientOnlyOrganizationIds: [
      "ampol-australia-petroleum-pty-ltd",
      "buchan-group",
      "c-and-j-spratt",
      "curtin-university",
      "dawesville-3-pty-ltd",
      "fesa-now-department-of-fire-and-emergency-services",
      "ktap-construction",
      "landcorp-now-developmentwa",
      "minderoo-foundation",
      "mra-now-developmentwa",
      "riley-consulting"
    ],
    employersFound: CV_COMPANY_SEED.map((item) => ({ normalizedId: item.id })),
    studiosFound: CV_COMPANY_SEED
      .filter((item) => String(item.classificationSource || "").includes("studio"))
      .map((item) => ({ normalizedId: item.id })),
    companiesPromotedToRegistry: CV_COMPANY_SEED.map((item) => ({ normalizedId: item.id }))
  };
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

  function platformRegistryId(value) {
    const id = createSlug(value);
    const aliases = {
      autocad: "autodesk-autocad",
      "autodesk-autocad": "autodesk-autocad",
      revit: "autodesk-revit",
      "autodesk-revit": "autodesk-revit",
      sketchup: "trimble-sketchup",
      "trimble-sketchup": "trimble-sketchup",
      "adobe-creative-cloud": "adobe-creative-cloud",
      "creative-cloud": "adobe-creative-cloud",
      "microsoft-office": "microsoft-office",
      "microsoft-office-365": "microsoft-office",
      office: "microsoft-office",
      qgis: "qgis"
    };
    return aliases[id] || id;
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
      const stored = unpackRegistryStorage(window.localStorage.getItem(storageKey) || "[]");
      const source = stored.overlay || stored.items || [];
      return Array.isArray(source) ? source.map(normalizeRegistryItem).filter((item) => item.id) : [];
    } catch {
      return [];
    }
  }

  function normalizeRegistryItem(raw = {}) {
    return reconcileNormalizeRegistryItem(raw);
  }

  function loadPositions() {
    const seed = CV_POSITION_SEED.map(normalizePosition);
    try {
      const stored = unpackRegistryStorage(window.localStorage.getItem(POSITIONS_STORAGE_KEY) || "[]");
      const source = stored.overlay || stored.items || [];
      const reconciled = reconcilePositionsCollection(seed, source, registryState.companies.items, (id) => registryLabel("companies", id));
      positionsState.reconciliation = {
        ...reconciled.meta,
        localDataRepaired: Boolean(stored.migratedFromLegacy || reconciled.meta.warnings.length || reconciled.meta.sourceRequiredRowsRestored)
      };
      return reconciled.items;
    } catch {
      return seed;
    }
  }

  function normalizePosition(raw = {}) {
    return normalizePositionRegistryItem(raw, (companyId) => registryLabel("companies", companyId));
  }

  function registryRules() {
    return {
      clientOnlyIds: extractClientOnlyIds(SOURCE_AUDIT_REGISTRY_RULES),
      requiredCompanyIds: extractRequiredCompanyIds(SOURCE_AUDIT_REGISTRY_RULES, CV_COMPANY_SEED)
    };
  }

  function reconcileRegistryItems(kind, storedItems = [], options = {}) {
    const { clientOnlyIds, requiredCompanyIds } = registryRules();
    const baseline = kind === "companies" ? CV_COMPANY_SEED : CV_PLATFORM_SEED;
    const result = reconcileRegistryCollection(kind, baseline, storedItems, {
      clientOnlyIds,
      requiredIds: kind === "companies" ? requiredCompanyIds : new Set(baseline.map((item) => item.id))
    });
    const meta = {
      ...result.meta,
      localDataRepaired: Boolean(
        options.localDataRepaired ||
          registryState[kind]?.reconciliation?.localDataRepaired ||
          result.meta.staleRowsExcluded ||
          result.meta.sourceRequiredRowsRestored
      ),
      staleRowsExcluded: Math.max(Number(registryState[kind]?.reconciliation?.staleRowsExcluded || 0), Number(result.meta.staleRowsExcluded || 0)),
      sourceRequiredRowsRestored: Math.max(
        Number(registryState[kind]?.reconciliation?.sourceRequiredRowsRestored || 0),
        Number(result.meta.sourceRequiredRowsRestored || 0)
      )
    };
    registryState[kind].items = result.items;
    registryState[kind].reconciliation = meta;
    return result;
  }

  function registryBaseline(kind) {
    if (kind === "companies") return CV_COMPANY_SEED;
    if (kind === "platforms") return CV_PLATFORM_SEED;
    if (kind === "positions") return CV_POSITION_SEED.map(normalizePosition);
    return [];
  }

  function registryStorageOptions(kind) {
    const { clientOnlyIds, requiredCompanyIds } = registryRules();
    if (kind === "companies") {
      return { baselineItems: CV_COMPANY_SEED, clientOnlyIds, requiredIds: requiredCompanyIds, updatedBy: currentAdminSession()?.email || "local-admin" };
    }
    if (kind === "platforms") {
      return { baselineItems: CV_PLATFORM_SEED, requiredIds: new Set(CV_PLATFORM_SEED.map((item) => item.id)), updatedBy: currentAdminSession()?.email || "local-admin" };
    }
    if (kind === "positions") {
      return { baselineItems: CV_POSITION_SEED.map(normalizePosition), companyLabelResolver: (id) => registryLabel("companies", id), updatedBy: currentAdminSession()?.email || "local-admin" };
    }
    return {};
  }

  function registryOverlayPayload(kind, rows, reconciliation = {}) {
    return registryStoragePayload(kind, rows, reconciliation, registryStorageOptions(kind));
  }

  function loadAndReconcileLocalRegistry(kind) {
    const config = registryConfig(kind);
    if (!config) return;
    let stored = { items: [], migratedFromLegacy: false };
    try {
      stored = unpackRegistryStorage(window.localStorage.getItem(config.storageKey) || "[]");
    } catch {
      stored = { items: [], migratedFromLegacy: true };
    }
    reconcileRegistryItems(kind, stored.overlay || stored.items, { localDataRepaired: stored.migratedFromLegacy });
    migrateRegistryStorage(kind);
  }

  function reconcilePositionsFromStorage() {
    positionsState.items = loadPositions();
    migratePositionsStorage();
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

  function migrateRegistryStorage(kind) {
    const config = registryConfig(kind);
    if (!config) return;
    try {
      window.localStorage.setItem(
        config.storageKey,
        JSON.stringify(registryOverlayPayload(kind, registryState[kind].items, registryState[kind].reconciliation), null, 2)
      );
      window.localStorage.setItem(REGISTRY_SCHEMA_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Registry cache migration is optional in file/static mode.
    }
  }

  function migratePositionsStorage() {
    try {
      window.localStorage.setItem(
        POSITIONS_STORAGE_KEY,
        JSON.stringify(registryOverlayPayload("positions", positionsState.items, positionsState.reconciliation), null, 2)
      );
      window.localStorage.setItem(REGISTRY_SCHEMA_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Registry cache migration is optional in file/static mode.
    }
  }

  function persistRegistryItems(kind) {
    const config = registryConfig(kind);
    if (!config) return;
    reconcileRegistryItems(kind, registryState[kind].items);
    try {
      window.localStorage.setItem(
        config.storageKey,
        JSON.stringify(registryOverlayPayload(kind, registryState[kind].items, registryState[kind].reconciliation), null, 2)
      );
    } catch {
      registryState[kind].message = `${config.label} saved in memory only because localStorage is unavailable.`;
    }
    persistCmsCollection(kind, registryState[kind].items);
  }

  function persistPositions() {
    const reconciled = reconcilePositionsCollection(CV_POSITION_SEED.map(normalizePosition), positionsState.items, registryState.companies.items, (id) => registryLabel("companies", id));
    positionsState.items = reconciled.items;
    positionsState.reconciliation = reconciled.meta;
    try {
      window.localStorage.setItem(
        POSITIONS_STORAGE_KEY,
        JSON.stringify(registryOverlayPayload("positions", positionsState.items, positionsState.reconciliation), null, 2)
      );
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
    const id = platformRegistryId(nameOrId);
    const item = (registryState.platforms.items || []).find((entry) => entry.id === id || entry.slug === id || createSlug(entry.name) === id);
    return item?.logoPath || platformLogoPath(nameOrId);
  }

  function seedRegistriesFromCvSource() {
    reconcileRegistryItems("companies", registryState.companies.items);
    reconcileRegistryItems("platforms", registryState.platforms.items);
  }

  function seedRegistriesFromProjects() {
    const companyById = new Map(registryState.companies.items.map((item) => [item.id, item]));
    const platformById = new Map(registryState.platforms.items.map((item) => [item.id, item]));
    projectState.projects.forEach((project) => {
      normalizeProjectRegistryRefs(project.studio || project.companyLabels || project.companyIds).forEach((name, index) => {
        const id = createSlug(name);
        if (!id || companyById.has(id)) return;
      });
      normalizeProjectRegistryRefs(project.software || project.platformLabels || project.platformIds).forEach((name, index) => {
        const id = platformRegistryId(name);
        if (!id || platformById.has(id)) return;
        platformById.set(id, normalizeRegistryItem({ id, name, status: "active", sortOrder: 100 + index, logoPath: platformLogoPath(name) }));
      });
    });
    reconcileRegistryItems("companies", Array.from(companyById.values()));
    reconcileRegistryItems("platforms", Array.from(platformById.values()));
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
    const id = kind === "platforms" ? platformRegistryId(value) : createSlug(value);
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

  function publishEndpoint() {
    return "/api/admin/publish/site-data";
  }

  function publicSiteDataEndpoint(revision = "") {
    return revision ? `${PUBLIC_SITE_DATA_URL}?rev=${encodeURIComponent(revision)}` : PUBLIC_SITE_DATA_URL;
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
          reconcileRegistryItems("companies", items);
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
          reconcileRegistryItems("platforms", items);
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
          const reconciled = reconcilePositionsCollection(CV_POSITION_SEED.map(normalizePosition), items.map(normalizePosition), registryState.companies.items, (id) => registryLabel("companies", id));
          positionsState.items = reconciled.items;
          positionsState.reconciliation = reconciled.meta;
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

  function registryReconciliationStatusMarkup(kind) {
    const meta = kind === "positions" ? positionsState.reconciliation : registryState[kind]?.reconciliation;
    if (!meta) return "";
    const stale = Number(meta.staleRowsExcluded || 0);
    const restored = Number(meta.sourceRequiredRowsRestored || 0);
    const repaired = Boolean(meta.localDataRepaired || stale || restored);
    if (!repaired && !(meta.warnings || []).length) return "";
    const summary = [
      repaired ? "Local registry data was reconciled against the source baseline." : "",
      stale ? `${stale} stale/client-only row(s) excluded.` : "",
      restored ? `${restored} source-required row(s) restored.` : "",
      ...(meta.warnings || []).slice(0, 2)
    ]
      .filter(Boolean)
      .join(" ");
    return `
      <div class="cms-storage-status" data-registry-reconciliation="${escapeHtml(kind)}">
        ${badge("Reconciled", "success")}
        <span>${escapeHtml(summary)}</span>
      </div>
    `;
  }

  function registryOverlayCountBadges(kind) {
    const meta = kind === "positions" ? positionsState.reconciliation : registryState[kind]?.reconciliation;
    const summary = meta?.overlaySummary || meta || {};
    const overrides = Number(meta?.overridesCount || summary.overridesCount || 0);
    const customRows = Number(meta?.customRowsCount || summary.customRowsCount || 0);
    const excludedRows = Number(meta?.excludedRowsCount || summary.excludedRowsCount || meta?.staleRowsExcluded || 0);
    return [badge(`${overrides} override(s)`, overrides ? "success" : "warn"), badge(`${customRows} custom`, customRows ? "success" : "warn"), badge(`${excludedRows} excluded`, excludedRows ? "warn" : "success")].join("");
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
      } else if (Array.isArray(payload.items) && (payload.source === "kv" || payload.meta?.reconciled || collection === "projects")) {
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
          JSON.stringify(
            collection === "projects"
              ? projectsStoragePayload()
              : registryOverlayPayload(collection, config.getItems(), config.state.reconciliation || payload.meta || {}),
            null,
            2
          )
        );
        if (["companies", "platforms", "positions"].includes(collection) && payload.meta) {
          config.state.reconciliation = {
            ...(config.state.reconciliation || {}),
            ...payload.meta,
            localDataRepaired: Boolean(payload.meta.staleRowsExcluded || payload.meta.sourceRequiredRowsRestored || payload.meta.warnings?.length)
          };
        }
        const repaired = payload.meta?.staleRowsExcluded || payload.meta?.sourceRequiredRowsRestored;
        markCmsStorage(
          collection,
          "connected",
          collection === "projects"
            ? "Loaded from protected public-site baseline with admin storage overlay."
            : repaired
              ? "Loaded from admin storage and reconciled against source baseline."
              : "Loaded from admin storage.",
          {
          source: payload.source || "kv",
          lastLoaded: payload.meta?.updatedAt || new Date().toISOString()
          }
        );
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

  function assetPreview(path, alt = "Selected asset preview", options = {}) {
    const value = String(path || "").trim();
    const variant = options.variant === "gallery" ? "gallery" : "field";
    const kind = String(options.kind || "");
    const constrained = variant === "gallery" || Boolean(kind);
    const cardClass = `asset-preview-card asset-preview-card--${variant}`;
    if (!value) {
      return constrained ? `<span class="${cardClass} asset-preview-placeholder">No asset selected</span>` : `<span class="asset-preview-placeholder">No asset selected</span>`;
    }
    if (/\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(value)) {
      if (!constrained) {
        return `<img src="${escapeHtml(adminAssetPreviewUrl(value))}" alt="${escapeHtml(alt)}" loading="lazy" />`;
      }
      return `
        <span class="${cardClass}">
          <span class="asset-preview-frame">
            <img class="asset-preview-image" src="${escapeHtml(adminAssetPreviewUrl(value))}" alt="${escapeHtml(alt)}" loading="lazy" />
          </span>
        </span>
      `;
    }
    const label = value.split("/").pop() || value;
    const isDocument = kind === "document_pdf" || /\.(pdf|docx?|xlsx?|pptx?)(\?.*)?$/i.test(value) || value.includes("/docs/");
    if (!constrained) {
      return `<span class="selected-file-indicator">${escapeHtml(label)}</span>`;
    }
    if (isDocument) {
      return `
        <span class="${cardClass} asset-preview-document">
          <span class="asset-preview-document-icon">${/\.pdf(\?.*)?$/i.test(value) ? "PDF" : "DOC"}</span>
          <span class="asset-preview-document-copy">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
          </span>
          <a class="asset-preview-open" href="${escapeHtml(adminAssetPreviewUrl(value))}" target="_blank" rel="noopener">Open</a>
        </span>
      `;
    }
    return `
      <span class="${cardClass}">
        <span class="selected-file-indicator">${escapeHtml(label)}</span>
      </span>
    `;
  }

  function adminAssetPreviewUrl(path) {
    const value = String(path || "").trim();
    if (!value) return "";
    if (/^(https?:|data:|blob:)/i.test(value)) return value;
    if (value.startsWith("/media/") || value.startsWith("/docs/")) return `./public${value}`;
    if (value.startsWith("media/") || value.startsWith("docs/")) return `./public/${value}`;
    if (/^[^/]+\.(png|jpe?g|webp|gif)$/i.test(value)) return `./public/media/portfolio/${value}`;
    return value;
  }

  async function persistCmsCollection(collection, renderAfter = false, force = false) {
    const config = getCmsConfig(collection);
    if (!config) return;
    const storage = config.state.storage;
    if (!force && (storage.status === "not-configured" || storage.status === "fallback")) {
      return;
    }
    if (["companies", "platforms", "positions"].includes(collection)) {
      try {
        window.localStorage.setItem(config.storageKey, JSON.stringify(registryOverlayPayload(collection, config.getItems(), config.state.reconciliation || {}), null, 2));
        window.localStorage.setItem(REGISTRY_SCHEMA_STORAGE_KEY, new Date().toISOString());
      } catch {
        // Local registry fallback is best-effort when browser storage is restricted.
      }
    }
    markCmsStorage(collection, "saving", "Saving to admin storage...");
    if (renderAfter && activePageIs(collection)) config.render();
    try {
      const response = await fetch(cmsEndpoint(collection), {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          collection === "projects"
            ? projectsStoragePayload()
            : ["companies", "platforms", "positions"].includes(collection)
              ? registryOverlayPayload(collection, config.getItems(), config.state.reconciliation || {})
              : { items: config.getItems() }
        )
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
        if (["companies", "platforms", "positions"].includes(collection) && Array.isArray(payload.items)) {
          config.setItems(payload.items);
          if (payload.meta) {
            config.state.reconciliation = {
              ...(config.state.reconciliation || {}),
              ...payload.meta,
              localDataRepaired: Boolean(payload.meta.staleRowsExcluded || payload.meta.sourceRequiredRowsRestored || payload.meta.warnings?.length)
            };
          }
          try {
            window.localStorage.setItem(config.storageKey, JSON.stringify(registryOverlayPayload(collection, config.getItems(), config.state.reconciliation || payload.meta || {}), null, 2));
          } catch {
            // The saved API result still updates in-memory rows when localStorage is unavailable.
          }
        }
        markCmsStorage(collection, "connected", "Saved to admin storage.", {
          source: payload.source || "kv",
          lastSaved: payload.meta?.updatedAt || new Date().toISOString()
        });
      }
    } catch {
      markCmsStorage(collection, "fallback", "No live admin API connected; saved locally only.", {
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
    updateSidebarApiStatus();
    if (renderAfter && activePageIs("overview")) renderOverview();
  }

  function updateSidebarApiStatus() {
    if (!sidebarStatusNote) return;
    const apiConnected = overviewStatusState.status === "connected" || analyticsStatusState.status === "connected";
    const authWorks = Boolean(window.DC_ADMIN_AUTH?.isAdmin);
    const analytics = analyticsStatusState.payload;
    const kvConnected = Boolean(
      analytics?.kvConnected ||
      analytics?.readiness?.dcAdminKvConfigured ||
      overviewStatusState.payload?.accounts?.configured ||
      Object.values(overviewStatusState.payload?.cms || {}).some((entry) => entry?.configured)
    );
    const dotTone = apiConnected && kvConnected ? "status-dot-success" : apiConnected ? "status-dot-warn" : "status-dot-warn";
    const text = apiConnected
      ? kvConnected
        ? analytics?.streamSuitesAnalyticsConnected
          ? "Live Admin API connected. StreamSuites analytics connected; DC_ADMIN_KV status available."
          : "Live Admin API connected. DC_ADMIN_KV/analytics status available."
        : analytics?.streamSuitesAnalyticsConnected
          ? "Live Admin API connected. StreamSuites analytics connected; durable KV bindings are incomplete."
          : "Live Admin API connected. Durable KV bindings are incomplete."
      : authWorks
        ? "Admin auth is active. Live Admin API status is still unavailable."
        : "Static/local fallback. No live admin API connected.";
    sidebarStatusNote.innerHTML = `<span class="status-dot ${dotTone}" aria-hidden="true"></span>${escapeHtml(text)}`;
  }

  async function hydrateAnalyticsStatus(renderAfter = false) {
    analyticsStatusState.status = "checking";
    analyticsStatusState.message = "Checking analytics status...";
    startTopbarLoader();
    if (renderAfter && activePageIs("analytics")) renderAnalytics();
    try {
      const selectedWindow = normalizeAnalyticsWindow(analyticsStatusState.selectedWindow);
      const response = await fetch(`${adminAnalyticsEndpoint()}?window=${encodeURIComponent(selectedWindow)}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        analyticsStatusState.status = "fallback";
        analyticsStatusState.message = payload?.error || `Analytics API unavailable (${response.status}).`;
        analyticsStatusState.payload = null;
      } else {
        const hasKvEvents = Number(payload?.pageVisits?.events || 0) > 0;
        analyticsStatusState.status = payload.configured || hasKvEvents ? "connected" : "not-configured";
        analyticsStatusState.message = payload.streamSuitesAnalyticsConnected
          ? "StreamSuites live DanielClancy analytics connected."
          : payload.streamSuitesAnalyticsConfigured
            ? "StreamSuites analytics configured but unavailable; local/Cloudflare fallback is active."
            : payload.configured
              ? `Cloudflare Analytics ${payload.cloudflare?.source?.includes("error") ? "returned an error" : "queried"}; page-visit storage is ${payload.pageVisits?.configured ? "connected" : "unavailable"}.`
              : hasKvEvents
                ? "Cloudflare analytics is not configured, but page-visit KV analytics are available."
                : "Cloudflare analytics not configured. No live analytics rows are shown until real source-tagged events exist.";
        analyticsStatusState.payload = payload;
        analyticsStatusState.selectedWindow = normalizeAnalyticsWindow(payload.window || selectedWindow);
        analyticsStatusState.lastChecked = payload.lastChecked || new Date().toISOString();
      }
    } catch {
      analyticsStatusState.status = "fallback";
      analyticsStatusState.message = "Pages Functions are unavailable here. Live analytics cannot be loaded.";
      analyticsStatusState.payload = null;
    } finally {
      stopTopbarLoader();
    }
    updateSidebarApiStatus();
    if (renderAfter && activePageIs("analytics")) renderAnalytics();
  }

  async function hydratePublishStatus(renderAfter = false) {
    publishState.status = "checking";
    publishState.message = "Checking public site-data publish status...";
    if (renderAfter && (activePageIs("overview") || activePageIs("settings") || isPublishCollectionPage())) render();
    try {
      const response = await fetch(publicSiteDataEndpoint(), { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `http_${response.status}`);
      }
      Object.assign(publishState, {
        status: payload.source === "published_kv_snapshot" ? "published" : payload.source === "live_reconciled_fallback" ? "fallback" : "static",
        source: payload.source || "unknown",
        revision: payload.revision || "",
        publishedAt: payload.publishedAt || "",
        generatedAt: payload.generatedAt || "",
        publicUrl: publicSiteDataEndpoint(payload.revision || ""),
        counts: payloadCounts(payload),
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
        message: publishStatusMessage(payload.source)
      });
    } catch {
      Object.assign(publishState, {
        status: "error",
        source: "unavailable",
        message: "Public site-data endpoint is unavailable; publish status cannot be confirmed.",
        warnings: ["public_site_data_status_unavailable"]
      });
    }
    if (renderAfter && (activePageIs("overview") || activePageIs("settings") || isPublishCollectionPage())) render();
  }

  async function publishSiteData() {
    if (!canPublishSiteData()) {
      publishState.status = "blocked";
      publishState.message = "Cannot publish: live Admin API/KV is unavailable. Current edits are local-only.";
      render();
      return;
    }
    publishState.status = "publishing";
    publishState.message = "Publishing sanitized public site-data snapshot...";
    render();
    try {
      const response = await fetch(publishEndpoint(), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" }
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || payload?.error || `http_${response.status}`);
      }
      Object.assign(publishState, {
        status: "published",
        source: payload.source || "published_kv_snapshot",
        revision: payload.revision || "",
        publishedAt: payload.publishedAt || new Date().toISOString(),
        generatedAt: payload.publishedAt || "",
        publicUrl: payload.publicUrl || publicSiteDataEndpoint(payload.revision || ""),
        counts: payload.counts || publishState.counts,
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
        message: "Published. Refresh the public site; redeploy Public only for env, fallback, rendering code, or asset changes."
      });
    } catch (error) {
      Object.assign(publishState, {
        status: "error",
        message: String(error?.message || "Publish failed. Save/Sync edits and confirm live Admin KV before retrying.")
      });
    }
    render();
  }

  function payloadCounts(payload = {}) {
    const collections = payload.collections || {};
    const assets = payload.assets || {};
    return {
      projects: Array.isArray(collections.projects) ? collections.projects.length : 0,
      companies: Array.isArray(collections.companies) ? collections.companies.length : 0,
      platforms: Array.isArray(collections.platforms) ? collections.platforms.length : 0,
      positions: Array.isArray(collections.positions) ? collections.positions.length : 0,
      assets:
        (Array.isArray(assets.portfolioThumbs) ? assets.portfolioThumbs.length : 0) +
        (Array.isArray(assets.portfolioImages) ? assets.portfolioImages.length : 0) +
        (Array.isArray(assets.docs) ? assets.docs.length : 0)
    };
  }

  function publishStatusMessage(source) {
    if (source === "published_kv_snapshot") return "Public endpoint is serving the latest published KV snapshot.";
    if (source === "live_reconciled_fallback") return "No published snapshot exists; public endpoint is building live reconciled fallback from Admin KV/baselines.";
    if (source === "baseline_fallback") return "No published snapshot or live KV data is available; public endpoint is serving static baseline fallback.";
    return "Public site-data source is unknown.";
  }

  function isPublishCollectionPage() {
    return ["projects", "companies", "platforms", "positions"].includes(parseRoute().page);
  }

  function canPublishSiteData() {
    return ["projects", "companies", "platforms", "positions"].every((collection) => getCmsConfig(collection)?.state.storage.status === "connected");
  }

  async function runAnalyticsAction(action, target = null) {
    if (action === "window") {
      analyticsStatusState.selectedWindow = normalizeAnalyticsWindow(target?.getAttribute("data-analytics-window"));
      await hydrateAnalyticsStatus(true);
      return;
    }
    if (action === "refresh") {
      await hydrateAnalyticsStatus(true);
      return;
    }
    if (action !== "purge-sample") return;
    if (!window.confirm("Purge sample/fallback/demo/mock/test and untagged legacy analytics rows? Source-tagged live rows will be kept.")) return;
    analyticsStatusState.status = "saving";
    analyticsStatusState.message = "Purging ignored analytics rows...";
    renderAnalytics();
    try {
      const response = await fetch(adminAnalyticsEndpoint(), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "purge_non_live_fallback_rows" })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.result?.ok) {
        analyticsStatusState.status = "fallback";
        analyticsStatusState.message = `Sample analytics purge failed: ${payload?.error || payload?.result?.error || response.status}`;
        renderAnalytics();
        return;
      }
      analyticsStatusState.message = `Purged ${payload.result.removed || 0} ignored analytics row(s).`;
      await hydrateAnalyticsStatus(true);
    } catch {
      analyticsStatusState.status = "fallback";
      analyticsStatusState.message = "Sample analytics purge failed because the Admin API is unavailable.";
      renderAnalytics();
    }
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

  function publishStatusPanel(compact = false) {
    const counts = publishState.counts || {};
    const sourceLabel =
      publishState.source === "published_kv_snapshot"
        ? "Published snapshot"
        : publishState.source === "live_reconciled_fallback"
          ? "Live reconciled fallback"
          : publishState.source === "baseline_fallback"
            ? "Static fallback"
            : publishState.source || "Unknown";
    const publishBlocked = !canPublishSiteData();
    const warningText = publishBlocked
      ? "Cannot publish: live Admin API/KV is unavailable. Current edits are local-only."
      : publishState.message;
    const body = `
      <div class="cms-storage-status">
        ${badge(sourceLabel, publishState.status === "published" ? "success" : "warn")}
        <span>${escapeHtml(warningText)}</span>
      </div>
      ${metricCards([
        { label: "Projects", value: String(counts.projects || 0), note: "Public projects in current site-data payload.", tone: counts.projects ? "success" : "warn" },
        { label: "Companies", value: String(counts.companies || 0), note: "Sanitized public company rows.", tone: counts.companies ? "success" : "warn" },
        { label: "Platforms", value: String(counts.platforms || 0), note: "Sanitized public platform rows.", tone: counts.platforms ? "success" : "warn" },
        { label: "Positions", value: String(counts.positions || 0), note: "Sanitized CV position rows.", tone: counts.positions ? "success" : "warn" },
        { label: "Assets", value: String(counts.assets || 0), note: "Cataloged thumbnails, images, and docs.", tone: counts.assets ? "success" : "warn" },
        { label: "Revision", value: publishState.revision || "None", note: publishState.publishedAt ? `Published ${formatOperationalTimestamp(publishState.publishedAt)}` : "No published timestamp.", tone: publishState.revision ? "success" : "warn" }
      ])}
      ${descriptionRows([
        ["Public endpoint", publishState.publicUrl || PUBLIC_SITE_DATA_URL],
        ["Generated at", formatOperationalTimestamp(publishState.generatedAt)],
        ["Warnings", publishState.warnings?.length ? publishState.warnings.join(", ") : "None reported"],
        ["Next step", "Save/Sync edits first, then Publish site data. Redeploy Public only for env, committed fallback, rendering code, or asset changes."]
      ])}
    `;
    return panel(
      compact ? "Public publish status" : "Publish to public site",
      "Publishing writes a sanitized snapshot for DanielClancy.net. Save/Sync remains separate from Publish.",
      body,
      `<button class="button" type="button" data-publish-action="publish" ${publishBlocked || publishState.status === "publishing" ? "disabled" : ""}>Publish site data</button>
       <button class="button button-secondary" type="button" data-publish-action="refresh">Refresh status</button>
       <a class="button button-secondary" href="#/settings">Rebuild manifests</a>`
    );
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
        const icon = `/assets/icons/ui/${route.icon || route.fallbackIcon || "dashboard.svg"}`;
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

        ${publishStatusPanel()}

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
    if (text.includes("cloudflare") || text.includes("page_visit") || text.includes("streamsuites")) return "success";
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

  const ANALYTICS_WINDOWS = Object.freeze([
    ["5m", "5M"],
    ["15m", "15M"],
    ["1h", "1H"],
    ["24h", "24HRS"]
  ]);

  function normalizeAnalyticsWindow(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return ANALYTICS_WINDOWS.some(([key]) => key === normalized) ? normalized : "5m";
  }

  function analyticsWindowLabel(value) {
    const normalized = normalizeAnalyticsWindow(value);
    return ANALYTICS_WINDOWS.find(([key]) => key === normalized)?.[1] || "5M";
  }

  function countryCode(value) {
    const text = String(value || "").trim().toUpperCase();
    if (text === "UK") return "GB";
    if (/^[A-Z]{2}$/.test(text)) return text;
    const lookup = {
      AUSTRALIA: "AU",
      BRAZIL: "BR",
      CANADA: "CA",
      FRANCE: "FR",
      GERMANY: "DE",
      INDIA: "IN",
      JAPAN: "JP",
      "SOUTH AFRICA": "ZA",
      "UNITED STATES": "US",
      "UNITED STATES OF AMERICA": "US",
      USA: "US",
      "UNITED KINGDOM": "GB",
      "GREAT BRITAIN": "GB",
      "NEW ZEALAND": "NZ"
    };
    return lookup[text] || "";
  }

  function getCountryFlagPath(countryCodeValue) {
    const code = countryCode(countryCodeValue);
    return code ? `/assets/icons/flags/${code.toLowerCase()}.svg` : "/assets/icons/flags/_fallback.svg";
  }

  function flagPath(row) {
    return getCountryFlagPath(row?.country_code || row?.countryCode || row?.country);
  }

  function flagIcon(row, label = "") {
    const text = label || row?.country || row?.country_code || "Country unavailable";
    return `<img class="country-flag" src="${escapeHtml(flagPath(row))}" alt="" loading="lazy" decoding="async" /><span>${escapeHtml(text)}</span>`;
  }

  function locationChip(row, text) {
    return `<span class="location-chip">${flagIcon(row, text)}</span>`;
  }

  function plainLocationText(value, fallback = "") {
    return `<span class="location-text">${escapeHtml(value || fallback || "")}</span>`;
  }

  function requestCount(row) {
    const value = row?.requests ?? row?.count ?? row?.events ?? row?.visits ?? null;
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
  }

  function sessionCount(row) {
    const value = row?.sessions;
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
  }

  function formatAnalyticsMetric(value) {
    return value === null || value === undefined ? "n/a" : formatAnalyticsNumber(value);
  }

  function sourceLabel(source) {
    const labels = {
      page_visit_kv: "Page-visit KV",
      cloudflare_graphql: "Cloudflare GraphQL",
      streamsuites_event_mirror: "StreamSuites mirror",
      streamsuites_live: "StreamSuites live",
      streamsuites_configured: "StreamSuites configured",
      streamsuites_connected: "StreamSuites connected",
      sample_fallback: "Sample fallback",
      stale_unverified: "Stale ignored"
    };
    return labels[source] || source || "Unavailable";
  }

  function resizeAnalyticsMap() {
    resizeAnalyticsMapModule();
  }

  function syncAnalyticsLocationMap(status, liveLocationRows) {
    const container = document.getElementById("analytics-location-map");
    if (!container) return;
    const selectedWindow = normalizeAnalyticsWindow(status?.window || analyticsStatusState.selectedWindow);
    initAnalyticsMap(container, {
      emptyElement: document.getElementById("analytics-location-map-empty"),
      feedbackElement: document.getElementById("analytics-location-map-feedback"),
      maplibregl: window.maplibregl,
      selectedWindow,
      windowLabel: analyticsWindowLabel(selectedWindow)
    });
    updateAnalyticsMap({
      rows: liveLocationRows,
      selectedWindow,
      windowLabel: analyticsWindowLabel(selectedWindow),
      hasEvents: Number(status?.pageVisits?.events || status?.location?.events || 0) > 0,
      emptyText: "No live page-visit location events captured for this window.",
      unmappedText: "Live location rows do not have verified coordinates yet."
    });
  }

  function detachAnalyticsMapContainerForRender() {
    const container = document.getElementById("analytics-location-map");
    const debug = window.DC_ADMIN_ANALYTICS_MAP_DEBUG;
    if (!container || !debug?.map) return null;
    container.remove();
    return container;
  }

  function restoreAnalyticsMapContainerAfterRender(preservedContainer) {
    if (!preservedContainer) return;
    const placeholder = document.getElementById("analytics-location-map");
    if (!placeholder || placeholder === preservedContainer) return;
    placeholder.replaceWith(preservedContainer);
  }

  function renderLocationMap(status, liveCities, liveCountries, liveLocationRows) {
    const pageVisits = status?.pageVisits || {};
    const location = status?.location || {};
    const featureCollection = buildLocationFeatures(liveLocationRows, {
      selectedWindow: normalizeAnalyticsWindow(status?.window || analyticsStatusState.selectedWindow)
    });
    const cityDetailCount = Number(pageVisits.cityEvents || liveCities.length || 0);
    const countryOnlyCount = Number(pageVisits.countryOnlyEvents || 0);
    const plottedLocationCount = featureCollection.features.length;
    const unmappedLocationCount = featureCollection.metadata?.unmappedRows?.length || 0;
    const hasEvents = Number(pageVisits.events || location.events || 0) > 0;
    const source = location.source || (hasEvents ? "page_visit_kv" : "unavailable");
    return `
      <section class="panel">
        <header class="panel-header">
          <div>
            <h2>Live Location Map</h2>
            <p>${escapeHtml(hasEvents ? "Real interactive MapLibre map. Live page-visit and Cloudflare location rows only." : "No live page-visit location events captured for this window.")}</p>
          </div>
          <div class="panel-actions">
            ${badge(`Source: ${source}`, sourceTone(source))}
            ${badge(location.freshnessState || status?.sourceFreshnessState || "no_live_events", sourceTone(location.freshnessState || status?.sourceFreshnessState))}
            ${badge(location.precision || (liveCities.length ? "city" : liveCountries.length ? "country" : "unavailable"), liveCities.length ? "success" : "warn")}
          </div>
        </header>
        <div class="panel-body">
          <div class="location-metrics">
            ${storageStatusCard("Tracked events", formatAnalyticsNumber(pageVisits.events || 0), "Bounded page_visit KV events.", pageVisits.configured ? "success" : "warn")}
            ${storageStatusCard("City detail", formatAnalyticsNumber(cityDetailCount), "Rows with city-level precision.", cityDetailCount ? "success" : "warn")}
            ${storageStatusCard("Country-only", formatAnalyticsNumber(countryOnlyCount), "Rows with country but no city.", countryOnlyCount ? "warn" : "success")}
            ${storageStatusCard("Mapped markers", formatAnalyticsNumber(plottedLocationCount), "Rows with source or verified lookup coordinates.", plottedLocationCount ? "success" : "warn")}
            ${storageStatusCard("Unmapped rows", formatAnalyticsNumber(unmappedLocationCount), "Rows without verified coordinates.", unmappedLocationCount ? "warn" : "success")}
            ${storageStatusCard("Last live event", formatOperationalTimestamp(pageVisits.lastLiveEventTime || location.lastUpdated), "Periodic refresh; not realtime.", pageVisits.lastLiveEventTime ? "success" : "warn")}
          </div>
          <div class="analytics-map-shell">
            <div id="analytics-location-map" class="analytics-location-map" aria-label="Interactive live analytics location map"></div>
            <div id="analytics-location-map-empty" class="analytics-map-empty" ${hasEvents ? "hidden" : ""}>No live page-visit location events captured for this window.</div>
            <div id="analytics-location-map-feedback" class="analytics-map-feedback" aria-live="polite"></div>
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
    const statusSourceLabel = status?.source || (analyticsStatusState.status === "fallback" ? "local_function_unavailable" : "checking");
    const cloudflare = status?.cloudflare || {};
    const pageVisits = status?.pageVisits || {};
    const readiness = status?.readiness || {};
    const totals = status?.totals || {};
    const selectedWindow = normalizeAnalyticsWindow(status?.window || analyticsStatusState.selectedWindow);
    const selectedWindowLabel = analyticsWindowLabel(selectedWindow);
    const liveTopPages = hasRows(status?.topPages) ? status.topPages : [];
    const liveReferrers = hasRows(status?.referrers) ? status.referrers : [];
    const liveCities = hasRows(status?.cities) ? status.cities : [];
    const liveCountries = hasRows(status?.countries) ? status.countries : [];
    const liveBrowsers = hasRows(status?.browsers) ? status.browsers : [];
    const liveDevices = hasRows(status?.devices) ? status.devices : [];
    const liveLocationRows = hasRows(status?.location?.liveLocationRows) ? status.location.liveLocationRows : [...liveCities, ...liveCountries];
    const hasLiveRows = hasRows(liveTopPages) || hasRows(liveReferrers) || hasRows(liveCities) || hasRows(liveCountries) || hasRows(liveBrowsers) || hasRows(liveDevices);
    const cityUnavailable = !liveCities.some((row) => row.precision === "city" && row.city);
    const sampleGeoRows = data.analytics.geoRows || [];
    const sampleRouteRows = data.analytics.routeRows || [];
    const sampleRows = pageVisits.sampleRows || status?.location?.sampleRows || [];
    const staleRows = pageVisits.staleRows || status?.location?.staleRows || [];
    const sourceBreakdown = status?.sourceBreakdown || {};
    const warnings = Array.isArray(status?.warnings) ? status.warnings : [];
    const preservedAnalyticsMapContainer = detachAnalyticsMapContainerForRender();
    const operationalRows = [
      ["Admin API", status?.adminApiConnected ? "Connected" : analyticsStatusState.status === "fallback" ? "Disconnected" : "Checking"],
      ["StreamSuites analytics", status?.streamSuitesAnalyticsConnected ? "Connected" : status?.streamSuitesAnalyticsConfigured ? "Configured with errors" : "Not configured"],
      ["DC_ADMIN_KV", status?.kvConnected ? "Connected" : "Unavailable"],
      ["Analytics ingest", status?.analyticsIngestConfigured ? "Configured" : "Unavailable"],
      ["Cloudflare GraphQL", status?.cloudflareGraphqlConnected ? "Connected" : configured ? "Configured with errors/partial data" : "Unavailable"],
      ["Cloudflare configured", configured ? "Yes" : "No"],
      ["Selected window", selectedWindowLabel],
      ["Page-visit KV", pageVisits.configured ? "Connected" : "Unavailable"],
      ["Source", statusSourceLabel],
      ["Freshness", status?.sourceFreshnessState || "no_live_events"],
      ["Last refreshed", formatOperationalTimestamp(status?.lastChecked || analyticsStatusState.lastChecked)],
      ["Last live page-visit event", formatOperationalTimestamp(status?.lastLivePageVisitEventTime || pageVisits.lastLiveEventTime)],
      ["Last Cloudflare GraphQL query", formatOperationalTimestamp(status?.lastCloudflareQueryTime || cloudflare.lastQueryTime)],
      ["Cloudflare result", cloudflare.lastResult || "Not checked"],
      ["Page-visit storage", pageVisits.storage?.lastResult || "Not checked"],
      ["Live rows", String(status?.liveRowsCount ?? liveLocationRows.length)],
      ["Sample/fallback rows isolated", String(sampleRows.length || 0)],
      ["Stale untagged rows held out", String(staleRows.length || 0)]
    ];
    app.innerHTML = `
      <div class="page">
        ${pageHeader(
          "Analytics",
          "Analytics",
          `StreamSuites live analytics, Admin KV, and Cloudflare metrics are separated by source for the selected ${selectedWindowLabel} window.`,
          `${badge(status?.streamSuitesAnalyticsConnected ? "StreamSuites analytics connected" : status?.streamSuitesAnalyticsConfigured ? "StreamSuites analytics error" : "StreamSuites analytics not configured", status?.streamSuitesAnalyticsConnected ? "success" : "warn")}
           ${badge(configured ? "Cloudflare Analytics connected" : "Cloudflare Analytics missing config", configured ? "success" : "warn")}
           ${badge(pageVisits.configured ? "Page-visit KV connected" : "Page-visit KV unavailable", pageVisits.configured ? "success" : "warn")}
           ${badge(`Freshness: ${status?.sourceFreshnessState || "no_live_events"}`, sourceTone(status?.sourceFreshnessState))}
           <div class="analytics-window-selector" role="group" aria-label="Analytics time window">
             ${ANALYTICS_WINDOWS.map(([value, label]) => `<button class="button button-secondary analytics-window-button${value === selectedWindow ? " is-active" : ""}" type="button" data-analytics-action="window" data-analytics-window="${escapeHtml(value)}" aria-pressed="${value === selectedWindow ? "true" : "false"}">${escapeHtml(label)}</button>`).join("")}
           </div>
           <button class="button" type="button" data-analytics-action="refresh">Refresh analytics</button>
           <button class="button button-secondary" type="button" data-analytics-action="purge-sample">Purge ignored analytics rows</button>`
        )}

        ${warnings.length || sampleRows.length || staleRows.length
          ? `<div class="analytics-warning-strip" role="status">
              ${staleRows.length ? badge("Stale analytics rows ignored.", "warn") : ""}
              ${sampleRows.length ? badge("Sample analytics rows ignored.", "warn") : ""}
              ${warnings.map((warning) => badge(warning, "warn")).join("")}
            </div>`
          : ""}

        ${panel(
          "Source status",
          analyticsStatusState.message,
          `<div class="grid grid-2">
            ${storageStatusCard("StreamSuites live", status?.streamSuitesAnalyticsConnected ? "Connected" : status?.streamSuitesAnalyticsConfigured ? "Error" : "Not configured", status?.streamSuitesAnalyticsConnected ? `${formatAnalyticsNumber(status?.streamSuitesAnalytics?.rowCount || 0)} DanielClancy row(s) from StreamSuites.` : status?.streamSuitesAnalyticsConfigured ? "Configured but unavailable; local fallbacks are secondary." : "STREAMSUITES_ANALYTICS_URL is not configured.", status?.streamSuitesAnalyticsConnected ? "success" : "warn")}
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

        ${renderLocationMap(status, liveCities, liveCountries, liveLocationRows)}

        <section class="grid analytics-grid">
          ${panel(
            "Location breakdown",
            cityUnavailable ? (pageVisits.emptyMessage || "City detail unavailable from current data source") : "City rows are sourced from page-visit KV request geo metadata when available.",
            analyticsTable(
              ["City", "Region", "Country", "Sessions", "Requests", "Precision", "Source", "Last seen"],
              liveCities,
              (row) => `
                <tr>
                  <td><strong>${plainLocationText(row.city || "City detail unavailable from current data source")}</strong></td>
                  <td>${row.region ? plainLocationText(row.region) : ""}</td>
                  <td>${locationChip(row, row.country || row.country_code || "Unavailable")}</td>
                  <td>${escapeHtml(formatAnalyticsMetric(sessionCount(row)))}</td>
                  <td>${escapeHtml(formatAnalyticsMetric(requestCount(row)))}</td>
                  <td>${badge(row.precision || "unavailable", row.precision === "city" ? "success" : "warn")}</td>
                  <td>${badge(row.source || "unavailable", sourceTone(row.source))}</td>
                  <td>${escapeHtml(formatOperationalTimestamp(row.lastSeen || row.recordedAt || row.timestamp || ""))}</td>
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
              <article class="card">${badge(readiness.streamSuitesAnalyticsConfigured ? "Configured" : "Missing", readiness.streamSuitesAnalyticsConfigured ? "success" : "warn")}<p><strong>STREAMSUITES_ANALYTICS_URL</strong></p></article>
              <article class="card">${badge(status?.streamSuitesAnalyticsConnected ? "Connected" : "Disconnected", status?.streamSuitesAnalyticsConnected ? "success" : "warn")}<p><strong>StreamSuites live source</strong></p></article>
              <article class="card">${badge(readiness.dcAdminKvConfigured ? "Configured" : "Missing", readiness.dcAdminKvConfigured ? "success" : "warn")}<p><strong>DC_ADMIN_KV</strong></p></article>
              <article class="card">${badge(status?.analyticsIngestConfigured ? "Configured" : "Missing", status?.analyticsIngestConfigured ? "success" : "warn")}<p><strong>Analytics ingest</strong></p></article>
              <article class="card">${badge("Cloudflare result", sourceTone(readiness.lastCloudflareQueryResult))}<p>${escapeHtml(readiness.lastCloudflareQueryResult || "Not checked")}</p></article>
              <article class="card">${badge("Page-visit result", sourceTone(readiness.lastPageVisitStorageResult))}<p>${escapeHtml(readiness.lastPageVisitStorageResult || "Not checked")}</p></article>
              ${Object.entries(status?.partialStatus || {}).map(([key, value]) => `<article class="card">${badge(value, sourceTone(value))}<p>${escapeHtml(key)}</p></article>`).join("")}
              ${(status?.notes || data.analytics.notes)
                .map((note) => `<article class="card">${badge("Note", "warn")}<p>${escapeHtml(note)}</p></article>`)
                .join("")}
            </div>`
          )}
        </section>

        <section class="grid analytics-grid">
          ${panel(
            "Source breakdown",
            "Only source-tagged current live rows are eligible for the map and live tables.",
            `<div class="grid grid-2">
              ${Object.entries({
                streamsuites_live: sourceBreakdown.streamsuites_live || 0,
                page_visit_kv: sourceBreakdown.page_visit_kv || 0,
                streamsuites_event_mirror: sourceBreakdown.streamsuites_event_mirror || 0,
                cloudflare_graphql: sourceBreakdown.cloudflare_graphql || 0,
                sample_fallback: sourceBreakdown.sample_fallback || 0,
                stale_legacy: sourceBreakdown.stale_legacy || 0
              }).map(([source, count]) => storageStatusCard(sourceLabel(source), formatAnalyticsNumber(count), source === "sample_fallback" || source === "stale_legacy" ? "Ignored; not shown as live." : "Eligible only when live and inside the selected window.", count && source !== "sample_fallback" && source !== "stale_legacy" ? "success" : "warn")).join("")}
            </div>`
          )}
          ${panel(
            "Live window",
            "Rows outside the selected window stay out of live rendering.",
            descriptionRows([
              ["Selected window", selectedWindowLabel],
              ["Last live event", formatOperationalTimestamp(status?.lastLiveEventAt || pageVisits.lastLiveEventTime)],
              ["Live rows", String(status?.liveRowsCount ?? liveLocationRows.length)],
              ["Repair action", status?.repairActionsAvailable?.purgeNonLiveFallbackRows ? "Available for ignored rows" : "Unavailable without Admin KV"]
            ])
          )}
        </section>

        <section class="grid analytics-grid">
          ${panel(
            "Country precision",
            hasRows(liveCountries) ? "Country-only rows remain labelled as country precision." : "No country precision rows available.",
            analyticsTable(
              ["Country", "Visits/Events", "Precision", "Source"],
              liveCountries,
              (row) => `<tr><td><strong class="country-cell">${flagIcon(row, row.country || row.country_code || "Unavailable")}</strong></td><td>${escapeHtml(formatAnalyticsNumber(metricValue(row)))}</td><td>${badge(row.precision || "country", "warn")}</td><td>${badge(row.source || "unavailable", sourceTone(row.source))}</td></tr>`,
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

        ${!hasLiveRows || sampleRows.length || staleRows.length
          ? panel(
              "Ignored analytics rows",
              "Sample/stale rows are diagnostics only — not live analytics",
              `<details class="demo-fallback">
                <summary>Show isolated demo/stale rows</summary>
                <p>These rows are excluded from the live map, tables, cards, and live totals.</p>
                <div class="table-wrap">
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
                    ${sampleRows
                      .map((row) => `<tr><td><strong>${escapeHtml(row.city || row.country || row.page_path || row.eventId || "Sample row")}</strong></td><td>${escapeHtml(row.precision || "sample")}</td><td>${escapeHtml(row.recordedAt || row.timestamp || "")}</td><td>${escapeHtml(row.source || "sample_fallback")}</td></tr>`)
                      .join("")}
                    ${staleRows
                      .map((row) => `<tr><td><strong>${escapeHtml(row.city || row.country || row.page_path || row.eventId || "Stale row")}</strong></td><td>${escapeHtml(row.precision || "stale")}</td><td>${escapeHtml(row.recordedAt || row.timestamp || "")}</td><td>stale_unverified</td></tr>`)
                      .join("")}
                  </tbody>
                </table>
              </div>
              </details>`
            )
          : ""}
      </div>
    `;
    restoreAnalyticsMapContainerAfterRender(preservedAnalyticsMapContainer);
    syncAnalyticsLocationMap(status, liveLocationRows);
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
          "Loaded from protected public-site baseline with admin storage overlay. Save/Sync writes Admin KV; Publish site data promotes saved edits to DanielClancy.net.",
          `<button class="button" type="button" data-project-action="create">Create Project</button>
           <button class="button button-secondary" type="button" data-project-action="copy-json">Copy JSON</button>
           <button class="button button-secondary" type="button" data-project-action="import-json">Import JSON</button>
           <button class="button button-secondary" type="button" data-project-action="reconcile">Reconcile with public site baseline</button>
           <button class="button button-secondary" type="button" data-project-action="reset">Reset baseline</button>`
        )}

        ${cmsStatusMarkup("projects", "project-action")}
        ${publishStatusPanel(true)}

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
           <button class="button button-secondary" type="button" data-registry-action="sync-cms" data-registry-kind="${kind}">Sync/save registry</button>
           <button class="button button-secondary" type="button" data-registry-action="repair-cache" data-registry-kind="${kind}">Reconcile / repair local registry cache</button>
           <button class="button button-secondary" type="button" data-registry-action="reset-cache" data-registry-kind="${kind}">Reset local registry cache</button>`
        )}
        <div class="cms-storage-status">
          ${badge(cmsStatusText(state.storage), cmsStatusTone(state.storage))}
          <span>${escapeHtml(state.storage.message || state.message)}</span>
        </div>
        ${publishStatusPanel(true)}
        ${registryReconciliationStatusMarkup(kind)}
        ${panel(
          `${config.label} options`,
          "Archived rows are retained for compatibility but hidden from the Projects editor selectors.",
          `<div class="cms-toolbar">
            <label class="field field-wide"><span>Search</span><input class="input" type="search" data-registry-filter="${kind}" value="${escapeHtml(state.search)}" placeholder="Name, ID, logo path, website" /></label>
            <div class="cms-toolbar-summary">${badge(`${items.length} visible`, "warn")}${badge(`${activeRegistryItems(kind).length} active`, "success")}${registryOverlayCountBadges(kind)}</div>
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
           <button class="button button-secondary" type="button" data-position-action="sync-cms">Sync/save positions</button>
           <button class="button button-secondary" type="button" data-position-action="repair-cache">Reconcile / repair local registry cache</button>
           <button class="button button-secondary" type="button" data-registry-action="reset-cache" data-registry-kind="positions">Reset local registry cache</button>`
        )}
        <div class="cms-storage-status">
          ${badge(cmsStatusText(positionsState.storage), cmsStatusTone(positionsState.storage))}
          <span>${escapeHtml(positionsState.storage.message || positionsState.message)}</span>
        </div>
        ${publishStatusPanel(true)}
        ${registryReconciliationStatusMarkup("positions")}
        ${panel(
          "Position records",
          "Archive keeps records available for compatibility while hiding them from the active view.",
          `<div class="cms-toolbar">
            <label class="field"><span>Search</span><input class="input" type="search" data-position-filter="search" value="${escapeHtml(positionsState.search)}" placeholder="Title, company, location, summary" /></label>
            <label class="field"><span>Status</span><select class="input" data-position-filter="status"><option value="all"${positionsState.status === "all" ? " selected" : ""}>All statuses</option><option value="active"${positionsState.status === "active" ? " selected" : ""}>active</option><option value="archived"${positionsState.status === "archived" ? " selected" : ""}>archived</option></select></label>
            <div class="cms-toolbar-summary">${badge(`${visible.length} visible`, "warn")}${badge(`${positionsState.items.filter((item) => item.status !== "archived").length} active`, "success")}${registryOverlayCountBadges("positions")}</div>
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
      <tr>
        <td><strong>${escapeHtml(item.title)}</strong><br><span>${escapeHtml(item.summary || "No summary recorded")}</span><br>${sourceBadge(item)}</td>
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
        <td><strong>${escapeHtml(item.name)}</strong><br><span>${escapeHtml(item.description || item.details || "No details recorded")}</span><br>${sourceBadge(item)}</td>
        <td><code>${escapeHtml(item.id)}</code></td>
        <td>${badge(item.status, item.status === "active" ? "success" : "warn")}</td>
        <td><div class="registry-logo-cell">${logo}<span>${escapeHtml(kind === "companies" ? item.location : item.vendor || item.company || "")}</span></div></td>
        <td>${item.website ? `<a class="path-text" href="${escapeHtml(item.website)}" rel="noreferrer">${escapeHtml(item.website)}</a>` : `<span class="muted">Not recorded</span>`}</td>
        <td>${escapeHtml(formatTimestamp(item.updatedAt))}</td>
        <td><div class="row-actions">
          <button class="button button-secondary" type="button" data-registry-action="edit" data-registry-kind="${kind}" data-registry-id="${escapeHtml(item.id)}">Edit</button>
          <button class="button button-danger" type="button" data-registry-action="archive" data-registry-kind="${kind}" data-registry-id="${escapeHtml(item.id)}">${item.status === "archived" ? "Activate" : "Archive"}</button>
          <button class="button button-danger" type="button" data-registry-action="delete" data-registry-kind="${kind}" data-registry-id="${escapeHtml(item.id)}">Delete</button>
        </div></td>
      </tr>
    `;
  }

  function sourceBadge(item) {
    if (item?.status === "excluded") return badge("Excluded/stale", "warn");
    if (item?.registryOrigin === "source_override") return badge("Source override", "success");
    if (item?.registryOrigin === "custom" || item?.source === "admin_created") return badge("Custom", "warn");
    if (item?.status === "archived") return badge("Archived", "warn");
    if (item?.registryOrigin === "source_baseline" || item?.registrySourceType === "source") return badge("Source baseline", "success");
    const classification = String(item?.classificationSource || "").replace(/_/g, " ");
    const label = classification
      ? `Source-audited: ${classification}`
      : item?.source === "admin_created"
        ? "Admin-created"
        : item?.provenance
          ? "Source-audited"
          : item?.source || item?.sourceNotes || "Source";
    return badge(label, item?.source === "admin_created" ? "warn" : "success");
  }

  function isSourceRegistryRow(item) {
    return item?.registrySourceType === "source" || item?.registryOrigin === "source_baseline" || item?.registryOrigin === "source_override" || item?.source === "public_cv_source" || Boolean(item?.provenance || item?.sourceNotes || item?.classificationSource);
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
      return `<span class="company-logo-mask" style="--icon-url: url('${escapeHtml(cssAssetUrl(path))}')" title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)} logo"></span>`;
    }
    return `<img class="software-logo-img" src="${escapeHtml(path)}" alt="${escapeHtml(item.name)} logo" loading="lazy" />`;
  }

  function cssAssetUrl(path) {
    const value = String(path || "").trim();
    if (!value || /^(?:https?:|data:|blob:|\/)/i.test(value)) return value;
    return `/${value.replace(/^\.?\//, "")}`;
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
      <tr data-project-row-id="${escapeHtml(project.id)}" tabindex="0">
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
        <span class="asset-preview-slot" data-project-upload-preview="${escapeHtml(name)}" data-project-preview-kind="${escapeHtml(catalogType)}">${assetPreview(value, label, { kind: catalogType })}</span>
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
        <div class="gallery-preview-grid gallery-grid" data-gallery-grid>
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
      <div class="gallery-preview-card gallery-tile" data-gallery-index="${index}">
        <div class="gallery-preview-thumb">${assetPreview(path, `Gallery item ${index + 1}`, { variant: "gallery" })}</div>
        <code title="${escapeHtml(path)}">${escapeHtml(path)}</code>
        ${
          readOnly
            ? ""
            : `<div class="gallery-preview-actions row-actions">
                <button class="button button-secondary" type="button" data-gallery-move="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Up</button>
                <button class="button button-secondary" type="button" data-gallery-move="${index}" data-direction="1">Down</button>
                <button class="button button-danger" type="button" data-gallery-remove="${index}">Remove</button>
              </div>`
        }
      </div>
    `;
  }

  function registryMultiSelectField(label, name, kind, selectedValues, readOnly = false) {
    const selected = new Set(normalizeProjectRegistryRefs(selectedValues).map((value) => (kind === "platforms" ? platformRegistryId(value) : createSlug(value))));
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
        const id = platformRegistryId(value);
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

        ${publishStatusPanel()}

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
    resizeAnalyticsMap();
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
    resizeAnalyticsMap();
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

    const target = event.target.closest("[data-project-action], [data-project-upload], [data-project-clear], [data-gallery-move], [data-gallery-remove], [data-registry-action], [data-registry-modal-backdrop], [data-project-modal-backdrop], [data-media-action], [data-media-modal-backdrop], [data-alert-action], [data-alert-modal-backdrop], [data-position-action], [data-position-modal-backdrop], [data-account-access-action], [data-account-action], [data-analytics-action], [data-publish-action]");
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute("data-project-action");
    const uploadField = target.getAttribute("data-project-upload");
    const clearField = target.getAttribute("data-project-clear");
    const mediaAction = target.getAttribute("data-media-action");
    const alertAction = target.getAttribute("data-alert-action");
    const accountAccessAction = target.getAttribute("data-account-access-action");
    const accountAction = target.getAttribute("data-account-action");
    const analyticsAction = target.getAttribute("data-analytics-action");
    const publishAction = target.getAttribute("data-publish-action");
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

    if (publishAction === "publish") {
      publishSiteData();
      return;
    }

    if (publishAction === "refresh") {
      hydratePublishStatus(true);
      return;
    }

    if (analyticsAction) {
      runAnalyticsAction(analyticsAction, target);
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
        if (nextStatus === "archived" && !window.confirm(`Archive ${item.title}? Source-derived rows are stored as archive overrides; custom rows remain in Admin overlay storage.`)) return;
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
    } else if (positionAction === "repair-cache") {
      repairLocalRegistryCache("positions");
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
    if (action === "reset-cache") {
      resetLocalRegistryCache(kind);
      return;
    }
    if (action === "repair-cache") {
      repairLocalRegistryCache(kind);
      return;
    }
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
    if (action === "delete") {
      const item = registryState[kind].items.find((entry) => entry.id === id);
      if (!item) return;
      const isSourceDerived = item.source === "public_cv_source" || item.provenance || item.sourceNotes;
      if (isSourceDerived) {
        if (!window.confirm(`${item.name} is source-derived. Archive it instead of deleting the source baseline row?`)) return;
        item.status = "archived";
        item.updatedAt = new Date().toISOString();
        registryState[kind].message = `${config.singular} archived; source-derived registry rows are retained for provenance.`;
        persistRegistryItems(kind);
        renderRegistryPage(kind);
        return;
      }
      if (!window.confirm(`Delete admin-created ${config.singular.toLowerCase()} "${item.name}"? This does not change the public CV or portfolio source.`)) return;
      registryState[kind].items = registryState[kind].items.filter((entry) => entry.id !== id);
      registryState[kind].message = `Deleted ${item.name}.`;
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

  function resetLocalRegistryCache(kind = "") {
    if (!window.confirm("Reset local registry cache for Companies, Platforms, and Positions? This does not clear auth/session data or unrelated CMS content.")) {
      return;
    }
    try {
      window.localStorage.removeItem(COMPANIES_STORAGE_KEY);
      window.localStorage.removeItem(PLATFORMS_STORAGE_KEY);
      window.localStorage.removeItem(POSITIONS_STORAGE_KEY);
      window.localStorage.removeItem(REGISTRY_SCHEMA_STORAGE_KEY);
    } catch {
      // Local cache reset is best-effort in restricted storage modes.
    }
    loadAndReconcileLocalRegistry("companies");
    loadAndReconcileLocalRegistry("platforms");
    reconcilePositionsFromStorage();
    registryState.companies.message = "Local registry cache reset and source baseline restored.";
    registryState.platforms.message = "Local registry cache reset and source baseline restored.";
    positionsState.message = "Local registry cache reset and source positions baseline restored.";
    if (kind === "platforms") renderRegistryPage("platforms");
    else if (kind === "companies") renderRegistryPage("companies");
    else if (activePageIs("positions")) renderPositions();
    else render();
  }

  function repairLocalRegistryCache(kind = "") {
    try {
      loadAndReconcileLocalRegistry("companies");
      loadAndReconcileLocalRegistry("platforms");
      reconcilePositionsFromStorage();
      registryState.companies.message = "Local Companies cache repaired to registry overlay v3 without deleting valid custom rows.";
      registryState.platforms.message = "Local Platforms cache repaired to registry overlay v3 without deleting valid custom rows.";
      positionsState.message = "Local Positions cache repaired to registry overlay v3 without deleting valid custom rows.";
    } catch {
      if (kind === "positions") positionsState.message = "Local registry cache repair failed; existing in-memory rows were kept.";
      else if (registryState[kind]) registryState[kind].message = "Local registry cache repair failed; existing in-memory rows were kept.";
    }
    if (kind === "platforms") renderRegistryPage("platforms");
    else if (kind === "companies") renderRegistryPage("companies");
    else if (activePageIs("positions") || kind === "positions") renderPositions();
    else render();
  }

  function saveRegistryFromForm(kind, form) {
    const name = formValue(form, "name");
    const originalId = formValue(form, "originalId");
    const existingItem = registryState[kind].items.find((item) => item.id === originalId);
    const id = isSourceRegistryRow(existingItem) ? originalId : createSlug(formValue(form, "id") || name);
    if (!name || !id) {
      registryState[kind].message = "Name and ID are required.";
      renderRegistryPage(kind);
      return;
    }
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
    const originalId = formValue(form, "originalId");
    const existingItem = positionsState.items.find((item) => item.id === originalId);
    const id = isSourceRegistryRow(existingItem) ? originalId : createSlug(formValue(form, "id") || title);
    const companyId = formValue(form, "companyId");
    if (!title || !id || !companyId) {
      positionsState.message = "Title, ID, and company are required.";
      renderPositions();
      return;
    }
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
    if (isSourceRegistryRow(item)) {
      if (!window.confirm(`Archive source-derived position "${item.title}" instead of deleting the source baseline row?`)) return;
      item.status = "archived";
      item.updatedAt = new Date().toISOString();
      positionsState.message = `Archived ${item.title}; source-derived position rows are retained for provenance.`;
      persistPositions();
      renderPositions();
      return;
    }
    if (!window.confirm(`Delete custom position "${item.title}"? This removes only the Admin custom row and does not change the public CV.`)) return;
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
    preview.innerHTML = `
      <span class="asset-preview-card asset-preview-card--field">
        <span class="asset-preview-frame">
          <img class="asset-preview-image" src="${url}" alt="Selected upload preview" />
        </span>
      </span>
    `;
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
    const preview = form.querySelector(`[data-project-upload-preview="${CSS.escape(fieldName)}"]`);
    if (preview) {
      preview.innerHTML = assetPreview(value, target.getAttribute("aria-label") || fieldName, {
        kind: preview.getAttribute("data-project-preview-kind")
      });
    }
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
  window.addEventListener("resize", resizeAnalyticsMap);
  document.addEventListener("dc-admin-auth-status", (event) => {
    if (event.detail?.isAdmin) {
      hydrateCmsCollections();
      hydrateAccountRegistry(activePageIs("accounts") || activePageIs("settings"));
      hydrateOverviewStatus(activePageIs("overview"));
      hydrateAnalyticsStatus(activePageIs("analytics"));
      hydratePublishStatus(activePageIs("overview") || activePageIs("settings") || isPublishCollectionPage());
    }
  });

  loadAndReconcileLocalRegistry("companies");
  loadAndReconcileLocalRegistry("platforms");
  reconcilePositionsFromStorage();
  if (!window.location.hash && ["/", "/index.html"].includes(window.location.pathname)) {
    window.location.hash = "#/overview";
  } else {
    render();
  }
  hydrateProjectBaseline(activePageIs("projects"));
  initSidebarMode();
  seedRegistriesFromCvSource();
  seedRegistriesFromProjects();
  reconcilePositionsFromStorage();
  hydratePublicAssetCatalog(activePageIs("projects"));
  hydrateCmsCollections();
  hydrateAccountRegistry(activePageIs("accounts") || activePageIs("settings"));
  hydrateOverviewStatus(activePageIs("overview"));
  hydrateAnalyticsStatus(activePageIs("analytics"));
  hydratePublishStatus(activePageIs("overview") || activePageIs("settings") || isPublishCollectionPage());
})();
