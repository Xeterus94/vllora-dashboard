// Cloudflare Worker API layer for the WaaS studio dashboard.
//
// Contract (as requested):
//   GET  {baseUrl}  with  Authorization: Basic base64(user:pass)  -> client list
//   POST {baseUrl}  with  Authorization: Basic ... + JSON body     -> save / delete
//
// The Worker response shape is intentionally parsed defensively: the client
// list may be a bare JSON array or nested under `clients` / `data` /
// `sites` / `items`. Individual records are normalised tolerantly so extra
// or missing fields never crash the dashboard.

import { DAYS, INDUSTRIES, TODAY, type Industry, type Site } from "./data";
import { MOCK_API_URL, mockGet, mockPost } from "./mockWorker";

export const DEFAULT_API_BASE = "https://dashboard-master.ionstefan0904.workers.dev";

export interface ApiCredentials {
  username: string;
  password: string;
  baseUrl: string;
}

/** Build the `Authorization: Basic ...` header value (UTF-8 safe). */
export function basicAuthHeader(username: string, password: string): string {
  const token = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
  return `Basic ${token}`;
}

function authHeaders(c: ApiCredentials): Record<string, string> {
  return {
    Authorization: basicAuthHeader(c.username, c.password),
    Accept: "application/json",
  };
}

/* ------------------------------------------------------------------ types */

export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  announcement: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapsUrl: string;
  facebook: string;
  instagram: string;
  images: string[];
}

export const EMPTY_CONTENT: SiteContent = {
  heroTitle: "",
  heroSubtitle: "",
  announcement: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  mapsUrl: "",
  facebook: "",
  instagram: "",
  images: [],
};

/** A normalised client record from the Worker API. */
export interface LiveClient {
  id: string;
  name: string;
  domain: string;
  status: "active" | "suspended";
  plan: string; // "Basic" | "Standard" | "WaaS" (tolerates anything)
  billing: "Monthly" | "Annual";
  priceMonthly: number;
  priceAnnual: number;
  mrr: number;
  nextRenewal: string; // YYYY-MM-DD or ""
  contact: string;
  industry: Industry;
  content: SiteContent;
  createdDay: number;
  liveVisitors: number | null;
  raw: Record<string, unknown>;
}

export const LIVE_PLAN_DEFAULTS: Record<string, { monthly: number; annual: number }> = {
  Basic: { monthly: 29, annual: 295 },
  Standard: { monthly: 59, annual: 600 },
  WaaS: { monthly: 99, annual: 1000 },
};

/* ------------------------------------------------------------ parsing */

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v === null || v === undefined ? fallback : String(v);
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function visitorCount(value: unknown): number | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    value = (value as Record<string, unknown>).count;
  }
  if (typeof value === "string") {
    if (!/^\d+$/.test(value.trim())) return null;
    value = Number(value);
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function readLiveVisitors(source: unknown): number | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const record = source as Record<string, unknown>;
  const keys = ["liveVisitors", "live_visitors", "activeVisitors", "active_visitors", "visitorsNow"];
  const groups: Record<string, unknown>[] = [record];
  for (const key of ["analytics", "metrics", "realtime", "traffic", "data"]) {
    const group = record[key];
    if (group && typeof group === "object" && !Array.isArray(group)) groups.push(group as Record<string, unknown>);
  }
  for (const group of groups) {
    for (const key of keys) {
      const count = visitorCount(group[key]);
      if (count !== null) return count;
    }
  }
  return null;
}

function get(r: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
  }
  return undefined;
}

/** Pull the client array out of whatever envelope the Worker uses. */
export function extractClientArray(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    for (const k of ["clients", "data", "sites", "items", "results"]) {
      if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
    }
    if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
      const nested = o.data as Record<string, unknown>;
      for (const k of ["clients", "sites", "items", "results"]) {
        if (Array.isArray(nested[k])) return nested[k] as Record<string, unknown>[];
      }
    }
  }
  return [];
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "site"
  );
}

function parseDayIndex(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    // epoch ms / epoch s / already a day index?
    if (v > 1e12) {
      const diff = Math.floor((TODAY.getTime() - v) / 86400000);
      return Math.min(DAYS - 1, Math.max(0, DAYS - 1 - diff));
    }
    if (v > 1e9) {
      const diff = Math.floor((TODAY.getTime() - v * 1000) / 86400000);
      return Math.min(DAYS - 1, Math.max(0, DAYS - 1 - diff));
    }
    if (v >= 0 && v < DAYS) return Math.floor(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) {
      const diff = Math.floor((TODAY.getTime() - t) / 86400000);
      return Math.min(DAYS - 1, Math.max(0, DAYS - 1 - diff));
    }
  }
  return fallback;
}

