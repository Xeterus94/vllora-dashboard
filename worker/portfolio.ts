import { ae, aeConfigured, dataset } from './analytics';
import { email } from './auth';
import { cmsUrl, siteContentView } from './site-content';
import { all, fail, stmt, text, validHost, type Ctx, type Env } from './core';

type Body = Record<string, unknown>;
export type PortfolioDetails = {
  industry: string;
  billing: 'Monthly' | 'Annual';
  monthly_cents: number;
  annual_cents: number;
  next_renewal: string;
  contact_email: string;
  content: string;
};
const cmsFields = [
  'heroTitle',
  'heroSubtitle',
  'announcement',
  'phone',
  'whatsapp',
  'email',
  'address',
  'mapsUrl',
  'facebook',
  'instagram',
] as const;
const money = (value: unknown) => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1_000_000
  )
    return fail(400, 'Preț invalid.');
  return Math.round(value * 100);
};
export function portfolioDetails(b: Body): PortfolioDetails {
  const billing = b.billing;
  if (billing !== 'Monthly' && billing !== 'Annual')
    return fail(400, 'Perioadă de facturare invalidă.');
  const next_renewal = text(b.nextRenewal ?? '', 10, 'Data reînnoirii', true);
  if (
    next_renewal &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(next_renewal) ||
      !Number.isFinite(Date.parse(next_renewal)) ||
      new Date(next_renewal).toISOString().slice(0, 10) !== next_renewal)
  )
    return fail(400, 'Data reînnoirii este invalidă.');
  const source = b.content ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source))
    return fail(400, 'Conținut CMS invalid.');
  const data = source as Body;
  const images = data.images ?? [];
  if (!Array.isArray(images) || images.length > 20)
    return fail(400, 'Sunt permise maximum 20 de imagini CMS.');
  const content = Object.fromEntries(
    cmsFields.map((field) => [
      field,
      ['mapsUrl', 'facebook', 'instagram'].includes(field)
        ? cmsUrl(data[field] ?? '')
        : text(data[field] ?? '', 1200, field, true),
    ]),
  );
  return {
    billing,
    industry: text(b.industry ?? 'Unspecified', 60, 'Segment'),
    monthly_cents: money(b.monthlyPrice),
    annual_cents: money(b.annualPrice),
    next_renewal,
    contact_email: email(b.contactEmail ?? '') ?? '',
    content: JSON.stringify({
      ...(b.content === undefined
        ? {}
        : { ...content, images: images.map(cmsUrl).filter(Boolean) }),
    }),
  };
}
export const putPortfolio = (
  env: Env,
  site: string,
  detail: PortfolioDetails,
) =>
  stmt(
    env,
    `INSERT INTO portfolio_details(site_id,industry,billing,monthly_cents,annual_cents,next_renewal,contact_email,content)
   SELECT id,?,?,?,?,?,?,? FROM sites WHERE id=? AND status!='deleting'
   ON CONFLICT(site_id) DO UPDATE SET industry=excluded.industry,billing=excluded.billing,
   monthly_cents=excluded.monthly_cents,annual_cents=excluded.annual_cents,next_renewal=excluded.next_renewal,
   contact_email=excluded.contact_email,content=CASE WHEN excluded.content='{}' THEN portfolio_details.content ELSE json_patch(portfolio_details.content,excluded.content) END`,
    detail.industry,
    detail.billing,
    detail.monthly_cents,
    detail.annual_cents,
    detail.next_renewal,
    detail.contact_email,
    detail.content,
    site,
  );

type Row = {
  id: string;
  name: string;
  domain: string;
  status: string;
  plan: string;
  created_at: number;
  suspended_at: number | null;
  history: string | null;
} & Partial<PortfolioDetails>;
export async function portfolioList(c: Ctx) {
  const rows = await all<Row>(
    c.env,
    `SELECT s.id,s.name,s.domain,s.status,s.plan,s.created_at,s.suspended_at,
    p.industry,p.billing,p.monthly_cents,p.annual_cents,p.next_renewal,p.contact_email,p.content,
    (SELECT json_group_object(day,visitors) FROM daily_stats WHERE site_id=s.id AND day>=date('now','-730 days')) AS history
    FROM sites s LEFT JOIN portfolio_details p ON p.site_id=s.id WHERE s.status!='deleting' ORDER BY s.created_at DESC`,
  );
  let online: Map<string, number> | null = null;
  if (aeConfigured(c.env)) {
    try {
      const counts = await ae<{ site: string; visitors: number }>(
        c.env,
        `SELECT index1 AS site, count(DISTINCT blob1) AS visitors FROM ${dataset(c.env)} WHERE timestamp>=toDateTime(${Math.floor(Date.now() / 1000) - 300}) GROUP BY site`,
      );
      online = new Map(counts.map((row) => [row.site, Number(row.visitors)]));
    } catch {
      /* Live values stay unknown if SQL Analytics is unavailable. */
    }
  }
  return c.json({
    clients: rows.map((row) => ({
      id: row.id,
      businessName: row.name,
      domain: row.domain,
      state: row.status,
      tier: row.plan,
      createdAt: new Date(row.created_at).toISOString(),
      suspendedAt:
        row.suspended_at == null
          ? null
          : new Date(row.suspended_at).toISOString(),
      industry: row.industry ?? 'Unspecified',
      billing: row.billing ?? 'Monthly',
      monthlyPrice: (row.monthly_cents ?? 0) / 100,
      annualPrice: (row.annual_cents ?? 0) / 100,
      nextRenewal: row.next_renewal ?? '',
      contactEmail: row.contact_email ?? '',
      content: JSON.parse(row.content ?? '{}'),
      visitorsByDay: JSON.parse(row.history ?? '{}'),
      liveVisitors: online ? (online.get(row.id) ?? 0) : null,
    })),
  });
}

export async function publicContent(c: Ctx) {
  const host = validHost(c.req.query('site'));
  if (!host || c.get('tenant')) return fail(404, 'Site necunoscut.');
  const row = await stmt(
    c.env,
    `SELECT s.id,s.name,s.domain,p.content FROM sites s JOIN portfolio_details p ON p.site_id=s.id
    WHERE s.domain=? AND s.status='active'`,
    host,
  ).first<{ id: string; name: string; domain: string; content: string }>();
  if (!row) return fail(404, 'Site necunoscut.');
  const content = await siteContentView(
    c.env,
    row.id,
    row.content,
    false,
    new URL(c.req.url).origin,
  );
  return c.json(
    {
      businessName: content.siteName || row.name,
      domain: row.domain,
      content: {
        ...content,
        images: [
          ...new Set([
            ...content.images,
            ...content.gallery.map((file) => file.url),
          ]),
        ],
      },
    },
    200,
    { 'Access-Control-Allow-Origin': '*' },
  );
}
