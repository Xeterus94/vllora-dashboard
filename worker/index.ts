import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { PORTAL_ADMIN_PATH } from '../shared/portal-paths';
import { admin } from './admin';
import { auth, bootstrap, requireRole } from './auth';
import {
  collectTraffic,
  range,
  rollupTraffic,
  trackingScript,
  trafficStats,
} from './analytics';
import {
  all,
  audit,
  dev,
  fail,
  json,
  platformHost,
  siteSelect,
  siteView,
  stmt,
  text,
  trustedOrigin,
  type Bindings,
  type Ctx,
  type Env,
  type Site,
} from './core';
import { listMedia, removeImage, serveMedia, upload } from './media';
import { businessReport, collectEvent } from './metrics';

export { PasswordKdf } from './password';

const mount = /^\/admin(?=\/|$)/;
const worker = new Hono<Bindings>({
  getPath: (request) => new URL(request.url).pathname.replace(mount, '') || '/',
});
const api = new Hono<Bindings>();
const portal = new Hono<Bindings>();
worker.onError((error, c) => {
  if (error instanceof HTTPException)
    return c.json({ error: error.message }, error.status);
  // Never log request payloads, tokens, or SQL arguments.
  console.error('worker_internal_error', error.name);
  return c.json({ error: 'Eroare internă. Încearcă din nou.' }, 500);
});
worker.notFound((c) => c.json({ error: 'Ruta nu există.' }, 404));
worker.use('*', async (c, next) => {
  const url = new URL(c.req.url),
    { hostname: host, pathname } = url,
    mounted = mount.test(pathname);
  const path = pathname.replace(mount, '') || '/';
  c.set('host', host);
  c.set('tenant', null);
  if (!platformHost(c.env, host)) {
    if (!mounted) return fail(404, 'Portalul nu există pe această cale.');
    const tenant = await stmt(
      c.env,
      `${siteSelect} JOIN site_hosts h ON h.site_id=s.id WHERE h.host=? AND s.status!='deleting'`,
      host,
    ).first<Site>();
    if (!tenant) return fail(404, 'Portalul nu există pe acest domeniu.');
    c.set('tenant', tenant);
  } else if (mounted)
    return fail(404, 'Acesta este domeniul master, nu un portal de client.');
  const collector = path === '/api/collect' || path === '/api/collect-event';
  if (path.startsWith('/api/') || path === '/') {
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
  }
  if (collector && !mounted) {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    c.header('Access-Control-Max-Age', '600');
  } else if (
    path.startsWith('/api/') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) &&
    !trustedOrigin(c)
  ) {
    return fail(403, 'Origine neautorizată.');
  }
  c.header('X-Content-Type-Options', 'nosniff');
  if (!dev(c.env)) c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  await next();
  if (!dev(c.env)) c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
});
api.route('/auth', auth);
api.post('/bootstrap', bootstrap);
api.route('/admin', admin);
api.options('/collect', (c) =>
  c.get('tenant') ? fail(404, 'Ruta nu există.') : c.body(null, 204),
);
api.options('/collect-event', (c) =>
  c.get('tenant') ? fail(404, 'Ruta nu există.') : c.body(null, 204),
);
api.post('/collect', (c) =>
  c.get('tenant') ? fail(404, 'Ruta nu există.') : collectTraffic(c),
);
api.post('/collect-event', (c) =>
  c.get('tenant') ? fail(404, 'Ruta nu există.') : collectEvent(c),
);
portal.use('*', async (c, next) => {
  await requireRole(c, 'client_admin');
  await next();
});
const tenantId = (c: Parameters<typeof range>[0]) => c.get('user').client_id!;
portal.get('/me', (c) =>
  c.json({ site: siteView(c.env, c.get('tenant')!, false, '/admin') }),
);
portal.get('/stats', async (c) =>
  c.json(await trafficStats(c.env, tenantId(c), range(c))),
);
portal.get('/metrics', async (c) =>
  c.json(await businessReport(c.env, tenantId(c), range(c))),
);
portal.patch('/site', async (c) => {
  const notes = text((await json(c, 8192)).notes, 3000, 'Notițe', true),
    id = tenantId(c);
  await c.env.DB.batch([
    stmt(
      c.env,
      "UPDATE sites SET notes=? WHERE id=? AND status='active'",
      notes,
      id,
    ),
    audit(c.env, 'portal_notes_changed', c.get('user').id, id),
  ]);
  return c.json({ notes });
});
portal.get('/media', (c) => listMedia(c, tenantId(c), '/admin'));
portal.post('/media', (c) => upload(c, tenantId(c), '/admin'));
portal.delete('/media/:id', (c) =>
  removeImage(c, tenantId(c), c.req.param('id')),
);
api.route('/portal', portal);
worker.route('/api', api);
worker.get('/track.js', (c) => {
  if (c.get('tenant')) return fail(404, 'Ruta nu există.');
  return c.body(trackingScript, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
});
worker.on(['GET', 'HEAD'], '/media/*', (c) => {
  const url = new URL(c.req.url),
    key = url.pathname.replace(mount, '').slice('/media/'.length),
    tenant = c.get('tenant');
  if (tenant && !key.startsWith(`sites/${tenant.id}/`))
    return fail(404, 'Imaginea nu există.');
  return serveMedia(c, key);
});
async function portalShell(c: Ctx) {
  const asset = await c.env.ASSETS.fetch(
    new Request(new URL('/', c.req.url), { method: c.req.method }),
  );
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self'; base-uri 'none'; form-action 'self'" +
      (dev(c.env) ? '' : "; frame-ancestors 'none'"),
  );
  return response;
}
function portalAsset(c: Ctx, prefix: string) {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.slice(prefix.length);
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
}
worker.on(['GET', 'HEAD'], '/', (c) => {
  const url = new URL(c.req.url);
  if (c.get('tenant')) {
    if (url.pathname === '/admin')
      return c.redirect('/admin/' + url.search, 308);
    return portalShell(c);
  }
  if (c.env.MASTER_DASHBOARD_URL) {
    const master = new URL(c.env.MASTER_DASHBOARD_URL);
    if (
      master.protocol === 'https:' &&
      !master.username &&
      !master.password &&
      master.hostname !== url.hostname
    ) {
      master.hash = '';
      // The explicit empty fragment prevents browsers from forwarding an old
      // password-reset token from this origin to the portfolio destination.
      return c.redirect(`${master.href}#`, 302);
    }
  }
  return c.redirect(PORTAL_ADMIN_PATH, 302);
});
const portalAdminPrefix = PORTAL_ADMIN_PATH.slice(0, -1);
const staffOnly = (c: Ctx, handler: () => Response | Promise<Response>) =>
  c.get('tenant') ? fail(404, 'Ruta nu există.') : handler();
