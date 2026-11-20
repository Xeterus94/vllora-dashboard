// Deterministic, realistic sample data for a solo WaaS agency portfolio.

export const DAYS = 730; // two years of history (allows previous-period comparisons)
export const TODAY = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

export function dayToDate(i: number): Date {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - (DAYS - 1 - i));
  return d;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(41877);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
function weighted<T>(items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export const INDUSTRIES = [
  "Hospitality",
  "Wellness",
  "Retail",
  "Professional",
  "Creative",
  "Home Services",
  "Unspecified",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const INDUSTRY_COLORS: Record<Industry, string> = {
  Hospitality: "#f97316",
  Wellness: "#10b981",
  Retail: "#8b5cf6",
  Professional: "#3b82f6",
  Creative: "#ec4899",
  "Home Services": "#eab308",
  Unspecified: "#94a3b8",
};

export const PLANS = [
  { id: "Starter", price: 39, color: "#94a3b8", reqRate: 1.4 },
  { id: "Growth", price: 79, color: "#6366f1", reqRate: 2.8 },
  { id: "Pro", price: 129, color: "#06b6d4", reqRate: 4.2 },
  { id: "Commerce", price: 199, color: "#f43f5e", reqRate: 5.5 },
] as const;

/** Plans offered by the live Cloudflare Worker API. */
export const LIVE_PLANS = [
  { id: "Basic", price: 29, color: "#38bdf8", reqRate: 1.4 },
  { id: "Standard", price: 59, color: "#6366f1", reqRate: 2.8 },
  { id: "WaaS", price: 99, color: "#a855f7", reqRate: 4.2 },
] as const;

/** Plan ids are open-ended so live API plans coexist with demo plans. */
export type PlanId = string;
export interface PlanInfo {
  id: string;
  price: number;
  color: string;
  reqRate: number;
}
export const PLAN_MAP: Record<string, PlanInfo> = Object.fromEntries(
  [...PLANS, ...LIVE_PLANS].map((p) => [p.id, { ...p }])
);

const FALLBACK_PLAN_COLORS = ["#6366f1", "#06b6d4", "#f43f5e", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
export function planColor(plan: string): string {
  if (PLAN_MAP[plan]) return PLAN_MAP[plan].color;
  let h = 0;
  for (let i = 0; i < plan.length; i++) h = (h * 31 + plan.charCodeAt(i)) >>> 0;
  return FALLBACK_PLAN_COLORS[h % FALLBACK_PLAN_COLORS.length];
}
export function planPrice(plan: string): number {
  return PLAN_MAP[plan]?.price ?? 0;
}

export type SiteStatus = "Online" | "Degraded" | "Down" | "Maintenance" | "Suspended";
export const STATUS_COLORS: Record<SiteStatus, string> = {
  Online: "#10b981",
  Degraded: "#f59e0b",
  Down: "#ef4444",
  Maintenance: "#6366f1",
  Suspended: "#a855f7",
};

/** Live CMS content synced with the Worker API (hero, contact, socials, gallery). */
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

export interface Site {
  id: string;
  client: string;
  contact: string;
  domain: string;
  industry: Industry;
  plan: PlanId;
  billing: "Monthly" | "Annual";
  mrr: number;
  startDay: number;
  churnDay: number | null;
  status: SiteStatus;
  cms: string;
  sslDaysLeft: number;
  loadTimeMs: number;
  visitors: number[];
  liveVisitors?: number | null;
  downtime: number[]; // minutes per day
  lastPublishDay: number;
  /** Live CMS + billing extras (populated for API clients). */
  content?: SiteContent;
  priceMonthly?: number;
  priceAnnual?: number;
  nextRenewal?: string;
}

export type RequestType =
  | "Text update"
  | "New page"
  | "Image swap"
  | "Blog post"
  | "SEO tweak"
  | "Bug fix"
  | "Menu / pricing";

export interface ContentRequest {
  id: string;
  siteId: string;
  type: RequestType;
  priority: "Low" | "Normal" | "Urgent";
  createdDay: number;
  resolvedDay: number | null;
}

const NAMES: Record<Industry, string[]> = {
  Hospitality: [
    "Bluebird Bakery", "Saffron & Sage Bistro", "The Copper Kettle", "Harbor Street Tacos",
    "Juniper Coffee Co", "Nonna Rosa Trattoria", "Little Fig Wine Bar", "Golden Hour Brunch",
    "Smokestack BBQ", "Maple Lane Inn", "Kumo Ramen",
  ],
  Wellness: [
    "Lotus Flow Yoga", "Peak Physio", "Evergreen Dental", "Mindful Path Therapy",
    "Ironclad Fitness", "Glow Skin Studio", "Rooted Acupuncture", "Clearview Optometry",
    "Bloom Midwifery", "Pulse Pilates", "Northside Chiro",
  ],
  Retail: [
    "Thread & Needle", "Paper Moon Stationery", "Wildflower Florist", "Oak & Ember Candles",
    "Vinyl Haven Records", "Pawsome Pet Supply", "Terra Ceramics", "The Book Nook",
    "Summit Outdoor Gear", "Lumen Lighting Co", "Honeycomb Kids",
  ],
  Professional: [
    "Hartley Law Group", "Brightside Accounting", "Keystone Realty", "Meridian Financial",
    "Atlas Architects", "Clarity HR Consulting", "Pinnacle Insurance", "Ledger & Co CPAs",
    "Northstar Coaching", "Beacon Notary", "Vantage Engineering",
  ],
  Creative: [
    "Studio Marlowe Photo", "Inkwell Tattoo", "Echo Sound Lab", "Frame & Field Films",
    "Mosaic Wedding Co", "Canvas Kids Art", "Velvet Room Events", "Driftwood Design",
    "Lens & Light Studio", "Rhythm Dance Academy",
  ],
  "Home Services": [
    "ProFlow Plumbing", "Greenleaf Landscaping", "Sparkle Clean Co", "Volt Electric",
    "Summit Roofing", "Cozy Home HVAC", "Fresh Coat Painters", "Handy Hank Repairs",
    "Crystal Pools", "Precision Pest Control",
  ],
  Unspecified: [],
};

const FIRST = ["Ava", "Liam", "Maya", "Noah", "Zoe", "Ethan", "Priya", "Lucas", "Chloe", "Mateo", "Grace", "Omar", "Ivy", "Leo", "Hana", "Sam", "Nora", "Felix", "Ruby", "Theo"];
const LAST = ["Nguyen", "Patel", "Garcia", "Kim", "Brooks", "Rossi", "Okafor", "Silva", "Chen", "Murphy", "Novak", "Haddad", "Lindqvist", "Reyes", "Walsh"];
const CMS = ["Webflow", "WordPress", "Framer", "Shopify", "Astro + Sanity"];
const TLD = [".com", ".com", ".com", ".co", ".studio", ".net"];

const INDUSTRY_TRAFFIC: Record<Industry, number> = {
  Hospitality: 105,
  Wellness: 60,
  Retail: 130,
  Professional: 48,
  Creative: 70,
  "Home Services": 58,
  Unspecified: 0,
};

function slug(name: string) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
}

function generate() {
  const sites: Site[] = [];
  const requests: ContentRequest[] = [];
  const all = INDUSTRIES.flatMap((ind) => NAMES[ind].map((n) => ({ ind, n })));
  // shuffle
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  all.forEach(({ ind, n }, idx) => {
    // Business grows over time: more sign-ups recently (skewed distribution)
    const startDay = Math.min(DAYS - 3, Math.floor(Math.pow(rand(), 0.72) * (DAYS - 5)));
    const plan = weighted(
      PLANS.map((p) => p.id),
      ind === "Retail" ? [2, 3, 2, 4] : [4, 5, 3, 1]
    );
    const billing = rand() < 0.35 ? "Annual" : "Monthly";
    const price = PLAN_MAP[plan].price;
    const mrr = Math.round((billing === "Annual" ? price * 0.85 : price) * 100) / 100;

    let churnDay: number | null = null;
    if (rand() < 0.17 && startDay < DAYS - 60) {
      churnDay = randInt(startDay + 45, DAYS - 2);
    }

    const planMult = { Starter: 0.6, Growth: 1, Pro: 1.6, Commerce: 2.4 }[plan];
    const base = INDUSTRY_TRAFFIC[ind] * planMult * (0.55 + rand() * 0.9);
    const weekendBoost = ind === "Hospitality" || ind === "Retail" ? 1.35 : ind === "Professional" ? 0.55 : 0.9;
    const visitors: number[] = new Array(DAYS).fill(0);
    const downtime: number[] = new Array(DAYS).fill(0);
    const end = churnDay ?? DAYS;
    const phase = rand() * Math.PI * 2;
    for (let d = startDay; d < end; d++) {
      const age = d - startDay;
      const ramp = Math.min(1, 0.25 + age / 60); // SEO ramp-up after launch
      const growth = 1 + Math.min(0.8, age / 600);
      const dow = dayToDate(d).getDay();
      const wk = dow === 0 || dow === 6 ? weekendBoost : 1;
      const season = 1 + 0.14 * Math.sin((2 * Math.PI * d) / 365 + phase);
      const noise = 0.78 + rand() * 0.44;
      const spike = rand() < 0.008 ? 2 + rand() * 2 : 1; // occasional viral/campaign day
      visitors[d] = Math.round(base * ramp * growth * wk * season * noise * spike);
      const r = rand();
      if (r < 0.006) downtime[d] = randInt(20, 240);
      else if (r < 0.04) downtime[d] = randInt(1, 12);
    }

    const contact = `${pick(FIRST)} ${pick(LAST)}`;
    const site: Site = {
      id: `S-${(1001 + idx).toString()}`,
      client: n,
      contact,
      domain: slug(n) + pick(TLD),
      industry: ind,
      plan,
      billing,
      mrr,
      startDay,
      churnDay,
      status: "Online",
      cms: plan === "Commerce" ? "Shopify" : pick(CMS),
      sslDaysLeft: randInt(3, 360),
      loadTimeMs: randInt(480, 2400),
      visitors,
      downtime,
      lastPublishDay: churnDay ? churnDay - randInt(5, 40) : DAYS - 1 - randInt(0, 45),
    };
    sites.push(site);

    // Content requests (Poisson-ish)
    const rate = PLAN_MAP[plan].reqRate / 30;
    for (let d = startDay + 3; d < end; d++) {
      if (rand() < rate) {
        const priority = weighted(["Low", "Normal", "Urgent"] as const, [3, 6, 1.4]);
        const delay =
          priority === "Urgent" ? randInt(0, 1) : priority === "Normal" ? randInt(0, 4) : randInt(1, 8);
        let resolvedDay: number | null = d + delay;
        if (resolvedDay > DAYS - 1 || (DAYS - 1 - d < 6 && rand() < 0.5)) resolvedDay = null;
        if (churnDay && resolvedDay === null) resolvedDay = Math.min(churnDay, DAYS - 1);
        requests.push({
          id: `R-${(requests.length + 2001).toString()}`,
          siteId: site.id,
          type: pick([
            "Text update", "Text update", "New page", "Image swap", "Blog post",
            "SEO tweak", "Bug fix", "Menu / pricing",
          ] as const),
          priority,
          createdDay: d,
          resolvedDay,
        });
      }
    }
  });

  // Assign some realistic live statuses to active sites
  const active = sites.filter((s) => s.churnDay === null);
  const setStatus = (count: number, status: SiteStatus) => {
    for (let i = 0; i < count; i++) {
      const s = active[randInt(0, active.length - 1)];
      if (s.status === "Online") {
        s.status = status;
        if (status === "Down") s.downtime[DAYS - 1] = randInt(40, 180);
        if (status === "Degraded") {
          s.downtime[DAYS - 1] = randInt(5, 25);
          s.loadTimeMs = randInt(2800, 4600);
        }
      }
    }
  };
  setStatus(1, "Down");
  setStatus(3, "Degraded");
  setStatus(2, "Maintenance");

  return { sites, requests };
}

export const SEED = generate();
