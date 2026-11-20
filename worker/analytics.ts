import { periods } from '../shared/metrics';
import {
  all,
  fail,
  hash,
  ipKey,
  json,
  rate,
  stmt,
  type Ctx,
  type Env,
  type Site,
} from './core';

export const DAY = 86400000;
export const day = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);
export const utc = (ms = Date.now()) => Date.parse(`${day(ms)}T00:00:00Z`);
export const sqlDate = (ms: number) =>
  new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
export function range(c: Ctx) {
  const n = c.req.query('days') ?? '30';
  if (!periods.some((p) => String(p) === n))
    return fail(400, 'Perioada trebuie să fie 7, 30, 90 sau 365 zile.');
  return Number(n);
}
export const trackingSite = async (env: Env, token: unknown) =>
  typeof token === 'string' && /^[a-f0-9]{48}$/.test(token)
    ? stmt(
        env,
        "SELECT * FROM sites WHERE tracking_token=? AND status='active'",
        token,
      ).first<Site>()
    : null;
export function beaconOrigin(c: Ctx, site: Site) {
  const value = c.req.header('Origin');
  if (!value) return;
  try {
    const origin = new URL(value);
    const alternate = site.domain.startsWith('www.')
      ? site.domain.slice(4)
      : `www.${site.domain}`;
    if (
      ['http:', 'https:'].includes(origin.protocol) &&
      !origin.port &&
      origin.origin === value &&
      [site.domain, alternate, site.portal_host].includes(origin.hostname)
    )
      return;
  } catch {
    /* invalid origin */
  }
  fail(403, 'Originea nu aparține site-ului.');
}
export async function collectTraffic(c: Ctx) {
  if (!(await rate(c.env, `traffic:ip:${await ipKey(c)}`, 240, 60000)))
    return fail(429, 'Limită de colectare depășită.');
  const b = await json(c, 4096),
    site = await trackingSite(c.env, b.site);
  if (!site) return fail(403, 'Site necunoscut sau inactiv.');
  beaconOrigin(c, site);
  if (
    typeof b.path !== 'string' ||
    !b.path.startsWith('/') ||
    b.path.startsWith('//') ||
    b.path.includes('\\')
  )
    return fail(400, 'Cale invalidă.');
  const path = b.path
    .split(/[?#]/)[0]
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 360);
  let ref = '';
  try {
    if (typeof b.ref === 'string') {
      const v = new URL(b.ref);
      if (v.protocol === 'https:' || v.protocol === 'http:')
        ref = v.origin.slice(0, 200);
    }
  } catch {
    /* no referrer */
  }
  if (c.env.ANALYTICS && c.env.TRACK_SALT) {
    const visitor = (
      await hash(
        `${day()}|${c.req.header('CF-Connecting-IP') || ''}|${(c.req.header('User-Agent') || '').slice(0, 512)}|${c.env.TRACK_SALT}`,
      )
    ).slice(0, 32);
    const start = b.newSession === true,
      second = b.secondPage === true;
    c.env.ANALYTICS.writeDataPoint({
      indexes: [site.id],
      blobs: [visitor, path, ref],
      doubles: [1, start ? 1 : second ? -1 : 0, start ? 1 : 0],
    });
  }
  return c.body(null, 204);
}
const trafficCols =
  'count(DISTINCT blob1) AS visitors, sum(double1*_sample_interval) AS pageviews, sum(double3*_sample_interval) AS sessions, sum(double2*_sample_interval) AS bounces';
export const dataset = (env: Env, business = false) => {
  const name =
    (business ? env.BUSINESS_AE_DATASET : env.AE_DATASET) ||
    (business ? 'vllora_business_events' : 'vllora_metrics');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name))
    throw new Error('Invalid Analytics Engine dataset');
  return name;
};
export const aeConfigured = (env: Env) =>
  Boolean(env.CF_ACCOUNT_ID && env.CF_AE_API_TOKEN);