function normalisePlan(v: unknown): string {
  const p = str(v, "Standard").trim().toLowerCase();
  if (p.includes("basic") || p.includes("starter")) return "Basic";
  if (p.includes("waas") || p.includes("pro") || p.includes("commerce") || p.includes("premium")) return "WaaS";
  return "Standard";
}

function normaliseStatus(v: unknown): "active" | "suspended" {
  const s = str(v, "active").trim().toLowerCase();
  if (["suspended", "suspend", "paused", "disabled", "inactive", "offline", "cancelled", "canceled"].includes(s)) return "suspended";
  return "active";
}

function asImageList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => str(x).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normaliseIndustry(v: unknown): Industry {
  const s = str(v).trim().toLowerCase();
  const hit = INDUSTRIES.find((i) => i.toLowerCase() === s);
  if (hit) return hit;
  return "Unspecified";
}

/** Normalise one raw Worker record into a LiveClient. Never throws. */
export function normalizeClient(r: Record<string, unknown>, idx: number): LiveClient {
  const nested =
    (["content", "cms", "siteContent", "site_content", "config"].map((k) => r[k]).find(
      (x) => x && typeof x === "object"
    ) as Record<string, unknown> | undefined) ?? {};

  const pick = (...keys: string[]) => get(r, ...keys) ?? get(nested, ...keys);

  const name = str(
    get(r, "name", "client", "businessName", "business", "siteName", "title", "company"),
    `Client ${idx + 1}`
  );
  let domain = str(get(r, "domain", "slug", "hostname", "host", "subdomain", "url", "siteUrl"));
  if (domain.includes("://")) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      /* keep raw */
    }
  }
  if (!domain) domain = `${slugify(name)}.mysites.dev`;

  const plan = normalisePlan(get(r, "plan", "tier", "package", "planName"));
  const billingRaw = str(get(r, "billing", "billingCycle", "cycle", "frequency"), "monthly").toLowerCase();
  const billing: "Monthly" | "Annual" = billingRaw.startsWith("annual") || billingRaw.startsWith("year") ? "Annual" : "Monthly";
  const defaults = LIVE_PLAN_DEFAULTS[plan] ?? LIVE_PLAN_DEFAULTS.Standard;
  const priceMonthly = num(
    pick("priceMonthly", "monthlyPrice", "price_monthly", "monthly", "mrr"),
    billing === "Monthly" ? num(pick("price", "amount"), defaults.monthly) : defaults.monthly
  );
  const priceAnnual = num(
    pick("priceAnnual", "annualPrice", "price_annual", "annual", "yearlyPrice"),
    billing === "Annual" ? num(pick("price", "amount"), defaults.annual) : Math.round(defaults.annual)
  );
  const mrr =
    billing === "Annual"
      ? Math.round((priceAnnual / 12) * 100) / 100
      : Math.round(priceMonthly * 100) / 100;

  let nextRenewal = str(pick("nextRenewal", "renewalDate", "next_renewal", "renewsAt", "renewal", "nextBillingDate"));
  if (nextRenewal) {
    const t = Date.parse(nextRenewal);
    if (!Number.isNaN(t)) nextRenewal = new Date(t).toISOString().slice(0, 10);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(nextRenewal)) nextRenewal = "";
  }

  const status = normaliseStatus(get(r, "status", "state", "accountStatus") ?? (r.active === false ? "suspended" : "active"));

  const content: SiteContent = {
    heroTitle: str(pick("heroTitle", "hero_title", "heroHeading", "headline", "title")),
    heroSubtitle: str(pick("heroSubtitle", "hero_subtitle", "subtitle", "tagline", "subheading")),
    announcement: str(pick("announcement", "specialAnnouncement", "banner", "bannerText", "notice")),
    phone: str(pick("phone", "phoneNumber", "tel")),
    whatsapp: str(pick("whatsapp", "whatsApp", "whats_app")),
    email: str(pick("email", "contactEmail", "mail")),
    address: str(pick("address", "location", "street")),
    mapsUrl: str(pick("mapsUrl", "googleMapsUrl", "maps_url", "mapUrl", "map")),
    facebook: str(pick("facebook", "facebookUrl", "fb")),
    instagram: str(pick("instagram", "instagramUrl", "ig")),
    images: asImageList(pick("images", "imageUrls", "gallery", "photos", "image_urls")),
  };

  const id = str(get(r, "id", "clientId", "slug", "key"), `live-${idx + 1}`);

  return {
    id,
    name,
    domain,
    status,
    plan,
    billing,
    priceMonthly,
    priceAnnual,
    mrr,
    nextRenewal,
    contact: str(get(r, "contact", "owner", "contactName"), content.email || "—"),
    industry: normaliseIndustry(get(r, "industry", "segment", "category", "vertical")),
    content,
    createdDay: parseDayIndex(get(r, "createdAt", "created", "joinedAt", "startDate", "signupDate", "startDay"), DAYS - 365),
    liveVisitors: readLiveVisitors(r),
    raw: r,
  };
}

