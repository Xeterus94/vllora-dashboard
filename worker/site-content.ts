import {
  cmsTextFields,
  documentLimit,
  galleryLimit,
  hoursLimit,
  servicesLimit,
  type CmsTextField,
  type CmsFile,
  type SiteContent,
} from '../shared/site-content';
import {
  all,
  fail,
  hash,
  json,
  publicMediaUrl,
  stmt,
  text,
  type Ctx,
  type Env,
} from './core';

import { color } from './branding';

type Body = Record<string, unknown>;
const record = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail(400, 'Conținutul nu are formatul corect.');
  return value as Body;
};
export const cmsUrl = (value: unknown) => {
  const input = text(value ?? '', 2048, 'Adresă URL', true);
  if (!input) return '';
  try {
    const url = new URL(input);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return url.href;
  } catch {
    /* Malformed URL */
  }
  return fail(400, 'Folosește o adresă HTTPS validă.');
};
const urlFields = new Set<CmsTextField>([
  'mapsUrl',
  'facebook',
  'instagram',
  'bookingUrl',
  'logoUrl',
  'heroImageUrl',
]);
export function fieldText(field: CmsTextField, value: unknown) {
  if (urlFields.has(field)) return cmsUrl(value);
  if (
    field === 'primaryColor' ||
    field === 'secondaryColor' ||
    field === 'accentColor'
  ) {
    if (value == null || value === '') return '';
    return color(value) ?? fail(400, 'Folosește o culoare în format #RRGGBB.');
  }
  if (field === 'siteScheme') {
    if (value == null || value === '') return '';
    return value === 'light' || value === 'dark'
      ? value
      : fail(400, 'Alege o temă validă.');
  }
  return text(
    value ?? '',
    field === 'siteName' ? 100 : field === 'aboutText' ? 3000 : 1200,
    field,
    true,
  );
}
const items = (value: unknown, maximum: number, label: string) => {
  if (!Array.isArray(value) || value.length > maximum)
    return fail(400, `${label}: limita este de ${maximum}.`);
  return value as unknown[];
};
const mediaId = (value: unknown) => {
  const id = record(value).id;
  if (typeof id !== 'string' || !/^m_[a-f0-9]{24}$/.test(id))
    return fail(400, 'Fișierul nu este valid.');
  return id;
};
type Stored = Omit<
  SiteContent,
  'heroMedia' | 'logoMedia' | 'gallery' | 'documents'
> & {
  heroMedia: string | null;
  logoMedia: string | null;
  gallery: string[];
  documents: string[];
};
function normalizeInput(body: Body): Stored {
  const fields = Object.fromEntries(
    cmsTextFields.map((name) => [name, fieldText(name, body[name])]),
  ) as Record<CmsTextField, string>;
  return {
    ...fields,
    images: items(body.images ?? [], galleryLimit, 'Imagini prin URL')
      .map(cmsUrl)
      .filter(Boolean),
    heroMedia: body.heroMedia == null ? null : mediaId(body.heroMedia),
    logoMedia: body.logoMedia == null ? null : mediaId(body.logoMedia),
    gallery: [
      ...new Set(
        items(body.gallery ?? [], galleryLimit, 'Galerie').map(mediaId),
      ),
    ],
    documents: [
      ...new Set(
        items(body.documents ?? [], documentLimit, 'Documente').map(mediaId),
      ),
    ],
    services: items(body.services ?? [], servicesLimit, 'Servicii').map(
      (value) => {
        const row = record(value);
        return {
          name: text(row.name, 100, 'Nume serviciu'),
          description: text(
            row.description ?? '',
            600,
            'Descriere serviciu',
            true,
          ),
          price: text(row.price ?? '', 80, 'Preț', true),
          duration: text(row.duration ?? '', 80, 'Durată', true),
        };
      },
    ),
    hours: items(body.hours ?? [], hoursLimit, 'Program').map((value) => {
      const row = record(value);
      return {
        day: text(row.day, 80, 'Zi'),
        time: text(row.time, 120, 'Interval'),
      };
    }),
  };
}

