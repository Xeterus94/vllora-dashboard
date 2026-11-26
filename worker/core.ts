import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { storedPermissions } from '../shared/permissions';

export interface Env {
  DB: D1Database;
  PASSWORD_KDF: DurableObjectNamespace;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;
  BRAND_CACHE?: KVNamespace;
  ANALYTICS?: AnalyticsEngineDataset;
  BUSINESS_ANALYTICS?: AnalyticsEngineDataset;
  ENVIRONMENT?: string;
  APP_ORIGIN?: string;
  MASTER_API_BASE?: string;
  EXTRA_ORIGINS?: string;
  DEV_TENANT_HOSTS?: string;
  MEDIA_PUBLIC_BASE?: string;
  BOOTSTRAP_TOKEN?: string;
  TRACK_SALT?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  CF_AE_API_TOKEN?: string;
  AE_DATASET?: string;
  BUSINESS_AE_DATASET?: string;
  WORKER_SCRIPT_NAME?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  DEV_EMAIL_API_URL?: string;
}
export interface Site {
  id: string;
  domain: string;
  portal_host: string | null;
  name: string;
  status: 'active' | 'suspended' | 'deleting';
  plan: string;
  tracking_token: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  scheme: 'light' | 'dark';
  brand_source: string;
  logo_media_id: string | null;
  favicon_media_id: string | null;
  favicon_key?: string | null;
  logo_data?: string | null;
  object_key?: string | null;
  route_id: string | null;
  route_zone: string | null;
  route_status: string;
  notes: string;
  created_at: number;
}
export interface User {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: 'super_admin' | 'client_admin';
  client_id: string | null;
  password_hash: string;
  password_version: number;
  must_change_password: number;
  permissions?: string | null;
  created_at: number;
}
export type Bindings = {
  Bindings: Env;
  Variables: { host: string; tenant: Site | null; user: User; session: string };
};
export type Ctx = Context<Bindings>;
export const fail = (
  status: 400 | 401 | 403 | 404 | 405 | 409 | 413 | 415 | 422 | 429 | 502 | 503,
  message: string,
): never => {
  throw new HTTPException(status, { message });
};
export const required = <T>(
  value: T | null | undefined,
  message = 'Resursa nu există.',
): T => value ?? fail(404, message);
export const stmt = (
  env: Env,
  query: string,
  ...args: (string | number | null)[]
) => env.DB.prepare(query).bind(...args);
export const all = async <T>(
  env: Env,
  query: string,
  ...args: (string | number | null)[]
) => (await stmt(env, query, ...args).all<T>()).results;
export const audit = (
  env: Env,
  action: string,
  actor: string | null,
  site: string | null,
) =>
  stmt(
    env,
    'INSERT INTO audit_log(actor_id,site_id,action,at) VALUES(?,?,?,?)',
    actor,
    site,
    action,
    Date.now(),
  );
export const encode = (data: Uint8Array) =>
  Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');
export const random = (bytes = 32) =>
  encode(crypto.getRandomValues(new Uint8Array(bytes)));
export const hash = async (value: string) =>
  encode(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  );
export const equal = (a: string, b: string) => {
  let value = a.length ^ b.length;
  for (let i = 0; i < a.length; i++)
    value |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return value === 0;
};
export const validHost = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const v = input.toLowerCase().trim();
  return v.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
      v,
    ) &&
    !/(?:^|\.)(localhost|local|internal|lan|test|invalid|onion|arpa|home)$/.test(
      v,
    )
    ? v
    : null;
};
export const dev = (env: Env) => env.ENVIRONMENT === 'development';
export const loopback = (host: string) =>
  ['localhost', '127.0.0.1', '[::1]'].includes(host);
export const platforms = (env: Env) =>
  [env.APP_ORIGIN, env.MASTER_API_BASE]
    .filter(Boolean)
    .map((value) => new URL(value!).hostname);
export const platformHost = (env: Env, host: string) =>
  platforms(env).includes(host) ||
  (dev(env) && (loopback(host) || /^\d+-[a-z0-9-]+\.e2b\.app$/.test(host)));
