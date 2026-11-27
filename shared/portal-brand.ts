// Only these public display fields are sent in the unauthenticated portal shell.
// The type is the behaviour of the portal: a barbershop gets bookings and a
// price list, a shop gets stock and orders, a presentation site gets neither.
export type SiteType = keyof typeof siteTypes;
export const siteTypes = {
  presentation: 'Prezentare / servicii',
  appointments: 'Programări (barbershop, salon)',
  ecommerce: 'Magazin online',
  restaurant: 'Restaurant / cafenea',
  hotel: 'Hotel / pensiune',
  real_estate: 'Imobiliare',
  publishing: 'Blog / publicație',
  portfolio: 'Portofoliu / agenție',
} as const;
export const defaultSiteType: SiteType = 'presentation';
export const isSiteType = (value: unknown): value is SiteType =>
  typeof value === 'string' && Object.hasOwn(siteTypes, value);
// The metric profile follows the site type, so a new site does not start with
// shop KPIs just because nobody chose a profile.
export const profileForType: Record<SiteType, string> = {
  presentation: 'services',
  appointments: 'appointments',
  ecommerce: 'ecommerce',
  restaurant: 'restaurant',
  hotel: 'hotel',
  real_estate: 'real_estate',
  publishing: 'publishing',
  portfolio: 'portfolio',
};
export type PortalBrand = {
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  scheme: 'light' | 'dark';
  logo_url: string | null;
  favicon_url?: string | null;
};

export const portalBrandAttribute = 'data-portal-brand';
export const portalLabel = 'Admin Dashboard';
export const portalTitle = (name: string) => `${name} · ${portalLabel}`;

// The portal icon is the client's own mark: logo, then favicon, then the site
// initials in the site colour. The platform mark is only the last resort.
const iconInitials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join('')
    .toUpperCase();
// Relative luminance, so the initials stay readable on the site colour.
const iconLuminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function portalIcon(
  site: Pick<PortalBrand, 'name' | 'primary_color'> &
    Partial<Pick<PortalBrand, 'logo_url' | 'favicon_url'>>,
  platformIcon: string,
) {
  if (site.logo_url) return site.logo_url;
  if (site.favicon_url) return site.favicon_url;
  const label = iconInitials(site.name);
  if (!label) return platformIcon;
  const background = /^#[0-9a-f]{6}$/i.test(site.primary_color)
    ? site.primary_color
    : '#4f1220';
  const ink = 1.05 / (iconLuminance(background) + 0.05) >= 4.5 ? '#ffffff' : '#000000';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${background}"/><text x="32" y="32" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="${label.length > 1 ? 26 : 34}" font-weight="700" fill="${ink}" text-anchor="middle" dominant-baseline="central">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
