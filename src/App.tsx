import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertOctagon, BarChart3, Calendar, CreditCard, FileText, Filter, Globe2, LayoutDashboard,
  Loader2, LogOut, Menu, Moon, Pause, RefreshCw, RotateCcw, Sun, Tag, Users, Wifi, WifiOff, X, Radio,
} from "lucide-react";
import { INDUSTRIES, LIVE_PLANS, PLANS, SEED, TODAY, type Industry, type Site } from "./data";
import { MOCK_API_URL } from "./mockWorker";
import { RANGES, computeDashboard, fmtNumber, type Filters, type RangeKey } from "./analytics";
import {
  DEFAULT_API_BASE, buildSavePayload, fetchClientSnapshot, formFromSite, liveClientToSite, normalizeClient, postClient,
  type ApiCredentials, type EditorForm,
} from "./api";
import { LoginScreen, type LoginValues } from "./components/LoginScreen";
import { VlloraBadge } from "./components/VlloraLogo";
import { ClientEditor } from "./components/ClientEditor";
import { KpiCard } from "./components/KpiCard";
import { GrowthBars, IndustryBars, PlanDonut, RequestsChart, RevenueChart, StatusDonut, TrafficChart } from "./components/Charts";
import { SitesTable, type StatusFilter } from "./components/SitesTable";
import { SiteDrawer } from "./components/SiteDrawer";
import { ActivityFeed, type LogEntry } from "./components/ActivityFeed";
import { Segmented, Select } from "./components/ui";
import { cn } from "./utils/cn";

const NAV = [
  { id: "top", label: "Overview", icon: LayoutDashboard },
  { id: "revenue", label: "Revenue", icon: CreditCard },
  { id: "sites", label: "Hosting & Uptime", icon: Globe2 },
  { id: "content", label: "Content Ops", icon: FileText },
  { id: "clients", label: "Clients", icon: Users },
];

const DEFAULT_FILTERS: Filters = { range: "90d", industry: "All", plan: "All", billing: "All" };
const AUTH_KEY = "vllora-studio-auth-v1";

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("waas-theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("waas-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark] as const;
}

