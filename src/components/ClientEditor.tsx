import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Check, ChevronDown, CreditCard, Eye, FileText, Globe, Loader2, Megaphone, Trash2, X,
} from "lucide-react";
import { buildSavePayload, LIVE_PLAN_DEFAULTS, type EditorForm } from "../api";
import { fmtCurrency } from "../analytics";
import type { Site } from "../data";
import { cn } from "../utils/cn";

const CMS_FIELDS: { key: keyof EditorForm; label: string; placeholder: string; type?: string }[] = [
  { key: "heroTitle", label: "Hero Title", placeholder: "Fresh sourdough, baked every morning" },
  { key: "heroSubtitle", label: "Subtitle", placeholder: "Family-run bakery in the heart of Portland…" },
  { key: "phone", label: "Phone", placeholder: "+1 (555) 010-2030", type: "tel" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+15550102030", type: "tel" },
  { key: "email", label: "Email", placeholder: "hello@client.com", type: "email" },
  { key: "address", label: "Address", placeholder: "123 Main St, Portland OR" },
  { key: "mapsUrl", label: "Google Maps URL", placeholder: "https://maps.google.com/?q=…", type: "url" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/…", type: "url" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…", type: "url" },
];

export function ClientEditor({
  site, form, setForm, saving, saveError, onSave, onDelete, onClose,
}: {
  /** null when creating a new client */
  site: Site | null;
  form: EditorForm;
  setForm: (f: EditorForm) => void;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"billing" | "cms">("billing");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = site === null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof EditorForm, v: string) => setForm({ ...form, [k]: v });
  const images = useMemo(
    () => form.imagesText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    [form.imagesText]
  );
  const mrrPreview =
    form.billing === "Annual"
      ? (Number(form.priceAnnual) || 0) / 12
      : Number(form.priceMonthly) || 0;

  const field =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:placeholder:text-slate-500";
  const label = "mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="animate-slide-in scrollbar-thin relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-slate-900">
        {/* header */}
        <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {isNew ? "Add new client" : `Edit ${site.client}`}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {isNew ? "Creates the record via POST to your Worker." : `${site.domain} · changes POST to your Worker.`}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Close editor">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* tabs */}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                { id: "billing", label: "Status & Billing", icon: CreditCard },
                { id: "cms", label: "Site Content (CMS)", icon: FileText },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                  tab === t.id
                    ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {/* body */}
        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {saveError && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {tab === "billing" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <span className={label}>Client name *</span>
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bluebird Bakery" className={field} />
                </div>
                <div className="sm:col-span-1">
                  <span className={label}>Domain *</span>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="bluebirdbakery.com" spellCheck={false} className={cn(field, "pl-8")} />
                  </div>
                </div>
              </div>

              <div>
                <span className={label}>Site status</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { v: "active", label: "Active", desc: "Site live, billed normally" },
                      { v: "suspended", label: "Suspended", desc: "Taken offline, no MRR" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => set("status", o.v)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        form.status === o.v
                          ? o.v === "active"
                            ? "border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-400/40 dark:border-emerald-500/50 dark:bg-emerald-500/10"
                            : "border-purple-400 bg-purple-50/60 ring-1 ring-purple-400/40 dark:border-purple-500/50 dark:bg-purple-500/10"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                        <span className={cn("h-2 w-2 rounded-full", o.v === "active" ? "bg-emerald-500" : "bg-purple-500")} />
                        {o.label}
                        {form.status === o.v && <Check className="h-3.5 w-3.5 text-indigo-500" />}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={label}>Hosting plan</span>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(LIVE_PLAN_DEFAULTS).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        const next = { ...form, plan: p };
                        if (!form.priceMonthly || form.priceMonthly === "0") next.priceMonthly = String(LIVE_PLAN_DEFAULTS[p].monthly);
                        if (!form.priceAnnual || form.priceAnnual === "0") next.priceAnnual = String(LIVE_PLAN_DEFAULTS[p].annual);
                        setForm(next);
                      }}
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-center transition-all",
                        form.plan === p
                          ? "border-indigo-400 bg-indigo-50/60 ring-1 ring-indigo-400/40 dark:border-indigo-500/60 dark:bg-indigo-500/10"
                          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                      )}
                    >
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">{p}</span>
                      <span className="mt-0.5 block text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                        ${LIVE_PLAN_DEFAULTS[p].monthly}/mo
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className={label}>Billing cycle</span>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                  {(["Monthly", "Annual"] as const).map((b) => (
                    <button
                      key={b}
                      onClick={() => set("billing", b)}
                      className={cn(
                        "rounded-md px-4 py-1.5 text-xs font-medium transition-all",
                        form.billing === b
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                          : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={label}>Monthly price (USD)</span>
                  <input value={form.priceMonthly} onChange={(e) => set("priceMonthly", e.target.value)} inputMode="decimal" placeholder="59" className={cn(field, "tabular-nums")} />
                </div>
                <div>
                  <span className={label}>Annual price (USD)</span>
                  <input value={form.priceAnnual} onChange={(e) => set("priceAnnual", e.target.value)} inputMode="decimal" placeholder="600" className={cn(field, "tabular-nums")} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={label}>Next renewal date</span>
                  <input type="date" value={form.nextRenewal} onChange={(e) => set("nextRenewal", e.target.value)} className={cn(field, "tabular-nums")} />
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Effective MRR</div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                    {fmtCurrency(mrrPreview)}/mo
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {form.billing === "Annual" ? "Annual price ÷ 12" : "Monthly price"}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <Eye className="h-3.5 w-3.5" /> Live site preview
                  <span className="ml-auto font-normal">updates as you type</span>
                </div>
                <div className="bg-gradient-to-br from-[#5E1828] via-[#46101D] to-[#2B0811] p-4 text-white">
                  {form.announcement && (
                    <div className="mb-3 inline-flex rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-slate-900">
                      {form.announcement}
                    </div>
                  )}
                  <div className="text-base font-bold leading-tight">
                    {form.heroTitle || "Your hero title appears here"}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-indigo-200">
                    {form.heroSubtitle || "Add a subtitle to describe the business."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-indigo-100">
                    {form.phone && <span>☎ {form.phone}</span>}
                    {form.email && <span>✉ {form.email}</span>}
                    {form.whatsapp && <span>WA {form.whatsapp}</span>}
                  </div>
                </div>
                {images.length > 0 && (
                  <div className="grid grid-cols-5 gap-1.5 p-2">
                    {images.slice(0, 5).map((src) => (
                      <div key={src} className="h-10 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-700">
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <span className={label}>Special announcement banner</span>
                <div className="relative">
                  <Megaphone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input value={form.announcement} onChange={(e) => set("announcement", e.target.value)} placeholder="Summer sale — 20% off all catering orders" className={cn(field, "pl-8")} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {CMS_FIELDS.slice(0, 2).map((f) => (
                  <div key={f.key} className="sm:col-span-1">
                    <span className={label}>{f.label}</span>
                    <input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} type={f.type} className={field} />
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {CMS_FIELDS.slice(2).map((f) => (
                  <div key={f.key}>
                    <span className={label}>{f.label}</span>
                    <input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} type={f.type} spellCheck={false} className={field} />
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className={label}>Image URLs (GitHub / jsDelivr) — one per line</span>
                  <span className="text-[11px] tabular-nums text-slate-400">{images.length} image{images.length === 1 ? "" : "s"}</span>
                </div>
                <textarea
                  value={form.imagesText}
                  onChange={(e) => set("imagesText", e.target.value)}
                  placeholder={"https://cdn.jsdelivr.net/gh/user/repo@main/hero.jpg\nhttps://raw.githubusercontent.com/user/repo/main/menu-1.jpg"}
                  spellCheck={false}
                  rows={5}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[11px] leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100"
                />
                {images.length > 0 && (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {images.slice(0, 4).map((src) => (
                      <div key={src} className="h-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Exact JSON that will be POSTed — useful for matching the Worker contract */}
          <details className="group rounded-xl border border-slate-200 dark:border-slate-700">
            <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
              JSON payload sent to Worker via POST
              <span className="ml-auto font-normal text-slate-400">click to inspect</span>
            </summary>
            <pre className="scrollbar-thin max-h-56 overflow-auto border-t border-slate-100 bg-slate-50 p-3 font-mono text-[10px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
              {JSON.stringify(buildSavePayload(form, site?.id ?? null), null, 2)}
            </pre>
          </details>
        </div>

        {/* footer */}
        <footer className="flex items-center gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {!isNew && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onDelete}
                  disabled={saving}
                  className="flex h-10 items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Confirm delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="h-10 rounded-xl px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl px-4 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.domain.trim()}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6B1C2E] to-[#4A1120] px-5 text-xs font-semibold text-[#F8EAC8] shadow-lg shadow-[#4F1321]/25 ring-1 ring-[#D6B46C]/35 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Save Changes
              </>
            )}
          </button>
        </footer>
      </aside>
    </div>
  );
}
