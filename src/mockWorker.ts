/* Local simulated Cloudflare Worker — lets variant B be exercised end-to-end
   without a real backend. Activated by using `local://worker` as the API URL.
   Data persists in localStorage and obeys the same Basic-auth contract. */

import type { ApiCredentials } from "./api";

const KEY = "vllora-studio-mock-worker-clients-v1";

export const MOCK_API_URL = "local://worker";

interface MockRecord {
  id: string;
  name: string;
  domain: string;
  status: "active" | "suspended";
  plan: string;
  billing: "Monthly" | "Annual";
  priceMonthly: number;
  priceAnnual: number;
  nextRenewal: string;
  industry: string;
  contact: string;
  createdAt: string;
  content: {
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
  };
}

const SEED: MockRecord[] = [
  {
    id: "c-1001", name: "Bluebird Bakery", domain: "bluebirdbakery.com", status: "active", plan: "WaaS",
    billing: "Annual", priceMonthly: 99, priceAnnual: 1000, nextRenewal: "2026-09-14", industry: "Hospitality",
    contact: "Maya Torres", createdAt: "2025-02-11",
    content: {
      heroTitle: "Fresh sourdough, every single morning",
      heroSubtitle: "Slow-fermented bread, pastries and coffee from our Portland bakery.",
      announcement: "Weekend brunch — now serving until 3pm",
      phone: "+1 503 555 0142", whatsapp: "+15035550142", email: "hello@bluebirdbakery.com",
      address: "418 SE Division St, Portland, OR", mapsUrl: "https://maps.google.com/?q=bluebird+bakery+portland",
      facebook: "https://facebook.com/bluebirdbakery", instagram: "https://instagram.com/bluebirdbakery",
      images: [
        "https://cdn.jsdelivr.net/gh/github-mark/github-mark@master/github-mark.png",
        "https://raw.githubusercontent.com/github/explore/main/topics/react/react.png",
      ],
    },
  },
  {
    id: "c-1002", name: "Lotus Flow Yoga", domain: "lotusflowyoga.co", status: "active", plan: "Standard",
    billing: "Monthly", priceMonthly: 59, priceAnnual: 600, nextRenewal: "2026-06-01", industry: "Wellness",
    contact: "Priya Raman", createdAt: "2025-05-03",
    content: {
      heroTitle: "Move, breathe, begin again",
      heroSubtitle: "Vinyasa, yin and restorative classes for every level.",
      announcement: "First class free for new students",
      phone: "+1 415 555 0188", whatsapp: "+14155550188", email: "namaste@lotusflowyoga.co",
      address: "22 Mission St, San Francisco, CA", mapsUrl: "https://maps.google.com/?q=lotus+flow+yoga",
      facebook: "https://facebook.com/lotusflowyoga", instagram: "https://instagram.com/lotusflowyoga",
      images: [],
    },
  },
  {
    id: "c-1003", name: "Thread & Needle", domain: "threadandneedle.shop", status: "suspended", plan: "Basic",
    billing: "Monthly", priceMonthly: 29, priceAnnual: 295, nextRenewal: "2026-04-20", industry: "Retail",
    contact: "Chloe Bennett", createdAt: "2025-08-19",
    content: {
      heroTitle: "Considered clothing, made to last",
      heroSubtitle: "Small-batch essentials in natural fibres.",
      announcement: "",
      phone: "+44 20 7946 0311", whatsapp: "", email: "hello@threadandneedle.shop",
      address: "14 Redchurch St, London", mapsUrl: "", facebook: "", instagram: "https://instagram.com/threadandneedle",
      images: [],
    },
  },
  {
    id: "c-1004", name: "Hartley Law Group", domain: "hartleylaw.com", status: "active", plan: "Standard",
    billing: "Annual", priceMonthly: 59, priceAnnual: 600, nextRenewal: "2026-11-02", industry: "Professional",
    contact: "Ava Hartley", createdAt: "2024-12-06",
    content: {
      heroTitle: "Clear advice when it matters most",
      heroSubtitle: "Business law, contracts and dispute resolution for growing companies.",
      announcement: "Free 30-minute consultation this month",
      phone: "+1 212 555 0110", whatsapp: "", email: "ava@hartleylaw.com",
      address: "88 Broadway, New York, NY", mapsUrl: "https://maps.google.com/?q=hartley+law+group",
      facebook: "", instagram: "", images: [],
    },
  },
  {
    id: "c-1005", name: "Studio Marlowe Photo", domain: "studiomarlowe.studio", status: "active", plan: "WaaS",
    billing: "Monthly", priceMonthly: 99, priceAnnual: 1000, nextRenewal: "2026-06-24", industry: "Creative",
    contact: "Leo Marlowe", createdAt: "2025-03-28",
    content: {
      heroTitle: "Honest photographs of real moments",
      heroSubtitle: "Editorial, wedding and brand photography, worldwide.",
      announcement: "2026 wedding dates now open",
      phone: "+1 310 555 0174", whatsapp: "+13105550174", email: "studio@marlowe.photo",
      address: "Los Angeles, CA", mapsUrl: "", facebook: "https://facebook.com/studiomarlowe",
      instagram: "https://instagram.com/studiomarlowe", images: [],
    },
  },
  {
    id: "c-1006", name: "ProFlow Plumbing", domain: "proflowplumbing.com", status: "active", plan: "Basic",
    billing: "Monthly", priceMonthly: 29, priceAnnual: 295, nextRenewal: "2026-06-08", industry: "Home Services",
    contact: "Sam Walsh", createdAt: "2025-10-15",
    content: {
      heroTitle: "Plumbing done right, the first time",
      heroSubtitle: "Licensed plumbers available 24/7 across the metro area.",
      announcement: "No call-out fee this week",
      phone: "+1 206 555 0166", whatsapp: "+12065550166", email: "dispatch@proflowplumbing.com",
      address: "Seattle, WA", mapsUrl: "", facebook: "", instagram: "", images: [],
    },
  },
];

