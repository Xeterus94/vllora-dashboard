import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  portalBrandAttribute,
  portalIcon,
  portalTitle,
  type PortalBrand,
} from '../shared/portal-brand';
import { PORTAL_ADMIN_PATH } from '../shared/portal-paths';
import { storedPermissions, type Permission } from '../shared/permissions';
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
  publicMediaUrl,
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
import { publicContent } from './portfolio';
import { editorContent, publishContent } from './site-content';
import { inspectSite } from './site-import';

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
api.get('/content', publicContent);
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
// The client UI hides these, but the API is what actually refuses.
const allow = (c: Ctx, permission: Permission) => {
  const granted = storedPermissions(c.get('user').permissions);
  if (!granted.includes(permission))
    return fail(403, 'Nu ai permisiunea necesară pentru această acțiune.');
};
portal.get('/me', (c) =>
  c.json({ site: siteView(c.env, c.get('tenant')!, false, '/admin') }),
);
portal.get('/stats', async (c) => {
  allow(c, 'stats');
  return c.json(await trafficStats(c.env, tenantId(c), range(c)));
});
portal.get('/metrics', async (c) => {
  allow(c, 'stats');
  return c.json(await businessReport(c.env, tenantId(c), range(c)));
});
portal.patch('/site', async (c) => {
  allow(c, 'notes');
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
portal.get('/content', (c) => {
  allow(c, 'content');
  return editorContent(c, tenantId(c));
});
portal.post('/content/import', (c) => {
  allow(c, 'content');
  return inspectSite(c, c.get('tenant')!);
});
portal.put('/content', (c) => {
  allow(c, 'content');
  return publishContent(c, tenantId(c));
});
portal.get('/media', (c) => {
  allow(c, 'media');
  return listMedia(c, tenantId(c), '/admin');
});
portal.post('/media', (c) => {
  allow(c, 'media');
  return upload(c, tenantId(c), '/admin');
});
portal.delete('/media/:id', (c) => {
  allow(c, 'media');
  return removeImage(c, tenantId(c), c.req.param('id'));
});
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
async function shell(c: Ctx, path = '/index.html') {
  const asset = await c.env.ASSETS.fetch(
    new Request(new URL(path, c.req.url), { method: c.req.method }),
  );
  const response = new Response(asset.body, asset);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'${path === '/index.html' ? " 'wasm-unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'` +
      (path === '/index.html' && !c.get('tenant') ? '; frame-src https:' : '') +
      (dev(c.env) ? '' : "; frame-ancestors 'none'"),
  );
  const tenant = c.get('tenant');
  if (!tenant || !asset.ok) return response;
  const brand: PortalBrand = {
    name: tenant.name,
    primary_color: tenant.primary_color,
    secondary_color: tenant.secondary_color,
    accent_color: tenant.accent_color,
    scheme: tenant.scheme,
    logo_url: tenant.object_key
      ? publicMediaUrl(c.env, tenant.object_key, '/admin')
      : null,
    favicon_url: tenant.favicon_key
      ? publicMediaUrl(c.env, tenant.favicon_key, '/admin')
      : null,
  };
  // The tab icon is the site's logo, so the shell renders the client brand and
  // never flashes the platform logo before /auth/me answers.
  const icon = portalIcon(brand, './assets/vllora-logo.svg');
  // The source asset is shared, but the HTML representation is specific to the host.
  response.headers.delete('ETag');
  response.headers.delete('Content-Length');
  if (c.req.method === 'HEAD') return response;
  return new HTMLRewriter()
    .on('title', {
      element: (element) => {
        element.setInnerContent(portalTitle(brand.name));
      },
    })
    .on('link[rel=icon]', {
      element: (element) => {
        element.setAttribute('href', icon);
        element.removeAttribute('type');
      },
    })
    .on('#root', {
      element: (element) => {
        element.setAttribute(
          portalBrandAttribute,
          encodeURIComponent(JSON.stringify(brand)),
        );
      },
    })
    .transform(response);
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
    return shell(c);
  }
  return shell(c, '/master/index.html');
});
const portalAdminPrefix = PORTAL_ADMIN_PATH.slice(0, -1);
const staffOnly = (c: Ctx, handler: () => Response | Promise<Response>) =>
  c.get('tenant') ? fail(404, 'Ruta nu există.') : handler();
worker.on(['GET', 'HEAD'], '/master/assets/*', (c) =>
  staffOnly(c, () => c.env.ASSETS.fetch(c.req.raw)),
);
worker.on(['GET', 'HEAD'], portalAdminPrefix, (c) =>
  staffOnly(c, () =>
    c.redirect(PORTAL_ADMIN_PATH + new URL(c.req.url).search, 308),
  ),
);
worker.on(['GET', 'HEAD'], PORTAL_ADMIN_PATH, (c) =>
  staffOnly(c, () => shell(c)),
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
