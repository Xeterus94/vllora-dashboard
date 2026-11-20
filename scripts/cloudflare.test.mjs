import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';
import {
  bootstrapToken,
  call,
  masterPassword,
  png,
  runtime,
} from './test-runtime.mjs';

test(
  'producție simulată: autentificare, branding, Cloudflare Routes, Analytics Engine și rollup cron',
  { timeout: 30000 },
  async (t) => {
    const origin = 'https://master.example.com',
      brand = 'brand.example.com',
      fallback = 'fallback.example.net';
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    const routeList = [];
    let aeDown = false,
      siteId;
    const env = await runtime({
      bindings: {
        ENVIRONMENT: 'production',
        APP_ORIGIN: origin,
        CF_ACCOUNT_ID: 'test-account',
        CF_API_TOKEN: 'route-test-token',
        CF_AE_API_TOKEN: 'read-test-token',
        MEDIA_PUBLIC_BASE: 'https://images.example.com',
      },
      outbound: async (request) => {
        const url = new URL(request.url);
        if (url.hostname === brand && url.pathname.startsWith('/.well-known/'))
          return Response.json({
            name: 'Contractul de brand',
            logo: '/logo.png',
            colors: { primary: '#123456', secondary: '#abcdef' },
            scheme: 'dark',
          });
        if (url.hostname === brand && url.pathname === '/logo.png')
          return new Response(png);
        if (url.hostname === fallback && url.pathname === '/')
          return new Response(
            `<html><head><title>Titlu alternativ</title><meta property="og:site_name" content="Brand din HTML"><style>:root { --brand-primary: #524079; --brand-accent: #fa8 }</style><script type="application/ld+json">{"logo":{"url":"https://${brand}/logo.png"}}</script></head></html>`,
            { headers: { 'Content-Type': 'text/html' } },
          );
        if (url.hostname !== 'api.cloudflare.com')
          return new Response(null, { status: 404 });
        if (url.pathname.endsWith('/analytics_engine/sql')) {
          assert.equal(
            request.headers.get('Authorization'),
            'Bearer read-test-token',
          );
          if (aeDown) return new Response(null, { status: 503 });
          const sql = await request.text();
          if (!sql.includes(`index1='${siteId}'`))
            return Response.json({ data: [] });
          if (sql.includes('GROUP BY path'))
            return Response.json({ data: [{ path: '/preturi', views: 37 }] });
          if (sql.includes('GROUP BY day'))
            return Response.json({
              data: [
                {
                  day: yesterday,
                  visitors: 8,
                  pageviews: 37,
                  sessions: 16,
                  bounces: 4,
                },
              ],
            });
          if (sql.includes('double1*_sample_interval'))
            return Response.json({
              data: [{ visitors: 8, pageviews: 37, sessions: 16, bounces: 4 }],
            });
          return Response.json({ data: [{ visitors: 3 }] });
        }
        assert.equal(
          request.headers.get('Authorization'),
          'Bearer route-test-token',
        );
        const success = (result) => Response.json({ success: true, result });
        if (url.pathname === '/client/v4/zones')
          return success(
            url.searchParams.get('name') === 'example.com'
              ? [
                  {
                    id: 'zone-com',
                    name: 'example.com',
                    account: { id: 'test-account' },
                  },
                ]
              : [],
          );
        if (
          url.pathname === '/client/v4/zones/zone-com/workers/routes' &&
          request.method === 'POST'
        ) {
          const route = { ...(await request.json()), id: 'route-1' };
          routeList.push(route);
          return success(route);
        }
        if (
          url.pathname === '/client/v4/zones/zone-com/workers/routes/route-1' &&
          request.method === 'DELETE'
        ) {
          routeList.length = 0;
          return success({ id: 'route-1' });
        }
        return success(routeList);
      },
    });
    t.after(() => env.close());
    const root = (path, opts) => call(env.mf, origin, path, opts);
    const boot = await root('/api/bootstrap', {
      method: 'POST',
      headers: { 'x-bootstrap-token': bootstrapToken },
      body: { username: 'master', name: 'Master', password: masterPassword },
    });
    assert.equal(boot.status, 201, boot.contents);
    const userId = boot.json.user.id;
    const { password_hash } = await env.db
      .prepare('SELECT password_hash FROM users WHERE id=?')
      .bind(userId)
      .first();
    assert.match(password_hash, /^[0-9a-f]{32}:[0-9a-f]{64}$/);
    const [salt, key] = password_hash.split(':');
    assert.equal(
      key,
      pbkdf2Sync(masterPassword, salt, 210_000, 32, 'sha256').toString('hex'),
    );

    // Model an existing D1 row minted by the old Worker, including UTF-8 password bytes.
    const legacySalt = '0123456789abcdef'.repeat(2),
      legacyPassword = 'ParolăVeche!2026';
    const legacyKey = pbkdf2Sync(
      legacyPassword,
      legacySalt,
      210_000,
      32,
      'sha256',
    );
    await env.db
      .prepare('UPDATE users SET password_hash=? WHERE id=?')
      .bind(`${legacySalt}:${legacyKey.toString('hex')}`, userId)
      .run();
    for (const [username, password] of [
      ['master', masterPassword],
      ['unknown-master', legacyPassword],
    ]) {
      const invalid = await root('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      assert.equal(invalid.status, 401, invalid.contents);
      assert.equal(invalid.json.error, 'Utilizator sau parolă incorectă.');
    }
    const privateRoute = await root('/derive', { method: 'POST', body: {} });
    assert.equal(privateRoute.status, 404);
    const login = await root('/api/auth/login', {
      method: 'POST',
      body: { username: 'master', password: legacyPassword },
    });
    assert.equal(login.status, 200, login.contents);
    assert.match(login.headers.get('set-cookie'), /Secure/);
    const admin = (path, method = 'GET', body) =>
      root(`/api/admin${path}`, { cookie: login.cookie, method, body });
    const create = await admin('/sites', 'POST', { domain: brand });
    assert.equal(create.status, 201, create.contents);
    const site = create.json.site;
    siteId = site.id;
    assert.equal(site.name, 'Contractul de brand');
    assert.equal(site.primary_color, '#123456');
    assert.equal(site.scheme, 'dark');
    assert.match(site.logo_url, /^https:\/\/images\.example\.com\/sites\//);
    assert.equal(site.route_status, 'active');
    assert.deepEqual(
      routeList.map((r) => r.pattern),
      [`${brand}/admin*`],
    );
    assert.equal(
      (await admin(`/sites/${siteId}/sync-route`, 'POST')).json.status,
      'active',
    );
    assert.equal(routeList.length, 1);
    assert.equal(
      (
        await root(
          site.logo_url.replace('https://images.example.com', '/media'),
        )
      ).status,
      200,
    );
    const tenant = await call(env.mf, `https://${brand}`, '/admin/');
    assert.equal(tenant.headers.get('x-frame-options'), 'DENY');
    const other = await admin('/sites', 'POST', { domain: fallback });
    assert.equal(other.status, 201, other.contents);
    assert.equal(other.json.site.brand_source, 'html');
    assert.equal(other.json.site.name, 'Brand din HTML');
    assert.equal(other.json.site.accent_color, '#ffaa88');
    assert.ok(other.json.site.logo_url);
    assert.equal(
      (
        await admin(`/sites/${siteId}/media/import`, 'POST', {
          url: 'https://127.0.0.1/logo.png',
        })
      ).status,
      400,
    );
    const stats = await admin(`/sites/${siteId}/stats?days=30`);
    assert.equal(stats.status, 200, stats.contents);
    assert.equal(stats.json.source, 'analytics_engine');
    assert.equal(stats.json.totals.pageviews, 37);
    assert.equal(stats.json.liveVisitors, 3);
    await env.db
      .prepare('INSERT INTO rate_limits VALUES (?,?,?)')
      .bind('expired', 1, Date.now() - 10)
      .run();
    const worker = await env.mf.getWorker();
    const cron = await worker.scheduled({
      scheduledTime: new Date(),
      cron: '15 2 * * *',
    });
    assert.equal(cron.outcome, 'ok');
    assert.equal(
      (
        await env.db
          .prepare(
            'SELECT pageviews FROM daily_stats WHERE site_id=? AND day=?',
          )
          .bind(siteId, yesterday)
          .first()
      ).pageviews,
      37,
    );
    assert.equal(
      (
        await env.db
          .prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE key='expired'")
          .first()
      ).n,
      0,
    );
    aeDown = true;
    const offline = await admin(`/sites/${siteId}/stats?days=30`);
    assert.equal(offline.json.source, 'rollup');
    assert.equal(offline.json.totals.pageviews, 37);
    assert.equal(offline.json.topPages[0].path, '/preturi');
    const deleted = await admin(`/sites/${siteId}`, 'DELETE');
    assert.equal(deleted.status, 200, deleted.contents);
    assert.equal(routeList.length, 0);
  },
);
