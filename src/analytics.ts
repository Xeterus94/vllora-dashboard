import {
  DAYS, INDUSTRIES, dayToDate, planColor, type ContentRequest, type Industry, type PlanId,
  type Site, type SiteStatus,
} from "./data";

export type RangeKey = "30d" | "90d" | "6m" | "12m";
export const RANGES: { key: RangeKey; label: string; days: number; bucket: number }[] = [
  { key: "30d", label: "30D", days: 30, bucket: 1 },
  { key: "90d", label: "90D", days: 90, bucket: 7 },
  { key: "6m", label: "6M", days: 182, bucket: 7 },
  { key: "12m", label: "12M", days: 365, bucket: 31 },
];

export interface Filters {
  range: RangeKey;
  industry: Industry | "All";
  plan: PlanId | "All";
  billing: "All" | "Monthly" | "Annual";
}

export const isActive = (s: Site, d: number) =>
  s.startDay <= d && (s.churnDay === null || s.churnDay > d);

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function matchSite(s: Site, f: Filters, ignore?: "industry" | "plan") {
  if (ignore !== "industry" && f.industry !== "All" && s.industry !== f.industry) return false;
  if (ignore !== "plan" && f.plan !== "All" && s.plan !== f.plan) return false;
  if (f.billing !== "All" && s.billing !== f.billing) return false;
  return true;
}

export function periodBounds(range: RangeKey) {
  const r = RANGES.find((x) => x.key === range)!;
  const end = DAYS - 1;
  const start = end - r.days + 1;
  return { len: r.days, bucket: r.bucket, start, end, prevStart: start - r.days, prevEnd: start - 1 };
}