worker.on(['GET', 'HEAD'], portalAdminPrefix, (c) =>
  staffOnly(c, () =>
    c.redirect(PORTAL_ADMIN_PATH + new URL(c.req.url).search, 308),
  ),
);
worker.on(['GET', 'HEAD'], PORTAL_ADMIN_PATH, (c) =>
  staffOnly(c, () => portalShell(c)),
);
worker.on(['GET', 'HEAD'], `${PORTAL_ADMIN_PATH}assets/*`, (c) =>
  staffOnly(c, () => portalAsset(c, portalAdminPrefix)),
);
worker.on(['GET', 'HEAD'], '/assets/*', (c) =>
  c.get('tenant') ? portalAsset(c, '/admin') : fail(404, 'Ruta nu există.'),
);

export default {
  fetch: worker.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const now = Date.now();
        await env.DB.batch([
          stmt(env, 'DELETE FROM sessions WHERE expires_at<=?', now),
          stmt(
            env,
            'DELETE FROM password_resets WHERE expires_at<=? OR used_at IS NOT NULL',
            now,
          ),
          stmt(env, 'DELETE FROM rate_limits WHERE expires_at<=?', now),
        ]);
        const abandoned = await all<{ id: string; object_key: string }>(
          env,
          'SELECT id,object_key FROM media WHERE ready=0 AND created_at<? LIMIT 200',
          now - 60 * 60 * 1000,
        );
        if (abandoned.length) {
          await env.MEDIA.delete(abandoned.map((row) => row.object_key));
          await env.DB.batch(
            abandoned.map((row) =>
              stmt(env, 'DELETE FROM media WHERE id=? AND ready=0', row.id),
            ),
          );
        }
      })(),
    );
    ctx.waitUntil(rollupTraffic(env, event.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
