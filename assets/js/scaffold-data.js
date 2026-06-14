window.DC_ADMIN_SCAFFOLD_DATA = {
  generatedLabel: "Scaffold snapshot",
  overview: {
    summary: [
      {
        label: "Admin surface",
        value: "Foundation only",
        note: "Static shell, routes, and panels are present. No live API session is connected.",
        tone: "warn"
      },
      {
        label: "Portfolio content",
        value: "Readiness scaffold",
        note: "Projects and media CMS work remains intentionally outside this milestone.",
        tone: "warn"
      },
      {
        label: "Analytics",
        value: "Placeholder model",
        note: "Map and table layouts use clearly marked scaffold geography and route rows.",
        tone: "warn"
      },
      {
        label: "Access",
        value: "Not wired",
        note: "Public login widget and admin auth/session contracts are future work.",
        tone: "warn"
      }
    ],
    posture: [
      "Static Cloudflare Pages-compatible dashboard foundation",
      "DanielClancy professional branding and local font assets",
      "No destructive controls or authority-state mutations",
      "Future Projects and Media navigation visible but disabled"
    ],
    readiness: [
      { label: "Shell", value: "Ready for review" },
      { label: "Routes", value: "Client-side scaffold" },
      { label: "Cloudflare", value: "Static fallback only" },
      { label: "Admin API", value: "Pending" }
    ]
  },
  analytics: {
    markers: [
      { label: "Sample AU", x: "76%", y: "68%" },
      { label: "Sample US", x: "25%", y: "38%" },
      { label: "Sample EU", x: "50%", y: "32%" }
    ],
    geoRows: [
      { location: "Australia sample", precision: "Country scaffold", sessions: "placeholder", source: "Local mock" },
      { location: "United States sample", precision: "Country scaffold", sessions: "placeholder", source: "Local mock" },
      { location: "Europe sample", precision: "Region scaffold", sessions: "placeholder", source: "Local mock" }
    ],
    routeRows: [
      { route: "/overview", surface: "Admin shell", status: "Scaffold" },
      { route: "/analytics", surface: "Analytics", status: "Scaffold" },
      { route: "/accounts", surface: "Accounts", status: "Scaffold" },
      { route: "/settings", surface: "Settings", status: "Scaffold" }
    ],
    notes: [
      "No visitor counts are real.",
      "No Cloudflare Web Analytics, server logs, or API telemetry are connected.",
      "The map panel exists to preserve the intended dashboard layout pattern."
    ]
  },
  accounts: [
    {
      id: "owner-scaffold",
      name: "Owner account scaffold",
      email: "owner@example.invalid",
      role: "Owner placeholder",
      access: "Admin readiness placeholder",
      status: "Scaffold only",
      profile: "Represents the future primary administrator account shape.",
      lastSeen: "Not connected",
      initials: "OC"
    },
    {
      id: "editor-scaffold",
      name: "Content editor scaffold",
      email: "editor@example.invalid",
      role: "Editor placeholder",
      access: "Future CMS access placeholder",
      status: "Scaffold only",
      profile: "Represents a future content maintenance account shape.",
      lastSeen: "Not connected",
      initials: "CE"
    },
    {
      id: "reviewer-scaffold",
      name: "Portfolio reviewer scaffold",
      email: "reviewer@example.invalid",
      role: "Reviewer placeholder",
      access: "Read-only placeholder",
      status: "Scaffold only",
      profile: "Represents a future limited-access review account shape.",
      lastSeen: "Not connected",
      initials: "PR"
    }
  ],
  settings: [
    {
      title: "Admin profile and display",
      description: "Local presentation defaults only. No account identity writes are implemented.",
      enabled: true
    },
    {
      title: "Site/admin preferences",
      description: "Safe scaffold controls for layout posture and future preferences.",
      enabled: true
    },
    {
      title: "Deployment/environment notes",
      description: "Documents static Pages readiness without claiming DNS or dashboard setup is complete.",
      enabled: false
    },
    {
      title: "Access/auth readiness",
      description: "Auth, login widget, and privileged session handling remain future integrations.",
      enabled: false
    }
  ]
};
