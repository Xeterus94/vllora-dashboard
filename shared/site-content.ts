import { mergePages, type ContentPage } from './site-pages';

export const companyFields = [
  'companyName',
  'companyCui',
  'companyRegistry',
  'companyAddress',
] as const;
export type CompanyField = (typeof companyFields)[number];
export type CompanyData = Record<CompanyField, string>;
export const companyFieldSpec = {
  companyName: { label: 'Denumire firmă', max: 160 },
  companyCui: { label: 'CUI / CIF', max: 24 },
  companyRegistry: { label: 'Nr. Registrul Comerțului (J)', max: 48 },
  companyAddress: { label: 'Adresa sediului social', max: 400 },
} satisfies Record<CompanyField, { label: string; max: number }>;

export const cmsTextFields = [
  'siteName',
  ...companyFields,
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'siteScheme',
  'logoUrl',
  'heroImageUrl',
  'heroTitle',
  'heroSubtitle',
  'announcement',
  'phone',
  'whatsapp',
  'email',
  'address',
  'mapsUrl',
  'facebook',
  'instagram',
  'aboutTitle',
  'aboutText',
  'bookingLabel',
  'bookingUrl',
] as const;
export type CmsTextField = (typeof cmsTextFields)[number];
export type CmsFile = {
  id: string;
  name: string;
  url: string;
  content_type: string;
};
export type CmsService = {
  name: string;
  description: string;
  price: string;
  duration: string;
};
export type CmsHours = { day: string; time: string };
// A shop row. The shop owner keeps the regular price; the discount is a whole
// percent, so the effective price is derived everywhere from these two values
// and the site never has to store a second, drifting price.
// The shop categories FITOPLANT-style stores use; a free-text value is still
// accepted, so an older row or another shop keeps working.
export const productCategories = [
  'Semințe & Plante',
  'Unelte Grădină',
  'Irigații',
  'Curte & Decor',
  'Casă & Întreținere',
] as const;
export type CmsProduct = {
  name: string;
  description: string;
  // Whole lei as text, so the shop keeps its own formatting ("69", "69,00").
  price: string;
  comparePrice: string;
  discount: number;
  bestseller: boolean;
  category: string;
  subcategory: string;
  stock: number | null;
  unit: string;
  badge: string;
  season: string;
  features: string[];
  active: boolean;
  imageUrl: string;
  image: CmsFile | null;
};
export type CmsReview = {
  name: string;
  rating: number;
  location: string;
  text: string;
  date: string;
};
export const reviewLimit = 200;
export const featuresLimit = 12;
export const stockMax = 1_000_000;
export const productLimit = 200;
export const discountMax = 90;
export const productFields = [
  'name',
  'description',
  'price',
  'comparePrice',
  'discount',
  'bestseller',
  'category',
  'subcategory',
  'stock',
  'unit',
  'badge',
  'season',
  'features',
  'active',
  'imageUrl',
] as const;
export const emptyProduct = (): CmsProduct => ({
  name: '',
  description: '',
  price: '',
  comparePrice: '',
  discount: 0,
  bestseller: false,
  category: '',
  subcategory: '',
  stock: null,
  unit: '',
  badge: '',
  season: '',
  features: [],
  active: true,
  imageUrl: '',
  image: null,
});
// "69 lei" -> 6900, "1.234,50 lei" -> 123450, "12,50" -> 1250. Returns null
// when the text is not a plain price, so a site can show its own text untouched.
export function priceCents(value: string): number | null {
  const raw = value.replace(/\u00a0/g, ' ').trim();
  const parts = raw.match(/^(\d[\d.,\s]*?)([^\d]*)$/);
  if (!parts || !/^[A-Za-z€$\s./]{0,12}$/.test(parts[2])) return null;
  const number = parts[1].replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(number)) return null;
  const lastDot = number.lastIndexOf('.'),
    lastComma = number.lastIndexOf(',');
  let whole = number,
    fraction = '';
  const separator = Math.max(lastDot, lastComma);
  if (separator > -1) {
    const tail = number.slice(separator + 1),
      head = number.slice(0, separator).replace(/[.,]/g, '');
    // Three digits after the last separator is a thousands group, not a decimal.
    if (tail.length <= 2) {
      whole = head;
      fraction = tail;
    } else if (tail.length === 3) whole = head + tail;
    else return null;
  }
  if (!/^\d+$/.test(whole)) return null;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
