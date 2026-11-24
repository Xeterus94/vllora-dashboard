// Only these public display fields are sent in the unauthenticated portal shell.
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