function fmtLabel(d: number, bucket: number) {
  const date = dayToDate(d);
  if (bucket >= 28) return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface Bucket {
  label: string;
  start: number;
  end: number;
  mrr: number;
  prevMrr: number;
  clients: number;
  prevClients: number;
  newClients: number;
  churned: number;
  newMrr: number;
  churnedMrr: number;
  visitors: number;
  prevVisitors: number;
  uptime: number;
  opened: number;
  resolved: number;
}

function uptimeFor(sites: Site[], a: number, b: number) {
  let down = 0;
  let siteDays = 0;
  for (const s of sites) {
    for (let d = Math.max(a, s.startDay); d <= b; d++) {
      if (!isActive(s, d)) continue;
      siteDays++;
      down += s.downtime[d];
    }
  }
  return siteDays === 0 ? 100 : 100 * (1 - down / (siteDays * 1440));
}

function visitorsFor(sites: Site[], a: number, b: number) {
  let v = 0;
  for (const s of sites) for (let d = Math.max(0, a); d <= b; d++) v += s.visitors[d];
  return v;
}

// Suspended subscriptions contribute no MRR and are excluded from the
// active-client count (they surface separately in the status breakdown).
const counted = (s: Site) => s.status !== "Suspended";
const mrrAt = (sites: Site[], d: number) =>
  sum(sites.filter((s) => isActive(s, d) && counted(s)).map((s) => s.mrr));
const countAt = (sites: Site[], d: number) =>
  sites.filter((s) => isActive(s, d) && counted(s)).length;
const openAt = (reqs: ContentRequest[], d: number) =>
  reqs.filter((r) => r.createdDay <= d && (r.resolvedDay === null || r.resolvedDay > d)).length;

export interface Kpi {
  key: string;
  label: string;
  value: number;
  prev: number;
  format: "currency" | "number" | "percent" | "days";
  goodWhenUp: boolean;
  spark: number[];
  hint: string;
}

export function computeDashboard(allSites: Site[], allReqs: ContentRequest[], f: Filters) {
  const { len, bucket, start, end, prevStart, prevEnd } = periodBounds(f.range);
  const sites = allSites.filter((s) => matchSite(s, f));
  const ids = new Set(sites.map((s) => s.id));
  const reqs = allReqs.filter((r) => ids.has(r.siteId));

  // ---- Buckets (built backwards so the last bucket ends today)
  const buckets: Bucket[] = [];
  for (let be = end; be >= start; be -= bucket) {
    const bs = Math.max(start, be - bucket + 1);
    const created = reqs.filter((r) => r.createdDay >= bs && r.createdDay <= be).length;
    const resolved = reqs.filter((r) => r.resolvedDay !== null && r.resolvedDay >= bs && r.resolvedDay <= be).length;
    const newS = sites.filter((s) => s.startDay >= bs && s.startDay <= be);
    const churnS = sites.filter((s) => s.churnDay !== null && s.churnDay >= bs && s.churnDay <= be);
    buckets.unshift({
      label: fmtLabel(be, bucket),
      start: bs,
      end: be,
      mrr: Math.round(mrrAt(sites, be)),
      prevMrr: Math.round(mrrAt(sites, be - len)),
      clients: countAt(sites, be),
      prevClients: countAt(sites, be - len),
      newClients: newS.length,
      churned: churnS.length,
      newMrr: Math.round(sum(newS.map((s) => s.mrr))),
      churnedMrr: Math.round(sum(churnS.map((s) => s.mrr))),
      visitors: visitorsFor(sites, bs, be),
      prevVisitors: visitorsFor(sites, bs - len, be - len),
      uptime: Math.round(uptimeFor(sites, bs, be) * 1000) / 1000,
      opened: created,
      resolved,
    });
  }

  // ---- KPIs
  const mrr = mrrAt(sites, end);
  const prevMrr = mrrAt(sites, prevEnd);
  const clients = countAt(sites, end);
  const prevClients = countAt(sites, prevEnd);
  const churnRate = (a: number, b: number) => {
    const base = countAt(sites, a - 1) + sites.filter((s) => s.startDay >= a && s.startDay <= b).length;
    const lost = sites.filter((s) => s.churnDay !== null && s.churnDay >= a && s.churnDay <= b).length;
    return base === 0 ? 0 : (100 * lost) / base;
  };
  const turnaround = (a: number, b: number) => {
    const done = reqs.filter((r) => r.resolvedDay !== null && r.resolvedDay >= a && r.resolvedDay <= b);
    return done.length ? sum(done.map((r) => r.resolvedDay! - r.createdDay)) / done.length : 0;
  };
  const visitors = visitorsFor(sites, start, end);
  const prevVisitors = visitorsFor(sites, prevStart, prevEnd);

  const kpis: Kpi[] = [
    {
      key: "mrr", label: "Monthly Recurring Revenue", value: mrr, prev: prevMrr, format: "currency",
      goodWhenUp: true, spark: buckets.map((b) => b.mrr), hint: `ARR ${fmtCurrency(mrr * 12, true)}`,
    },
    {
      key: "clients", label: "Active Clients", value: clients, prev: prevClients, format: "number",
      goodWhenUp: true, spark: buckets.map((b) => b.clients),
      hint: `ARPC ${fmtCurrency(clients ? mrr / clients : 0)}`,
    },
    {
      key: "churn", label: "Client Churn", value: churnRate(start, end), prev: churnRate(prevStart, prevEnd),
      format: "percent", goodWhenUp: false, spark: buckets.map((b) => b.churned),
      hint: `${sites.filter((s) => s.churnDay !== null && s.churnDay >= start).length} cancelled this period`,
    },
    {
      key: "uptime", label: "Portfolio Uptime", value: uptimeFor(sites, start, end),
      prev: uptimeFor(sites, prevStart, prevEnd), format: "percent", goodWhenUp: true,
      spark: buckets.map((b) => b.uptime), hint: "SLA target 99.90%",
    },
    {
      key: "visitors", label: "Site Visitors (sample)", value: visitors, prev: prevVisitors, format: "number",
      goodWhenUp: true, spark: buckets.map((b) => b.visitors),
      hint: `Illustrative history · ${fmtNumber(Math.round(visitors / len))} / day avg`,
    },
    {
      key: "requests", label: "Open Content Requests", value: openAt(reqs, end), prev: openAt(reqs, prevEnd),
      format: "number", goodWhenUp: false, spark: buckets.map((b) => b.opened),
      hint: `Avg turnaround ${turnaround(start, end).toFixed(1)}d`,
    },
  ];

  // ---- Breakdowns (cross-filter: ignore own dimension so the selection can be highlighted)
  // Plans are grouped dynamically so live API plans (Basic/Standard/WaaS)
  // and demo plans both render without code changes.
  const planSites = allSites.filter((s) => matchSite(s, f, "plan") && isActive(s, end));
  const planOrder = new Map<string, number>();
  planSites.forEach((s) => {
    if (!planOrder.has(s.plan)) planOrder.set(s.plan, planOrder.size);
  });
  const byPlan = [...planOrder.keys()]
    .map((name) => {
      const ss = planSites.filter((s) => s.plan === name);
      return { name, value: Math.round(sum(ss.map((s) => s.mrr))), count: ss.length, color: planColor(name) };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  const indSites = allSites.filter((s) => matchSite(s, f, "industry"));
  const byIndustry = INDUSTRIES.map((ind) => {
    const ss = indSites.filter((s) => s.industry === ind);
    return {
      name: ind,
      current: Math.round(mrrAt(ss, end)),
      previous: Math.round(mrrAt(ss, prevEnd)),
      clients: countAt(ss, end),
    };
  }).sort((a, b) => b.current - a.current);

  const activeNow = sites.filter((s) => isActive(s, end));
  const statuses: SiteStatus[] = ["Online", "Suspended", "Degraded", "Maintenance", "Down"];
  const byStatus = statuses
    .map((st) => ({ name: st, value: activeNow.filter((s) => s.status === st).length }))
    .filter((s) => s.value > 0 || s.name === "Online" || s.name === "Suspended");

  const reqTypes = new Map<string, number>();
  reqs
    .filter((r) => r.createdDay >= start && r.createdDay <= end)
    .forEach((r) => reqTypes.set(r.type, (reqTypes.get(r.type) ?? 0) + 1));
  const byType = [...reqTypes.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return { buckets, kpis, byPlan, byIndustry, byStatus, byType, sites, reqs, start, end, len };
}

export type Dashboard = ReturnType<typeof computeDashboard>;

// ---- Formatting helpers
export function fmtCurrency(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : n % 1 === 0 || Math.abs(n) >= 1000 ? 0 : 2,
  }).format(n);
}
export function fmtNumber(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}
export function fmtKpi(v: number, format: Kpi["format"]) {
  switch (format) {
    case "currency": return fmtCurrency(v);
    case "percent": return `${v.toFixed(v > 99 ? 2 : 1)}%`;
    case "days": return `${v.toFixed(1)}d`;
    default: return fmtNumber(v, v >= 100000);
  }
}
export function fmtDate(d: number) {
  return dayToDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export function daysAgo(d: number) {
  const diff = DAYS - 1 - d;
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 30) return `${diff}d ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}
