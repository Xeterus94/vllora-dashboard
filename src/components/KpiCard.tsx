import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus, Activity, DollarSign, Globe, Inbox, ShieldCheck, Users, UserMinus } from "lucide-react";
import { fmtKpi, type Kpi } from "../analytics";
import { cn } from "../utils/cn";

const ICONS: Record<string, typeof DollarSign> = {
  mrr: DollarSign, clients: Users, churn: UserMinus, uptime: ShieldCheck, visitors: Globe, requests: Inbox,
};
const ACCENT: Record<string, string> = {
  mrr: "#6366f1", clients: "#06b6d4", churn: "#f43f5e", uptime: "#10b981", visitors: "#8b5cf6", requests: "#f59e0b",
};

export function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const Icon = ICONS[kpi.key] ?? Activity;
  const color = ACCENT[kpi.key] ?? "#6366f1";
  const isPct = kpi.format === "percent";
  const delta = isPct ? kpi.value - kpi.prev : kpi.prev === 0 ? (kpi.value > 0 ? 100 : 0) : ((kpi.value - kpi.prev) / Math.abs(kpi.prev)) * 100;
  const flat = Math.abs(delta) < (isPct ? 0.005 : 0.05);
  const up = delta > 0;
  const good = flat ? null : up === kpi.goodWhenUp;
  const deltaLabel = isPct
    ? `${up ? "+" : ""}${delta.toFixed(Math.abs(delta) < 0.1 ? 2 : 1)} pts`
    : `${up ? "+" : ""}${delta.toFixed(1)}%`;
  const Arrow = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const data = kpi.spark.map((v, i) => ({ i, v }));
  const id = `spark-${kpi.key}`;

  return (
    <div
      className="card group relative overflow-hidden p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md animate-fade-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-tight text-slate-500 dark:text-slate-400">{kpi.label}</span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1a`, color }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">
        {fmtKpi(kpi.value, kpi.format)}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            good === null && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            good === true && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
            good === false && "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
          )}
        >
          <Arrow className="h-3 w-3" />
          {flat ? "0.0%" : deltaLabel}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">vs prev. period</span>
      </div>
      <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{kpi.hint}</div>
      <div className="pointer-events-none -mx-4 -mb-4 mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
