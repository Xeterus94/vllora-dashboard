import {
  currencies,
  isMetric,
  metrics,
  profiles,
  profileSettings,
  type MetricId,
  type MetricSettings,
} from '../shared/metrics';
import {
  ae,
  aeConfigured,
  beaconOrigin,
  dataset,
  DAY,
  sqlDate,
  trackingSite,
  trafficStats,
  trafficValue,
  utc,
} from './analytics';
import {
  all,
  audit,
  equal,
  fail,
  hash,
  ipKey,
  json,
  random,
  rate,
  stmt,
  type Ctx,
  type Env,
} from './core';

const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isCurrency = (v: unknown): v is MetricSettings['currency'] =>
  currencies.some((c) => c === v);
const readIds = (v: unknown): MetricId[] => {
  if (
    !Array.isArray(v) ||
    v.length > Object.keys(metrics).length ||
    !v.every(isMetric) ||
    new Set(v).size !== v.length
  )
    return fail(400, 'Selecția de metrici este invalidă.');
  return v;
};
export function validateMetrics(v: unknown): MetricSettings {
  if (
    !obj(v) ||
    typeof v.profile !== 'string' ||
    !Object.hasOwn(profiles, v.profile) ||
    !isCurrency(v.currency)
  )
    return fail(400, 'Profilul sau moneda nu este validă.');
  const selected = readIds(v.selected),
    ready = readIds(v.ready);
  if (
    ready.some(
      (id) => !selected.includes(id) || metrics[id][1] === 'traffic',
    ) ||
    (v.primary !== null &&
      (!isMetric(v.primary) || !selected.includes(v.primary))) ||
    !obj(v.targets)
  )
    return fail(
      400,
      'Indicatorul principal, țintele sau integrările sunt invalide.',
    );
  const targets: MetricSettings['targets'] = {};
  for (const [id, value] of Object.entries(v.targets)) {
    if (
      !isMetric(id) ||
      !selected.includes(id) ||
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 1e12 ||
      (id === 'bounce_rate' && value > 100) ||
      (id !== 'bounce_rate' && !Number.isSafeInteger(value))
    )
      return fail(400, 'Ținta lunară este invalidă.');
    targets[id] = value;
  }
  return {
    profile: v.profile,
    selected,
    ready,
    primary: v.primary,
    targets,
    currency: v.currency,
  };
}
const defaultConfig = () => JSON.stringify(profileSettings());
interface Stored {
  config: string;
  server_key_hash: string | null;
}
export const storedMetrics = (env: Env, id: string) =>
  stmt(
    env,
    'SELECT config,server_key_hash FROM site_metric_settings WHERE site_id=?',
    id,
  ).first<Stored>();
export const configView = async (env: Env, id: string) => {
  const row = await storedMetrics(env, id);
  const locked = Boolean(
    await stmt(
      env,
      "SELECT 1 FROM metric_events WHERE site_id=? AND event='order_paid' LIMIT 1",
      id,
    ).first(),
  );
  return {
    settings: row
      ? (JSON.parse(row.config) as MetricSettings)
      : profileSettings(),
    server_key_configured: Boolean(row?.server_key_hash),
    currency_locked: locked,
  };
};
export const settingsInsert = (env: Env, id: string, config: MetricSettings) =>
  stmt(
    env,
    'INSERT INTO site_metric_settings(site_id,config) VALUES(?,?)',
    id,
    JSON.stringify(config),
  );
export const settingsUpsert = (env: Env, id: string, config: MetricSettings) =>
  stmt(
    env,
    `INSERT INTO site_metric_settings(site_id,config)
  SELECT id,? FROM sites WHERE id=? AND status!='deleting' ON CONFLICT(site_id) DO UPDATE SET config=excluded.config`,
    JSON.stringify(config),
    id,
  );
