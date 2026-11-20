import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  CheckCircle2, Globe, Lock, Power, RefreshCw, Rocket, ShieldAlert, Wrench, X, Zap, Mail, Server,
} from "lucide-react";
import { DAYS, PLAN_MAP, dayToDate, type ContentRequest, type Site, type SiteStatus } from "../data";
import { daysAgo, fmtCurrency, fmtDate, fmtNumber } from "../analytics";
import { StatusPill, TooltipBox, useChartTheme } from "./ui";
import { cn } from "../utils/cn";

export function SiteDrawer({
  site, requests, dark, onClose, onUpdate, onResolve,
}: {
  site: Site | null;
  requests: ContentRequest[];
  dark: boolean;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Site>, log: string) => void;
  onResolve: (ids: string[], siteName: string) => void;
}) {
  const t = useChartTheme(dark);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = useMemo(
    () => (site ? requests.filter((r) => r.siteId === site.id && r.resolvedDay === null).sort((a, b) => b.createdDay - a.createdDay) : []),
    [site, requests]
  );
  const traffic = useMemo(() => {
    if (!site) return [];
    const out = [];
    for (let i = DAYS - 30; i < DAYS; i++)
      out.push({ label: dayToDate(i).toLocaleDateString("en-US", { month: "short", day: "numeric" }), v: site.visitors[i], down: site.downtime[i] });
    return out;
  }, [site]);

  if (!site) return null;
  const cancelled = site.churnDay !== null;
  const status: string = cancelled ? "Cancelled" : site.status;
  const visitors30 = traffic.reduce((a, b) => a + b.v, 0);
  const incidents = traffic.filter((x) => x.down > 15).length;

  const run = (key: string, fn: () => void, ms = 900) => {
    setBusy(key);
    setTimeout(() => {
      fn();
      setBusy(null);
    }, ms);
  };
  const setStatus = (s: SiteStatus, log: string, extra: Partial<Site> = {}) => onUpdate(site.id, { status: s, ...extra }, log);

  const Action = ({
    k, icon: Icon, label, desc, onClick, tone = "default", disabled,
  }: {
    k: string; icon: typeof Power; label: string; desc: string; onClick: () => void; tone?: "default" | "warn" | "good"; disabled?: boolean;
  }) => (
    <button
      disabled={disabled || busy !== null}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
        "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/5"
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          tone === "warn" && "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
          tone === "good" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
          tone === "default" && "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
        )}
      >
        {busy === k ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{desc}</span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <aside className="animate-slide-in scrollbar-thin relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/90 px-5 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold">{site.client}</h2>
                <StatusPill status={status} />
              </div>
              <a className="mt-0.5 flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400" href="#" onClick={(e) => e.preventDefault()}>
                <Globe className="h-3 w-3" /> {site.domain}
              </a>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "MRR", v: fmtCurrency(site.mrr) },
              { l: "Visitors 30d", v: fmtNumber(visitors30, true) },
              { l: "Load time", v: `${(site.loadTimeMs / 1000).toFixed(2)}s` },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{x.l}</div>
                <div className="mt-0.5 text-sm font-semibold tabular-nums">{x.v}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">Traffic · last 30 days</span>
              <span className="text-slate-500 dark:text-slate-400">{incidents} incident{incidents === 1 ? "" : "s"}</span>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={traffic} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="drawerFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" hide />
                  <Tooltip
                    cursor={{ stroke: t.axis, strokeDasharray: "3 3" }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload, label }: any) =>
                      active && payload?.length ? (
                        <TooltipBox
                          title={label}
                          rows={[
                            { name: "Visitors", value: fmtNumber(payload[0].payload.v), color: "#8b5cf6" },
                            { name: "Downtime", value: `${payload[0].payload.down} min`, color: "#ef4444" },
                          ]}
                        />
                      ) : null
                    }
                  />
                  <Area type="monotone" dataKey="v" stroke="#8b5cf6" strokeWidth={2} fill="url(#drawerFill)" animationDuration={600} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {!cancelled && (
            <div>
              <h3 className="mb-2 text-xs font-semibold">Site administration</h3>
              <div className="grid gap-2">
                {(site.status === "Down" || site.status === "Degraded") && (
                  <Action
                    k="heal"
                    icon={Zap}
                    tone="good"
                    label="Restart & purge CDN cache"
                    desc="Restarts the edge function and re-runs uptime checks"
                    onClick={() =>
                      run("heal", () => setStatus("Online", `Restored ${site.client} — site back online`, { loadTimeMs: 620 + Math.round(Math.random() * 400) }), 1400)
                    }
                  />
                )}
                <Action
                  k="maint"
                  icon={Wrench}
                  tone="warn"
                  label={site.status === "Maintenance" ? "Disable maintenance mode" : "Enable maintenance mode"}
                  desc={site.status === "Maintenance" ? "Take the site live again for visitors" : "Show a branded 'back soon' page to visitors"}
                  onClick={() =>
                    run("maint", () =>
                      site.status === "Maintenance"
                        ? setStatus("Online", `${site.client} is live again`)
                        : setStatus("Maintenance", `${site.client} put into maintenance mode`)
                    )
                  }
                />
                <Action
                  k="publish"
                  icon={Rocket}
                  label={`Publish pending changes${open.length ? ` (${open.length})` : ""}`}
                  desc={open.length ? "Deploy all queued content updates to production" : "No queued updates — redeploy current build"}
                  onClick={() =>
                    run("publish", () => {
                      if (open.length) onResolve(open.map((r) => r.id), site.client);
                      onUpdate(site.id, { lastPublishDay: DAYS - 1 }, `Deployed ${site.client} to production`);
                    }, 1200)
                  }
                />
                <Action
                  k="ssl"
                  icon={site.sslDaysLeft < 21 ? ShieldAlert : Lock}
                  tone={site.sslDaysLeft < 21 ? "warn" : "default"}
                  label="Renew SSL certificate"
                  desc={`Current certificate expires in ${site.sslDaysLeft} days`}
                  disabled={site.sslDaysLeft > 300}
                  onClick={() => run("ssl", () => onUpdate(site.id, { sslDaysLeft: 365 }, `Renewed SSL for ${site.domain}`))}
                />
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">Open content requests</h3>
              <span className="text-[11px] text-slate-500">{open.length} pending</span>
            </div>
            {open.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Inbox zero — all client requests handled.
              </div>
            ) : (
              <ul className="space-y-2">
                {open.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        {r.type}
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            r.priority === "Urgent" && "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
                            r.priority === "Normal" && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                            r.priority === "Low" && "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                          )}
                        >
                          {r.priority}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {r.id} · requested {daysAgo(r.createdDay)}
                      </div>
                    </div>
                    <button
                      onClick={() => onResolve([r.id], site.client)}
                      className="shrink-0 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-600"
                    >
                      Mark done
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold">Subscription details</h3>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs dark:divide-slate-800 dark:border-slate-700">
              {[
                ["Contact", <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{site.contact}</span>],
                ["Plan", `${site.plan} · ${fmtCurrency(PLAN_MAP[site.plan]?.price ?? site.mrr)}/mo list`],
                ["Billing cycle", site.billing === "Annual" ? "Annual (15% discount)" : "Monthly"],
                ["Segment", site.industry],
                ["Stack", <span className="flex items-center gap-1"><Server className="h-3 w-3" />{site.cms}</span>],
                ["Client since", fmtDate(site.startDay)],
                ["Last publish", `${fmtDate(site.lastPublishDay)} (${daysAgo(site.lastPublishDay)})`],
                ...(cancelled ? [["Cancelled", fmtDate(site.churnDay!)]] : []),
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between gap-3 px-3 py-2">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="text-right font-medium text-slate-800 dark:text-slate-200">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </aside>
    </div>
  );
}