// Rounds to the nearest cent and keeps the decimals the price already had:
// "69" with 10% -> "62,10"; "69.00" -> "62.10"; "12,50" with 20% -> "10,00".
export function discountedPrice(
  price: string,
  discount: number,
  currency = 'lei',
): { price: string; compare: string } | null {
  const cents = priceCents(price);
  if (cents === null || !Number.isInteger(discount) || !discount) return null;
  if (discount < 0 || discount > discountMax) return null;
  const reduced = Math.round((cents * (100 - discount)) / 100);
  if (reduced <= 0 || reduced >= cents) return null;
  const decimals = /[.,]\d{1,2}(?:[^\d]*)$/.test(price.trim()),
    dot = /,\d{1,2}(?:[^\d]*)$/.test(price.trim());
  const text = (reduced / 100).toFixed(2),
    [whole, fraction] = text.split('.');
  const shown =
    decimals || fraction !== '00'
      ? `${whole}${dot ? ',' : '.'}${fraction}`
      : whole;
  return { price: `${shown} ${currency}`, compare: price };
}
export type SiteContent = Record<CmsTextField, string> & {
  images: string[];
  heroMedia: CmsFile | null;
  logoMedia: CmsFile | null;
  gallery: CmsFile[];
  documents: CmsFile[];
  services: CmsService[];
  hours: CmsHours[];
  products: CmsProduct[];
  reviews: CmsReview[];
  pages?: ContentPage[];
};
export type EditorData = { content: SiteContent; revision: string };
export const galleryLimit = 20;
export const documentLimit = 10;
export const servicesLimit = 16;
export const hoursLimit = 14;

export type SiteImport = {
  source: 'manifest' | 'html';
  fields: Partial<Record<CmsTextField, string>>;
  images: string[];
  services: CmsService[];
  hours: CmsHours[];
  products: CmsProduct[];
  reviews: CmsReview[];
  pages?: ContentPage[];
};

// Only repair an old manifest link if the fresh scan confirms its exact counterpart.
function manifestAddress(value: string) {
  try {
    const url = new URL(value);
    const prefix = '/.well-known/';
    if (url.protocol === 'https:' && url.pathname.startsWith(prefix)) {
      url.pathname = '/' + url.pathname.slice(prefix.length);
      return url.href;
    }
  } catch {
    /* Not an absolute imported URL. */
  }
  return value;
}

export function fillFromSite(draft: SiteContent, source: SiteImport) {
  const next = { ...draft };
  for (const key of cmsTextFields) {
    const value = source.fields[key];
    if (
      !value ||
      (key === 'heroImageUrl' && draft.heroMedia) ||
      (key === 'logoUrl' && draft.logoMedia)
    )
      continue;
    if (
      !next[key].trim() ||
      (source.source === 'manifest' &&
        (key === 'logoUrl' || key === 'heroImageUrl') &&
        value === manifestAddress(next[key]))
    )
      next[key] = value;
  }
  if (!draft.images.length) next.images = source.images;
  else if (source.source === 'manifest') {
    const confirmed = new Set(source.images);
    next.images = [
      ...new Set(
        draft.images.map((url) => {
          const corrected = manifestAddress(url);
          return confirmed.has(corrected) ? corrected : url;
        }),
      ),
    ];
  }
  if (!draft.services.length) next.services = source.services;
  if (!draft.hours.length) next.hours = source.hours;
  if (source.reviews?.length) {
    // Reviews have no stable id, so compare the text and author together.
    const known = new Set(
      draft.reviews.map(
        (review) => `${review.name}\u0000${review.text}`.toLowerCase(),
      ),
    );
    const added = source.reviews.filter(
      (review) => !known.has(`${review.name}\u0000${review.text}`.toLowerCase()),
    );
    if (added.length)
      next.reviews = [
        ...draft.reviews,
        ...added.slice(0, Math.max(0, reviewLimit - draft.reviews.length)),
      ];
  }
  if (source.products?.length) {
    // Never overwrite an edited row: match on the name, keep what exists and
    // append what the site has but the editor does not.
    const known = new Set(
      draft.products.map((product) => product.name.trim().toLowerCase()),
    );
    const added = source.products.filter(
      (product) => !known.has(product.name.trim().toLowerCase()),
    );
    if (added.length)
      next.products = [
        ...draft.products,
        ...added
          .slice(0, Math.max(0, productLimit - draft.products.length))
          .map((product) => ({
            ...emptyProduct(),
            ...product,
            image: null,
            discount: product.discount ?? 0,
            bestseller: product.bestseller === true,
          })),
      ];
  }
  if (source.pages?.length) next.pages = mergePages(draft.pages ?? [], source.pages);
  return next;
}
