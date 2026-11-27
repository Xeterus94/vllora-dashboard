import {
  defaultSiteType,
  isSiteType,
  siteTypes,
  type SiteType,
} from './portal-brand';

// One blueprint per kind of site. The editor renders only the sections of the
// blueprint, so a barbershop never sees stock and a shop never sees a booking
// form. Data that already exists is never hidden: a filled list outside the
// blueprint is appended, flagged as detected on the site.
export const editorSections = [
  'intro',
  'brand',
  'services',
  'program',
  'products',
  'reviews',
  'media',
  'contact',
  'pages',
] as const;
export type EditorSection = (typeof editorSections)[number];
export type SiteBlueprint = {
  type: SiteType;
  // Sections in the order they are shown.
  sections: EditorSection[];
  // Section labels that differ from the neutral default.
  labels: Partial<Record<EditorSection, string>>;
  // What the site actually does, in one line, for the editor header.
  summary: string;
  // Products are the catalogue: stock, discount, badge.
  catalogue: boolean;
  // Bookings and opening hours.
  bookings: boolean;
  // Services with price and duration (a barber's list, a hotel's rooms).
  services: boolean;
  // The booking fields (button label + link) make sense.
  bookingFields: boolean;
};

const base = {
  summary: 'Prezentare, servicii și contact.',
  catalogue: false,
  bookings: false,
  services: true,
  bookingFields: false,
};

export const blueprints: Record<SiteType, SiteBlueprint> = {
  presentation: {
    ...base,
    type: 'presentation',
    sections: ['intro', 'brand', 'services', 'reviews', 'media', 'contact', 'pages'],
    labels: {},
  },
  appointments: {
    ...base,
    type: 'appointments',
    summary: 'Programări, lista de servicii și programul de lucru.',
    sections: [
      'intro',
      'brand',
      'services',
      'program',
      'reviews',
      'media',
      'contact',
      'pages',
    ],
    labels: { services: 'Servicii și prețuri', program: 'Program și rezervări' },
    bookings: true,
    bookingFields: true,
  },
  ecommerce: {
    ...base,
    type: 'ecommerce',
    summary: 'Catalog de produse cu preț, stoc și reduceri.',
    sections: ['intro', 'brand', 'products', 'reviews', 'media', 'contact', 'pages'],
    labels: { products: 'Produse (magazin)' },
    catalogue: true,
    services: false,
  },
  restaurant: {
    ...base,
    type: 'restaurant',
    summary: 'Meniu cu prețuri, program și rezervări.',
    sections: [
      'intro',
      'brand',
      'services',
      'program',
      'reviews',
      'media',
      'contact',
      'pages',
    ],
    labels: { services: 'Meniu și prețuri', program: 'Program și rezervări' },
    bookings: true,
    bookingFields: true,
  },
  hotel: {
    ...base,
    type: 'hotel',
    summary: 'Camere și tarife, disponibilitate și rezervări.',
    sections: [
      'intro',
      'brand',
      'services',
      'program',
      'reviews',
      'media',
      'contact',
      'pages',
    ],
    labels: {
      services: 'Camere și tarife',
      program: 'Program și rezervări',
    },
    bookings: true,
    bookingFields: true,
  },
  real_estate: {
    ...base,
    type: 'real_estate',
    summary: 'Proprietăți cu preț, suprafețe și poze.',
    sections: ['intro', 'brand', 'products', 'media', 'contact', 'pages'],
    labels: { products: 'Proprietăți' },
    catalogue: true,
    services: false,
  },
  publishing: {
    ...base,
    type: 'publishing',
    summary: 'Articole, imagini și abonare.',
    sections: ['intro', 'brand', 'media', 'contact', 'pages'],
    labels: {},
    services: false,
  },
  portfolio: {
    ...base,
    type: 'portfolio',
    summary: 'Proiecte, servicii și contact.',
    sections: ['intro', 'brand', 'services', 'media', 'contact', 'pages'],
    labels: { services: 'Servicii și tarife' },
  },
};

export const blueprintFor = (type: string | undefined | null): SiteBlueprint =>
  blueprints[isSiteType(type) ? type : defaultSiteType];

export type SiteContentFacts = {
  services?: unknown[];
  products?: unknown[];
  reviews?: unknown[];
  hours?: unknown[];
};

// Sections to render for this site: the blueprint, plus any list that already
// holds data but is not part of the blueprint, so nothing becomes unreachable.
export function sectionsFor(
  type: string | undefined | null,
  content?: SiteContentFacts,
): { sections: EditorSection[]; extra: EditorSection[] } {
  const blueprint = blueprintFor(type);
  const has: Record<string, boolean> = {
    services: !!content?.services?.length,
    products: !!content?.products?.length,
    reviews: !!content?.reviews?.length,
    program: !!content?.hours?.length,
  };
  const extra = editorSections.filter(
    (id) =>
      (id === 'services' || id === 'products' || id === 'reviews' || id === 'program') &&
      has[id] &&
      !blueprint.sections.includes(id),
  );
  return {
    sections: [...blueprint.sections, ...extra].sort(
      (a, b) => editorSections.indexOf(a) - editorSections.indexOf(b),
    ),
    extra,
  };
}

export const sectionLabel = (
  type: string | undefined | null,
  section: EditorSection,
  fallback: Record<EditorSection, string>,
) => blueprintFor(type).labels[section] ?? fallback[section];

// The public page tells us what the site is. Only strong signals are used, and
// the master always confirms the result in the site form.
export function detectSiteType(facts: SiteContentFacts): SiteType {
  const count = (rows?: unknown[]) => rows?.length ?? 0;
  if (count(facts.products) >= 2) return 'ecommerce';
  if (count(facts.services) >= 2) return 'appointments';
  if (count(facts.hours) >= 2) return 'restaurant';
  return defaultSiteType;
}

export { siteTypes, isSiteType, type SiteType };