function read(): MockRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MockRecord[];
  } catch {
    /* fall through to seed */
  }
  localStorage.setItem(KEY, JSON.stringify(SEED));
  return SEED;
}

function write(rows: MockRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

function verifyAuth(creds: ApiCredentials) {
  if (!creds.username.trim() || !creds.password.trim()) {
    throw new Error("Invalid username or password.");
  }
}

/** Simulates GET / — returns the raw record array. */
export function mockGet(creds: ApiCredentials): Record<string, unknown>[] {
  verifyAuth(creds);
  return read() as unknown as Record<string, unknown>[];
}

/** Simulates POST / — create, update or delete. */
export function mockPost(creds: ApiCredentials, payload: Record<string, unknown>): unknown {
  verifyAuth(creds);
  const rows = read();
  const action = String(payload.action ?? "update");
  if (action === "delete") {
    const id = String(payload.id ?? "");
    write(rows.filter((r) => r.id !== id));
    return { ok: true, deleted: id };
  }
  const content = (payload.content ?? {}) as Partial<MockRecord["content"]>;
  const record: MockRecord = {
    id: String(payload.id ?? `c-${Date.now()}`),
    name: String(payload.name ?? "Untitled client"),
    domain: String(payload.domain ?? ""),
    status: payload.status === "suspended" ? "suspended" : "active",
    plan: String(payload.plan ?? "Standard"),
    billing: payload.billing === "Annual" ? "Annual" : "Monthly",
    priceMonthly: Number(payload.priceMonthly ?? 59),
    priceAnnual: Number(payload.priceAnnual ?? 600),
    nextRenewal: String(payload.nextRenewal ?? ""),
    industry: String(payload.industry ?? rows.find((r) => r.id === payload.id)?.industry ?? "Professional"),
    contact: String(payload.contact ?? ""),
    createdAt: rows.find((r) => r.id === payload.id)?.createdAt ?? new Date().toISOString().slice(0, 10),
    content: {
      heroTitle: String(content.heroTitle ?? ""),
      heroSubtitle: String(content.heroSubtitle ?? ""),
      announcement: String(content.announcement ?? ""),
      phone: String(content.phone ?? ""),
      whatsapp: String(content.whatsapp ?? ""),
      email: String(content.email ?? ""),
      address: String(content.address ?? ""),
      mapsUrl: String(content.mapsUrl ?? ""),
      facebook: String(content.facebook ?? ""),
      instagram: String(content.instagram ?? ""),
      images: Array.isArray(content.images) ? content.images.map(String) : [],
    },
  };
  const idx = rows.findIndex((r) => r.id === record.id);
  if (idx >= 0) rows[idx] = record;
  else rows.unshift(record);
  write(rows);
  return { ok: true, id: record.id };
}

export function resetMock() {
  localStorage.removeItem(KEY);
}