export async function ae<T>(env: Env, query: string) {
  if (!aeConfigured(env)) throw new Error('Analytics Engine unavailable');
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CF_ACCOUNT_ID!)}/analytics_engine/sql`,
    {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(6500),
      headers: {
        Authorization: `Bearer ${env.CF_AE_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: query,
    },
  );
  if (!response.ok)
    throw new Error(`Analytics Engine returned ${response.status}`);
  const data = await response.json<{ data?: T[] }>();
  if (!Array.isArray(data.data))
    throw new Error('Analytics Engine response invalid');
  return data.data;
}
interface Totals {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounces: number;
}
interface Daily extends Totals {
  day: string;
}
interface Page {
  path: string;
  views: number;
}
const zero = (): Totals => ({
  visitors: 0,
  pageviews: 0,
  sessions: 0,
  bounces: 0,
});
const count = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));
const clean = (row: Daily): Daily => ({
  ...row,
  visitors: count(row.visitors),
  pageviews: count(row.pageviews),
  sessions: count(row.sessions),
  bounces: Math.min(count(row.bounces), count(row.sessions)),
});
export const trafficValue = (totals: Totals, id: string) =>
  id === 'bounce_rate'
    ? totals.sessions
      ? (100 * totals.bounces) / totals.sessions
      : 0
    : totals[id as keyof Totals];
const sum = (rows: Daily[]) =>
  rows.reduce(
    (out, r) => ({
      visitors: out.visitors + r.visitors,
      pageviews: out.pageviews + r.pageviews,
      sessions: out.sessions + r.sessions,
      bounces: out.bounces + r.bounces,
    }),
    zero(),
  );
