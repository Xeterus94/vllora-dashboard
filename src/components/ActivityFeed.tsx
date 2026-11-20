import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, FilePlus2, Sparkles, UserMinus, UserPlus, Zap } from "lucide-react";
import { DAYS } from "../data";
import { daysAgo, fmtCurrency, type Dashboard } from "../analytics";
import { Card } from "./ui";

export interface LogEntry {
  id: number;
  text: string;
  at: number; // ms timestamp
  kind: "action" | "live";
}

type Ev = { key: string; icon: typeof Zap; color: string; text: string; when: string; sort: number };

function ago(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function ActivityFeed({ d, logs }: { d: Dashboard; logs: LogEntry[] }) {
  const events = useMemo(() => {
    const out: Ev[] = [];
    const from = DAYS - 21;
    const name = new Map(d.sites.map((s) => [s.id, s.client]));
    d.sites.forEach((s) => {
      if (s.startDay >= from)
        out.push({ key: `n${s.id}`, icon: UserPlus, color: "text-emerald-500 bg-emerald-500/10", text: `${s.client} subscribed to ${s.plan} (${fmtCurrency(s.mrr)}/mo)`, when: daysAgo(s.startDay), sort: s.startDay * 10 + 3 });
      if (s.churnDay !== null && s.churnDay >= from)
        out.push({ key: `c${s.id}`, icon: UserMinus, color: "text-rose-500 bg-rose-500/10", text: `${s.client} cancelled their ${s.plan} plan`, when: daysAgo(s.churnDay), sort: s.churnDay * 10 + 2 });
      for (let i = Math.max(from, s.startDay); i < DAYS; i++)
        if (s.downtime[i] > 30)
          out.push({ key: `i${s.id}${i}`, icon: AlertTriangle, color: "text-amber-500 bg-amber-500/10", text: `${s.domain} was down for ${s.downtime[i]} min`, when: daysAgo(i), sort: i * 10 + 1 });
    });
    d.reqs
      .filter((r) => r.createdDay >= DAYS - 4)
      .forEach((r) =>
        out.push({ key: `r${r.id}`, icon: FilePlus2, color: "text-sky-500 bg-sky-500/10", text: `${name.get(r.siteId)} requested: ${r.type}${r.priority === "Urgent" ? " (urgent)" : ""}`, when: daysAgo(r.createdDay), sort: r.createdDay * 10 })
      );
    return out.sort((a, b) => b.sort - a.sort);
  }, [d]);

  const merged: Ev[] = [
    ...logs.map((l) => ({
      key: `l${l.id}`,
      icon: l.kind === "action" ? CheckCircle2 : Sparkles,
      color: l.kind === "action" ? "text-indigo-500 bg-indigo-500/10" : "text-violet-500 bg-violet-500/10",
      text: l.text,
      when: ago(l.at),
      sort: Infinity,
    })),
    ...events,
  ].slice(0, 14);

  return (
    <Card
      title="Activity"
      subtitle="Subscriptions, incidents and client requests"
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      }
    >
      <ul className="scrollbar-thin -mr-2 max-h-[372px] space-y-1 overflow-y-auto pr-2">
        {merged.length === 0 && <li className="py-8 text-center text-xs text-slate-400">No recent activity for this segment.</li>}
        {merged.map((e) => (
          <li key={e.key} className="animate-fade-up flex items-start gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${e.color}`}>
              <e.icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-snug text-slate-700 dark:text-slate-200">{e.text}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{e.when}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
