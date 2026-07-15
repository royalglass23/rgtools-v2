"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./prototype.module.css";

type PageKind =
  | "dashboard"
  | "list"
  | "detail"
  | "form"
  | "guide"
  | "admin"
  | "login";
type ThemeChoice = "light" | "dark" | "system";
type DeviceChoice = "desktop" | "mobile";
type StateChoice =
  | "default"
  | "loading"
  | "empty"
  | "error"
  | "success"
  | "denied"
  | "readonly";

type PrototypePage = {
  id: string;
  route: string;
  label: string;
  module: string;
  kind: PageKind;
  summary: string;
  primaryAction?: string;
};

const pages: PrototypePage[] = [
  {
    id: "dashboard",
    route: "/",
    label: "Operations dashboard",
    module: "Dashboard",
    kind: "dashboard",
    summary:
      "Priority queues, business performance, and live operational work.",
  },
  {
    id: "lead-intake",
    route: "/lead-intake",
    label: "Lead Intake",
    module: "Lead Intake",
    kind: "form",
    summary: "Capture, qualify, and score a new enquiry.",
    primaryAction: "Save and score lead",
  },
  {
    id: "lead-intake-config",
    route: "/lead-intake/configuration",
    label: "Lead Intake configuration",
    module: "Lead Intake",
    kind: "form",
    summary: "Manage scoring fields, options, weights, and thresholds.",
    primaryAction: "Publish configuration",
  },
  {
    id: "lead-intake-guide",
    route: "/lead-intake/guide",
    label: "Lead Intake guide",
    module: "Lead Intake",
    kind: "guide",
    summary:
      "A practical staff guide for capturing consistent lead information.",
  },
  {
    id: "leads",
    route: "/leads",
    label: "Leads",
    module: "Leads",
    kind: "list",
    summary:
      "Review qualified enquiries, ServiceM8 status, ownership, and follow-up.",
    primaryAction: "Import from ServiceM8",
  },
  {
    id: "lead-detail",
    route: "/leads/[id]",
    label: "Lead detail",
    module: "Leads",
    kind: "detail",
    summary:
      "A complete lead record with scoring, guidance, notes, and activity.",
    primaryAction: "Take next action",
  },
  {
    id: "quote-tracker",
    route: "/quote-tracker",
    label: "Quote Tracker",
    module: "Quote Tracker",
    kind: "list",
    summary:
      "Track ServiceM8 quotes, sharing links, engagement, and follow-up status.",
    primaryAction: "Track ServiceM8 quote",
  },
  {
    id: "quote-detail",
    route: "/quote-tracker/[id]",
    label: "Tracked quote detail",
    module: "Quote Tracker",
    kind: "detail",
    summary:
      "Engagement, link health, attachments, and follow-up guidance for a ServiceM8 quote.",
    primaryAction: "Copy tracked link",
  },
  {
    id: "quote-guide",
    route: "/quote-tracker/guide",
    label: "Quote Tracker guide",
    module: "Quote Tracker",
    kind: "guide",
    summary:
      "How to track a ServiceM8 quote and interpret customer engagement.",
  },
  {
    id: "work-orders",
    route: "/work-orders",
    label: "Work Orders",
    module: "Work Orders",
    kind: "list",
    summary:
      "Current installation work, readiness, ownership, and operational status.",
  },
  {
    id: "work-order-detail",
    route: "/work-orders/[id]",
    label: "Work Order detail",
    module: "Work Orders",
    kind: "detail",
    summary:
      "Job context, operational fields, items, timeline, and next action.",
    primaryAction: "Update work order",
  },
  {
    id: "work-order-guide",
    route: "/work-orders/guide",
    label: "Work Orders guide",
    module: "Work Orders",
    kind: "guide",
    summary: "How staff monitor and update installation work.",
  },
  {
    id: "clients",
    route: "/clients",
    label: "Clients",
    module: "Clients",
    kind: "list",
    summary: "Canonical client records and connected operational activity.",
  },
  {
    id: "client-detail",
    route: "/clients/[id]",
    label: "Client detail",
    module: "Clients",
    kind: "detail",
    summary:
      "Contacts, leads, quotes, Work Orders, notes, and recent activity.",
    primaryAction: "Edit client",
  },
  {
    id: "client-config",
    route: "/clients/configuration",
    label: "Client configuration",
    module: "Clients",
    kind: "form",
    summary: "Manage identity rules, review states, and merge behaviour.",
    primaryAction: "Save configuration",
  },
  {
    id: "client-guide",
    route: "/clients/guide",
    label: "Clients guide",
    module: "Clients",
    kind: "guide",
    summary: "How to find, review, and maintain client records.",
  },
  {
    id: "ps-generator",
    route: "/ps-generator",
    label: "PS Generator",
    module: "PS Generator",
    kind: "form",
    summary: "Generate PS1 and PS3 packages from a ServiceM8 job.",
    primaryAction: "Generate package",
  },
  {
    id: "ps-config",
    route: "/ps-generator/configuration",
    label: "PS configuration",
    module: "PS Generator",
    kind: "form",
    summary: "Manage systems, options, mappings, wording, and templates.",
    primaryAction: "Publish configuration",
  },
  {
    id: "ps-history",
    route: "/ps-generator/history",
    label: "PS generation history",
    module: "PS Generator",
    kind: "list",
    summary: "Generated packages, source jobs, status, and audit history.",
  },
  {
    id: "admin",
    route: "/admin",
    label: "Admin",
    module: "Admin",
    kind: "admin",
    summary:
      "System health, access, configuration, and operational administration.",
  },
  {
    id: "admin-administration",
    route: "/admin/administration",
    label: "Administration",
    module: "Admin",
    kind: "admin",
    summary:
      "Users, module grants, menu availability, errors, and audit activity.",
    primaryAction: "Add user",
  },
  {
    id: "admin-pricing",
    route: "/admin/calculator-pricing",
    label: "Calculator pricing",
    module: "Admin",
    kind: "admin",
    summary: "Review and publish controlled calculator price versions.",
    primaryAction: "Create version",
  },
  {
    id: "admin-merge",
    route: "/admin/client-merge-review",
    label: "Client merge review",
    module: "Admin",
    kind: "admin",
    summary: "Review probable duplicate clients and confirm safe merges.",
  },
  {
    id: "admin-dashboard",
    route: "/admin/dashboard-settings",
    label: "Dashboard settings",
    module: "Admin",
    kind: "admin",
    summary: "Choose operational tables and default dashboard views.",
    primaryAction: "Save dashboard",
  },
  {
    id: "admin-tracking",
    route: "/admin/tracking",
    label: "Tracking settings",
    module: "Admin",
    kind: "admin",
    summary:
      "Configure quote engagement, notification, and retention behaviour.",
    primaryAction: "Save settings",
  },
  {
    id: "admin-work-orders",
    route: "/admin/work-orders",
    label: "Work Order configuration",
    module: "Admin",
    kind: "admin",
    summary: "Manage stages, installers, hardware status, and summary fields.",
    primaryAction: "Add option",
  },
  {
    id: "login",
    route: "/login",
    label: "Sign in",
    module: "Authentication",
    kind: "login",
    summary: "Secure staff access to Royal Glass operations.",
  },
];

