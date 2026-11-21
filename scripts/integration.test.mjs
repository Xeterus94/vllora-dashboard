import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  bootstrapToken,
  call,
  clientPassword,
  masterPassword,
  png,
  webp,
  runtime,
} from './test-runtime.mjs';

const platform = 'http://localhost',
  first = 'http://siteclient.com',
  second = 'http://other-client.com';
const admin = '/api/admin';
const portal = '/admin/api/portal';
const settings = {
  profile: 'ecommerce',
  selected: [
    'visitors',
    'pageviews',
    'phone_click',
    'order_paid',
    'revenue',
    'menu_view',
  ],
  primary: 'revenue',
  ready: ['menu_view'],
  targets: { revenue: 15000, phone_click: 8, visitors: 90 },
  currency: 'RON',
};
const send = (body, options = {}) => ({ method: 'POST', body, ...options });
const pngForm = (content = png, type = 'image/png', filename = 'logo.png') => {
  const f = new FormData();
  f.append('file', new Blob([content], { type }), filename);
  return f;
};
const must = (r, status) => {
  assert.equal(r.status, status, r.contents);
  return r;
};

test(
  'portal integrat cu D1, R2 și un furnizor de email simulat',
  { timeout: 90000 },
  async (t) => {
    const env = await runtime();
    t.after(() => env.close());
    const { mf, db, received } = env;
    const p = (path, o) => call(mf, platform, path, o),
      a = (path, o) => call(mf, first, path, o),
      b = (path, o) => call(mf, second, path, o);
    let master, client, site, other, user, temp, key, logo;
    const adminCall = (path, o = {}) =>
      p(admin + path, { ...o, cookie: master });
    const change = (options = {}) =>
      send({ current_password: temp, new_password: clientPassword }, options);
    const clientLogin = (password = clientPassword) =>
      a('/admin/api/auth/login', send({ username: 'tenant.one', password }));
    const reset = (host, token, password) =>
      call(
        mf,
        host,
        '/admin/api/auth/reset-password',
        send({ token, new_password: password }),
      );
    const waitUntil = async (predicate) => {
      for (let i = 0; i < 60; i++) {
        if (await predicate()) return;
        await sleep(30);
      }
      throw new Error('Email async indisponibil');
    };

    await t.test(
      'bootstrap unic, cookie master, creare de site și alias unic',
      async () => {
        must(
          await p(
            '/api/bootstrap',
            send(
              {
                username: 'master',
                name: 'Master',
                email: 'master@example.com',
                password: masterPassword,
              },
              { headers: { 'x-bootstrap-token': bootstrapToken } },
            ),
          ),
          201,
        );
        must(
          await p(
            '/api/bootstrap',
            send(
              { username: 'another', name: 'Master', password: masterPassword },
              { headers: { 'x-bootstrap-token': bootstrapToken } },
            ),
          ),
          409,
        );
        const login = must(
          await p(
            '/api/auth/login',
            send({ username: 'master', password: masterPassword }),
          ),
          200,
        );
        master = login.cookie;
        assert.match(
          login.headers.get('set-cookie'),
          /Path=\/;.*HttpOnly.*SameSite=Lax/i,
        );
        must(await p(`${admin}/sites`), 401);
        site = must(
          await adminCall(
            '/sites',
            send({
              domain: 'siteclient.com',
              portal_host: 'admin.siteclient.com',
              name: 'Primul site',
              company: {
                companyName: 'Prima Firmă SRL',
                companyCui: 'RO01234567',
                companyRegistry: 'J23/12/2020',
                companyAddress: 'Strada Sediului 10',
              },
              metrics: settings,
            }),
          ),
          201,
        ).json.site;
        other = must(
          await adminCall(
            '/sites',
            send({
              domain: 'other-client.com',
              name: 'Al doilea site & <Nord> "RO"',
            }),
          ),
          201,
        ).json.site;
        must(
          await adminCall('/sites', send({ domain: 'admin.siteclient.com' })),
          409,
        );
        must(await adminCall('/sites', send({ domain: 'localhost' })), 400);
        must(await adminCall(`/sites/${site.id}/sync-route`, send()), 200);
        await db
          .prepare('UPDATE sites SET notes=? WHERE id=?')
          .bind('Private tenant note', site.id)
          .run();
        const shell = must(await a('/admin/'), 200);
        const branding = (html) =>
          JSON.parse(
            decodeURIComponent(html.match(/data-portal-brand="([^"]+)"/)[1]),
          );
        assert.match(
          shell.contents,
          /<title>Primul site · Admin Dashboard<\/title>/,
        );
        assert.equal(branding(shell.contents).name, 'Primul site');
        assert.ok(
          !shell.contents.includes(site.id) &&
            !shell.contents.includes(site.tracking_token),
        );
        assert.doesNotMatch(shell.contents, /Private tenant note/);
        const secondShell = must(await b('/admin/'), 200);
        assert.equal(
          branding(secondShell.contents).name,
          'Al doilea site & <Nord> "RO"',
        );
        assert.doesNotMatch(secondShell.contents, /<Nord>|Primul site/);
        assert.match(shell.headers.get('referrer-policy'), /no-referrer/);
        const asset = shell.contents.match(/src="\.\/assets\/([^"]+)/)?.[1];
        assert.ok(asset);
        must(await a(`/admin/assets/${asset}`), 200);
        must(await a('/admin'), 308);
        must(await a('/administrator'), 404);
        must(
          await call(mf, 'http://siteclient.com.other-client.com', '/admin/'),
          404,
        );
        must(await call(mf, 'http://admin.siteclient.com', '/admin/'), 200);
        must(await p('/admin/'), 404);
        must(
          await a(
            '/admin/api/auth/login',
            send({ username: 'master', password: masterPassword }),
          ),
          401,
        );
      },
    );

    await t.test(
      'acces temporar, izolare după hostname, CSRF și schimbare obligatorie',
      async () => {
        const account = must(
          await adminCall(
            `/sites/${site.id}/users`,
            send({
              username: 'tenant.one',
              name: 'Client',
              email: 'fixture@example.com',
            }),
          ),
          201,
        ).json;
        user = account.user;
        temp = account.temporary_password;
        assert.match(temp, /^[\da-zA-Z]{4}-[\da-zA-Z]{5}-[\da-zA-Z]{5}$/);
        const saved = await db
          .prepare('SELECT * FROM users WHERE id=?')
          .bind(user.id)
          .first();
        assert.notEqual(saved.password_hash, temp);
        const issued = must(await clientLogin(temp), 200);
        client = issued.cookie;
        assert.equal(issued.json.must_change_password, true);
        assert.match(
          issued.headers.get('set-cookie'),
          /Path=\/admin;.*HttpOnly.*SameSite=Lax/i,
        );
        const extra = must(await clientLogin(temp), 200).cookie;
        must(await a(`${portal}/stats`, { cookie: client }), 403);
        must(await b('/admin/api/auth/me', { cookie: client }), 401);
        must(await p('/api/auth/me', { cookie: client }), 401);
        must(
          await p(
            '/api/auth/login',
            send({ username: 'tenant.one', password: temp }),
          ),
          401,
        );
        must(
          await a(
            '/admin/api/auth/change-password',
            change({
              cookie: client,
              headers: { Origin: 'http://siteclient.com.other-client.com' },
            }),
          ),
          403,
        );
        must(
          await a(
            '/admin/api/auth/change-password',
            send(
              { current_password: temp, new_password: 'weak' },
              { cookie: client },
            ),
          ),
          400,
        );
        client = must(
          await a(
            '/admin/api/auth/change-password',
            change({ cookie: client, headers: { Origin: first } }),
          ),
          200,
        ).cookie;
        must(await a('/admin/api/auth/me', { cookie: extra }), 401);
        assert.equal(
          must(await a('/admin/api/auth/me', { cookie: client }), 200).json
            .must_change_password,
          false,
        );
        must(await a('/admin/api/admin/sites', { cookie: client }), 403);
        must(await a('/admin/api/admin/portfolio', { cookie: client }), 403);
        must(await p('/api/admin/portfolio', { cookie: client }), 401);
        must(await a(`${portal}/stats?days=21`, { cookie: client }), 400);
        const day = new Date().toISOString().slice(0, 10);
        await db
          .prepare('INSERT INTO daily_stats VALUES (?,?,?,?,?,?),(?,?,?,?,?,?)')
          .bind(site.id, day, 2, 9, 4, 1, other.id, day, 7, 83, 18, 5)
          .run();
        const stats = must(
          await a(`${portal}/stats?days=7&client_id=${other.id}`, {
            cookie: client,
          }),
          200,
        ).json;
        assert.equal(stats.source, 'rollup');
        assert.equal(stats.days.length, 7);
        assert.equal(stats.totals.pageviews, 9);
        must(
          await a(`${portal}/site`, {
            method: 'PATCH',
            body: { notes: 'Notițe de test', site_id: other.id },
            cookie: client,
          }),
          200,
        );
        assert.equal(
          must(await adminCall(`/sites/${site.id}`), 200).json.site.notes,
          'Notițe de test',
        );
        assert.equal(
          must(await adminCall(`/sites/${other.id}`), 200).json.site.notes,
          '',
        );
        const logged = await db
          .prepare('SELECT token_hash FROM sessions')
          .all();
        assert.ok(logged.results.every((r) => !client.includes(r.token_hash)));
      },
    );

    await t.test(
      'R2, semnături, cote, ETag, logo cu relație de tenant și migrare idempotentă',
      async () => {
        const webpForm = () => pngForm(webp, 'image/webp', 'logo.webp');
        const body = webpForm();
        logo = must(
          await a(`${portal}/media`, send(body, { cookie: client })),
          201,
        ).json.item;
        assert.equal(logo.content_type, 'image/webp');
        assert.match(logo.url, /\.webp$/);
        must(
          await a(
            `${portal}/media`,
            send(pngForm(png, 'image/webp', 'fake.webp'), { cookie: client }),
          ),
          415,
        );
        must(await adminCall(`/sites/${site.id}/media`, send(pngForm())), 415);
        assert.equal(logo.width, 1);
        must(
          await a(
            `${portal}/media`,
            send(pngForm('not an image'), { cookie: client }),
          ),
          415,
        );
        must(
          await a(
            `${portal}/media`,
            send(pngForm(Buffer.alloc(8 * 1024 * 1024 + 1)), {
              cookie: client,
            }),
          ),
          413,
        );
        must(
          await a(
            `${portal}/media`,
            send(
              pngForm(
                '<svg xmlns="http://www.w3.org/2000/svg"><script>console.log(1)</script></svg>',
                'image/svg+xml',
                'script.svg',
              ),
              { cookie: client },
            ),
          ),
          415,
        );
        const media = must(await a(logo.url), 200);
        assert.match(media.headers.get('content-security-policy'), /sandbox/);
        assert.equal(media.headers.get('x-content-type-options'), 'nosniff');
        must(
          await a(logo.url, {
            headers: { 'If-None-Match': media.headers.get('etag') },
          }),
          304,
        );
        must(await b(logo.url), 404);
        must(
          await adminCall(`/sites/${other.id}`, {
            method: 'PATCH',
            body: { logo_media_id: logo.id },
          }),
          400,
        );
        must(
          await adminCall(`/sites/${site.id}`, {
            method: 'PATCH',
            body: { logo_media_id: logo.id, primary_color: '#1b2c3d' },
          }),
          200,
        );
        assert.equal(
          must(
            await adminCall(`/sites/${site.id}/refresh-branding`, send()),
            200,
          ).json.skipped,
          true,
        );
        assert.equal(
          must(await a(`${portal}/me`, { cookie: client }), 200).json.site
            .logo_url,
          logo.url,
        );
        must(
          await adminCall(`/sites/${other.id}/media/${logo.id}`, {
            method: 'DELETE',
          }),
          404,
        );
        const key = logo.url.split('/media/')[1];
        await db
          .prepare('UPDATE media SET size=? WHERE object_key=?')
          .bind(200 * 1024 * 1024, key)
          .run();
        must(
          await a(`${portal}/media`, send(webpForm(), { cookie: client })),
          413,
        );
        await db
          .prepare('UPDATE media SET size=? WHERE object_key=?')
          .bind(webp.length, key)
          .run();
        await db
          .prepare('UPDATE sites SET logo_data=? WHERE id=?')
          .bind(`data:image/png;base64,${png.toString('base64')}`, other.id)
          .run();
        assert.equal(
          must(await adminCall('/maintenance/migrate-logos', send()), 200).json
            .migrated,
          1,
        );
        assert.equal(
          must(await adminCall('/maintenance/migrate-logos', send()), 200).json
            .migrated,
          0,
        );
        must(
          await p(
            must(await adminCall(`/sites/${other.id}`), 200).json.site.logo_url,
          ),
          200,
        );
      },
    );

    await t.test(
      'editor CMS: publicare, fișiere PDF, conflicte și izolare pe tenant',
      async () => {
        const path = `${portal}/content`;
        must(await a(path), 401);
        must(await b(path, { cookie: client }), 401);
        const load = must(await a(path, { cookie: client }), 200).json;
        assert.equal(load.content.companyCui, 'RO01234567');
        const initialCompany = must(await adminCall(`/sites/${site.id}`), 200)
          .json.company;
        assert.equal(initialCompany.companyName, 'Prima Firmă SRL');
        assert.equal(initialCompany.companyRegistry, 'J23/12/2020');
        assert.equal(
          must(await adminCall(`/sites/${other.id}`), 200).json.company
            .companyName,
          '',
        );
        must(
          await adminCall(`/sites/${site.id}`, {
            method: 'PATCH',
            body: { company: { companyCui: '1'.repeat(25) } },
          }),
          400,
        );

        const doc = must(
          await a(
            `${portal}/media`,
            send(pngForm('%PDF-1.7\n%%EOF', 'application/pdf', 'preturi.pdf'), {
              cookie: client,
            }),
          ),
          201,
        ).json.item;
        assert.equal(doc.content_type, 'application/pdf');
        const download = must(await a(doc.url), 200);
        assert.match(
          download.headers.get('content-disposition'),
          /^attachment;/,
        );
        must(await b(doc.url), 404);
        must(
          await a(
            `${portal}/media`,
            send(
              pngForm('<html>not a PDF</html>', 'application/pdf', 'fals.pdf'),
              { cookie: client },
            ),
          ),
          415,
        );
        must(
          await adminCall(`/sites/${site.id}`, {
            method: 'PATCH',
            body: { logo_media_id: doc.id },
          }),
          400,
        );
        const otherLogo = must(await adminCall(`/sites/${other.id}`), 200).json
          .site.logo_media_id;
        const publish = (content, revision = load.revision) =>
          a(path, {
            cookie: client,
            method: 'PUT',
            body: { content, revision },
          });
        must(await publish({ heroMedia: { id: otherLogo } }), 400);
        must(await publish({ gallery: [doc] }), 400);
        must(await publish({ bookingUrl: 'javascript:void(0)' }), 400);
        const edited = {
          ...load.content,
          heroTitle: 'Frizeria de test',
          companyAddress: 'Sediul nou 3',
          heroMedia: {
            id: logo.id,
            url: 'https://other-client.com/forged.jpg',
          },
          gallery: [logo],
          heroImageUrl: 'https://siteclient.com/assets/original.webp',
          documents: [doc],
          services: [{ name: 'Tuns', price: '80 lei' }],
          hours: [{ day: 'Luni', time: '10:00—18:00' }],
        };
        const config = must(await publish(edited), 200).json;
        assert.equal(config.content.heroMedia.url, logo.url);
        assert.equal(config.content.heroImageUrl, edited.heroImageUrl);
        assert.notEqual(config.revision, load.revision);
        must(await publish({ heroTitle: 'Date vechi' }), 409);
        const published = (await p('/api/content?site=siteclient.com')).json;
        assert.equal(published.content.heroTitle, edited.heroTitle);
        assert.equal(published.content.companyCui, 'RO01234567');
        assert.equal(published.content.companyAddress, 'Sediul nou 3');
        assert.equal(
          published.content.heroImageUrl,
          published.content.heroMedia.url,
        );
        assert.match(published.content.heroImageUrl, /\.webp$/);
        assert.equal(published.content.services[0].price, '80 lei');
        assert.equal(published.content.hours[0].day, 'Luni');
        assert.match(
          published.content.images[0],
          /^http:\/\/localhost\/media\/sites\//,
        );
        assert.equal(published.content.documents[0].name, 'preturi.pdf');
        assert.equal(
          published.content.documents[0].url,
          `${platform}${doc.url.replace(/^\/admin/, '')}`,
        );
        assert.doesNotMatch(
          JSON.stringify(published),
          /forged|tracking_token|contact_email|Private tenant note/,
        );
        must(await p('/api/content?site=other-client.com'), 404);
        const staffPath = `/sites/${site.id}/content`;
        const staffLoad = must(await adminCall(staffPath), 200).json;
        const staffPublish = (content, revision = staffLoad.revision) =>
          adminCall(staffPath, {
            method: 'PUT',
            body: { revision, content },
          });
        assert.equal(staffLoad.revision, config.revision);
        must(await p(`/api/admin${staffPath}`), 401);
        must(await a(`/admin/api/admin${staffPath}`, { cookie: client }), 403);
        must(await staffPublish({ heroMedia: otherLogo }), 400);
        must(
          await staffPublish({ heroTitle: 'Ediție învechită' }, load.revision),
          409,
        );
        const savedByStaff = must(
          await staffPublish({
            ...staffLoad.content,
            heroTitle: 'Editat din master',
          }),
          200,
        ).json;
        assert.equal(
          savedByStaff.content.heroMedia.url,
          logo.url.replace(/^\/admin/, ''),
        );
        must(
          await publish(
            { heroTitle: 'Conflict master/client' },
            config.revision,
          ),
          409,
        );
        must(
          await adminCall(
            '/portfolio',
            send({
              action: 'update',
              id: site.id,
              businessName: site.name,
              domain: site.domain,
              tier: site.plan,
              state: 'active',
              industry: 'Servicii',
              billing: 'Monthly',
              monthlyPrice: 99,
              annualPrice: 1000,
            }),
          ),
          200,
        );
        const shared = must(await a(path, { cookie: client }), 200).json;
        assert.equal(shared.content.heroTitle, 'Editat din master');
        assert.equal(shared.revision, savedByStaff.revision);
        assert.equal(shared.content.services[0].name, 'Tuns');
        assert.equal(shared.content.companyAddress, 'Sediul nou 3');
        must(
          await adminCall(`/sites/${site.id}`, {
            method: 'PATCH',
            body: { company: { companyRegistry: '' } },
          }),
          200,
        );
        must(await publish(shared.content, shared.revision), 409);
        const revised = must(await a(path, { cookie: client }), 200).json;
        assert.equal(revised.content.companyRegistry, '');
        assert.equal(revised.content.heroTitle, shared.content.heroTitle);
        assert.equal(revised.content.companyCui, shared.content.companyCui);
        assert.equal(shared.content.documents[0].name, 'preturi.pdf');
        must(
          await publish(
            { ...revised.content, heroTitle: 'Editat din nou' },
            revised.revision,
          ),
          200,
        );
        assert.equal(
          (
            await db
              .prepare(
                'SELECT monthly_cents FROM portfolio_details WHERE site_id=?',
              )
              .bind(site.id)
              .first()
          ).monthly_cents,
          9900,
        );
        must(
          await a(`${portal}/media/${doc.id}`, {
            method: 'DELETE',
            cookie: client,
          }),
          200,
        );
        assert.deepEqual(
          must(await p('/api/content?site=siteclient.com'), 200).json.content
            .documents,
          [],
        );
        assert.equal(
          (
            await db
              .prepare(
                "SELECT COUNT(*) AS n FROM audit_log WHERE action='site_content_published'",
              )
              .first()
          ).n,
          3,
        );
      },
    );

    await t.test(
      'evenimente browser și server, deduplicare concurentă, bani exacți, izolare și rotație',
      async () => {
        const events = '/api/collect-event',
          token = site.tracking_token;
        const signup = must(
          await adminCall(`/sites/${site.id}/metrics-key`, send()),
          200,
        );
        key = signup.json.key;
        const order = {
          site: token,
          event: 'order_paid',
          event_id: 'order-paid-001',
          amount_cents: 12550,
          currency: 'RON',
        };
        const auth = { headers: { Authorization: `Bearer ${key}` } };
        must(await p(events, send(order)), 401);
        must(
          await p(events, send({ ...order, amount_cents: 10.45 }, auth)),
          400,
        );
        must(
          await p(events, send({ ...order, site: other.tracking_token }, auth)),
          401,
        );
        must(
          await p(
            events,
            send(
              { site: token, event: 'phone_click' },
              { headers: { Origin: 'http://siteclient.com.other-client.com' } },
            ),
          ),
          403,
        );
        const beacon = must(
          await p(
            events,
            send(
              { site: token, event: 'phone_click' },
              { headers: { Origin: first } },
            ),
          ),
          201,
        );
        assert.equal(beacon.headers.get('access-control-allow-origin'), '*');
        assert.equal(
          must(
            await p(events, send({ site: token, event: 'service_view' })),
            200,
          ).json.accepted,
          false,
        );
        must(
          await p(
            '/api/collect',
            send(
              { site: token, path: '/preturi?email=ignored', newSession: true },
              { headers: { Origin: first } },
            ),
          ),
          204,
        );
        assert.match(
          must(await p('/track.js'), 200).contents,
          /window.Vllora=\{track\}/,
        );
        const result = await Promise.all([
          p(events, send(order, auth)),
          p(events, send(order, auth)),
        ]);
        assert.deepEqual(result.map((r) => r.status).sort(), [200, 201]);
        assert.equal(
          must(
            await p(events, send({ ...order, amount_cents: 99999 }, auth)),
            200,
          ).json.duplicate,
          true,
        );
        const report = must(
          await a(`${portal}/metrics?days=30&site_id=${other.id}`, {
            cookie: client,
          }),
          200,
        ).json;
        assert.equal(report.values[0].id, 'revenue');
        assert.equal(report.values[0].value, 12550);
        assert.equal(report.values[0].monthly, 12550);
        assert.equal(report.trafficMonthly.visitors, 2);
        assert.equal(
          report.values.find((r) => r.id === 'menu_view').state,
          'ready',
        );
        assert.equal(report.values.find((r) => r.id === 'order_paid').value, 1);
        assert.ok(!JSON.stringify(report).includes(key));
        assert.deepEqual(
          must(await adminCall(`/sites/${other.id}/metrics?days=365`), 200).json
            .values,
          [],
        );
        must(
          await adminCall(`/sites/${site.id}`, {
            method: 'PATCH',
            body: {
              name: 'Not applied',
              metrics: { ...settings, currency: 'EUR' },
            },
          }),
          409,
        );
        assert.equal(
          must(await adminCall(`/sites/${site.id}`), 200).json.site.name,
          'Primul site',
        );
        const newKey = must(
          await adminCall(`/sites/${site.id}/metrics-key`, send()),
          200,
        ).json.key;
        must(
          await p(events, send({ ...order, event_id: 'order-paid-002' }, auth)),
          401,
        );
        must(
          await p(
            events,
            send(
              { ...order, event_id: 'order-paid-002' },
              { headers: { Authorization: `Bearer ${newKey}` } },
            ),
          ),
          201,
        );
        assert.ok(
          !(
            await db
              .prepare(
                'SELECT server_key_hash FROM site_metric_settings WHERE site_id=?',
              )
              .bind(site.id)
              .first()
          ).server_key_hash.includes(newKey),
        );
      },
    );

    await t.test(
      'recuperare client și master, link de unică folosință, expirare, concurență, eșec de provider',
      async () => {
        const generic = must(
          await a(
            '/admin/api/auth/forgot-password',
            send({ identifier: 'missing@example.com' }),
          ),
          202,
        );
        assert.deepEqual(
          must(
            await b(
              '/admin/api/auth/forgot-password',
              send({ identifier: 'fixture@example.com' }),
            ),
            202,
          ).json,
          generic.json,
        );
        assert.deepEqual(
          must(
            await a(
              '/admin/api/auth/forgot-password',
              send({ identifier: 'fixture@example.com' }),
            ),
            202,
          ).json,
          generic.json,
        );
        await waitUntil(() => received.length >= 1);
        assert.deepEqual(received[0].to, ['fixture@example.com']);
        assert.match(
          received[0].text,
          /https:\/\/siteclient\.com\/admin\/#reset=[\da-f]{64}/,
        );
        const token = received[0].text.match(/#reset=([\da-f]{64})/)[1];
        must(await reset(second, token, 'NewClient1!'), 400);
        must(await a('/admin/api/auth/me', { cookie: client }), 200);
        const results = await Promise.all([
          reset(first, token, 'NewClient1!'),
          reset(first, token, 'NewClient1!'),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
        must(await a('/admin/api/auth/me', { cookie: client }), 401);
        client = must(await clientLogin('NewClient1!'), 200).cookie;
        await a(
          '/admin/api/auth/forgot-password',
          send({ identifier: 'tenant.one' }),
        );
        await waitUntil(() => received.length >= 2);
        await db
          .prepare('UPDATE password_resets SET expires_at=? WHERE user_id=?')
          .bind(Date.now() - 1, user.id)
          .run();
        must(
          await reset(
            first,
            received[1].text.match(/#reset=([\da-f]{64})/)[1],
            'NewClient2!',
          ),
          400,
        );
        env.rejectEmail(true);
        must(
          await a(
            '/admin/api/auth/forgot-password',
            send({ identifier: 'tenant.one' }),
          ),
          202,
        );
        await waitUntil(() => received.length >= 3);
        await waitUntil(
          async () =>
            !(await db
              .prepare(
                'SELECT 1 FROM password_resets WHERE user_id=? AND expires_at>?',
              )
              .bind(user.id, Date.now())
              .first()),
        );
        must(
          await reset(
            first,
            received[2].text.match(/#reset=([\da-f]{64})/)[1],
            'NewClient2!',
          ),
          400,
        );
        await a(
          '/admin/api/auth/forgot-password',
          send({ identifier: 'tenant.one' }),
        );
        assert.equal(received.length, 3);
        env.rejectEmail(false);
        must(
          await p('/api/auth/recovery-email', {
            method: 'PATCH',
            cookie: master,
            body: {
              current_password: masterPassword,
              email: 'new@example.com',
            },
          }),
          200,
        );
        must(
          await p(
            '/api/auth/forgot-password',
            send({ identifier: 'new@example.com' }),
          ),
          202,
        );
        await waitUntil(() => received.length >= 4);
        assert.match(
          received[3].text,
          /http:\/\/localhost\/portal-admin\/#reset=[\da-f]{64}/,
        );
        const resetMaster = received[3].text.match(/#reset=([\da-f]{64})/)[1];
        must(
          await p(
            '/api/auth/reset-password',
            send({ token: resetMaster, new_password: 'NewMaster1!' }),
          ),
          200,
        );
        must(await adminCall('/sites'), 401);
        master = must(
          await p(
            '/api/auth/login',
            send({ username: 'master', password: 'NewMaster1!' }),
          ),
          200,
        ).cookie;
      },
    );

    await t.test(
      'reset master & suspendare, rate limit, audit și ștergere R2',
      async () => {
        temp = must(
          await adminCall(`/users/${user.id}/reset-password`, send()),
          200,
        ).json.temporary_password;
        must(await a('/admin/api/auth/me', { cookie: client }), 401);
        assert.equal(
          must(await clientLogin(temp), 200).json.must_change_password,
          true,
        );
        const responses = [];
        for (let i = 0; i < 6; i++)
          responses.push((await clientLogin('invalid')).status);
        assert.deepEqual(responses, [401, 401, 401, 401, 401, 429]);
        must(
          await adminCall(`/sites/${site.id}`, {
            method: 'PATCH',
            body: { status: 'suspended' },
          }),
          200,
        );
        must(await a(`${portal}/me`, { cookie: client }), 401);
        must(
          await p(
            '/api/collect',
            send({ site: site.tracking_token, path: '/' }),
          ),
          403,
        );
        const removed = must(await a(logo.url), 200);
        assert.ok(removed.contents);
        must(await adminCall(`/sites/${site.id}`, { method: 'DELETE' }), 200);
        must(await p(logo.url.replace('/admin', '')), 404);
        must(await a('/admin/'), 404);
        assert.ok(
          must(await adminCall('/audit'), 200).json.entries.some(
            (x) => x.action === 'site_deleted',
          ),
        );
        assert.equal(
          (
            await db
              .prepare(
                'SELECT COUNT(*) AS n FROM metric_events WHERE site_id=?',
              )
              .bind(site.id)
              .first()
          ).n,
          0,
        );
        must(await adminCall(`/sites/${other.id}`, { method: 'DELETE' }), 200);
      },
    );
  },
);