// Rows can also have only the older portfolio fields. Never reuse client-supplied URLs
// for uploaded files: resolve every reference against this tenant's ready media.
async function resolveContent(
  env: Env,
  site: string,
  raw: string | null,
  strict = false,
  publicOrigin?: string,
  prefix = '',
): Promise<SiteContent> {
  const data = JSON.parse(raw || '{}') as Partial<Stored>;
  const ids = [
    ...new Set(
      [
        ...(data.gallery ?? []),
        ...(data.documents ?? []),
        data.heroMedia,
        data.logoMedia,
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const rows = ids.length
    ? await all<{
        id: string;
        name: string;
        object_key: string;
        content_type: string;
      }>(
        env,
        `SELECT id,name,object_key,content_type FROM media WHERE site_id=? AND ready=1 AND id IN (${ids.map(() => '?').join(',')})`,
        site,
        ...ids,
      )
    : [];
  const files = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        content_type: row.content_type,
        url: publicOrigin
          ? new URL(publicMediaUrl(env, row.object_key), publicOrigin).href
          : publicMediaUrl(env, row.object_key, prefix),
      } satisfies CmsFile,
    ]),
  );
  const find = (id: string, kind: 'image' | 'pdf') => {
    const file = files.get(id);
    if (
      file &&
      (kind === 'image'
        ? file.content_type.startsWith('image/')
        : file.content_type === 'application/pdf')
    )
      return file;
    if (strict)
      return fail(
        400,
        'Un fișier nu mai este disponibil în biblioteca acestui site. Elimină-l din editor și încearcă din nou.',
      );
    return null;
  };
  const fields = Object.fromEntries(
    cmsTextFields.map((name) => [name, data[name] ?? '']),
  ) as Record<CmsTextField, string>;
  return {
    ...fields,
    images: data.images ?? [],
    heroMedia: data.heroMedia ? find(data.heroMedia, 'image') : null,
    logoMedia: data.logoMedia ? find(data.logoMedia, 'image') : null,
    gallery: (data.gallery ?? [])
      .map((id) => find(id, 'image'))
      .filter((file): file is CmsFile => file !== null),
    documents: (data.documents ?? [])
      .map((id) => find(id, 'pdf'))
      .filter((file): file is CmsFile => file !== null),
    services: data.services ?? [],
    hours: data.hours ?? [],
  };
}
const current = (env: Env, id: string) =>
  stmt(
    env,
    'SELECT content FROM portfolio_details WHERE site_id=?',
    id,
  ).first<string>('content');
export async function editorContent(c: Ctx, site: string) {
  const raw = await current(c.env, site);
  return c.json({
    content: await resolveContent(
      c.env,
      site,
      raw,
      false,
      undefined,
      c.get('tenant') ? '/admin' : '',
    ),
    revision: await hash(raw ?? ''),
  });
}
export async function publishContent(c: Ctx, site: string) {
  const body = await json(c, 96 * 1024);
  const previous = await current(c.env, site);
  const conflict = () =>
    fail(
      409,
      'Conținutul a fost schimbat în altă parte. Reîncarcă editorul înainte să publici.',
    );
  if (body.revision !== (await hash(previous ?? ''))) return conflict();
  const next = JSON.stringify(normalizeInput(record(body.content)));
  const content = await resolveContent(
    c.env,
    site,
    next,
    true,
    undefined,
    c.get('tenant') ? '/admin' : '',
  );
  const [result] = await c.env.DB.batch([
    stmt(
      c.env,
      `INSERT INTO portfolio_details(site_id,industry,billing,monthly_cents,annual_cents,next_renewal,contact_email,content)
      SELECT id,'Unspecified','Monthly',0,0,'','',? FROM sites WHERE id=? AND (status='active' OR (? AND status='suspended'))
      ON CONFLICT(site_id) DO UPDATE SET content=excluded.content WHERE portfolio_details.content IS ?`,
      next,
      site,
      Number(c.get('user').role === 'super_admin'),
      previous,
    ),
    stmt(
      c.env,
      "INSERT INTO audit_log(actor_id,site_id,action,at) SELECT ?,?,'site_content_published',? WHERE changes()=1",
      c.get('user').id,
      site,
      Date.now(),
    ),
  ]);
  if (!result.meta.changes) return conflict();
  return c.json({ content, revision: await hash(next) });
}
export const siteContentView = resolveContent;
