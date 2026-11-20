/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { fmtCurrency, fmtNumber, type Dashboard } from "../analytics";
import { INDUSTRY_COLORS, STATUS_COLORS, type Industry, type PlanId } from "../data";
import { Card, Legend, Segmented, TooltipBox, useChartTheme } from "./ui";
import { cn } from "../utils/cn";

const ANIM = { animationDuration: 650, animationEasing: "ease-out" as const };

function axisProps(t: ReturnType<typeof useChartTheme>) {
  return {
    tick: { fill: t.axis, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  };
}

/* ------------------------------------------------------------------ Revenue */
export function RevenueChart({ d, dark }: { d: Dashboard; dark: boolean }) {
  const t = useChartTheme(dark);
  const [metric, setMetric] = useState<"mrr" | "clients">("mrr");
  const isMrr = metric === "mrr";
  const key = isMrr ? "mrr" : "clients";
  const prevKey = isMrr ? "prevMrr" : "prevClients";
  const fmt = (v: number) => (isMrr ? fmtCurrency(v) : fmtNumber(v));
  const first = d.buckets[0]?.[key] ?? 0;
  const last = d.buckets[d.buckets.length - 1]?.[key] ?? 0;
  const growth = first ? ((last - first) / first) * 100 : 0;

  return (
    <Card
      id="revenue"
      title="Recurring revenue growth"
      subtitle={
        <>
          {isMrr ? "MRR" : "Active subscriptions"} over the selected period ·{" "}
          <span className={growth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            {growth >= 0 ? "+" : ""}
            {growth.toFixed(1)}%
          </span>
        </>
      }
      action={
        <div className="flex flex-wrap items-center gap-3">
          <Legend items={[{ label: "Current", color: t.primary }, { label: "Previous period", color: t.axis, dashed: true }]} />
          <Segmented
            size="sm"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "mrr", label: "MRR" },
              { value: "clients", label: "Clients" },
            ]}
          />
        </div>
      }
      className="lg:col-span-2"
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={d.buckets} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={t.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps(t)} minTickGap={24} />
            <YAxis
              {...axisProps(t)}
              width={56}
              domain={["auto", "auto"]}
              tickFormatter={(v) => (isMrr ? fmtCurrency(v, true) : fmtNumber(v))}
            />
            <Tooltip
              cursor={{ stroke: t.axis, strokeDasharray: "3 3" }}
              content={({ active, payload, label }: any) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={label}
                    rows={[
                      { name: "Current", value: fmt(payload[0].payload[key]), color: t.primary },
                      { name: "Prev. period", value: fmt(payload[0].payload[prevKey]), color: t.axis },
                      { name: "New", value: isMrr ? `+${fmtCurrency(payload[0].payload.newMrr)}` : `+${payload[0].payload.newClients}`, color: "#10b981" },
                      { name: "Churned", value: isMrr ? `−${fmtCurrency(payload[0].payload.churnedMrr)}` : `−${payload[0].payload.churned}`, color: "#f43f5e" },
                    ]}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey={prevKey} stroke={t.axis} strokeDasharray="4 4" strokeWidth={1.5} dot={false} {...ANIM} />
            <Area
              type="monotone"
              dataKey={key}
              stroke={t.primary}
              strokeWidth={2.5}
              fill="url(#mrrFill)"
              activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }}
              {...ANIM}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- Plan donut */
