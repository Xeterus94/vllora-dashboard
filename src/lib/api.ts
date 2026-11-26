import type { CompanyData } from '../../shared/site-content';
import type { PortalBrand } from '../../shared/portal-brand';
import type { Permission } from '../../shared/permissions';
import type { MetricId, MetricSettings } from '../../shared/metrics';
import { webImage, type MediaPurpose } from './web-image';

export type Site = PortalBrand & {
  id: string;
  domain: string;
  portal_host: string | null;
  plan: string;
  status: 'active' | 'suspended' | 'deleting';
  logo_media_id: string | null;
  favicon_media_id: string | null;
  favicon_url: string | null;
  notes: string;
  brand_source?: string;
  tracking_token?: string;
  route_status?: string;
};
export type User = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: 'super_admin' | 'client_admin';
  client_id: string | null;
  must_change_password: boolean;
  permissions: Permission[];
};
export type Identity = {
  user: User;
  site: Site | null;
  must_change_password: boolean;
};
export type Totals = {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounces: number;
};
export type Stats = {
  days: (Totals & { day: string })[];
  totals: Totals;
  previous: Totals;
  topPages: { path: string; views: number }[];
  liveVisitors: number | null;
  source: 'analytics_engine' | 'rollup' | 'mixed';
};
export type BusinessReport = {
  settings: MetricSettings;
  values: {
    id: MetricId;
    state: 'received' | 'ready' | 'needs_integration';
    last_event: number | null;
    value: number | string | null;
    monthly: number | string | null;
    source: string;
  }[];
  trafficMonthly: Partial<Record<MetricId, number>>;
  days: number;
};
export type SiteDetail = {
  site: Site;
  company: CompanyData;
  users: User[];
  settings: MetricSettings;
  server_key_configured: boolean;
  currency_locked: boolean;
};
export type MediaItem = {
  id: string;
  name: string;
  url: string;
  size: number;
  content_type: string;
  width: number | null;
  height: number | null;
};
export type MediaList = {
  items: MediaItem[];
  used: number;
  quota: number;
  delivery: 'cdn' | 'worker';
};
export type CertificateReport = {
  state:
    | 'active'
    | 'expiring'
    | 'expired'
    | 'none'
    | 'unknown'
    | 'unmanaged'
    | 'unconfigured'
    | 'error';
  domain: string;
  expires_on: string | null;
  days_left: number | null;
  pack_status: string | null;
  hosts: string[];
  checked_at: string;
};
export type AuditEntry = {
  id: number;
  action: string;
  site_id: string | null;
  at: number;
  username: string | null;
};
export const mount = /^\/admin(?:\/|$)/.test(location.pathname) ? '/admin' : '';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const form = body instanceof FormData;
  const res = await fetch(`${mount}/api${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers:
      body === undefined || form
        ? undefined
        : { 'Content-Type': 'application/json' },
    body: form ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data === null)
    throw new ApiError(
      res.status,
      data?.error || 'Serviciul nu a răspuns. Încearcă din nou.',
    );
  return data as T;
}
export const adminSite = (id: string) =>
  `/admin/sites/${encodeURIComponent(id)}`;
export const adminUser = (id: string) =>
  `/admin/users/${encodeURIComponent(id)}`;
export const collection = (site?: string) =>
  `${site ? adminSite(site) : '/portal'}/media`;
export async function uploadMedia(
  path: string,
  file: File,
  purpose: MediaPurpose,
) {
  const form = new FormData();
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (pdf && file.size > 8 * 1024 * 1024)
    throw new Error('Documentele PDF pot avea cel mult 8 MB.');
  form.append('file', pdf ? file : await webImage(file, purpose));
  return request<{ item: MediaItem }>(path, 'POST', form);
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'A apărut o eroare. Încearcă din nou.';
