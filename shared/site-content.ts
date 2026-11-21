export const cmsTextFields = [
  'siteName',
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
export type SiteContent = Record<CmsTextField, string> & {
  images: string[];
  heroMedia: CmsFile | null;
  logoMedia: CmsFile | null;
  gallery: CmsFile[];
  documents: CmsFile[];
  services: CmsService[];
  hours: CmsHours[];
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
  return next;
}