export async function rotateKey(c: Ctx, id: string) {
  const key = random(),
    actor = c.get('user').id;
  const [result] = await c.env.DB.batch([
    stmt(
      c.env,
      `INSERT INTO site_metric_settings(site_id,config,server_key_hash)
    SELECT id,?,? FROM sites WHERE id=? AND status!='deleting' ON CONFLICT(site_id) DO UPDATE SET server_key_hash=excluded.server_key_hash`,
      defaultConfig(),
      await hash(key),
      id,
    ),
    audit(c.env, 'metrics_key_rotated', actor, id),
  ]);
  if (!result.meta.changes)
    return fail(409, 'Site-ul este în curs de ștergere.');
  return c.json({ key });
}
export async function collectEvent(c: Ctx) {
  const env = c.env;
  if (!(await rate(env, `business:ip:${await ipKey(c)}`, 120, 60000)))
    return fail(429, 'Limită de colectare depășită.');
  const b = await json(c, 4096),
    site = await trackingSite(env, b.site);
  if (!site) return fail(403, 'Site necunoscut sau inactiv.');
  const event = b.event;
  if (
    !isMetric(event) ||
    metrics[event][1] === 'traffic' ||
    event === 'revenue'
  )
    return fail(400, 'Eveniment necunoscut.');
  const source = metrics[event][1],
    stored = await storedMetrics(env, site.id);
  if (source === 'server') {
    const key = c.req
      .header('Authorization')
      ?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
    if (
      !key ||
      !stored?.server_key_hash ||
      !equal(stored.server_key_hash, await hash(key))
    )
      return fail(401, 'Cheie server invalidă.');
  } else beaconOrigin(c, site);
  if (!(await rate(env, `business:site:${site.id}:${source}`, 600, 60000)))
    return fail(429, 'Limită de colectare depășită.');
  const settings = stored
    ? (JSON.parse(stored.config) as MetricSettings)
    : profileSettings();
  if (
    !settings.selected.includes(event) &&
    !(event === 'order_paid' && settings.selected.includes('revenue'))
  )
    return c.json({ accepted: false });
  let eventId: string | null = null,
    amount = 0,
    currency: string | null = null;
  if (source === 'server') {
    if (
      typeof b.event_id !== 'string' ||
      !/^[a-zA-Z0-9_.:-]{8,100}$/.test(b.event_id)
    )
      return fail(400, 'event_id trebuie să aibă 8–100 caractere valide.');
    eventId = b.event_id;
  }
  if (event === 'order_paid') {
    if (
      typeof b.amount_cents !== 'number' ||
      !Number.isSafeInteger(b.amount_cents) ||
      b.amount_cents < 0 ||
      b.amount_cents > 1e12 ||
      b.currency !== settings.currency
    )
      return fail(400, 'Suma sau moneda nu este validă.');
    amount = b.amount_cents;
    currency = settings.currency;
  }
  const now = Date.now();
  const result = await stmt(
    env,
    `INSERT INTO metric_events(site_id,event_id,event,source,amount_cents,currency,created_at)
    SELECT s.id,?,?,?,?,?,? FROM sites s JOIN site_metric_settings m ON m.site_id=s.id
    WHERE s.id=? AND s.status='active' AND m.config=? AND (?='browser' OR m.server_key_hash=?)
    ON CONFLICT(site_id,event_id) DO NOTHING`,
    eventId,
    event,
    source,
    amount,
    currency,
    now,
    site.id,
    stored?.config ?? '',
    source,
    stored?.server_key_hash ?? null,
  ).run();
  if (!result.meta.changes) {
    const duplicate = Boolean(
      eventId &&
      (await stmt(
        env,
        'SELECT 1 FROM metric_events WHERE site_id=? AND event_id=?',
        site.id,
        eventId,
      ).first()),
    );
    return c.json({ accepted: duplicate, duplicate });
  }
  try {
    env.BUSINESS_ANALYTICS?.writeDataPoint({
      indexes: [site.id],
      blobs: [event, currency || '', source],
      doubles: [1, amount, now],
    });
  } catch {
    console.warn('business_analytics_write_failed');
  }
  return c.json({ accepted: true, duplicate: false }, 201);
}
interface Group {
  event: MetricId;
  n: number;
  monthly: number;
  last: number;
}
const exact = (value: bigint) => {
  return value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
};
export async function businessReport(env: Env, id: string, days: number) {
  const today = utc(),
    start = today - (days - 1) * DAY;
  const date = new Date(today);
  date.setUTCDate(1);
  const month = date.getTime();
  const config = await storedMetrics(env, id);
  const settings: MetricSettings = config
    ? JSON.parse(config.config)
    : profileSettings();
  const [groups, financial] = await Promise.all([
    all<Group>(
      env,
      `SELECT event, SUM(created_at>=?) AS n, SUM(created_at>=?) AS monthly, MAX(created_at) AS last
      FROM metric_events WHERE site_id=? GROUP BY event`,
      start,
      month,
      id,
    ),
    settings.selected.includes('revenue')
      ? all<{ period: number; amount: string }>(
          env,
          `SELECT CAST(created_at / ? AS INTEGER) * ? AS period,
      CAST(SUM(amount_cents) AS TEXT) AS amount FROM metric_events WHERE site_id=? AND event='order_paid' AND created_at>=? GROUP BY period`,
          DAY,
          DAY,
          id,
          Math.min(start, month),
        )
      : [],
  ]);
  // Sum bounded daily totals in BigInt, never through D1 JSON floating-point numbers.
  const finance = (since: number) =>
    exact(
      financial.reduce(
        (sum, row) => (row.period >= since ? sum + BigInt(row.amount) : sum),
        0n,
      ),
    );
  const grouped = new Map(groups.map((row) => [row.event, row]));
  let estimates = new Map<MetricId, number>();
  if (
    aeConfigured(env) &&
    days <= 90 &&
    /^site_[0-9a-f]{24}$/.test(id) &&
    groups.some((row) => row.n > 0)
  )
    try {
      const rows = await ae<{
        event: MetricId;
        n: number;
        last: number;
        raw: number;
      }>(
        env,
        `SELECT blob1 AS event, sum(double1*_sample_interval) AS n, max(double3) AS last, count() AS raw FROM ${dataset(env, true)} WHERE index1='${id}' AND timestamp>=toDateTime('${sqlDate(start)}') GROUP BY event LIMIT 32`,
      );
      for (const row of rows) {
        const d1 = grouped.get(row.event);
        if (
          d1 &&
          d1.last < Date.now() - 120000 &&
          Number(row.last) === d1.last &&
          Number(row.raw) <= d1.n &&
          Number(row.n) >= d1.n
        )
          estimates.set(row.event, Number(row.n));
      }
    } catch {
      estimates = new Map();
    }
  const hasTrafficGoal = settings.selected.some(
    (metric) => metrics[metric][1] === 'traffic' && settings.targets[metric],
  );
  const monthlyTraffic = hasTrafficGoal
    ? (await trafficStats(env, id, (today - month) / DAY + 1)).totals
    : null;
  const ordered = settings.primary
    ? [
        settings.primary,
        ...settings.selected.filter((m) => m !== settings.primary),
      ]
    : settings.selected;
  const values = ordered
    .filter((metric) => metrics[metric][1] !== 'traffic')
    .map((metric) => {
      const event = metric === 'revenue' ? 'order_paid' : metric,
        d1 = grouped.get(event);
      const state = d1
        ? 'received'
        : settings.ready.includes(metric)
          ? 'ready'
          : 'needs_integration';
      const estimate = estimates.get(event);
      return {
        id: metric,
        state,
        last_event: d1?.last ?? null,
        source:
          metric !== 'revenue' && estimate !== undefined
            ? 'analytics_engine'
            : 'd1',
        value:
          state === 'needs_integration'
            ? null
            : metric === 'revenue'
              ? finance(start)
              : (estimate ?? d1?.n ?? 0),
        monthly:
          state === 'needs_integration'
            ? null
            : metric === 'revenue'
              ? finance(month)
              : (d1?.monthly ?? 0),
      };
    });
  const trafficMonthly = Object.fromEntries(
    settings.selected
      .filter((m) => metrics[m][1] === 'traffic' && monthlyTraffic)
      .map((m) => [m, trafficValue(monthlyTraffic!, m)]),
  );
  return { settings, values, trafficMonthly, days };
}
