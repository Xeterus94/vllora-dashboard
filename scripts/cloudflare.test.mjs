import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { test } from 'node:test';
import {
  bootstrapToken,
  clientPassword,
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
        if (
          url.hostname === brand &&
          url.pathname === '/.well-known/vllora-content.json'
        )
          return Response.json({
            version: 1,
            content: {
              siteName: 'Nume comercial',
              primaryColor: '#abc',
              heroTitle: 'Titlu din manifest',
              services: [{ name: 'Tuns', price: '85 lei' }],
              hours: [{ day: 'Luni', time: '9–18' }],
              images: ['/photo.webp', 'javascript:void(0)', '/photo.webp'],
              bookingUrl: 'https://127.0.0.1/contact',
              unknown: 'private-config',
            },
          });
        if (
          url.hostname === brand &&
          url.pathname === '/.well-known/vllora-brand.json'
        )
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
            `<html><head><title>Titlu alternativ</title><meta property="og:site_name" content="Brand din HTML"><link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="https://styles-outside.example.org/theme.css"><link rel="icon" href="/favicon.ico"></head><body><img class="site-logo" src="/brand-mark.png" alt="Brand"><h1>Pagina de test</h1><p data-cms="subtitlu">Din HTML-ul public</p><a href="tel:+40700123456">Sună</a><div id="galerie"><img src="/assets/work.webp" alt=""></div></body></html>`,
            { headers: { 'Content-Type': 'text/html' } },
          );
        if (url.hostname === fallback && url.pathname === '/assets/theme.css')
          return new Response(
            ':root { --color-primary: #524079; --brand-secondary: #345; --accent: #fa8 }',
          );
        if (url.hostname === fallback && url.pathname === '/brand-mark.png')
          return new Response(png);
        assert.notEqual(url.hostname, 'styles-outside.example.org');
        if (url.hostname !== 'api.cloudflare.com')
          return new Response(null, { status: 404 });
        if (url.pathname.endsWith('/analytics_engine/sql')) {
          assert.equal(
            request.headers.get('Authorization'),
            'Bearer read-test-token',
          );
          if (aeDown) return new Response(null, { status: 503 });
          const sql = await request.text();
          if (sql.includes('GROUP BY site'))
            return Response.json({ data: [{ site: siteId, visitors: 3 }] });
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
    const entry = await root('/');
    assert.equal(entry.status, 200);
    assert.match(entry.contents, /Vllora Studio Master Dashboard/);
    assert.equal(entry.headers.get('location'), null);
    assert.match(
      entry.headers.get('content-security-policy'),
      /script-src 'self'/,
    );
    assert.equal((await root('/master/assets/master.js')).status, 200);
    assert.equal(entry.headers.get('referrer-policy'), 'no-referrer');
    const redirect = await root('/portal-admin?tab=access');
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), '/portal-admin/?tab=access');
    const tools = await root('/portal-admin/');
    assert.equal(tools.status, 200);
    assert.match(tools.headers.get('cache-control'), /no-store/);
    const asset = tools.contents.match(/src="\.\/assets\/([^"]+)/)[1];
    assert.equal((await root(`/portal-admin/assets/${asset}`)).status, 200);
    assert.equal((await root(`/assets/${asset}`)).status, 404);
    assert.equal((await root('/admin/')).status, 404);

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
    assert.equal((await root('/api/admin/portfolio')).status, 401);
    assert.equal(
      (
        await root('/api/admin/portfolio', {
          headers: { Authorization: 'Basic dGVzdDp0ZXN0' },
        })
      ).status,
      401,
    );
    const portfolio = {
      action: 'create',
      businessName: 'Test master',
      domain: 'portfolio.example.com',
      tier: 'Standard',
      industry: 'Retail',
      billing: 'Annual',
      state: 'active',
      monthlyPrice: 12.34,
      annualPrice: 109.99,
      nextRenewal: '2027-04-17',
      contactEmail: 'private@example.com',
      content: {
        heroTitle: 'Content title',
        images: ['https://images.example.com/photo.webp'],
        unknown: 'not public',
      },
    };
    assert.equal(
      (
        await admin('/portfolio', 'POST', {
          ...portfolio,
          nextRenewal: '2027-02-29',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await admin('/portfolio', 'POST', {
          ...portfolio,
          content: { images: ['javascript:alert(1)'] },
        })
      ).status,
      400,
    );
    const addition = await admin('/portfolio', 'POST', portfolio);
    assert.equal(addition.status, 201, addition.contents);
    const id = addition.json.site.id;
    assert.equal((await admin('/portfolio', 'POST', portfolio)).status, 409);
    const detail = await env.db
      .prepare('SELECT annual_cents FROM portfolio_details WHERE site_id=?')
      .bind(id)
      .first();
    assert.equal(detail.annual_cents, 10999);
    assert.equal(
      (await call(env.mf, 'https://portfolio.example.com', '/admin/')).status,
      200,
    );
    assert.equal(
      (
        await root('/api/admin/portfolio', {
          method: 'POST',
          cookie: login.cookie,
          headers: { Origin: 'https://elsewhere.com' },
          body: portfolio,
        })
      ).status,
      403,
    );
    const read = await root('/api/content?site=portfolio.example.com', {
      headers: { Origin: 'https://portfolio.example.com' },
    });
    assert.equal(read.status, 200, read.contents);
    assert.equal(read.headers.get('access-control-allow-origin'), '*');
    assert.equal(read.json.content.heroTitle, 'Content title');
    assert.doesNotMatch(read.contents, /private@example|unknown|annualPrice/);
    const suspended = await admin('/portfolio', 'POST', {
      ...portfolio,
      id,
      action: 'update',
      state: 'suspended',
      annualPrice: 120.01,
    });
    assert.equal(suspended.status, 200, suspended.contents);
    assert.equal(
      (await root('/api/content?site=portfolio.example.com')).status,
      404,
    );
    const snapshot = (await admin('/portfolio')).json.clients.find(
      (site) => site.id === id,
    );
    assert.equal(snapshot.state, 'suspended');
    assert.ok(Number.isFinite(Date.parse(snapshot.suspendedAt)));
    assert.equal(snapshot.annualPrice, 120.01);
    assert.equal(
      (
        await admin('/portfolio', 'POST', {
          id,
          action: 'delete',
          domain: 'wrong.example.com',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await admin('/portfolio', 'POST', {
          id,
          action: 'delete',
          domain: portfolio.domain,
        })
      ).status,
      200,
    );
    assert.equal(
      (await call(env.mf, 'https://portfolio.example.com', '/admin/')).status,
      404,
    );
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
    assert.equal(tenant.status, 200);
    assert.match(
      tenant.contents,
      /<title>Contractul de brand · Admin Dashboard<\/title>/,
    );
    const publicBrand = JSON.parse(
      decodeURIComponent(
        tenant.contents.match(/data-portal-brand="([^"]+)"/)[1],
      ),
    );
    assert.deepEqual(publicBrand, {
      name: 'Contractul de brand',
      primary_color: '#123456',
      secondary_color: '#abcdef',
      accent_color: '#f6e6bc',
      scheme: 'dark',
      logo_url: site.logo_url,
    });
    assert.match(tenant.headers.get('cache-control'), /no-store/);
    assert.doesNotMatch(tools.contents, /data-portal-brand/);
    assert.equal(
      (await call(env.mf, `https://${brand}`, '/admin/api/portal/me')).status,
      401,
    );
    for (const path of [
      '/portal-admin/',
      '/admin/portal-admin/',
      '/admin/master/assets/master.js',
      '/admin/api/content',
      `/admin/portal-admin/assets/${asset}`,
    ]) {
      assert.equal((await call(env.mf, `https://${brand}`, path)).status, 404);
    }

    assert.equal(tenant.headers.get('x-frame-options'), 'DENY');
    const other = await admin('/sites', 'POST', { domain: fallback });
    assert.equal(other.status, 201, other.contents);
    assert.equal(other.json.site.brand_source, 'html');
    assert.equal(other.json.site.name, 'Brand din HTML');
    assert.equal(other.json.site.accent_color, '#ffaa88');
    assert.equal(other.json.site.primary_color, '#524079');
    assert.equal(other.json.site.secondary_color, '#334455');
    assert.ok(other.json.site.logo_url);
    const importPath = `/sites/${siteId}/content/import`;
    assert.equal(
      (await root(`/api/admin${importPath}`, { method: 'POST' })).status,
      401,
    );
    const before = (await admin(`/sites/${siteId}/content`)).json;
    const suggestion = await admin(importPath, 'POST');
    assert.equal(suggestion.status, 200, suggestion.contents);
    assert.equal(suggestion.json.source, 'manifest');
    assert.equal(suggestion.json.fields.siteName, 'Nume comercial');
    assert.equal(suggestion.json.fields.primaryColor, '#aabbcc');
    assert.equal(suggestion.json.fields.secondaryColor, '#abcdef');
    assert.equal(suggestion.json.fields.logoUrl, `https://${brand}/logo.png`);
    assert.deepEqual(suggestion.json.images, [`https://${brand}/photo.webp`]);
    assert.equal(suggestion.json.hours[0].time, '9–18');
    assert.equal(suggestion.json.services[0].price, '85 lei');
    assert.doesNotMatch(
      suggestion.contents,
      /private-config|127.0.0.1|javascript:/,
    );
    assert.deepEqual((await admin(`/sites/${siteId}/content`)).json, before);
    const tenantImportPath = '/admin/api/portal/content/import';
    const customer = (path, opts) =>
      call(env.mf, `https://${brand}`, path, opts);
    assert.equal(
      (await customer(tenantImportPath, { method: 'POST' })).status,
      401,
    );
    const staffOnTenant = await customer(tenantImportPath, {
      method: 'POST',
      cookie: login.cookie,
    });
    assert.notEqual(staffOnTenant.status, 200);
    const account = await admin(`/sites/${siteId}/users`, 'POST', {
      username: 'import.client',
      name: 'Client import',
    });
    const temp = account.json.temporary_password;
    const session = await customer('/admin/api/auth/login', {
      method: 'POST',
      body: { username: 'import.client', password: temp },
    });
    assert.equal(session.status, 200, session.contents);
    assert.equal(
      (
        await customer(tenantImportPath, {
          method: 'POST',
          cookie: session.cookie,
        })
      ).status,
      403,
    );
    const changed = await customer('/admin/api/auth/change-password', {
      method: 'POST',
      cookie: session.cookie,
      body: { current_password: temp, new_password: clientPassword },
    });
    assert.equal(changed.status, 200, changed.contents);
    const clientImport = await customer(tenantImportPath, {
      method: 'POST',
      cookie: changed.cookie,
    });
    assert.equal(clientImport.status, 200, clientImport.contents);
    assert.deepEqual(clientImport.json, suggestion.json);
    assert.equal(
      (
        await call(env.mf, `https://${fallback}`, tenantImportPath, {
          method: 'POST',
          cookie: changed.cookie,
        })
      ).status,
      401,
    );
    const fromHtml = await admin(
      `/sites/${other.json.site.id}/content/import`,
      'POST',
    );
    assert.equal(fromHtml.status, 200, fromHtml.contents);
    assert.equal(fromHtml.json.source, 'html');
    assert.equal(fromHtml.json.fields.heroTitle, 'Pagina de test');
    assert.equal(fromHtml.json.fields.heroSubtitle, 'Din HTML-ul public');
    assert.equal(fromHtml.json.fields.phone, '+40700123456');
    assert.equal(fromHtml.json.fields.primaryColor, '#524079');
    assert.deepEqual(fromHtml.json.images, [
      `https://${fallback}/assets/work.webp`,
    ]);
    const publishedImport = await admin(`/sites/${siteId}/content`, 'PUT', {
      revision: before.revision,
      content: {
        ...suggestion.json.fields,
        images: suggestion.json.images,
        services: suggestion.json.services,
        hours: suggestion.json.hours,
      },
    });
    assert.equal(publishedImport.status, 200, publishedImport.contents);
    assert.equal(
      (await root(`/api/content?site=${brand}`)).json.businessName,
      'Nume comercial',
    );
    assert.match(
      (await customer('/admin/')).contents,
      /Contractul de brand · Admin Dashboard/,
    );

    assert.equal(
      (
        await admin(`/sites/${siteId}/media/import`, 'POST', {
          url: 'https://127.0.0.1/logo.png',
        })
      ).status,
      400,
    );
    assert.equal(
      (await admin('/portfolio')).json.clients.find((c) => c.id === siteId)
        .liveVisitors,
      3,
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
    const rolledUp = (await admin('/portfolio')).json.clients.find(
      (c) => c.id === siteId,
    );
    assert.equal(rolledUp.liveVisitors, null);
    assert.equal(rolledUp.visitorsByDay[yesterday], 8);
    const offline = await admin(`/sites/${siteId}/stats?days=30`);
    assert.equal(offline.json.source, 'rollup');
    assert.equal(offline.json.totals.pageviews, 37);
    assert.equal(offline.json.topPages[0].path, '/preturi');
    const deleted = await admin(`/sites/${siteId}`, 'DELETE');
    assert.equal(deleted.status, 200, deleted.contents);
    assert.equal(routeList.length, 0);
  },
);
