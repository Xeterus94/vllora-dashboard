import { Hono } from 'hono';
import { DAY, day, range, trafficStats, utc } from './analytics';
import { email, requireRole, temporary, username } from './auth';
import { applyBrand, color, importImage } from './branding';
import {
  all,
  audit,
  fail,
  findSite,
  json,
  platformHost,
  random,
  required,
  siteSelect,
  siteView,
  stmt,
  text,
  userView,
  validHost,
  type Bindings,
  type Ctx,
  type Site,
  type User,
} from './core';
import { listMedia, removeImage, saveImage, upload } from './media';
import {
  businessReport,
  configView,
  rotateKey,
  settingsInsert,
  settingsUpsert,
  validateMetrics,
} from './metrics';
import { hashPassword } from './password';
import {
  allPermissions,
  readPermissions,
  storedPermissions,
} from '../shared/permissions';
import {
  portfolioDetails,
  portfolioList,
  putPortfolio,
  type PortfolioDetails,
} from './portfolio';
import { certificateReport, removeRoute, syncRoute } from './routes';
import {
  defaultSiteType,
  isSiteType,
  profileForType,
  type SiteType,
} from '../shared/portal-brand';
import { profileSettings } from '../shared/metrics';
import {
  companyPatch,
  editorContent,
  publishContent,
  putCompany,
  readCompany,
} from './site-content';
import { inspectSite } from './site-import';

export const admin = new Hono<Bindings>();
admin.use('*', async (c, next) => {
  await requireRole(c, 'super_admin');
  await next();
});
const siteId = (c: Ctx) => c.req.param('id') || '';
const target = async (c: Ctx) => required(await findSite(c.env, siteId(c)));
const editable = async (c: Ctx) => {
  const site = await target(c);
  return site.status === 'deleting'
    ? fail(409, 'Site-ul este în curs de ștergere.')
    : site;
};
const actor = (c: Ctx) => c.get('user').id;
const uniqueness = (err: unknown) =>
  String(err).includes('UNIQUE constraint failed');