/* ------------------------------------------------- Site conversion */

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Convert a LiveClient into the dashboard's Site model. Current-period KPIs
 * (MRR, client counts, plan mix, active/suspended) come straight from the
 * API; the daily traffic history is synthesised deterministically so the
 * time-series charts render instead of flat-lining at zero.
 */
export function liveClientToSite(c: LiveClient, idx: number): Site {
  const rnd = mulberry(hashStr(c.id || c.domain || String(idx)));
  const trafficBase = c.plan === "WaaS" ? 120 : c.plan === "Standard" ? 75 : 40;
  const visitors: number[] = new Array(DAYS).fill(0);
  const downtime: number[] = new Array(DAYS).fill(0);
  for (let d = c.createdDay; d < DAYS; d++) {
    const dow = new Date(TODAY);
    dow.setDate(dow.getDate() - (DAYS - 1 - d));
    const wk = dow.getDay() === 0 || dow.getDay() === 6 ? 1.2 : 1;
    visitors[d] = Math.max(0, Math.round(trafficBase * wk * (0.7 + rnd() * 0.6)));
  }
  return {
    id: c.id,
    client: c.name,
    contact: c.contact,
    domain: c.domain,
    industry: c.industry,
    plan: c.plan,
    billing: c.billing,
    mrr: c.status === "suspended" ? 0 : c.mrr,
    startDay: c.createdDay,
    churnDay: null,
    status: c.status === "suspended" ? "Suspended" : "Online",
    cms: "Cloudflare Workers",
    sslDaysLeft: 60 + Math.floor(rnd() * 240),
    loadTimeMs: 480 + Math.floor(rnd() * 900),
    visitors,
    liveVisitors: c.liveVisitors,
    downtime,
    lastPublishDay: DAYS - 1 - Math.floor(rnd() * 20),
    content: { ...c.content },
    priceMonthly: c.priceMonthly,
    priceAnnual: c.priceAnnual,
    nextRenewal: c.nextRenewal,
  };
}

/* ------------------------------------------------------------ requests */

function cleanBase(baseUrl: string): string {
  return (baseUrl || DEFAULT_API_BASE).trim().replace(/\/+$/, "") || DEFAULT_API_BASE;
}

export interface ClientSnapshot {
  clients: LiveClient[];
  liveVisitors: number | null;
}

