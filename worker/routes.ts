import { audit, stmt, type Env, type Site } from './core';
interface Zone {
  id: string;
  name: string;
  account: { id: string };
}
interface Route {
  id: string;
  pattern: string;
  script: string | null;
}
interface CertificatePack {
  id: string;
  status: string;
  hosts?: unknown[];
  certificates?: { hosts?: unknown[]; expires_on?: string | null }[];
}
/**
 * Read-only view of the TLS certificate that Cloudflare serves for a site.
 * Renewal itself is automatic at Cloudflare, so this never writes to the zone.
 */
export type CertificateState =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'none'
  | 'unknown'
  | 'unmanaged'
  | 'unconfigured'
  | 'error';
export interface CertificateReport {
  state: CertificateState;
  domain: string;
  expires_on: string | null;
  days_left: number | null;
  pack_status: string | null;
  hosts: string[];
  checked_at: string;
}
const EXPIRING_DAYS = 30;
const hostNames = (values: unknown[]): string[] =>
  values.flatMap((value) => {
    if (typeof value === 'string') return [value.toLowerCase()];
    if (value && typeof value === 'object') {
      const row = value as Record<string, unknown>;
      const name = row.host ?? row.name ?? row.value;
      return typeof name === 'string' ? [name.toLowerCase()] : [];
    }
    return [];
  });
const covers = (hosts: string[], domain: string) =>
  hosts.includes(domain) ||
  hosts.some((host) => host.startsWith('*.') && domain.endsWith(host.slice(1)));
async function cf<T>(env: Env, path: string, method = 'GET', body?: object) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(5000),
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(`Cloudflare API returned ${response.status}`);
  const result = await response.json<{ success: boolean; result: T }>();
  if (!result.success) throw new Error('Cloudflare API unsuccessful');
  return result.result;
}
const zoneToken = (env: Env) => Boolean(env.CF_API_TOKEN && env.CF_ACCOUNT_ID);
async function zoneOf(env: Env, domain: string): Promise<Zone | undefined> {
  const parts = domain.split('.');
  for (let i = 0; i < Math.min(parts.length - 1, 6); i++) {
    const name = parts.slice(i).join('.');
    const zones = await cf<Zone[]>(
      env,
      `/zones?name=${encodeURIComponent(name)}&account.id=${encodeURIComponent(env.CF_ACCOUNT_ID!)}`,
    );
    const zone = zones.find(
      (z) => z.name === name && z.account.id === env.CF_ACCOUNT_ID,
    );
    if (zone) return zone;
  }
}
export async function certificateReport(
  env: Env,
  domain: string,
): Promise<CertificateReport> {
  const checked_at = new Date().toISOString();
  const base = {
    domain,
    checked_at,
    expires_on: null,
    days_left: null,
    pack_status: null,
    hosts: [] as string[],
  };
  if (!zoneToken(env)) return { ...base, state: 'unconfigured' };
  try {
    const zone = await zoneOf(env, domain);
    if (!zone) return { ...base, state: 'unmanaged' };
    const packs = await cf<CertificatePack[]>(
      env,
      `/zones/${encodeURIComponent(zone.id)}/ssl/certificate_packs?status=all`,
    );
    const relevant = packs.filter((pack) =>
      covers(
        hostNames([
          ...(pack.hosts ?? []),
          ...(pack.certificates ?? []).flatMap((cert) => cert.hosts ?? []),
        ]),
        domain,
      ),
    );
    if (!relevant.length) return { ...base, state: 'none' };
    const hosts = [
      ...new Set(
        relevant.flatMap((pack) =>
          hostNames([
            ...(pack.hosts ?? []),
            ...(pack.certificates ?? []).flatMap((cert) => cert.hosts ?? []),
          ]),
        ),
      ),
    ].slice(0, 12);
    const pack = relevant.find((item) => item.status === 'active') ?? relevant[0];
    const expiries = relevant
      .flatMap((item) => item.certificates ?? [])
      .map((cert) => Date.parse(cert.expires_on ?? ''))
      .filter((value) => Number.isFinite(value));
    const soonest = expiries.length ? Math.min(...expiries) : null;
    const days_left =
      soonest === null ? null : Math.floor((soonest - Date.now()) / 86_400_000);
    const state: CertificateState =
      pack.status !== 'active'
        ? 'unknown'
        : days_left === null
          ? 'active'
          : days_left <= 0
            ? 'expired'
            : days_left <= EXPIRING_DAYS
              ? 'expiring'
              : 'active';
    return {
      ...base,
      state,
      expires_on: soonest === null ? null : new Date(soonest).toISOString(),
      days_left,
      pack_status: pack.status,
      hosts,
    };
  } catch {
    return { ...base, state: 'error' };
  }
}
export async function syncRoute(env: Env, site: Site, actor: string) {
  let status = 'manual',
    routeId = site.route_id,
    zoneId = site.route_zone;
  if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID)
    try {
      const script = env.WORKER_SCRIPT_NAME || 'vllora-backoffice';
      const zone = await zoneOf(env, site.domain);
      if (zone) {
        const pattern = `${site.domain}/admin*`,
          path = `/zones/${encodeURIComponent(zone.id)}/workers/routes`;
        const existing = (await cf<Route[]>(env, path)).find(
          (r) => r.pattern === pattern || r.pattern === `https://${pattern}`,
        );
        if (existing && existing.script !== script) status = 'conflict';
        else if (existing)
          status = 'active'; // Never take ownership of an independently provisioned route.
        else {
          const created = await cf<Route>(env, path, 'POST', {
            pattern,
            script,
          });
          routeId = created.id;
          zoneId = zone.id;
          status = 'active';
        }
      }
    } catch {
      status = 'error';
    }
  const updated = await stmt(
    env,
    "UPDATE sites SET route_status=?,route_id=?,route_zone=? WHERE id=? AND status!='deleting'",
    status,
    routeId,
    zoneId,
    site.id,
  ).run();
  if (
    !updated.meta.changes &&
    status === 'active' &&
    routeId &&
    routeId !== site.route_id
  ) {
    await removeRoute(env, { ...site, route_id: routeId, route_zone: zoneId });
  }
  await audit(env, 'route_sync_attempted', actor, site.id).run();
  return status;
}
export async function removeRoute(env: Env, site: Site) {
  if (!site.route_id || !site.route_zone) return;
  if (!env.CF_API_TOKEN) throw new Error('Route token missing');
  const path = `/zones/${encodeURIComponent(site.route_zone)}/workers/routes`;
  const route = (await cf<Route[]>(env, path)).find(
    (r) => r.id === site.route_id,
  );
  if (
    route?.pattern === `${site.domain}/admin*` &&
    route.script === (env.WORKER_SCRIPT_NAME || 'vllora-backoffice')
  )
    await cf(env, `${path}/${encodeURIComponent(route.id)}`, 'DELETE');
}