function domain(c: Ctx, input: unknown) {
  const host = validHost(input);
  if (!host || platformHost(c.env, host))
    return fail(400, 'Introdu un hostname valid, fără protocol sau cale.');
  return host;
}
async function brandUpdate(
  c: Ctx,
  site: Site,
  force: boolean,
  expected: string,
  keepName = false,
) {
  const { brand, logo, skipped } = await applyBrand(c.env, site, force);
  if (!brand) return { skipped, detected: false };
  await c.env.DB.batch([
    stmt(
      c.env,
      `UPDATE sites SET name=COALESCE(?,name),primary_color=COALESCE(?,primary_color),secondary_color=COALESCE(?,secondary_color),accent_color=COALESCE(?,accent_color),scheme=COALESCE(?,scheme),logo_media_id=COALESCE((SELECT id FROM media WHERE id=? AND site_id=sites.id AND ready=1),logo_media_id),brand_source=?
    WHERE id=? AND status!='deleting' AND (? OR brand_source=?)`,
      keepName ? null : (brand.name ?? null),
      brand.primary ?? null,
      brand.secondary ?? null,
      brand.accent ?? null,
      brand.scheme ?? null,
      logo?.id ?? null,
      brand.source,
      site.id,
      Number(force),
      expected,
    ),
    audit(c.env, 'branding_refreshed', actor(c), site.id),
  ]);
  return { skipped: false, detected: true };
}
admin.get('/overview', async (c) => {
  const row = await stmt(
    c.env,
    `SELECT (SELECT COUNT(*) FROM sites WHERE status!='deleting') AS sites,(SELECT COUNT(*) FROM sites WHERE status='active') AS active,
    (SELECT COUNT(*) FROM users WHERE role='client_admin') AS clients,(SELECT COALESCE(SUM(pageviews),0) FROM daily_stats WHERE day>=?) AS pageviews`,
    day(utc() - 29 * DAY),
  ).first();
  return c.json(row);
});
admin.get('/sites', async (c) =>
  c.json({
    sites: (
      await all<Site>(c.env, `${siteSelect} ORDER BY s.created_at DESC`)
    ).map((s) => siteView(c.env, s, true)),
  }),
);
async function createSite(
  c: Ctx,
  body: Record<string, unknown>,
  portfolio?: PortfolioDetails,
) {
  const host = domain(c, body.domain),
    portal =
      body.portal_host === undefined ||
      body.portal_host === null ||
      body.portal_host === ''
        ? null
        : domain(c, body.portal_host);
  const name =
    body.name === undefined || body.name === ''
      ? host
      : text(body.name, 100, 'Nume');
  // The type decides which sections the portal shows, so it is stored on the
  // site itself and never inferred again from the public page.
  const type = body.site_type ?? defaultSiteType;
  if (!isSiteType(type)) return fail(400, 'Tip de site invalid.');
  const id = `site_${random(12)}`,
    config = validateMetrics(
      body.metrics === undefined
        ? profileSettings(profileForType[type])
        : body.metrics,
    );
  const plan =
    body.plan === undefined ? 'Standard' : text(body.plan, 60, 'Plan');
  const changes = brandFields(body),
    manual = Object.keys(changes).length > 0;
  const company = companyPatch(body.company);
  if (changes.logo_media_id || changes.favicon_media_id)
    return fail(400, 'Încarcă imaginile după crearea site-ului.');
  const status = body.status ?? 'active';
  if (status !== 'active' && status !== 'suspended')
    return fail(400, 'Stare de site invalidă.');
  try {
    await c.env.DB.batch([
      stmt(
        c.env,
        'INSERT INTO sites(id,domain,portal_host,name,plan,status,tracking_token,created_at,suspended_at,brand_source,primary_color,secondary_color,accent_color,scheme,site_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        id,
        host,
        portal,
        name,
        plan,
        status,
        random(24),
        Date.now(),
        status === 'suspended' ? Date.now() : null,
        manual ? 'manual' : 'default',
        changes.primary_color ?? '#6b1c2e',
        changes.secondary_color ?? '#d6b46c',
        changes.accent_color ?? '#f6e6bc',
        changes.scheme ?? 'light',
        type,
      ),
      ...[...new Set([host, ...(portal ? [portal] : [])])].map((h) =>
        stmt(c.env, 'INSERT INTO site_hosts(host,site_id) VALUES(?,?)', h, id),
      ),
      ...(config ? [settingsInsert(c.env, id, config)] : []),
      ...(portfolio ? [putPortfolio(c.env, id, portfolio)] : []),
      ...(Object.values(company).some(Boolean)
        ? [putCompany(c.env, id, company)]
        : []),
      audit(c.env, 'site_created', actor(c), id),
    ]);
  } catch (err) {
    if (uniqueness(err)) return fail(409, 'Hostname-ul este deja atribuit.');
    throw err;
  }
  const site = required(await findSite(c.env, id));
  await Promise.all([
    brandUpdate(
      c,
      site,
      false,
      'default',
      body.name !== undefined && body.name !== '',
    ),
    syncRoute(c.env, site, actor(c)),
  ]);
  return c.json(
    { site: siteView(c.env, required(await findSite(c.env, id)), true) },
    201,
  );
}
admin.post('/sites', async (c) => createSite(c, await json(c)));
admin.get('/sites/:id', async (c) => {
  const site = await target(c);
  const [users, metrics, company] = await Promise.all([
    all<User>(
      c.env,
      'SELECT * FROM users WHERE client_id=? ORDER BY created_at',
      site.id,
    ),
    configView(c.env, site.id),
    readCompany(c.env, site.id),
  ]);
  return c.json({
    site: siteView(c.env, site, true),
    users: users.map(userView),
    company,
    ...metrics,
  });
});
const brandFields = (body: Record<string, unknown>) => {
  const update: Record<string, string | null> = {};
  for (const field of ['primary_color', 'secondary_color', 'accent_color'])
    if (Object.hasOwn(body, field))
      update[field] = color(body[field]) ?? fail(400, 'Culoare invalidă.');
  if (Object.hasOwn(body, 'scheme')) {
    if (body.scheme !== 'light' && body.scheme !== 'dark')
      return fail(400, 'Temă invalidă.');
    update.scheme = body.scheme;
  }
  for (const k of ['logo_media_id', 'favicon_media_id'])
    if (Object.hasOwn(body, k))
      update[k] = body[k] === null ? null : text(body[k], 26, 'Imagine');
  return update;
};
async function updateSite(
  c: Ctx,
  site: Site,
  b: Record<string, unknown>,
  portfolio?: PortfolioDetails,
) {
  if (site.status === 'deleting')
    return fail(409, 'Site-ul este în curs de ștergere.');
  const update = brandFields(b),
    sets: string[] = [],
    values: (string | null | number)[] = [];
  const company = companyPatch(b.company);
  if (b.site_type !== undefined) {
    if (!isSiteType(b.site_type)) return fail(400, 'Tip de site invalid.');
    update.site_type = b.site_type;
  }
  // Changing the type without sending metrics moves the KPI profile with it,
  // unless the currency is already locked by a paid order.
  const config =
    b.metrics !== undefined
      ? validateMetrics(b.metrics)
      : update.site_type && update.site_type !== site.site_type
        ? validateMetrics(
            profileSettings(
              profileForType[update.site_type as SiteType],
              (await configView(c.env, site.id)).settings.currency,
            ),
          )
        : null;
  if (b.domain !== undefined && b.domain !== site.domain)
    return fail(
      400,
      'Domeniul principal nu se poate schimba. Folosește hostname-ul suplimentar sau creează un site nou.',
    );
  if (b.name !== undefined && b.name !== site.name)
    update.name = text(b.name, 100, 'Nume');
  if (Object.keys(update).length) update.brand_source = 'manual';
  if (b.plan !== undefined) update.plan = text(b.plan, 60, 'Plan');
  if (b.status !== undefined) {
    if (b.status !== 'active' && b.status !== 'suspended')
      return fail(400, 'Stare invalidă.');
    update.status = b.status;
  }
  if (b.portal_host !== undefined)
    update.portal_host =
      b.portal_host === null || b.portal_host === ''
        ? null
        : domain(c, b.portal_host);
  for (const field of ['logo_media_id', 'favicon_media_id']) {
    const id = update[field];
    if (
      id &&
      !(await stmt(
        c.env,
        "SELECT id FROM media WHERE id=? AND site_id=? AND ready=1 AND content_type LIKE 'image/%'",
        id,
        site.id,
      ).first())
    )
      return fail(400, 'Selectează o imagine din biblioteca acestui site.');
  }
  for (const [key, value] of Object.entries(update)) {
    sets.push(`${key}=?`);
    values.push(value);
  }
  if (update.status === 'suspended') {
    sets.push(
      "suspended_at=CASE WHEN status='suspended' THEN COALESCE(suspended_at, ?) ELSE ? END",
    );
    values.push(Date.now(), Date.now());
  }
  if (update.status === 'active') sets.push('suspended_at=NULL');
  const updated = sets.length
    ? stmt(
        c.env,
        `UPDATE sites SET ${sets.join(',')} WHERE id=? AND status!='deleting'`,
        ...values,
        site.id,
      )
    : stmt(
        c.env,
        "UPDATE sites SET id=id WHERE id=? AND status!='deleting'",
        site.id,
      );
  const updateHosts = Object.hasOwn(update, 'portal_host');
  const revoke = update.status === 'suspended' || updateHosts;
  try {
    const [result] = await c.env.DB.batch([
      updated,
      ...(updateHosts
        ? [
            stmt(
              c.env,
              'DELETE FROM site_hosts WHERE site_id=? AND host<>?',
              site.id,
              site.domain,
            ),
            ...(update.portal_host && update.portal_host !== site.domain
              ? [
                  stmt(
                    c.env,
                    "INSERT INTO site_hosts(host,site_id) SELECT portal_host,id FROM sites WHERE id=? AND portal_host=? AND status!='deleting'",
                    site.id,
                    update.portal_host,
                  ),
                ]
              : []),
          ]
        : []),
      ...(revoke
        ? [
            stmt(
              c.env,
              'DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE client_id=?)',
              site.id,
            ),
            stmt(
              c.env,
              'DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE client_id=?)',
              site.id,
            ),
          ]
        : []),
      ...(config ? [settingsUpsert(c.env, site.id, config)] : []),
      ...(portfolio ? [putPortfolio(c.env, site.id, portfolio)] : []),
      ...(Object.keys(company).length
        ? [putCompany(c.env, site.id, company)]
        : []),
      audit(
        c.env,
        update.status === 'suspended' ? 'site_suspended' : 'site_updated',
        actor(c),
        site.id,
      ),
    ]);
    if (!result.meta.changes)
      return fail(409, 'Site-ul sau imaginea a fost modificată.');
  } catch (err) {
    if (String(err).includes('metric_currency_locked'))
      return fail(409, 'Moneda nu se poate schimba după prima comandă.');
    if (String(err).includes('site_brand_media_mismatch'))
      return fail(400, 'Imaginea nu aparține site-ului.');
    if (uniqueness(err)) return fail(409, 'Hostname-ul este deja atribuit.');
    throw err;
  }
  return c.json({
    site: siteView(c.env, required(await findSite(c.env, site.id)), true),
    ...(await configView(c.env, site.id)),
  });
}
admin.patch('/sites/:id', async (c) =>
  updateSite(c, await editable(c), await json(c)),
);
admin.post('/sites/:id/refresh-branding', async (c) => {
  const site = await editable(c),
    force = c.req.query('force') === '1';
  const result = await brandUpdate(
    c,
    site,
    force,
    site.brand_source,
    !force && site.name !== site.domain,
  );
  return c.json({
    ...result,
    site: siteView(c.env, required(await findSite(c.env, site.id)), true),
  });
});
admin.post('/sites/:id/sync-route', async (c) =>
  c.json({ status: await syncRoute(c.env, await editable(c), actor(c)) }),
);
// Read-only: Cloudflare renews managed certificates on its own.
admin.get('/sites/:id/certificate', async (c) => {
  const site = await target(c);
  return c.json(
    await certificateReport(c.env, site.portal_host || site.domain),
  );
});
async function deleteSite(c: Ctx, site: Site) {
  const [marked] = await c.env.DB.batch([
    stmt(
      c.env,
      "UPDATE sites SET status='deleting' WHERE id=? AND NOT EXISTS(SELECT 1 FROM media WHERE site_id=? AND ready=0 AND created_at>?)",
      site.id,
      site.id,
      Date.now() - 15 * 60 * 1000,
    ),
    stmt(
      c.env,
      "DELETE FROM sessions WHERE user_id IN (SELECT u.id FROM users u JOIN sites s ON s.id=u.client_id WHERE s.id=? AND s.status='deleting')",
      site.id,
    ),
  ]);
  if (!marked.meta.changes)
    return fail(
      409,
      'Așteaptă finalizarea încărcărilor media și încearcă din nou.',
    );
  try {
    await removeRoute(c.env, required(await findSite(c.env, site.id)));
    let cursor: string | undefined;
    do {
      const page: R2Objects = await c.env.MEDIA.list({
        prefix: `sites/${site.id}/`,
        cursor,
        limit: 500,
      });
      if (page.objects.length)
        await c.env.MEDIA.delete(page.objects.map((v) => v.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  } catch {
    return fail(
      502,
      'Curățarea a eșuat. Site-ul rămâne inaccesibil; reîncearcă ștergerea.',
    );
  }
  await c.env.DB.batch([
    stmt(c.env, 'DELETE FROM sites WHERE id=?', site.id),
    audit(c.env, 'site_deleted', actor(c), site.id),
  ]);
  return c.json({ ok: true });
}
admin.delete('/sites/:id', async (c) => deleteSite(c, await target(c)));
admin.get('/portfolio', portfolioList);
admin.post('/portfolio', async (c) => {
  const b = await json(c, 65536);
  if (b.action !== 'create' && b.action !== 'update' && b.action !== 'delete')
    return fail(400, 'Operațiune portofoliu invalidă.');
  const site =
    b.action === 'create'
      ? null
      : required(await findSite(c.env, text(b.id, 32, 'ID site')));
  if (b.action === 'delete') {
    if (!site || b.domain !== site.domain)
      return fail(400, 'Confirmă domeniul site-ului înainte de ștergere.');
    return deleteSite(c, site);
  }
  const detail = portfolioDetails(b);
  const update = {
    name: text(b.businessName, 100, 'Nume'),
    domain: domain(c, b.domain),
    plan: text(b.tier, 60, 'Plan'),
    status: b.state,
    company: b.company,
  };
  if (b.state !== 'active' && b.state !== 'suspended')
    return fail(400, 'Stare site invalidă.');
  return site
    ? updateSite(c, site, update, detail)
    : createSite(c, update, detail);
});
admin.get('/sites/:id/stats', async (c) =>
  c.json(await trafficStats(c.env, (await target(c)).id, range(c))),
);
admin.get('/sites/:id/metrics', async (c) =>
  c.json(await businessReport(c.env, (await target(c)).id, range(c))),
);
admin.post('/sites/:id/metrics-key', async (c) =>
  rotateKey(c, (await editable(c)).id),
);
admin.post('/sites/:id/users', async (c) => {
  const site = await editable(c),
    b = await json(c, 4096),
    pass = temporary(),
    id = `u_${random(12)}`,
    login = username(b.username);
  try {
    await c.env.DB.batch([
      stmt(
        c.env,
        `INSERT INTO users(id,username,name,email,role,client_id,password_hash,created_at,permissions) VALUES(?,?,?,?,'client_admin',?,?,?,?)`,
        id,
        login,
        text(b.name ?? login, 100, 'Nume'),
        b.email === undefined ? null : email(b.email),
        site.id,
        await hashPassword(c.env, pass),
        Date.now(),
        JSON.stringify(readPermissions(b.permissions, allPermissions)),
      ),
      audit(c.env, 'client_created', actor(c), site.id),
    ]);
  } catch (err) {
    if (uniqueness(err))
      return fail(409, 'Numele de utilizator este deja folosit.');
    throw err;
  }
  return c.json(
    {
      user: userView(
        required(
          await stmt(c.env, 'SELECT * FROM users WHERE id=?', id).first<User>(),
        ),
      ),
      temporary_password: pass,
    },
    201,
  );
});
const client = async (c: Ctx) =>
  required(
    await stmt(
      c.env,
      "SELECT * FROM users WHERE id=? AND role='client_admin'",
      siteId(c),
    ).first<User>(),
  );
admin.patch('/users/:id', async (c) => {
  const u = await client(c),
    b = await json(c, 4096),
    e = b.email === undefined ? u.email : email(b.email),
    name = b.name === undefined ? u.name : text(b.name, 100, 'Nume'),
    grants =
      b.permissions === undefined
        ? null
        : JSON.stringify(
            readPermissions(b.permissions, storedPermissions(u.permissions)),
          );
  await c.env.DB.batch([
    stmt(c.env, 'UPDATE users SET email=?,name=? WHERE id=?', e, name, u.id),
    ...(grants
      ? [
          stmt(
            c.env,
            'UPDATE users SET permissions=? WHERE id=?',
            grants,
            u.id,
          ),
          audit(c.env, 'client_permissions_changed', actor(c), u.client_id),
        ]
      : []),
    stmt(
      c.env,
      'DELETE FROM password_resets WHERE user_id=? AND email IS NOT ?',
      u.id,
      e,
    ),
    audit(c.env, 'client_updated', actor(c), u.client_id),
  ]);
  return c.json({
    user: userView({
      ...u,
      email: e,
      name,
      permissions: grants ?? u.permissions,
    }),
  });
});
admin.post('/users/:id/reset-password', async (c) => {
  const u = await client(c),
    pass = temporary();
  await c.env.DB.batch([
    stmt(
      c.env,
      'UPDATE users SET password_hash=?,password_version=password_version+1,must_change_password=1 WHERE id=?',
      await hashPassword(c.env, pass),
      u.id,
    ),
    stmt(c.env, 'DELETE FROM sessions WHERE user_id=?', u.id),
    stmt(c.env, 'DELETE FROM password_resets WHERE user_id=?', u.id),
    audit(c.env, 'client_password_reset', actor(c), u.client_id),
  ]);
  return c.json({ username: u.username, temporary_password: pass });
});
admin.delete('/users/:id', async (c) => {
  const u = await client(c);
  await c.env.DB.batch([
    stmt(c.env, 'DELETE FROM users WHERE id=?', u.id),
    audit(c.env, 'client_deleted', actor(c), u.client_id),
  ]);
  return c.json({ ok: true });
});
admin.get('/audit', async (c) =>
  c.json({
    entries: await all(
      c.env,
      `SELECT a.id,a.action,a.site_id,a.at,u.username FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100`,
    ),
  }),
);
admin.get('/sites/:id/content', async (c) =>
  editorContent(c, (await editable(c)).id),
);
admin.post('/sites/:id/content/import', async (c) =>
  inspectSite(c, await editable(c)),
);
admin.put('/sites/:id/content', async (c) =>
  publishContent(c, (await editable(c)).id),
);
admin.get('/sites/:id/media', async (c) => listMedia(c, (await target(c)).id));
admin.post('/sites/:id/media', async (c) => upload(c, (await editable(c)).id));
admin.delete('/sites/:id/media/:mediaId', async (c) =>
  removeImage(c, (await editable(c)).id, c.req.param('mediaId')),
);
admin.post('/sites/:id/media/import', async (c) => {
  const site = await editable(c),
    b = await json(c, 4096),
    item = await importImage(c.env, site.id, b.url);
  await audit(c.env, 'media_imported', actor(c), site.id).run();
  return c.json({ id: item.id }, 201);
});
admin.post('/maintenance/migrate-logos', async (c) => {
  const rows = await all<{ id: string; logo_data: string }>(
    c.env,
    "SELECT id,logo_data FROM sites WHERE logo_data IS NOT NULL AND status!='deleting' ORDER BY id",
  );
  let migrated = 0;
  const skipped: string[] = [];
  for (const site of rows) {
    try {
      const legacy = site.logo_data.match(
        /^data:image\/[\w+.\-]+;base64,([A-Za-z0-9+/=\s]+)$/i,
      )?.[1];
      if (!legacy || legacy.length > 300000) {
        skipped.push(site.id);
        continue;
      }
      const item = await saveImage(
        c.env,
        site.id,
        'Logo migrat',
        Uint8Array.from(atob(legacy), (ch) => ch.charCodeAt(0)),
        200 * 1024,
      );
      const updated = await stmt(
        c.env,
        "UPDATE sites SET logo_media_id=COALESCE(logo_media_id,?),logo_data=NULL WHERE id=? AND logo_data=? AND status!='deleting'",
        item.id,
        site.id,
        site.logo_data,
      ).run();
      const current = await findSite(c.env, site.id);
      if (current?.logo_media_id !== item.id) {
        await c.env.MEDIA.delete(item.object_key);
        await stmt(c.env, 'DELETE FROM media WHERE id=?', item.id).run();
      }
      migrated += Number(Boolean(updated.meta.changes));
    } catch {
      skipped.push(site.id);
    }
  }
  await audit(c.env, 'logos_migration', actor(c), null).run();
  return c.json({
    migrated,
    skipped,
    note: 'Poate fi rulată din nou în siguranță.',
  });
});