export function PlanDonut({
  d, dark, selected, onSelect,
}: {
  d: Dashboard;
  dark: boolean;
  selected: PlanId | "All";
  onSelect: (p: PlanId | "All") => void;
}) {
  const t = useChartTheme(dark);
  const [hover, setHover] = useState<number | null>(null);
  const total = d.byPlan.reduce((a, b) => a + b.value, 0);
  const focus = hover !== null ? d.byPlan[hover] : selected !== "All" ? d.byPlan.find((p) => p.name === selected) : null;

  return (
    <Card title="MRR by hosting plan" subtitle="Click a slice to filter the dashboard">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={d.byPlan}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={2}
              cornerRadius={4}
              stroke={t.surface}
              strokeWidth={2}
              onMouseEnter={(_: any, i: number) => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={(_: any, i: number) => {
                const name = d.byPlan[i].name as PlanId;
                onSelect(selected === name ? "All" : name);
              }}
              {...ANIM}
            >
              {d.byPlan.map((p, i) => (
                <Cell
                  key={p.name}
                  fill={p.color}
                  className="cursor-pointer"
                  opacity={
                    (selected !== "All" && selected !== p.name) || (hover !== null && hover !== i) ? 0.35 : 1
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {focus ? focus.name : "Total MRR"}
            </div>
            <div className="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {fmtCurrency(focus ? focus.value : total)}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {focus
                ? `${focus.count} sites · ${total ? ((focus.value / total) * 100).toFixed(0) : 0}%`
                : `${d.byPlan.reduce((a, b) => a + b.count, 0)} active sites`}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {d.byPlan.map((p, i) => (
          <button
            key={p.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(selected === p.name ? "All" : (p.name as PlanId))}
            className={cn(
              "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
              selected === p.name
                ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10"
                : "border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
            )}
          >
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{p.count}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

/* --------------------------------------------------- New vs churned clients */
export function GrowthBars({ d, dark }: { d: Dashboard; dark: boolean }) {
  const t = useChartTheme(dark);
  const data = d.buckets.map((b) => ({ ...b, churnedNeg: -b.churnedMrr, net: b.newMrr - b.churnedMrr }));
  const totalNew = d.buckets.reduce((a, b) => a + b.newMrr, 0);
  const totalLost = d.buckets.reduce((a, b) => a + b.churnedMrr, 0);
  return (
    <Card
      title="New vs churned MRR"
      subtitle={
        <>
          Net new <span className="font-semibold text-slate-700 dark:text-slate-200">{fmtCurrency(totalNew - totalLost)}</span> this period
        </>
      }
      action={<Legend items={[{ label: "New", color: "#10b981" }, { label: "Churned", color: "#f43f5e" }, { label: "Net", color: t.primary }]} />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} stackOffset="sign" margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps(t)} minTickGap={20} />
            <YAxis {...axisProps(t)} width={52} tickFormatter={(v) => fmtCurrency(v, true)} />
            <ReferenceLine y={0} stroke={t.axis} strokeOpacity={0.5} />
            <Tooltip
              cursor={{ fill: t.cursor }}
              content={({ active, payload, label }: any) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={label}
                    rows={[
                      { name: `New (${payload[0].payload.newClients})`, value: `+${fmtCurrency(payload[0].payload.newMrr)}`, color: "#10b981" },
                      { name: `Churned (${payload[0].payload.churned})`, value: `−${fmtCurrency(payload[0].payload.churnedMrr)}`, color: "#f43f5e" },
                      { name: "Net", value: fmtCurrency(payload[0].payload.net), color: t.primary },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="newMrr" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} {...ANIM} />
            <Bar dataKey="churnedNeg" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} {...ANIM} />
            <Line type="monotone" dataKey="net" stroke={t.primary} strokeWidth={2} dot={false} {...ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------ Revenue by industry */
export function IndustryBars({
  d, dark, selected, onSelect,
}: {
  d: Dashboard;
  dark: boolean;
  selected: Industry | "All";
  onSelect: (i: Industry | "All") => void;
}) {
  const t = useChartTheme(dark);
  return (
    <Card
      title="MRR by client segment"
      subtitle="Current vs previous period · click a bar to filter"
      action={<Legend items={[{ label: "Current", color: t.primary }, { label: "Previous", color: t.secondary }]} />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d.byIndustry} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid stroke={t.grid} horizontal={false} />
            <XAxis type="number" {...axisProps(t)} tickFormatter={(v) => fmtCurrency(v, true)} />
            <YAxis type="category" dataKey="name" {...axisProps(t)} width={92} />
            <Tooltip
              cursor={{ fill: t.cursor }}
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                const ch = p.previous ? ((p.current - p.previous) / p.previous) * 100 : 0;
                return (
                  <TooltipBox
                    title={label}
                    rows={[
                      { name: "Current MRR", value: fmtCurrency(p.current), color: INDUSTRY_COLORS[p.name as Industry] },
                      { name: "Previous", value: fmtCurrency(p.previous), color: t.secondary },
                      { name: "Change", value: `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` },
                      { name: "Active clients", value: String(p.clients) },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="current"
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              className="cursor-pointer"
              onClick={(_: any, i: number) => {
                const name = d.byIndustry[i].name as Industry;
                onSelect(selected === name ? "All" : name);
              }}
              {...ANIM}
            >
              {d.byIndustry.map((row) => (
                <Cell
                  key={row.name}
                  fill={INDUSTRY_COLORS[row.name as Industry]}
                  opacity={selected === "All" || selected === row.name ? 1 : 0.3}
                />
              ))}
            </Bar>
            <Bar dataKey="previous" fill={t.secondary} radius={[0, 4, 4, 0]} maxBarSize={14} {...ANIM} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------ Traffic & uptime */
export function TrafficChart({ d, dark }: { d: Dashboard; dark: boolean }) {
  const t = useChartTheme(dark);
  const [view, setView] = useState<"visitors" | "uptime">("visitors");
  const minUp = Math.min(...d.buckets.map((b) => b.uptime), 99.9);
  return (
    <Card
      id="sites"
      title="Hosted sites performance"
      subtitle={view === "visitors" ? "Illustrative traffic history (not live visitor data)" : "Portfolio uptime vs 99.9% SLA"}
      action={
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "visitors", label: "Traffic" },
            { value: "uptime", label: "Uptime" },
          ]}
        />
      }
      className="lg:col-span-2"
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {view === "visitors" ? (
            <AreaChart data={d.buckets} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <defs>
                <linearGradient id="visFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps(t)} minTickGap={24} />
              <YAxis {...axisProps(t)} width={52} tickFormatter={(v) => fmtNumber(v, true)} />
              <Tooltip
                cursor={{ stroke: t.axis, strokeDasharray: "3 3" }}
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={label}
                      rows={[
                        { name: "Visitors", value: fmtNumber(payload[0].payload.visitors), color: "#8b5cf6" },
                        { name: "Prev. period", value: fmtNumber(payload[0].payload.prevVisitors), color: t.axis },
                      ]}
                    />
                  ) : null
                }
              />
              <Area type="monotone" dataKey="prevVisitors" stroke={t.axis} strokeDasharray="4 4" fill="none" strokeWidth={1.5} {...ANIM} />
              <Area type="monotone" dataKey="visitors" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#visFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }} {...ANIM} />
            </AreaChart>
          ) : (
            <LineChart data={d.buckets} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" {...axisProps(t)} minTickGap={24} />
              <YAxis
                {...axisProps(t)}
                width={56}
                domain={[Math.floor((minUp - 0.05) * 10) / 10, 100]}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              <ReferenceLine y={99.9} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "SLA", fill: "#f59e0b", fontSize: 10, position: "insideTopLeft" }} />
              <Tooltip
                cursor={{ stroke: t.axis, strokeDasharray: "3 3" }}
                content={({ active, payload, label }: any) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={label}
                      rows={[{ name: "Uptime", value: `${payload[0].payload.uptime.toFixed(3)}%`, color: "#10b981" }]}
                    />
                  ) : null
                }
              />
              <Line
                type="monotone"
                dataKey="uptime"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: t.surface }}
                {...ANIM}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- Status donut */
export function StatusDonut({ d, dark, onStatusClick }: { d: Dashboard; dark: boolean; onStatusClick: (s: string) => void }) {
  const t = useChartTheme(dark);
  const total = d.byStatus.reduce((a, b) => a + b.value, 0);
  const online = d.byStatus.find((s) => s.name === "Online")?.value ?? 0;
  return (
    <Card title="Live site status" subtitle="Right now across all hosted sites">
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={d.byStatus.filter((s) => s.value > 0)}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="95%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              cornerRadius={4}
              stroke={t.surface}
              strokeWidth={2}
              {...ANIM}
            >
              {d.byStatus.filter((s) => s.value > 0).map((s) => (
                <Cell key={s.name} fill={STATUS_COLORS[s.name as keyof typeof STATUS_COLORS]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }: any) =>
                active && payload?.length ? (
                  <TooltipBox
                    rows={[{ name: payload[0].name, value: `${payload[0].value} sites`, color: STATUS_COLORS[payload[0].name as keyof typeof STATUS_COLORS] }]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
              {total ? Math.round((online / total) * 100) : 0}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">healthy</div>
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {d.byStatus.map((s) => (
          <li key={s.name}>
            <button
              onClick={() => onStatusClick(s.name)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[s.name as keyof typeof STATUS_COLORS] }} />
                {s.name}
              </span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{s.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------- Content requests */
export function RequestsChart({ d, dark }: { d: Dashboard; dark: boolean }) {
  const t = useChartTheme(dark);
  const opened = d.buckets.reduce((a, b) => a + b.opened, 0);
  const resolved = d.buckets.reduce((a, b) => a + b.resolved, 0);
  const maxType = Math.max(1, ...d.byType.map((x) => x.value));
  return (
    <Card
      id="content"
      title="Content update requests"
      subtitle={`${fmtNumber(opened)} opened · ${fmtNumber(resolved)} resolved this period`}
      action={<Legend items={[{ label: "Opened", color: "#f59e0b" }, { label: "Resolved", color: "#10b981" }]} />}
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={d.buckets} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2}>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="label" {...axisProps(t)} minTickGap={20} />
            <YAxis {...axisProps(t)} allowDecimals={false} width={44} />
            <Tooltip
              cursor={{ fill: t.cursor }}
              content={({ active, payload, label }: any) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={label}
                    rows={[
                      { name: "Opened", value: String(payload[0].payload.opened), color: "#f59e0b" },
                      { name: "Resolved", value: String(payload[0].payload.resolved), color: "#10b981" },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="opened" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={16} {...ANIM} />
            <Bar dataKey="resolved" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={16} {...ANIM} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {d.byType.slice(0, 5).map((r) => (
          <div key={r.name} className="flex items-center gap-3 text-xs">
            <span className="w-24 shrink-0 truncate text-slate-500 dark:text-slate-400">{r.name}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                style={{ width: `${(r.value / maxType) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