const moduleNavigation = [
  { label: "Dashboard", page: "dashboard", mark: "DB" },
  { label: "Lead Intake", page: "lead-intake", mark: "LI" },
  { label: "Leads", page: "leads", mark: "LD" },
  { label: "Quote Tracker", page: "quote-tracker", mark: "QT" },
  { label: "Work Orders", page: "work-orders", mark: "WO" },
  { label: "Clients", page: "clients", mark: "CL" },
  { label: "PS Generator", page: "ps-generator", mark: "PS" },
  { label: "Admin", page: "admin", mark: "AD" },
];

const sampleRows: Record<string, string[][]> = {
  Leads: [
    [
      "High",
      "Coastal Windows",
      "Frameless shower",
      "J. Parker",
      "Today",
      "Needs action",
    ],
    [
      "High",
      "Northshore Homes",
      "Pool fencing",
      "M. Lee",
      "Today",
      "SM8 pending",
    ],
    [
      "Medium",
      "Harbour View Build",
      "Glass balustrade",
      "T. Nguyen",
      "Tomorrow",
      "Follow-up",
    ],
    [
      "Low",
      "Bayside Apartments",
      "Mirror package",
      "J. Parker",
      "22 May",
      "On track",
    ],
  ],
  "Quote Tracker": [
    ["High", "Q-1047", "Harbour View Build", "J. Parker", "Today", "Overdue"],
    ["High", "Q-1051", "Coastal Windows", "S. Patel", "Today", "Never opened"],
    ["Medium", "Q-1050", "Northshore Homes", "M. Lee", "Tomorrow", "Due soon"],
    ["Low", "Q-1056", "Bayside Apartments", "J. Parker", "24 May", "On track"],
  ],
  "Work Orders": [
    ["High", "W-3021", "Coastal Windows", "S. Patel", "Today", "Fabrication"],
    [
      "Medium",
      "W-3022",
      "Altitude Renovations",
      "T. Nguyen",
      "Tomorrow",
      "Pre-install",
    ],
    ["Low", "W-3023", "Bayside Apartments", "J. Parker", "27 May", "Ready"],
    ["Low", "W-3024", "Harbour View Build", "M. Lee", "30 May", "Scheduled"],
  ],
  Clients: [
    [
      "Active",
      "Coastal Windows",
      "3 contacts",
      "8 projects",
      "Today",
      "SM8 linked",
    ],
    [
      "Active",
      "Harbour View Build",
      "2 contacts",
      "5 projects",
      "Today",
      "SM8 linked",
    ],
    [
      "Review",
      "Northshore Homes",
      "4 contacts",
      "6 projects",
      "Yesterday",
      "Provisional",
    ],
    [
      "Active",
      "Bayside Apartments",
      "2 contacts",
      "3 projects",
      "20 May",
      "SM8 linked",
    ],
  ],
  "PS Generator": [
    ["Complete", "PS-2041", "R260312", "PS1 + PS3", "J. Parker", "Today"],
    ["Complete", "PS-2040", "R260309", "PS3", "M. Lee", "Today"],
    ["Review", "PS-2039", "R260301", "PS1", "S. Patel", "Yesterday"],
    ["Complete", "PS-2038", "R260295", "PS1 + PS3", "T. Nguyen", "20 May"],
  ],
};