function loadStoredAuth(): ApiCredentials | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.username === "string" && typeof p.password === "string") {
      return { username: p.username, password: p.password, baseUrl: p.baseUrl === MOCK_API_URL ? MOCK_API_URL : DEFAULT_API_BASE };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function App() {
  const [dark, setDark] = useDarkMode();

  // ---- Auth + data source
  const [auth, setAuth] = useState<ApiCredentials | null>(null);
  const [demo, setDemo] = useState(false);
  const [booting, setBooting] = useState(() => loadStoredAuth() !== null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // ---- Data
  const [sites, setSites] = useState<Site[]>(SEED.sites);
  const [requests] = useState(SEED.requests);
  const [liveMode, setLiveMode] = useState(false);
  const [apiLiveVisitors, setApiLiveVisitors] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [liveCheckedAt, setLiveCheckedAt] = useState(() => Date.now());

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("top");
  const logId = useRef(0);
  const refreshId = useRef(0);

  // ---- Client editor (CMS + billing)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editorForm, setEditorForm] = useState<EditorForm>(() => formFromSite(null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const authed = auth !== null;
  const gated = !authed && !demo;

  const d = useMemo(() => computeDashboard(sites, liveMode ? [] : requests, filters), [sites, requests, filters, liveMode]);
  const selected = sites.find((s) => s.id === selectedId) ?? null;
  const downSites = sites.filter((s) => s.churnDay === null && s.status === "Down");
  const suspendedSites = sites.filter((s) => s.status === "Suspended");
  const live = useMemo(() => {
    if (demo || !authed || !liveMode || apiError || !lastSync || liveCheckedAt - lastSync.getTime() > 90000) return null;
    const filtered = filters.industry !== "All" || filters.plan !== "All" || filters.billing !== "All";
    if (!filtered && apiLiveVisitors !== null) return apiLiveVisitors;
    const active = d.sites.filter((s) => s.churnDay === null && s.status !== "Suspended");
    if (active.length && active.every((s) => s.liveVisitors !== null && s.liveVisitors !== undefined)) {
      return active.reduce((total, s) => total + s.liveVisitors!, 0);
    }
    if (!active.length && (apiLiveVisitors !== null || sites.some((s) => s.liveVisitors !== null && s.liveVisitors !== undefined))) return 0;
    return null;
  }, [demo, authed, liveMode, apiError, lastSync, liveCheckedAt, filters, apiLiveVisitors, d.sites, sites]);

  const addLog = useCallback((text: string, kind: LogEntry["kind"] = "action") => {
    setLogs((l) => [{ id: ++logId.current, text, at: Date.now(), kind }, ...l].slice(0, 20));
  }, []);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const filtersActive = filters.industry !== "All" || filters.plan !== "All" || filters.billing !== "All" || filters.range !== DEFAULT_FILTERS.range;

  /* ------------------------------------------------ GET client list */
  const refreshFromApi = useCallback(async (creds: ApiCredentials, opts?: { silent?: boolean }) => {
    const requestId = ++refreshId.current;
    if (!opts?.silent) setSyncing(true);
    try {
      const snapshot = await fetchClientSnapshot(creds.baseUrl, creds);
      if (requestId !== refreshId.current) return false;
      setSites(snapshot.clients.map((c, i) => liveClientToSite(c, i)));
      setApiLiveVisitors(snapshot.liveVisitors);
      setLiveMode(true);
      setApiError(null);
      setLastSync(new Date());
      setLiveCheckedAt(Date.now());
      return true;
    } catch (e) {
      if (requestId !== refreshId.current) return false;
      setApiError(e instanceof Error ? e.message : "Unknown connection error.");
      setApiLiveVisitors(null);
      return false;
    } finally {
      if (!opts?.silent && requestId === refreshId.current) setSyncing(false);
    }
  }, []);

  const handleLogin = useCallback(
    async (v: LoginValues) => {
      const creds: ApiCredentials = { username: v.username, password: v.password, baseUrl: v.baseUrl === MOCK_API_URL ? MOCK_API_URL : DEFAULT_API_BASE };
      setLoginLoading(true);
      setLoginError(null);
      const ok = await refreshFromApi(creds);
      setLoginLoading(false);
      if (ok) {
        setAuth(creds);
        setDemo(false);
        try {
          sessionStorage.setItem(AUTH_KEY, JSON.stringify(creds));
        } catch {
          /* private mode — session simply won't persist */
        }
        addLog(`Connected to Worker API as ${creds.username} — client list loaded`);
      } else {
        // refreshFromApi already set apiError; surface it on the login card
        setLoginError("Could not load the client list with those credentials.");
      }
    },
    [refreshFromApi, addLog]
  );

  // Restore previous session on reload
  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored) return;
    setAuth(stored);
    refreshFromApi(stored).then((ok) => {
      if (!ok) setSites(SEED.sites); // stay signed in, show demo data + banner
      setBooting(false);
    });
  }, [refreshFromApi]);

  // Poll only while the dashboard is visible; the Worker is the source of live counts.
  useEffect(() => {
    if (!auth) return;
    const poll = () => {
      if (!document.hidden) {
        setLiveCheckedAt(Date.now());
        void refreshFromApi(auth, { silent: true });
      }
    };
    const id = setInterval(poll, 30000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [auth, refreshFromApi]);

  const handleLogout = () => {
    refreshId.current++;
    setAuth(null);
    setDemo(false);
    setLiveMode(false);
    setApiLiveVisitors(null);
    setApiError(null);
    setLastSync(null);
    setLoginError(null);
    setSites(SEED.sites);
    setLogs([]);
    setEditorOpen(false);
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
  };

  /* ------------------------------------------- POST save / delete */
  const openEditor = (s: Site) => {
    setEditingSite(s);
    setEditorForm(formFromSite(s));
    setSaveError(null);
    setEditorOpen(true);
  };
  const openCreate = () => {
    setEditingSite(null);
    setEditorForm(formFromSite(null));
    setSaveError(null);
    setEditorOpen(true);
  };

  /** Patch local state instantly so the table + KPIs refresh without waiting. */
  const applyOptimistic = (payload: Record<string, unknown>, id: string | null) => {
    const rec = normalizeClient({ ...(payload as object), id: id ?? `live-${Date.now()}` } as Record<string, unknown>, sites.length);
    const fresh = liveClientToSite(rec, sites.length);
    setSites((prev) => {
      if (id) {
        const old = prev.find((s) => s.id === id);
        return prev.map((s) =>
          s.id === id ? { ...fresh, id, visitors: old?.visitors ?? fresh.visitors, liveVisitors: old?.liveVisitors ?? null, downtime: old?.downtime ?? fresh.downtime, startDay: old?.startDay ?? fresh.startDay } : s
        );
      }
      return [...prev, fresh];
    });
  };

  const handleSave = async () => {
    if (!auth) return;
    setSaving(true);
    setSaveError(null);
    const payload: Record<string, unknown> = {
      ...buildSavePayload(editorForm, editingSite?.id ?? null),
      industry: editingSite?.industry ?? "Professional",
    };
    try {
      await postClient(auth.baseUrl, auth, payload); // POST updated JSON to the Worker
      applyOptimistic(payload, editingSite?.id ?? null);
      addLog(`${editingSite ? "Updated" : "Created"} client ${payload.name} — saved to Worker`);
      setEditorOpen(false);
      await refreshFromApi(auth, { silent: true }); // reconcile with server truth
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!auth || !editingSite) return;
    setSaving(true);
    setSaveError(null);
    try {
      await postClient(auth.baseUrl, auth, { action: "delete", id: editingSite.id });
      const name = editingSite.client;
      setSites((prev) => prev.filter((s) => s.id !== editingSite.id));
      addLog(`Deleted client ${name}`);
      setEditorOpen(false);
      await refreshFromApi(auth, { silent: true });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------- simulated activity events */
  const activeSites = sites.filter((s) => s.churnDay === null);
  useEffect(() => {
    if (gated || !demo) return;
    const pool = activeSites.filter((s) => s.status !== "Maintenance");
    const templates = [
      (s: Site) => `New contact form lead on ${s.domain}`,
      (s: Site) => `${s.client} viewed their monthly report`,
      (s: Site) => `Traffic spike: ${Math.round(20 + Math.random() * 60)} visitors on ${s.domain}`,
      (s: Site) => `Automated backup completed for ${s.domain}`,
      (s: Site) => `Invoice paid by ${s.client}`,
    ];
    const id = setInterval(() => {
      const s = pool[Math.floor(Math.random() * pool.length)];
      if (s) addLog(templates[Math.floor(Math.random() * templates.length)](s), "live");
    }, 14000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, gated, demo]);

  // ---- Scroll spy for nav
  useEffect(() => {
    if (gated) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveNav(e.target.id)),
      { rootMargin: "-30% 0px -60% 0px" }
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [gated]);

  const go = (id: string) => {
    setNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onUpdate = (id: string, patch: Partial<Site>, log: string) => {
    setSites((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    addLog(log);
  };
  const onResolve = (ids: string[], siteName: string) => {
    addLog(`Completed ${ids.length} content request${ids.length > 1 ? "s" : ""} for ${siteName}`);
  };

  // Plan filter options adapt to whatever plans the data actually contains
  const planOptions = useMemo(() => {
    const map = new Map<string, number>();
    PLANS.forEach((p) => map.set(p.id, p.price));
    LIVE_PLANS.forEach((p) => {
      if (!map.has(p.id)) map.set(p.id, p.price);
    });
    sites.forEach((s) => {
      if (!map.has(s.plan)) map.set(s.plan, Math.round(s.mrr) || 0);
    });
    return [...map.entries()].map(([id, price]) => ({
      value: id,
      label: price ? `${id} · $${price}` : id,
    }));
  }, [sites]);

  /* ------------------------------------------------------------ render */
  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <VlloraBadge className="h-12 w-12" />
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#6B1C2E] dark:text-[#D6B46C]" />
            Restoring Vllora Studio session…
          </div>
        </div>
      </div>
    );
  }

  if (gated) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onDemo={() => {
          setDemo(true);
          setSites(SEED.sites);
        }}
        loading={loginLoading}
        error={loginError ?? apiError}
        dark={dark}
        onToggleDark={() => setDark(!dark)}
      />
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const who = authed ? auth.username : "Alex";
  const rangeLabel = { "30d": "Last 30 days", "90d": "Last 90 days", "6m": "Last 6 months", "12m": "Last 12 months" }[filters.range];
  const simulated = authed && auth.baseUrl === MOCK_API_URL;
  const shortHost = authed ? auth.baseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";

  const Sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-3 px-1.5">
        <VlloraBadge className="h-10 w-10" />
        <div className="min-w-0">
          <div
            className="truncate text-sm font-bold tracking-[0.08em] text-slate-900 dark:text-[#F6E6BC]"
            style={{ fontFamily: '"Cinzel", Georgia, serif' }}
          >
            VLLORA STUDIO
          </div>
          <div className="truncate text-[11px] font-medium text-[#8B6B2E] dark:text-[#D6B46C]/85">
            Master Dashboard
          </div>
        </div>
      </div>
      <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Master Menu</div>
      {NAV.map((n) => (
        <button
          key={n.id}
          onClick={() => go(n.id)}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeNav === n.id
              ? "bg-[#6B1C2E]/10 text-[#6B1C2E] dark:bg-[#D6B46C]/15 dark:text-[#F6E6BC]"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          )}
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </button>
      ))}
      <div className="mt-auto rounded-xl border border-[#D6B46C]/30 bg-gradient-to-br from-[#6B1C2E] via-[#4F1321] to-[#340A14] p-4 text-[#F8EAC8] shadow-lg shadow-[#3B0C17]/25">
        <BarChart3 className="h-5 w-5 text-[#E8CB8A]" />
        <div className="mt-2 text-sm font-semibold">Goal: $10k MRR</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#F6E6BC] to-[#D6B46C] transition-all duration-700"
            style={{ width: `${Math.min(100, (d.kpis[0].value / 10000) * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 text-[11px] text-[#E8CB8A]/90">
          {Math.round((d.kpis[0].value / 10000) * 100)}% of target{filtersActive ? " (filtered)" : ""}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900">
        {Sidebar}
      </aside>
      {/* Mobile nav */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <aside className="relative h-full w-64 bg-white shadow-xl dark:bg-slate-900">
            <button onClick={() => setNavOpen(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            {Sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
          <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6">
            <button onClick={() => setNavOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 lg:hidden dark:hover:bg-slate-800" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <VlloraBadge className="h-8 w-8 lg:hidden" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  Vllora Studio Master Dashboard
                </h1>
                <span className="hidden rounded-full border border-[#D6B46C]/40 bg-[#6B1C2E]/10 px-2 py-0.5 text-[10px] font-semibold text-[#6B1C2E] sm:inline-block dark:bg-[#D6B46C]/15 dark:text-[#E8CB8A]">
                  {greeting}, {who}
                </span>
              </div>
              <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
                {TODAY.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · WaaS portfolio, hosting subscriptions &amp; live CMS
              </p>
            </div>
            {/* connection badge */}
            <div
              className={cn(
                "hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex",
                liveMode
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              )}
              title={authed ? `Worker: ${auth.baseUrl}` : "Demo sample data"}
            >
              {liveMode ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {simulated ? "Simulated Worker" : liveMode ? "Live API" : "Demo data"}
              {authed && !simulated && <span className="max-w-36 truncate font-normal opacity-70">{shortHost}</span>}
            </div>
            <div
              role="status"
              title={live === null ? "The Worker must return an analytics-backed liveVisitors count. Per-client counts are required for filters." : "Count supplied by the Worker and refreshed every 30 seconds."}
              className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs md:flex dark:border-slate-700 dark:bg-slate-900"
            >
              <Radio className={cn("h-3.5 w-3.5", live === null ? "text-slate-400" : "text-emerald-500")} />
              <span className="font-semibold tabular-nums transition-all">{live === null ? "--" : fmtNumber(live)}</span>
              <span className="text-slate-500 dark:text-slate-400">{live === null ? "live visitors unavailable" : "active visitors"}</span>
            </div>
            {authed && (
              <button
                onClick={() => refreshFromApi(auth)}
                disabled={syncing}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Refresh from API"
                title={lastSync ? `Last synced ${lastSync.toLocaleTimeString()}` : "Refresh from API"}
              >
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              </button>
            )}
            <button
              onClick={() => setDark(!dark)}
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              <Sun className={cn("absolute h-4 w-4 transition-all duration-300", dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
              <Moon className={cn("absolute h-4 w-4 transition-all duration-300", dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
            </button>
            {authed ? (
              <button
                onClick={handleLogout}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                aria-label="Log out"
                title={`Log out (${auth.username})`}
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setDemo(false)}
                className="h-9 shrink-0 rounded-lg bg-gradient-to-r from-[#6B1C2E] to-[#4A1120] px-3 text-xs font-semibold text-[#F8EAC8] shadow-sm ring-1 ring-[#D6B46C]/35 transition-all hover:brightness-110"
                title="Back to login"
              >
                Sign in
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="scrollbar-thin flex items-center gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
            <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-slate-500 sm:flex dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" /> Filters
            </span>
            <div className="shrink-0">
              <Segmented<RangeKey> value={filters.range} onChange={(v) => set("range", v)} options={RANGES.map((r) => ({ value: r.key, label: r.label }))} />
            </div>
            <div className="w-40 shrink-0">
              <Select<Industry | "All">
                label="Segment"
                icon={<Users className="h-3.5 w-3.5" />}
                value={filters.industry}
                onChange={(v) => set("industry", v)}
                options={[{ value: "All", label: "All segments" }, ...INDUSTRIES.map((i) => ({ value: i, label: i }))]}
              />
            </div>
            <div className="w-40 shrink-0">
              <Select<string>
                label="Plan"
                icon={<Tag className="h-3.5 w-3.5" />}
                value={filters.plan}
                onChange={(v) => set("plan", v)}
                options={[{ value: "All", label: "All plans" }, ...planOptions]}
              />
            </div>
            <div className="w-36 shrink-0">
              <Select<Filters["billing"]>
                label="Billing"
                icon={<Calendar className="h-3.5 w-3.5" />}
                value={filters.billing}
                onChange={(v) => set("billing", v)}
                options={[
                  { value: "All", label: "All billing" },
                  { value: "Monthly", label: "Monthly" },
                  { value: "Annual", label: "Annual" },
                ]}
              />
            </div>
            {filtersActive && (
              <button
                onClick={() => {
                  setFilters(DEFAULT_FILTERS);
                  setStatusFilter("All");
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-5 sm:space-y-5 sm:px-6">
          <div id="top" className="flex scroll-mt-40 flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Portfolio overview</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {rangeLabel} vs previous period
                {filters.industry !== "All" && ` · ${filters.industry}`}
                {filters.plan !== "All" && ` · ${filters.plan} plan`}
                {filters.billing !== "All" && ` · ${filters.billing} billing`}
                {liveMode && lastSync && ` · synced ${lastSync.toLocaleTimeString()}`}
              </p>
            </div>
          </div>

          {authed && apiError && (
            <div className="animate-fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <WifiOff className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1 text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Worker unreachable — showing last known data.</span>{" "}
                <span className="opacity-80">{apiError}</span>
              </div>
              <button
                onClick={() => refreshFromApi(auth)}
                disabled={syncing}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
              >
                {syncing ? "Retrying…" : "Retry"}
              </button>
            </div>
          )}

          {downSites.length > 0 && (
            <div className="animate-fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm dark:border-rose-500/30 dark:bg-rose-500/10">
              <AlertOctagon className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="min-w-0 flex-1 text-rose-800 dark:text-rose-200">
                <span className="font-semibold">{downSites.length} site{downSites.length > 1 ? "s are" : " is"} down:</span>{" "}
                {downSites.map((s) => s.domain).join(", ")}
              </div>
              <button
                onClick={() => setSelectedId(downSites[0].id)}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
              >
                Investigate
              </button>
            </div>
          )}

          {suspendedSites.length > 0 && (
            <div className="animate-fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm dark:border-purple-500/30 dark:bg-purple-500/10">
              <Pause className="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400" />
              <div className="min-w-0 flex-1 text-purple-800 dark:text-purple-200">
                <span className="font-semibold">{suspendedSites.length} suspended site{suspendedSites.length > 1 ? "s" : ""}:</span>{" "}
                {suspendedSites.slice(0, 4).map((s) => s.domain).join(", ")}
                {suspendedSites.length > 4 && ` +${suspendedSites.length - 4} more`}
              </div>
              <button
                onClick={() => {
                  setStatusFilter("Suspended");
                  go("clients");
                }}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
              >
                Review
              </button>
            </div>
          )}

          {liveMode && sites.length === 0 && (
            <div className="animate-fade-up rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">No clients in your Worker yet</div>
              <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                The API connected successfully but returned an empty list. Add your first client to populate the KPIs and charts.
              </p>
              {authed && (
                <button
                  onClick={openCreate}
                  className="mt-4 inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
                >
                  + Add New Client
                </button>
              )}
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
            {d.kpis.map((k, i) => (
              <KpiCard key={k.key} kpi={k} index={i} />
            ))}
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <RevenueChart d={d} dark={dark} />
            <PlanDonut d={d} dark={dark} selected={filters.plan} onSelect={(p) => set("plan", p)} />
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <GrowthBars d={d} dark={dark} />
            <IndustryBars d={d} dark={dark} selected={filters.industry} onSelect={(i) => set("industry", i)} />
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <TrafficChart d={d} dark={dark} />
            <StatusDonut
              d={d}
              dark={dark}
              onStatusClick={(s) => {
                setStatusFilter(s as StatusFilter);
                go("clients");
              }}
            />
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <RequestsChart d={d} dark={dark} />
            <ActivityFeed d={d} logs={logs} />
          </div>

          <SitesTable
            d={d}
            status={statusFilter}
            onStatus={setStatusFilter}
            onOpen={(s) => setSelectedId(s.id)}
            onEdit={authed ? openEditor : undefined}
            onAdd={authed ? openCreate : undefined}
          />

          <footer className="py-6 text-center text-[11px] text-slate-400">
            {authed ? (
              liveMode ? (
                <>Vllora Studio Master Dashboard · {simulated ? "Simulated Worker (local://worker)" : `Connected to ${shortHost}`} · {sites.length} live client{sites.length === 1 ? "" : "s"}</>
              ) : (
                <>Vllora Studio Master Dashboard · Worker unavailable — showing sample data</>
              )
            ) : (
              <>Vllora Studio Master Dashboard · Sample data generated for demonstration</>
            )}
          </footer>
        </main>
      </div>

      <SiteDrawer
        site={selected}
        requests={requests}
        dark={dark}
        onClose={() => setSelectedId(null)}
        onUpdate={onUpdate}
        onResolve={onResolve}
      />

      {editorOpen && authed && (
        <ClientEditor
          site={editingSite}
          form={editorForm}
          setForm={setEditorForm}
          saving={saving}
          saveError={saveError}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => !saving && setEditorOpen(false)}
        />
      )}
    </div>
  );
}