const safeId = (id: string) => {
  if (!/^site_[0-9a-f]{24}$/.test(id)) throw new Error('Invalid site ID');
  return id;
};
export async function trafficStats(env: Env, site: string, days: number) {
  const today = utc(),
    current = today - (days - 1) * DAY,
    previous = current - days * DAY;
  const [rollup, rollupPages] = await Promise.all([
    all<Daily>(
      env,
      'SELECT day,visitors,pageviews,sessions,bounces FROM daily_stats WHERE site_id=? AND day>=? AND day<=?',
      site,
      day(previous),
      day(today),
    ),
    all<Page & { day: string }>(
      env,
      'SELECT day,path,views FROM top_pages_daily WHERE site_id=? AND day>=? AND day<=?',
      site,
      day(current),
      day(today),
    ),
  ]);
  const rows = new Map(rollup.map((r) => [r.day, clean(r)]));
  let source = 'rollup',
    liveVisitors: number | null = null;
  let pageRows: Page[] = rollupPages;
  if (aeConfigured(env))
    try {
      const start = Math.max(previous, today - 89 * DAY),
        pageStart = Math.max(start, current);
      const where = `FROM ${dataset(env)} WHERE index1='${safeId(site)}'`;
      const [online, pages, live] = await Promise.all([
        ae<Daily>(
          env,
          `SELECT formatDateTime(timestamp, '%Y-%m-%d') AS day, ${trafficCols} ${where} AND timestamp>=toDateTime('${sqlDate(start)}') GROUP BY day ORDER BY day LIMIT 91`,
        ),
        ae<Page>(
          env,
          `SELECT blob2 AS path, sum(double1*_sample_interval) AS views ${where} AND timestamp>=toDateTime('${sqlDate(pageStart)}') GROUP BY path ORDER BY views DESC LIMIT 50`,
        ),
        ae<{ visitors: number }>(
          env,
          `SELECT count(DISTINCT blob1) AS visitors ${where} AND timestamp>=toDateTime(${Math.floor(Date.now() / 1000) - 300})`,
        ),
      ]);
      if (online.length) {
        for (const row of online) rows.set(row.day, clean(row));
        const covered = new Set(online.map((row) => row.day));
        pageRows = [
          ...rollupPages.filter((row) => !covered.has(row.day)),
          ...pages,
        ];
        source =
          previous < start || rollup.some((r) => !covered.has(r.day))
            ? 'mixed'
            : 'analytics_engine';
      }
      liveVisitors = count(live[0]?.visitors);
    } catch {
      /* D1 rollup is available even if the Analytics Engine SQL API is down */
    }
  const fill = (start: number) =>
    Array.from({ length: days }, (_, i) => {
      const key = day(start + i * DAY);
      return rows.get(key) || { day: key, ...zero() };
    });
  const timeline = fill(current),
    pageMap = new Map<string, number>();
  for (const row of pageRows)
    pageMap.set(row.path, (pageMap.get(row.path) || 0) + count(row.views));
  const topPages = [...pageMap]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
    .slice(0, 10);
  return {
    days: timeline,
    topPages,
    totals: sum(timeline),
    previous: sum(fill(previous)),
    liveVisitors,
    source,
  };
}
export async function rollupTraffic(env: Env, scheduledTime: number) {
  if (!aeConfigured(env)) return;
  const end = utc(scheduledTime),
    start = end - DAY;
  const bounds = `FROM ${dataset(env)} WHERE timestamp>=toDateTime('${sqlDate(start)}') AND timestamp<toDateTime('${sqlDate(end)}')`;
  const sites = await all<{ id: string }>(
    env,
    "SELECT id FROM sites WHERE status!='deleting'",
  );
  for (let i = 0; i < sites.length; i += 4)
    await Promise.all(
      sites.slice(i, i + 4).map(async ({ id }) => {
        try {
          const filter = `${bounds} AND index1='${safeId(id)}'`,
            key = day(start);
          const [totals, pages] = await Promise.all([
            ae<Totals>(env, `SELECT ${trafficCols} ${filter}`),
            ae<Page>(
              env,
              `SELECT blob2 AS path, sum(double1*_sample_interval) AS views ${filter} GROUP BY path ORDER BY views DESC LIMIT 20`,
            ),
          ]);
          const row = clean({ day: key, ...(totals[0] || zero()) });
          if (!row.pageviews) return; // never replace an existing rollup with an empty response
          await env.DB.batch([
            stmt(
              env,
              `INSERT INTO daily_stats SELECT id,?,?,?,?,? FROM sites WHERE id=? AND status!='deleting' ON CONFLICT(site_id,day) DO UPDATE SET visitors=excluded.visitors,pageviews=excluded.pageviews,sessions=excluded.sessions,bounces=excluded.bounces`,
              key,
              row.visitors,
              row.pageviews,
              row.sessions,
              row.bounces,
              id,
            ),
            stmt(
              env,
              'DELETE FROM top_pages_daily WHERE site_id=? AND day=?',
              id,
              key,
            ),
            ...pages.map((p) =>
              stmt(
                env,
                "INSERT INTO top_pages_daily SELECT id,?,?,? FROM sites WHERE id=? AND status!='deleting'",
                key,
                p.path,
                count(p.views),
                id,
              ),
            ),
          ]);
        } catch {
          console.error('traffic_rollup_failed', id);
        }
      }),
    );
}
export const trackingScript = String.raw`(() => {
  const script = document.currentScript;
  const site = script && script.dataset.vlloraSite;
  if (!site || window.Vllora) return;
  const base = new URL(script.src).origin;
  function send(endpoint, data) {
    const body=JSON.stringify({site,...data});
    fetch(base+endpoint,{method:'POST',mode:'cors',credentials:'omit',body,keepalive:true}).catch(()=>{});
  }
  function track(event) { if (typeof event==='string' && /^[a-z_]{1,40}$/.test(event)) send('/api/collect-event',{event}); }
  window.Vllora={track};
  const sessionKey='vllora-session:'+site, now=Date.now(), day=new Date(now).toISOString().slice(0,10);
  let session;
  try { session=JSON.parse(sessionStorage.getItem(sessionKey)); } catch (_) {}
  const newSession=!session||now-session.at>1800000||session.day!==day;
  const pages=newSession?1:Math.min(2,session.pages+1);
  try {sessionStorage.setItem(sessionKey,JSON.stringify({at:now,day,pages}));} catch (_) {}
  send('/api/collect',{path:location.pathname,ref:document.referrer ? new URL(document.referrer).origin : '',newSession,secondPage:!newSession&&session.pages===1});
  document.addEventListener('click', e=>{
    const el=e.target instanceof Element && e.target.closest('[data-vllora-event],a[href]');
    if(!el)return;
    const explicit=el.getAttribute('data-vllora-event') ?? el.closest('[data-vllora-event]')?.getAttribute('data-vllora-event');
    if(explicit!==null && explicit!==undefined){track(explicit);return;}
    try {const href=new URL(el.href,location.href);
      if(href.protocol==='tel:') track('phone_click');
      else if(href.protocol==='mailto:') track('email_click');
      else if(['wa.me','api.whatsapp.com','web.whatsapp.com'].includes(href.hostname)) track('whatsapp_click');
    } catch (_) {}
  },true);
  const views=()=>document.querySelectorAll('[data-vllora-view]').forEach(el=>track(el.dataset.vlloraView));
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',views,{once:true});else views();
})();`;