const formFields: Record<string, string[]> = {
  "Lead Intake": [
    "Client or company",
    "Contact name",
    "Phone",
    "Email",
    "Project type",
    "Site address",
    "Timeline",
    "Budget",
    "Notes",
  ],
  Clients: [
    "Identity source",
    "Review status",
    "Default owner",
    "Merge confidence",
    "Alias handling",
    "Review note",
  ],
  "PS Generator": [
    "ServiceM8 job number",
    "Producer Statement type",
    "System",
    "Glass type",
    "Hardware",
    "Site address",
    "Council",
    "Template",
  ],
  Admin: [
    "Setting name",
    "Current value",
    "Owner",
    "Effective date",
    "Review note",
  ],
};

export function PrototypeGallery() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pageId = searchParams.get("page") ?? "dashboard";
  const theme = validChoice(
    searchParams.get("theme"),
    ["light", "dark", "system"],
    "light",
  );
  const device = validChoice(
    searchParams.get("device"),
    ["desktop", "mobile"],
    "desktop",
  );
  const state = validChoice(
    searchParams.get("state"),
    ["default", "loading", "empty", "error", "success", "denied", "readonly"],
    "default",
  );
  const pageIndex = Math.max(
    0,
    pages.findIndex((entry) => entry.id === pageId),
  );
  const page = pages[pageIndex];
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const cyclePage = (direction: -1 | 1) => {
    const nextIndex = (pageIndex + direction + pages.length) % pages.length;
    setParam("page", pages[nextIndex].id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches(
          'input, textarea, select, button, [contenteditable="true"]',
        )
      )
        return;
      if (event.key === "ArrowLeft") cyclePage(-1);
      if (event.key === "ArrowRight") cyclePage(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const groupedPages = useMemo(() => {
    return pages.reduce<Record<string, PrototypePage[]>>((groups, entry) => {
      groups[entry.module] = [...(groups[entry.module] ?? []), entry];
      return groups;
    }, {});
  }, []);

  return (
    <div className={styles.gallery} data-theme={theme}>
      <div className={styles.prototypeNotice}>
        PROTOTYPE · FAKE DATA · DEVELOPMENT ONLY
      </div>
      <div className={styles.stage}>
        <div className={styles.frame} data-device={device}>
          {page.kind === "login" ? (
            <LoginPrototype state={state} />
          ) : (
            <div className={styles.appShell}>
              <Sidebar page={page} onNavigate={(id) => setParam("page", id)} />
              <div className={styles.workspace}>
                <Topbar
                  page={page}
                  theme={theme}
                  onThemeChange={(value) => setParam("theme", value)}
                />
                <main className={styles.main}>
                  <PageHeader page={page} state={state} />
                  <StateBanner state={state} />
                  <PageSurface page={page} state={state} />
                </main>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.controlBar} aria-label="Prototype controls">
        <button
          type="button"
          onClick={() => cyclePage(-1)}
          aria-label="Previous page"
        >
          ←
        </button>
        <label>
          <span>
            Page {pageIndex + 1}/{pages.length}
          </span>
          <select
            value={page.id}
            onChange={(event) => setParam("page", event.target.value)}
          >
            {Object.entries(groupedPages).map(([module, entries]) => (
              <optgroup key={module} label={module}>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          <span>Theme</span>
          <select
            value={theme}
            onChange={(event) => setParam("theme", event.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <label>
          <span>Preview</span>
          <select
            value={device}
            onChange={(event) => setParam("device", event.target.value)}
          >
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
          </select>
        </label>
        <label>
          <span>State</span>
          <select
            value={state}
            onChange={(event) => setParam("state", event.target.value)}
          >
            <option value="default">Default</option>
            <option value="loading">Loading</option>
            <option value="empty">Empty</option>
            <option value="error">Error</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="readonly">Read only</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => cyclePage(1)}
          aria-label="Next page"
        >
          →
        </button>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  onNavigate,
}: {
  page: PrototypePage;
  onNavigate: (id: string) => void;
}) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span>RG</span> Tools
      </div>
      <nav aria-label="Prototype navigation">
        {moduleNavigation.map((entry) => (
          <button
            key={entry.page}
            type="button"
            data-active={
              page.module === entry.label || page.id === entry.page || undefined
            }
            onClick={() => onNavigate(entry.page)}
          >
            <span className={styles.navMark}>{entry.mark}</span>
            <span>{entry.label}</span>
            {entry.label === "Quote Tracker" && <small>SM8</small>}
          </button>
        ))}
      </nav>
      <div className={styles.roadmap}>
        <span>Roadmap</span>
        <div>
          Pre-install <small>Future</small>
        </div>
        <div>
          Invoicing <small>Future</small>
        </div>
      </div>
      <div className={styles.account}>
        <span>RH</span>
        <div>
          <strong>Royal Glass</strong>
          <small>Administrator</small>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  page,
  theme,
  onThemeChange,
}: {
  page: PrototypePage;
  theme: ThemeChoice;
  onThemeChange: (theme: ThemeChoice) => void;
}) {
  return (
    <header className={styles.topbar}>
      <button
        className={styles.mobileMenu}
        type="button"
        aria-label="Open navigation"
      >
        ☰
      </button>
      <div className={styles.crumbs}>
        <span>RGTools</span>
        <b>/</b>
        <strong>{page.module}</strong>
      </div>
      <div className={styles.commandSearch}>
        ⌕ <span>Search RGTools</span>
        <kbd>Ctrl K</kbd>
      </div>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(event) => onThemeChange(event.target.value as ThemeChoice)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
      <span className={styles.topAvatar}>RG</span>
    </header>
  );
}

function PageHeader({
  page,
  state,
}: {
  page: PrototypePage;
  state: StateChoice;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <div className={styles.route}>{page.route}</div>
        <h1>{page.label}</h1>
        <p>{page.summary}</p>
      </div>
      <div className={styles.headerActions}>
        <span className={styles.updated}>
          <i /> Updated 2 min ago
        </span>
        {page.primaryAction && (
          <button type="button" disabled={state === "readonly"}>
            {page.primaryAction}
          </button>
        )}
      </div>
    </header>
  );
}

function StateBanner({ state }: { state: StateChoice }) {
  if (state === "success")
    return (
      <div className={styles.banner} data-tone="success">
        <strong>Saved.</strong> The latest changes are visible to the team.
      </div>
    );
  if (state === "readonly")
    return (
      <div className={styles.banner} data-tone="info">
        <strong>Read-only record.</strong> Historical information remains
        available for reference.
      </div>
    );
  return null;
}

function PageSurface({
  page,
  state,
}: {
  page: PrototypePage;
  state: StateChoice;
}) {
  if (state === "loading") return <LoadingState />;
  if (state === "empty") return <EmptyState page={page} />;
  if (state === "error")
    return (
      <FeedbackState
        tone="error"
        title="This view could not be loaded"
        body="The source system did not respond. Try again without losing your current filters."
        action="Try again"
      />
    );
  if (state === "denied")
    return (
      <FeedbackState
        tone="warning"
        title="Access required"
        body="Your account does not have permission to use this area. Ask an administrator for module access."
        action="Return to dashboard"
      />
    );

  if (page.kind === "dashboard") return <DashboardSurface />;
  if (page.kind === "list") return <ListSurface page={page} />;
  if (page.kind === "detail")
    return <DetailSurface page={page} readonly={state === "readonly"} />;
  if (page.kind === "form")
    return <FormSurface page={page} readonly={state === "readonly"} />;
  if (page.kind === "guide") return <GuideSurface page={page} />;
  if (page.kind === "admin")
    return <AdminSurface page={page} readonly={state === "readonly"} />;
  return null;
}

function DashboardSurface() {
  return (
    <div className={styles.surfaceStack}>
      <section className={styles.attentionPanel}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>Needs attention</h2>
            <p>Sorted by operational urgency</p>
          </div>
          <button type="button" className={styles.quietButton}>
            View all actions →
          </button>
        </div>
        <div className={styles.attentionGrid}>
          <AttentionItem
            tone="critical"
            count="8"
            title="No ServiceM8 job"
            meta="Tier A/B leads"
          />
          <AttentionItem
            tone="warning"
            count="14"
            title="Follow-up due"
            meta="Quotes and leads"
          />
          <AttentionItem
            tone="info"
            count="6"
            title="Pre-install checks"
            meta="Work Orders"
          />
          <AttentionItem
            tone="positive"
            count="23"
            title="On track"
            meta="No action required"
          />
        </div>
      </section>
      <div className={styles.dashboardSplit}>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>Business performance</h2>
              <p>Rolling 30-day view</p>
            </div>
            <select>
              <option>Last 30 days</option>
            </select>
          </div>
          <div className={styles.metrics}>
            <Metric label="Pipeline value" value="$2.48m" delta="+18.6%" />
            <Metric label="Conversion rate" value="22.7%" delta="+3.4 pts" />
            <Metric label="Lead volume" value="186" delta="+12.9%" />
          </div>
          <div className={styles.chart}>
            <div className={styles.chartHeading}>
              <strong>30-day trend</strong>
              <span>Relative movement; current values are shown above</span>
            </div>
            <div className={styles.chartLegend} aria-label="Chart series">
              <span data-series="pipeline">
                <i /> Pipeline value
              </span>
              <span data-series="leads">
                <i /> Lead volume
              </span>
            </div>
            <svg
              viewBox="0 0 600 120"
              role="img"
              aria-labelledby="performance-chart-title performance-chart-description"
            >
              <title id="performance-chart-title">
                Pipeline value and lead volume over the last 30 days
              </title>
              <desc id="performance-chart-description">
                Both measures trend upward. Pipeline value rises more strongly
                than lead volume toward today.
              </desc>
              <g className={styles.chartGrid} aria-hidden="true">
                <line x1="0" y1="20" x2="600" y2="20" />
                <line x1="0" y1="60" x2="600" y2="60" />
                <line x1="0" y1="100" x2="600" y2="100" />
              </g>
              <path
                className={styles.pipelineSeries}
                d="M0 102 C60 92 65 72 120 78 S185 55 235 60 S310 35 360 43 S420 22 470 32 S540 15 600 18"
              />
              <path
                className={styles.leadSeries}
                d="M0 116 C70 105 110 108 150 95 S230 90 280 74 S360 82 410 58 S500 56 600 44"
              />
            </svg>
            <div className={styles.chartAxis} aria-hidden="true">
              <span>30 days ago</span>
              <span>15 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </section>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>Next actions</h2>
              <p>Across active modules</p>
            </div>
          </div>
          <ActionRows />
        </section>
      </div>
    </div>
  );
}

function AttentionItem({
  tone,
  count,
  title,
  meta,
}: {
  tone: string;
  count: string;
  title: string;
  meta: string;
}) {
  return (
    <article className={styles.attentionItem} data-tone={tone}>
      <span className={styles.statusDot} />
      <strong>{count}</strong>
      <div>
        <b>{title}</b>
        <small>{meta}</small>
      </div>
      <span>→</span>
    </article>
  );
}

function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{delta} vs prior period</small>
    </div>
  );
}

function ActionRows() {
  const rows = [
    ["Follow up", "Quote Q-1047", "Today", "Overdue"],
    ["Approve fabrication", "Work Order W-3021", "Today", "Due"],
    ["Link ServiceM8 job", "Lead L-2012", "Tomorrow", "Pending"],
    ["Review duplicate", "Northshore Homes", "24 May", "Review"],
  ];
  return (
    <div className={styles.actionRows}>
      {rows.map((row) => (
        <div key={row[1]}>
          <span className={styles.statusDot} />
          <strong>{row[0]}</strong>
          <span>{row[1]}</span>
          <small>{row[2]}</small>
          <Badge label={row[3]} />
        </div>
      ))}
    </div>
  );
}

function ListSurface({ page }: { page: PrototypePage }) {
  const rows = sampleRows[page.module] ?? sampleRows["Quote Tracker"];
  return (
    <section className={styles.panel}>
      <div className={styles.listToolbar}>
        <div className={styles.searchField}>
          ⌕ Search {page.module.toLowerCase()}
        </div>
        <select>
          <option>All statuses</option>
        </select>
        <select>
          <option>All owners</option>
        </select>
        <select>
          <option>Needs attention</option>
        </select>
        <button type="button" className={styles.quietButton}>
          Columns
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {[
                "Priority",
                "Reference",
                "Client / project",
                "Owner",
                "Due",
                "Status",
                "",
              ].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.concat(rows).map((row, index) => (
              <tr key={`${row[1]}-${index}`}>
                <td>
                  <span
                    className={styles.priority}
                    data-level={row[0].toLowerCase()}
                  >
                    {row[0]}
                  </span>
                </td>
                <td>
                  <strong>{row[1]}</strong>
                  <small>
                    {index % 2 ? "Source: ServiceM8" : "Updated 10m ago"}
                  </small>
                </td>
                <td>{row[2]}</td>
                <td>{row[3]}</td>
                <td>{row[4]}</td>
                <td>
                  <Badge label={row[5]} />
                </td>
                <td>•••</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className={styles.tableFooter}>
        <span>Showing 1–8 of 48</span>
        <div>
          <button>Previous</button>
          <button>1</button>
          <button>2</button>
          <button>Next</button>
        </div>
      </footer>
    </section>
  );
}

function DetailSurface({
  page,
  readonly,
}: {
  page: PrototypePage;
  readonly: boolean;
}) {
  const isQuote = page.module === "Quote Tracker";
  const reference = isQuote
    ? "Q-1047"
    : page.module === "Work Orders"
      ? "W-3021"
      : page.module === "Leads"
        ? "L-2012"
        : "Coastal Windows";
  return (
    <div className={styles.detailLayout} data-readonly={readonly || undefined}>
      <section className={styles.detailMain}>
        <div className={styles.recordHeading}>
          <div>
            <span>{reference}</span>
            <h2>
              {isQuote
                ? "Harbour View Build — Glass balustrade"
                : page.module === "Clients"
                  ? "Coastal Windows"
                  : "Coastal Windows — Architectural glazing"}
            </h2>
          </div>
          <Badge label={isQuote ? "Follow-up due" : "Needs attention"} />
        </div>
        <div className={styles.tabs}>
          {["Overview", "Items", "Activity", "Files", "History"].map(
            (tab, index) => (
              <button key={tab} data-active={index === 0 || undefined}>
                {tab}
              </button>
            ),
          )}
        </div>
        <div className={styles.summaryGrid}>
          <Info label="Owner" value="J. Parker" />
          <Info label="Due" value="Today" />
          <Info
            label="Source"
            value={isQuote ? "ServiceM8 quote" : "RGTools + ServiceM8"}
          />
          <Info label="Last updated" value="2 min ago" />
        </div>
        <section className={styles.detailSection}>
          <h3>Current status</h3>
          <p>
            {isQuote
              ? "The ServiceM8 quote has been viewed three times. The most recent view was yesterday and follow-up is now due."
              : "Site measure is complete. Fabrication approval is the next required action before the scheduled install."}
          </p>
        </section>
        <section className={styles.detailSection}>
          <h3>Timeline</h3>
          <div className={styles.timeline}>
            {[
              "Record created",
              "Source data linked",
              "Documents reviewed",
              "Follow-up due",
            ].map((item, index) => (
              <div key={item}>
                <i data-current={index === 3 || undefined} />
                <strong>{item}</strong>
                <span>{index === 3 ? "Today" : `${index + 5} May`}</span>
                <small>
                  {index === 3 ? "Needs action" : "Completed by Royal Glass"}
                </small>
              </div>
            ))}
          </div>
        </section>
      </section>
      <aside className={styles.inspector}>
        <div>
          <span>Next action</span>
          <h3>{isQuote ? "Follow up on quote" : "Approve fabrication"}</h3>
          <p>Due today · Owner J. Parker</p>
          <button type="button" disabled={readonly}>
            {readonly ? "Read only" : "Take action"}
          </button>
        </div>
        <div>
          <span>Upcoming</span>
          <ul>
            <li>
              Fabrication <b>21 May</b>
            </li>
            <li>
              Pre-install check <b>24 May</b>
            </li>
            <li>
              Installation <b>27 May</b>
            </li>
          </ul>
        </div>
        <div>
          <span>Traceability</span>
          <ul>
            <li>
              Source <b>{isQuote ? "ServiceM8" : "Multiple"}</b>
            </li>
            <li>
              Synced <b>2 min ago</b>
            </li>
            <li>
              Record owner <b>J. Parker</b>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function FormSurface({
  page,
  readonly,
}: {
  page: PrototypePage;
  readonly: boolean;
}) {
  const fields = formFields[page.module] ?? formFields.Admin;
  return (
    <div className={styles.formLayout} data-readonly={readonly || undefined}>
      <aside className={styles.stepRail}>
        {["Client and source", "Scope", "Operational details", "Review"].map(
          (step, index) => (
            <div key={step} data-active={index === 0 || undefined}>
              <span>{index + 1}</span>
              <b>{step}</b>
              <small>{index === 0 ? "In progress" : "Not started"}</small>
            </div>
          ),
        )}
      </aside>
      <form className={styles.formPanel}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>{page.label}</h2>
            <p>
              Required fields are marked. Changes are not saved in this
              prototype.
            </p>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          {fields.map((field, index) => (
            <label key={field}>
              <span>
                {field}
                {index < 4 && " *"}
              </span>
              {index % 4 === 3 ? (
                <textarea
                  placeholder={`Enter ${field.toLowerCase()}`}
                  disabled={readonly}
                />
              ) : index % 3 === 0 ? (
                <select disabled={readonly}>
                  <option>Select {field.toLowerCase()}</option>
                </select>
              ) : (
                <input
                  placeholder={`Enter ${field.toLowerCase()}`}
                  disabled={readonly}
                />
              )}
            </label>
          ))}
        </div>
        <div className={styles.formFooter}>
          <button type="button" className={styles.quietButton}>
            Save draft
          </button>
          <button type="button" disabled={readonly}>
            {readonly
              ? "Read only"
              : (page.primaryAction ?? "Save and continue")}
          </button>
        </div>
      </form>
      <aside className={styles.formContext}>
        <span>Live guidance</span>
        <h3>Complete source details first</h3>
        <p>
          Accurate source and ownership information keeps downstream Work
          Orders, documents, and reporting traceable.
        </p>
        <ul>
          <li>
            Required fields <b>4 remaining</b>
          </li>
          <li>
            Validation <b>Ready</b>
          </li>
          <li>
            Draft saved <b>Not yet</b>
          </li>
        </ul>
      </aside>
    </div>
  );
}

function GuideSurface({ page }: { page: PrototypePage }) {
  return (
    <div className={styles.guideLayout}>
      <aside>
        <strong>On this page</strong>
        {[
          "Purpose",
          "Before you start",
          "Step-by-step",
          "Common issues",
          "Need help?",
        ].map((item, index) => (
          <button key={item} data-active={index === 0 || undefined}>
            {item}
          </button>
        ))}
      </aside>
      <article>
        <span className={styles.guideTag}>Staff guide · {page.module}</span>
        <h2>{page.label}</h2>
        <p className={styles.lede}>
          {page.summary} This guide explains the normal workflow and the
          exceptions that need attention.
        </p>
        <h3>Before you start</h3>
        <ul>
          <li>Confirm you have access to the module.</li>
          <li>Check the source record and last update time.</li>
          <li>Have the client or job reference available.</li>
        </ul>
        <h3>Complete the workflow</h3>
        <ol>
          <li>
            <b>Find the record.</b>
            <span>Use search and operational filters to narrow the list.</span>
          </li>
          <li>
            <b>Review status and source.</b>
            <span>Check ownership, due date, and any failed sync.</span>
          </li>
          <li>
            <b>Take the next action.</b>
            <span>Complete the highlighted task and confirm feedback.</span>
          </li>
        </ol>
        <div className={styles.helpCallout}>
          <strong>Common issue</strong>
          <p>
            If source data appears out of date, check the last updated time
            before retrying or contacting an administrator.
          </p>
        </div>
      </article>
    </div>
  );
}

function AdminSurface({
  page,
  readonly,
}: {
  page: PrototypePage;
  readonly: boolean;
}) {
  const sections =
    page.id === "admin"
      ? [
          "Users and access",
          "Operational configuration",
          "System health",
          "Audit and exports",
        ]
      : ["Current configuration", "Pending changes", "Recent activity"];
  return (
    <div className={styles.adminGrid} data-readonly={readonly || undefined}>
      <section className={styles.adminSummary}>
        <span>System status</span>
        <strong>All core services operational</strong>
        <small>Last checked 2 minutes ago</small>
      </section>
      {sections.map((section, index) => (
        <section className={styles.panel} key={section}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>{section}</h2>
              <p>
                {index === 0
                  ? "Highest-use administrative controls"
                  : "Controlled settings and traceable changes"}
              </p>
            </div>
            <button type="button" className={styles.quietButton}>
              Open →
            </button>
          </div>
          <div className={styles.settingRows}>
            {[
              "Access and ownership",
              "Published configuration",
              "Last updated",
              "Review status",
            ].map((label, row) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {row === 0
                    ? "Royal Glass admin"
                    : row === 1
                      ? "Active"
                      : row === 2
                        ? "Today, 9:42 am"
                        : "No issues"}
                </strong>
                <Badge label={row === 3 ? "Healthy" : "Current"} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LoginPrototype({ state }: { state: StateChoice }) {
  return (
    <div className={styles.loginSurface}>
      <section className={styles.loginBrand}>
        <div className={styles.brand}>
          <span>RG</span> Tools
        </div>
        <div>
          <span>Royal Glass operations</span>
          <h1>
            Clear priorities.
            <br />
            Confident action.
          </h1>
          <p>
            One operational workspace for leads, quotes, clients, Work Orders,
            and Producer Statements.
          </p>
        </div>
        <small>Precise · Efficient · Trustworthy</small>
      </section>
      <section className={styles.loginForm}>
        <form>
          <span>Staff access</span>
          <h2>Sign in to RGTools</h2>
          <p>Use your Royal Glass account.</p>
          {state === "error" && (
            <div className={styles.inlineError}>
              The username or password was not recognised.
            </div>
          )}
          <label>
            <span>Username</span>
            <input autoComplete="username" placeholder="Enter username" />
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              placeholder="Enter password"
            />
          </label>
          <button type="button">Sign in</button>
          <small>Sessions expire after four hours of inactivity.</small>
        </form>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className={styles.loading}>
      <div />
      <div className={styles.loadingGrid}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.loadingTable}>
        {Array.from({ length: 6 }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}
function EmptyState({ page }: { page: PrototypePage }) {
  return (
    <FeedbackState
      tone="empty"
      title={`No ${page.module.toLowerCase()} records yet`}
      body="When records match this view, they will appear here with their status, owner, source, and next action."
      action={page.primaryAction ?? "Clear filters"}
    />
  );
}
function FeedbackState({
  tone,
  title,
  body,
  action,
}: {
  tone: string;
  title: string;
  body: string;
  action: string;
}) {
  return (
    <div className={styles.feedback} data-tone={tone}>
      <span>{tone === "error" ? "!" : tone === "warning" ? "⌁" : "○"}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button type="button">{action}</button>
    </div>
  );
}
function Badge({ label }: { label: string }) {
  const tone = /overdue|error|needs/i.test(label)
    ? "critical"
    : /due|pending|review/i.test(label)
      ? "warning"
      : /track|healthy|current|complete|ready/i.test(label)
        ? "positive"
        : "info";
  return (
    <span className={styles.badge} data-tone={tone}>
      {label}
    </span>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.info}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function validChoice<T extends string>(
  value: string | null,
  choices: readonly T[],
  fallback: T,
): T {
  return value && choices.includes(value as T) ? (value as T) : fallback;
}