/** GET the client list and any real-time visitor count supplied by the Worker. */
export async function fetchClientSnapshot(baseUrl: string, creds: ApiCredentials): Promise<ClientSnapshot> {
  const base = cleanBase(baseUrl);
  // Simulated Worker (for trying the live-API flow with no backend).
  if (base === MOCK_API_URL) {
    try {
      const rows = mockGet(creds);
      return { clients: rows.map((r, i) => normalizeClient(r, i)), liveVisitors: null };
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Simulated Worker auth failed.");
    }
  }
  let res: Response;
  try {
    res = await fetch(base, { method: "GET", cache: "no-store", headers: authHeaders(creds) });
  } catch {
    throw new Error(`Cannot reach ${base}. Check the Worker URL and network connection.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid username or password (server rejected the credentials).");
  }
  if (!res.ok) {
    throw new Error(`Worker responded with ${res.status} ${res.statusText || "error"}.`);
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Worker did not return JSON. Check the endpoint URL.");
  }
  return {
    clients: extractClientArray(json).map((r, i) => normalizeClient(r, i)),
    liveVisitors: readLiveVisitors(json),
  };
}

export async function fetchClients(baseUrl: string, creds: ApiCredentials): Promise<LiveClient[]> {
  return (await fetchClientSnapshot(baseUrl, creds)).clients;
}

/**
 * POST the updated client JSON. Used for both create/update and delete
 * (delete sends `{ action: "delete", id }` — handle `body.action` in the
 * Worker). Returns the parsed response when there is one.
 */
export async function postClient(
  baseUrl: string,
  creds: ApiCredentials,
  payload: Record<string, unknown>
): Promise<unknown> {
  const base = cleanBase(baseUrl);
  if (base === MOCK_API_URL) {
    try {
      return mockPost(creds, payload);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Simulated Worker save failed.");
    }
  }
  let res: Response;
  try {
    res = await fetch(base, {
      method: "POST",
      headers: { ...authHeaders(creds), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Cannot reach ${base}. Changes were not saved.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid username or password (server rejected the credentials).");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`Save failed (${res.status}). ${detail.slice(0, 160)}`.trim());
  }
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** Build the POST body for Save Changes from the editor form. */
export function buildSavePayload(form: EditorForm, existingId: string | null): Record<string, unknown> {
  const priceMonthly = Number(form.priceMonthly) || 0;
  const priceAnnual = Number(form.priceAnnual) || 0;
  return {
    action: existingId ? "update" : "create",
    ...(existingId ? { id: existingId } : {}),
    name: form.name.trim(),
    domain: form.domain.trim(),
    slug: form.domain.trim().split(".")[0],
    status: form.status,
    plan: form.plan,
    billing: form.billing,
    priceMonthly,
    priceAnnual,
    price: form.billing === "Annual" ? priceAnnual : priceMonthly,
    mrr: form.billing === "Annual" ? Math.round((priceAnnual / 12) * 100) / 100 : priceMonthly,
    nextRenewal: form.nextRenewal,
    contact: form.email.trim(),
    content: {
      heroTitle: form.heroTitle,
      heroSubtitle: form.heroSubtitle,
      announcement: form.announcement,
      phone: form.phone,
      whatsapp: form.whatsapp,
      email: form.email,
      address: form.address,
      mapsUrl: form.mapsUrl,
      facebook: form.facebook,
      instagram: form.instagram,
      images: form.imagesText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean),
    },
  };
}

export interface EditorForm {
  name: string;
  domain: string;
  status: "active" | "suspended";
  plan: string;
  billing: "Monthly" | "Annual";
  priceMonthly: string;
  priceAnnual: string;
  nextRenewal: string;
  heroTitle: string;
  heroSubtitle: string;
  announcement: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  mapsUrl: string;
  facebook: string;
  instagram: string;
  imagesText: string;
}

/** Seed the editor form from a Site (edit) or blank defaults (create). */
export function formFromSite(s: Site | null): EditorForm {
  const c = s?.content;
  if (!s) {
    return {
      name: "", domain: "", status: "active", plan: "Standard", billing: "Monthly",
      priceMonthly: String(LIVE_PLAN_DEFAULTS.Standard.monthly),
      priceAnnual: String(LIVE_PLAN_DEFAULTS.Standard.annual),
      nextRenewal: "", heroTitle: "", heroSubtitle: "", announcement: "",
      phone: "", whatsapp: "", email: "", address: "", mapsUrl: "",
      facebook: "", instagram: "", imagesText: "",
    };
  }
  const isSuspended = s.status === "Suspended";
  const plan = ["Basic", "Standard", "WaaS"].includes(s.plan) ? s.plan : "Standard";
  const pm = s.priceMonthly ?? (s.billing === "Monthly" ? s.mrr : LIVE_PLAN_DEFAULTS[plan]?.monthly ?? 59);
  const pa = s.priceAnnual ?? Math.round((s.billing === "Annual" ? s.mrr * 12 : pm * 12 * 0.85));
  return {
    name: s.client,
    domain: s.domain,
    status: isSuspended ? "suspended" : "active",
    plan,
    billing: s.billing,
    priceMonthly: String(pm),
    priceAnnual: String(pa),
    nextRenewal: s.nextRenewal ?? "",
    heroTitle: c?.heroTitle ?? "",
    heroSubtitle: c?.heroSubtitle ?? "",
    announcement: c?.announcement ?? "",
    phone: c?.phone ?? "",
    whatsapp: c?.whatsapp ?? "",
    email: c?.email ?? (s.contact.includes("@") ? s.contact : ""),
    address: c?.address ?? "",
    mapsUrl: c?.mapsUrl ?? "",
    facebook: c?.facebook ?? "",
    instagram: c?.instagram ?? "",
    imagesText: (c?.images ?? []).join("\n"),
  };
}
