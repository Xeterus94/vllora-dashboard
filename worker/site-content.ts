import {
  cmsTextFields,
  companyFields,
  companyFieldSpec,
  type CompanyField,
  type CompanyData,
  type CmsProduct,
  type CmsReview,
  discountMax,
  featuresLimit,
  reviewLimit,
  stockMax,
  documentLimit,
  galleryLimit,
  hoursLimit,
  productLimit,
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
import {
  normalizePages,
  pagePayloadLimit,
  type StoredPages,
} from './site-pages';

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
  if (isCompanyField(field)) {
    const { label, max } = companyFieldSpec[field];
    return text(value === undefined ? '' : value, max, label, true);
  }
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
const isCompanyField = (field: CmsTextField): field is CompanyField =>
  Object.hasOwn(companyFieldSpec, field);

export function companyPatch(input: unknown): Partial<CompanyData> {
  if (input === undefined) return {};
  const data = record(input);
  return Object.fromEntries(
    companyFields
      .filter((key) => Object.hasOwn(data, key))
      .map((key) => [key, fieldText(key, data[key])]),
  );
}

export const putCompany = (
  env: Env,
  site: string,
  patch: Partial<CompanyData>,
) =>
  stmt(
    env,
    `INSERT INTO portfolio_details(site_id,industry,billing,monthly_cents,annual_cents,next_renewal,contact_email,content)
    SELECT id,'Unspecified','Monthly',0,0,'','',? FROM sites WHERE id=? AND status!='deleting'
    ON CONFLICT(site_id) DO UPDATE SET content=json_patch(portfolio_details.content,excluded.content)`,
    JSON.stringify(patch),
    site,
  );

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
  'heroMedia' | 'logoMedia' | 'gallery' | 'documents' | 'pages' | 'products'
> & {
  heroMedia: string | null;
  logoMedia: string | null;
  gallery: string[];
  documents: string[];
  products: (Omit<CmsProduct, 'image'> & { image: string | null })[];
  reviews: CmsReview[];
  pages?: StoredPages;
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
    products: items(body.products ?? [], productLimit, 'Produse').map(
      (value) => {
        const row = record(value),
          discount = Number(row.discount ?? 0);
        if (
          !Number.isInteger(discount) ||
          discount < 0 ||
          discount > discountMax
        )
          return fail(
            400,
            `Discountul trebuie să fie un număr întreg între 0 și ${discountMax}.`,
          );
        const stock =
          row.stock === undefined || row.stock === null || row.stock === ''
            ? null
            : Number(row.stock);
        if (
          stock !== null &&
          (!Number.isInteger(stock) || stock < 0 || stock > stockMax)
        )
          return fail(400, 'Stocul trebuie să fie un număr întreg pozitiv.');
        return {
          name: text(row.name, 160, 'Nume produs'),
          description: text(
            row.description ?? '',
            2000,
            'Descriere produs',
            true,
          ),
          price: text(row.price, 40, 'Preț', true),
          comparePrice: text(row.comparePrice ?? '', 40, 'Preț tăiat', true),
          discount,
          // A product is visible unless it was explicitly hidden.
          active: row.active !== false,
          bestseller: row.bestseller === true,
          category: text(row.category ?? '', 80, 'Categorie', true),
          subcategory: text(row.subcategory ?? '', 80, 'Subcategorie', true),
          stock,
          unit: text(row.unit ?? '', 40, 'Unitate', true),
          badge: text(row.badge ?? '', 40, 'Etichetă', true),
          season: text(row.season ?? '', 40, 'Sezon', true),
          features: items(row.features ?? [], featuresLimit, 'Caracteristici')
            .map((feature) => text(feature, 120, 'Caracteristică', true))
            .filter(Boolean),
          imageUrl: cmsUrl(row.imageUrl ?? ''),
          image: row.image == null ? null : mediaId(row.image),
        };
      },
    ),
    reviews: items(body.reviews ?? [], reviewLimit, 'Recenzii').map(
      (value) => {
        const row = record(value),
          rating = Number(row.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5)
          return fail(400, 'Nota recenziei trebuie să fie între 1 și 5.');
        return {
          name: text(row.name, 80, 'Nume recenzie'),
          rating,
          location: text(row.location ?? '', 80, 'Localitate', true),
          text: text(row.text, 1500, 'Text recenzie', true),
          date: text(row.date ?? '', 10, 'Data', true),
        };
      },
    ),
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
        ...(data.products ?? []).map((product) => product.image),
        ...(data.pages ?? []).flatMap((page) =>
          page.fields.map((field) => field.media),
        ),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  // D1 permits at most 100 bound parameters per statement.
  const rows = (
    await Promise.all(
      Array.from({ length: Math.ceil(ids.length / 90) }, (_, index) => {
        const batch = ids.slice(index * 90, (index + 1) * 90);
        return all<{
          id: string;
          name: string;
          object_key: string;
          content_type: string;
        }>(
          env,
          `SELECT id,name,object_key,content_type FROM media WHERE site_id=? AND ready=1 AND id IN (${batch.map(() => '?').join(',')})`,
          site,
          ...batch,
        );
      }),
    )
  ).flat();
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
    products: (data.products ?? []).map((product) => {
      const file = product.image ? find(product.image, 'image') : null;
      return {
        ...product,
        name: product.name ?? '',
        description: product.description ?? '',
        price: product.price ?? '',
        comparePrice: product.comparePrice ?? '',
        discount: product.discount ?? 0,
        bestseller: product.bestseller === true,
        active: product.active !== false,
        category: product.category ?? '',
        subcategory: product.subcategory ?? '',
        stock: product.stock ?? null,
        unit: product.unit ?? '',
        badge: product.badge ?? '',
        season: product.season ?? '',
        features: product.features ?? [],
        imageUrl: product.imageUrl ?? '',
        image: file,
      };
    }),
    reviews: data.reviews ?? [],
    ...(data.pages
      ? {
          pages: data.pages.map((page) => ({
            ...page,
            fields: page.fields.map(({ media, ...field }) => {
              const file = media ? find(media, 'image') : null;
              return file ? { ...field, media: file } : field;
            }),
          })),
        }
      : {}),
  };
}
const current = (env: Env, id: string) =>
  stmt(
    env,
    'SELECT content FROM portfolio_details WHERE site_id=?',
    id,
  ).first<string>('content');
export async function readCompany(
  env: Env,
  site: string,
): Promise<CompanyData> {
  const content = JSON.parse(
    (await current(env, site)) ?? '{}',
  ) as Partial<CompanyData>;
  return Object.fromEntries(
    companyFields.map((key) => [key, content[key] ?? '']),
  ) as CompanyData;
}
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
  const body = await json(c, pagePayloadLimit + 128 * 1024);
  const previous = await current(c.env, site);
  const conflict = () =>
    fail(
      409,
      'Conținutul a fost schimbat în altă parte. Reîncarcă editorul înainte să publici.',
    );
  if (body.revision !== (await hash(previous ?? ''))) return conflict();
  const input = record(body.content);
  const old = JSON.parse(previous ?? '{}') as Partial<Stored>;
  // Older editor clients did not send these fields. An explicit empty string still clears a value.
  for (const key of companyFields)
    if (!Object.hasOwn(input, key) && old[key] !== undefined)
      input[key] = old[key];
  const next = JSON.stringify({
    ...normalizeInput(input),
    // Only the master editor manages page inventory; other editors preserve it.
    pages:
      c.get('user').role === 'super_admin' && Object.hasOwn(input, 'pages')
        ? normalizePages(input.pages)
        : old.pages,
  });
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
