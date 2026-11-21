export const cmsTextFields = [
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
