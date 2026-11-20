import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";

export function Card({
  title, subtitle, action, children, className, id,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("card animate-fade-up scroll-mt-24 p-4 sm:p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md font-medium transition-all duration-200",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            value === o.value
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({
  value, onChange, options, label, icon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  icon?: ReactNode;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      {icon && <span className="pointer-events-none absolute left-2.5 text-slate-400">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white pr-8 text-xs font-medium text-slate-700 outline-none transition-colors",
          "hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600",
          icon ? "pl-8" : "pl-3"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
    </label>
  );
}

export interface TooltipRow {
  name: string;
  value: string;
  color?: string;
}

export function TooltipBox({ title, rows }: { title?: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
      {title && <div className="mb-1.5 font-semibold text-slate-900 dark:text-white">{title}</div>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
              {r.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function useChartTheme(dark: boolean) {
  return {
    grid: dark ? "#1e293b" : "#eef2f7",
    axis: dark ? "#64748b" : "#94a3b8",
    cursor: dark ? "rgba(148,163,184,0.08)" : "rgba(99,102,241,0.06)",
    primary: "#6366f1",
    secondary: dark ? "#475569" : "#cbd5e1",
    surface: dark ? "#0f172a" : "#ffffff",
  };
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Online: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    Active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
    Suspended: "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/30",
    Degraded: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
    Down: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
    Maintenance: "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30",
    Cancelled: "bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600/40",
  };
  const dot: Record<string, string> = {
    Online: "bg-emerald-500", Active: "bg-emerald-500", Suspended: "bg-purple-500", Degraded: "bg-amber-500", Down: "bg-red-500", Maintenance: "bg-indigo-500", Cancelled: "bg-slate-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", styles[status])}>
      <span className="relative flex h-1.5 w-1.5">
        {(status === "Down" || status === "Online") && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", dot[status])} />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dot[status])} />
      </span>
      {status}
    </span>
  );
}
