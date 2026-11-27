import { cmsTextFields, type CmsTextField } from './site-content';

// Direct editing in the preview. The same names are used on the public page
// (data-vllora-field / data-vllora-text) and in the portal, so a click always
// maps to exactly one field.
export type InlineField =
  | { source: 'text'; field: CmsTextField }
  | { source: 'page'; page: string; id: string };

export const inlineAttribute = 'data-vllora-inline';

const singleLine = new Set<CmsTextField>([
  'siteName',
  'heroTitle',
  'announcement',
  'phone',
  'whatsapp',
  'email',
  'address',
  'bookingLabel',
  'companyName',
  'companyCui',
  'companyRegistry',
  'aboutTitle',
]);
const links = new Set<CmsTextField>([
  'bookingUrl',
  'mapsUrl',
  'facebook',
  'instagram',
]);
// "Despre" reads as a layout photograph in a single line, so it stays a textarea.
const multiLine = new Set<CmsTextField>(['heroSubtitle', 'aboutText']);

export const isInlineText = (value: unknown): value is CmsTextField =>
  typeof value === 'string' && cmsTextFields.includes(value as CmsTextField);

export const isInlineLink = (field: CmsTextField) => links.has(field);

// Everything the overlay needs to draw the right input for a field.
export function inlineKind(field: CmsTextField) {
  if (links.has(field)) return 'url' as const;
  if (multiLine.has(field) || !singleLine.has(field)) return 'text' as const;
  return 'line' as const;
}

export const inlineLimit = (field: CmsTextField) =>
  field === 'siteName'
    ? 100
    : field === 'aboutText'
      ? 3000
      : links.has(field)
        ? 2048
        : 1200;

export const inlineLabel = (field: CmsTextField) =>
  inlineLabels[field] ?? field;

export const inlineLabels: Partial<Record<CmsTextField, string>> = {
  siteName: 'Numele site-ului',
  heroTitle: 'Titlu principal',
  heroSubtitle: 'Subtitlu',
  announcement: 'Anunț',
  aboutTitle: 'Titlu Despre',
  aboutText: 'Text Despre',
  bookingLabel: 'Text buton rezervare',
  bookingUrl: 'Link rezervare',
  phone: 'Telefon',
  whatsapp: 'WhatsApp',
  email: 'Email',
  address: 'Adresă',
  mapsUrl: 'Link hartă',
  facebook: 'Facebook',
  instagram: 'Instagram',
  companyName: 'Denumire firmă',
  companyCui: 'CUI',
  companyRegistry: 'Registrul Comerțului',
  companyAddress: 'Sediu social',
};

// The page side: mark every editable element so the overlay can find it, and
// report clicks back to the portal. Only messages from the portal origin count.
export const inlineHintStyle =
  'outline:2px dashed rgba(107,28,46,.55);outline-offset:2px;border-radius:4px;cursor:text';

// Messages exchanged between the portal and the framed page while editing.
export const inlineMessages = {
  pick: 'vllora:inline-pick',
  payload: 'vllora:inline-payload',
  enable: 'vllora:inline-enable',
} as const;