export const siteSelect =
  'SELECT s.*,m.object_key,f.object_key AS favicon_key FROM sites s LEFT JOIN media m ON m.id=s.logo_media_id AND m.site_id=s.id AND m.ready=1 LEFT JOIN media f ON f.id=s.favicon_media_id AND f.site_id=s.id AND f.ready=1';
export const findSite = (env: Env, id: string) =>
  stmt(env, `${siteSelect} WHERE s.id=?`, id).first<Site>();
export const publicMediaUrl = (env: Env, key: string, prefix = '') =>
  `${env.MEDIA_PUBLIC_BASE?.replace(/\/+$/, '') || `${prefix}/media`}/${key}`;
export const siteView = (env: Env, site: Site, admin = false, prefix = '') => ({
  id: site.id,
  domain: site.domain,
  portal_host: site.portal_host,
  name: site.name,
  status: site.status,
  plan: site.plan,
  primary_color: site.primary_color,
  secondary_color: site.secondary_color,
  accent_color: site.accent_color,
  scheme: site.scheme,
  logo_media_id: site.logo_media_id,
  logo_url: site.object_key
    ? publicMediaUrl(env, site.object_key, prefix)
    : null,
  favicon_media_id: site.favicon_media_id,
  favicon_url: site.favicon_key
    ? publicMediaUrl(env, site.favicon_key, prefix)
    : null,
  notes: site.notes,
  ...(admin
    ? {
        brand_source: site.brand_source,
        tracking_token: site.tracking_token,
        route_status: site.route_status,
        created_at: site.created_at,
      }
    : {}),
});
export const userView = (user: User) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email,
  role: user.role,
  client_id: user.client_id,
  must_change_password: Boolean(user.must_change_password),
  permissions:
    user.role === 'client_admin' ? storedPermissions(user.permissions) : [],
});
export async function readBytes(input: Request | Response, limit: number) {
  if (Number(input.headers.get('content-length')) > limit)
    fail(413, 'Fișierul sau cererea depășește limita.');
  if (!input.body) return new Uint8Array(0);
  const reader = input.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        fail(413, 'Fișierul sau cererea depășește limita.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function json(
  c: Ctx,
  limit = 32768,
): Promise<Record<string, unknown>> {
  const bytes = await readBytes(c.req.raw, limit);
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || Array.isArray(value) || typeof value !== 'object')
      throw new Error();
    return value;
  } catch {
    return fail(400, 'Cerere JSON invalidă.');
  }
}
export function text(
  value: unknown,
  max: number,
  label: string,
  optional = false,
): string {
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (!optional && !value.trim())
  )
    return fail(400, `${label}: valoare invalidă.`);
  return value.trim();
}
export async function rate(
  env: Env,
  key: string,
  max: number,
  windowMs: number,
  lockFromLimit = false,
) {
  const now = Date.now();
  const row = await stmt(
    env,
    `INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? OR (? AND count+1=?) THEN excluded.expires_at ELSE expires_at END RETURNING count`,
    key,
    now + windowMs,
    now,
    now,
    Number(lockFromLimit),
    max,
  ).first<{ count: number }>();
  return (row?.count ?? max + 1) <= max;
}
export const ipKey = (c: Ctx) =>
  hash(
    `${c.env.TRACK_SALT || ''}|${c.req.header('CF-Connecting-IP') || 'local'}`,
  );
export function trustedOrigin(c: Ctx) {
  const origin = c.req.header('Origin');
  if (!origin) return true; // non-browser clients; all browser writes also require a first-party cookie
  const current = new URL(c.req.url);
  if (origin === current.origin) return true;
  // The local Vite proxy can terminate HTTPS while preserving the preview Host.
  if (dev(c.env)) {
    try {
      const value = new URL(origin);
      return (
        loopback(value.hostname) ||
        (value.hostname === current.hostname &&
          platformHost(c.env, value.hostname))
      );
    } catch {
      return false;
    }
  }
  if (c.get('tenant')) return false;
  return [
    c.env.APP_ORIGIN,
    c.env.MASTER_API_BASE,
    ...(c.env.EXTRA_ORIGINS || '').split(','),
  ].some((value) => value?.trim().replace(/\/$/, '') === origin);
}
