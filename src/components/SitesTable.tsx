import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, ExternalLink, Pencil, Plus, Search } from "lucide-react";
import { daysAgo, fmtCurrency, fmtNumber, isActive, type Dashboard } from "../analytics";
import { INDUSTRY_COLORS, planColor, PLAN_MAP, type Site } from "../data";
import { Card, StatusPill } from "./ui";
import { cn } from "../utils/cn";

export interface Row {
  site: Site;
  status: string;
  uptime: number;
  visitors: number;
  open: number;
  sparkline: number[];
}

type SortKey = "client" | "industry" | "plan" | "mrr" | "status" | "uptime" | "visitors" | "open" | "since" | "published";

const STATUS_ORDER: Record<string, number> = { Down: 0, Suspended: 1, Degraded: 2, Maintenance: 3, Online: 4, Cancelled: 5 };
export const STATUS_FILTERS = ["All", "Online", "Suspended", "Degraded", "Down", "Maintenance", "Cancelled"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export function buildRows(d: Dashboard): Row[] {
  const openBySite = new Map<string, number>();
  d.reqs.forEach((r) => {
    if (r.resolvedDay === null) openBySite.set(r.siteId, (openBySite.get(r.siteId) ?? 0) + 1);
  });
  return d.sites
    .filter((s) => s.startDay <= d.end && (s.churnDay === null || s.churnDay >= d.start - d.len))
    .map((s) => {
      let down = 0, days = 0, vis = 0;
      for (let i = Math.max(d.start, s.startDay); i <= d.end; i++) {
        vis += s.visitors[i];
        if (isActive(s, i)) {
          days++;
          down += s.downtime[i];
        }
      }
      const spark: number[] = [];
      for (let i = d.end - 13; i <= d.end; i++) spark.push(s.visitors[i]);
      return {
        site: s,
        status: s.churnDay !== null ? "Cancelled" : s.status,
        uptime: days ? 100 * (1 - down / (days * 1440)) : 0,
        visitors: vis,
        open: openBySite.get(s.id) ?? 0,
        sparkline: spark,
      };
    });
}

function MiniSpark({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 60},${18 - (v / max) * 16}`).join(" ");
  return (
    <svg viewBox="0 0 60 20" className="h-5 w-14 overflow-visible">
      <polyline points={pts} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const PAGE = 10;

export function SitesTable({
  d, status, onStatus, onOpen, onEdit, onAdd,
}: {
  d: Dashboard;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  onOpen: (s: Site) => void;
  onEdit?: (s: Site) => void;
  onAdd?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "mrr", dir: "desc" });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => buildRows(d), [d]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: rows.length };
    rows.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (status === "All" || r.status === status) &&
        (!q ||
          r.site.client.toLowerCase().includes(q) ||
          r.site.domain.toLowerCase().includes(q) ||
          r.site.contact.toLowerCase().includes(q) ||
          r.site.cms.toLowerCase().includes(q))
    );
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case "client": return r.site.client;
        case "industry": return r.site.industry;
        case "plan": return PLAN_MAP[r.site.plan]?.price ?? r.site.mrr;
        case "mrr": return r.status === "Cancelled" ? -1 : r.site.mrr;
        case "status": return STATUS_ORDER[r.status];
        case "uptime": return r.uptime;
        case "visitors": return r.visitors;
        case "open": return r.open;
        case "since": return r.site.startDay;
        case "published": return r.site.lastPublishDay;
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.dir === "asc" ? c : -c;
    });
  }, [rows, query, status, sort]);

  useEffect(() => setPage(0), [query, status, d]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "client" || key === "industry" ? "asc" : "desc" }));

  const exportCsv = () => {
    const header = ["Client", "Domain", "Contact", "Segment", "Plan", "Billing", "MRR", "Status", "Uptime %", "Visitors (sample)", "Open requests", "CMS"];
    const lines = filtered.map((r) =>
      [r.site.client, r.site.domain, r.site.contact, r.site.industry, r.site.plan, r.site.billing, r.site.mrr, r.status, r.uptime.toFixed(3), r.visitors, r.open, r.site.cms]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vllora-studio-clients.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const Th = ({ k, children, className }: { k: SortKey; children: ReactNode; className?: string }) => (
    <th className={cn("whitespace-nowrap px-3 py-2.5 font-medium", className)}>
      <button
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-slate-900 dark:hover:text-white",
          sort.key === k && "text-slate-900 dark:text-white"
        )}
      >
        {children}
        {sort.key === k ? (
          sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <Card
      id="clients"
      title="Client sites & subscriptions"
      subtitle={`${filtered.length} of ${rows.length} sites · click a row for details${onEdit ? " or Edit to change billing & CMS" : ""}`}
      action={
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client, domain, CMS…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 sm:w-60 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          {onAdd && (
            <button
              onClick={onAdd}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#6B1C2E] to-[#4A1120] px-3 text-xs font-semibold text-[#F8EAC8] shadow-sm shadow-[#4F1321]/25 ring-1 ring-[#D6B46C]/35 transition-all hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5 text-[#E8CB8A]" /> Add New Client
            </button>
          )}
        </div>
      }
      className="p-0 sm:p-0 [&>header]:px-4 [&>header]:pt-4 sm:[&>header]:px-5 sm:[&>header]:pt-5"
    >
      <div className="scrollbar-thin flex gap-1.5 overflow-x-auto px-4 pb-3 sm:px-5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => onStatus(s)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
              status === s
                ? "border-indigo-500 bg-indigo-500 text-white shadow-sm shadow-indigo-500/30"
                : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            {s}
            <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", status === s ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800")}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[1060px] text-left text-xs">
          <thead className="border-y border-slate-100 bg-slate-50/70 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <Th k="client" className="pl-4 sm:pl-5">Client / site</Th>
              <Th k="industry">Segment</Th>
              <Th k="plan">Plan</Th>
              <Th k="mrr">MRR</Th>
              <Th k="status">Status</Th>
              <Th k="uptime">Uptime</Th>
              <Th k="visitors">Visitors (sample)</Th>
              <Th k="open">Requests</Th>
              <Th k="since">Client since</Th>
              <Th k="published">Last publish</Th>
              {onEdit && <th className="whitespace-nowrap px-3 py-2.5 pr-4 text-right font-medium sm:pr-5">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((r) => (
              <tr
                key={r.site.id}
                onClick={() => onOpen(r.site)}
                className={cn(
                  "group cursor-pointer transition-colors hover:bg-indigo-50/40 dark:hover:bg-slate-800/50",
                  r.status === "Cancelled" && "opacity-60"
                )}
              >
                <td className="py-2.5 pl-4 pr-3 sm:pl-5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
                      style={{ background: INDUSTRY_COLORS[r.site.industry] }}
                    >
                      {r.site.client.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900 dark:text-white">{r.site.client}</div>
                      <div className="flex items-center gap-1 truncate text-[11px] text-slate-400">
                        {r.site.domain}
                        <ExternalLink className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{r.site.industry}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: planColor(r.site.plan) }} />
                    <span className="font-medium text-slate-700 dark:text-slate-200">{r.site.plan}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{r.site.billing}</div>
                </td>
                <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900 dark:text-white">
                  {r.status === "Cancelled" ? <span className="text-slate-400 line-through">{fmtCurrency(r.site.mrr)}</span> : fmtCurrency(r.site.mrr)}
                </td>
                <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      r.uptime >= 99.9 ? "text-emerald-600 dark:text-emerald-400" : r.uptime >= 99.5 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {r.uptime ? `${r.uptime.toFixed(2)}%` : "—"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-12 tabular-nums text-slate-700 dark:text-slate-200">{fmtNumber(r.visitors, true)}</span>
                    <MiniSpark data={r.sparkline} />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {r.open > 0 ? (
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      {r.open} open
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{daysAgo(r.site.startDay)}</td>
                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">{daysAgo(r.site.lastPublishDay)}</td>
                {onEdit && (
                  <td className="py-2.5 pl-3 pr-4 text-right sm:pr-5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onEdit(r.site)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:text-indigo-400 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={onEdit ? 11 : 10} className="py-12 text-center text-sm text-slate-400">
                  No sites match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5 dark:border-slate-800 dark:text-slate-400">
        <span>
          Showing {filtered.length ? page * PAGE + 1 : 0}–{Math.min(filtered.length, (page + 1) * PAGE)} of {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 tabular-nums">
            {page + 1} / {pages}
          </span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
