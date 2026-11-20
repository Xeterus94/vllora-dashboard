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
    throw new Error(`Cloudflare routes returned ${response.status}`);
  const result = await response.json<{ success: boolean; result: T }>();
  if (!result.success) throw new Error('Cloudflare routes unsuccessful');
  return result.result;
}
export async function syncRoute(env: Env, site: Site, actor: string) {
  let status = 'manual',
    routeId = site.route_id,
    zoneId = site.route_zone;
  if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID)
    try {
      const parts = site.domain.split('.'),
        script = env.WORKER_SCRIPT_NAME || 'vllora-backoffice';
      let zone: Zone | undefined;
      for (let i = 0; i < Math.min(parts.length - 1, 6) && !zone; i++) {
        const name = parts.slice(i).join('.');
        const zones = await cf<Zone[]>(
          env,
          `/zones?name=${encodeURIComponent(name)}&account.id=${encodeURIComponent(env.CF_ACCOUNT_ID)}`,
        );
        zone = zones.find(
          (z) => z.name === name && z.account.id === env.CF_ACCOUNT_ID,
        );
      }
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
