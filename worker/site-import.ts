import {
  cmsTextFields,
  companyFieldSpec,
  discountMax,
  featuresLimit,
  galleryLimit,
  stockMax,
  productLimit,
  reviewLimit,
  servicesLimit,
  hoursLimit,
  type SiteImport,
  type CmsTextField,
} from '../shared/site-content';
import { absolute, discoveredColor, discovery, external } from './branding';
import { fail, rate, type Ctx } from './core';
import { fieldText } from './site-content';
import { normalizePages, pagePayloadLimit } from './site-pages';
import type { ContentPage, PageField } from '../shared/site-pages';

const clean = (value: unknown, limit = 1200) =>
  typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const textLimit = (key: CmsTextField) =>
  key === 'siteName' ? 100 : key === 'aboutText' ? 3000 : 1200;
const urls = new Set<CmsTextField>([
  'logoUrl',
  'heroImageUrl',
  'mapsUrl',
  'bookingUrl',
  'facebook',
  'instagram',
]);
const colors = new Set<CmsTextField>([
  'primaryColor',
  'secondaryColor',
  'accentColor',
]);
function normalize(
  raw: Record<string, unknown>,
  base: string,
  source: SiteImport['source'],
): SiteImport {
  const fields: SiteImport['fields'] = {};
  for (const key of cmsTextFields) {
    if (Object.hasOwn(companyFieldSpec, key)) continue;
    const value = urls.has(key)
      ? absolute(raw[key], base)
      : colors.has(key)
        ? discoveredColor(raw[key])
        : clean(raw[key], textLimit(key));
    if (!value || (urls.has(key) && value.length > 2048)) continue;
    try {
      fields[key] = fieldText(key, value);
    } catch {
      /* Invalid source field; leave it out. */
    }
  }
  // Some manifests use the public `gallery` shape rather than legacy `images`.
  const images = [
    ...new Set(
      [array(raw.images), array(raw.gallery)].flatMap((list) =>
        list.slice(0, galleryLimit * 2).flatMap((value) => {
          const item = typeof value === 'string' ? value : object(value).url;
          const url = absolute(item, base);
          return url &&
            url.length <= 2048 &&
            url !== fields.logoUrl &&
            url !== fields.heroImageUrl
            ? [url]
            : [];
        }),
      ),
    ),
  ].slice(0, galleryLimit);
  const scalar = (value: unknown) =>
    clean(
      typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : value,
      80,
    );
  const services = array(raw.services)
    .slice(0, servicesLimit)
    .map(object)
    .flatMap((row) => {
      const name = clean(row.name, 100);
      return name
        ? [
            {
              name,
              description: clean(row.description, 600),
              price: scalar(row.price),
              duration: scalar(row.duration),
            },
          ]
        : [];
    });
  const hours = array(raw.hours)
    .slice(0, hoursLimit)
    .map(object)
    .flatMap((row) => {
      const day = clean(row.day, 80),
        time = clean(row.time, 120);
      return day && time ? [{ day, time }] : [];
    });
  // Shop rows come from the manifest, or from Product JSON-LD on the page.
  const products = [...array(raw.products), ...array(raw.jsonLdProducts)]
    .slice(0, productLimit)
    .map(object)
    .flatMap((row) => {
      const name = clean(row.name, 160);
      if (!name) return [];
      const discount = Number(row.discount ?? 0);
      const stock = row.stock === undefined ? null : Number(row.stock);
      const features = Array.isArray(row.features)
        ? row.features
            .slice(0, featuresLimit)
            .flatMap((feature) => clean(feature, 120) || [])
        : typeof row.features === 'string'
          ? row.features
              .split('|')
              .slice(0, featuresLimit)
              .flatMap((feature) => feature.trim() || [])
          : [];
      return [
        {
          name,
          description: clean(row.description, 2000),
          price: scalar(row.price),
          comparePrice: scalar(row.comparePrice),
          discount:
            Number.isInteger(discount) && discount >= 0 && discount <= discountMax
              ? discount
              : 0,
          bestseller: row.bestseller === true,
          active: row.active !== false,
          category: clean(row.category, 80),
          subcategory: clean(row.subcategory, 80),
          stock:
            stock !== null && Number.isInteger(stock) && stock >= 0
              ? Math.min(stock, stockMax)
              : null,
          unit: clean(row.unit, 40),
          badge: clean(row.badge, 40),
          season: clean(row.season, 40),
          features,
          imageUrl: absolute(row.imageUrl, base) ?? '',
          image: null,
        },
      ];
    });
  // Local reviews: an array in the manifest, or Review JSON-LD on the page.
  const reviews = [...array(raw.reviews)]
    .slice(0, reviewLimit)
    .map(object)
    .flatMap((row) => {
      const name = clean(row.name ?? row.author, 80),
        rating = Number(row.rating);
      if (!name || !Number.isInteger(rating) || rating < 1 || rating > 5)
        return [];
      return [
        {
          name,
          rating,
          location: clean(row.location, 80),
          text: clean(row.text ?? row.body, 1500),
          date: clean(row.date, 10),
        },
      ];
    });
  return { source, fields, images, services, hours, products, reviews };
}

async function readHtml(bytes: Uint8Array) {
  const raw: Record<string, unknown> = {};
  const basic: Record<string, unknown> = {};
  const explicit: string[] = [],
    gallery: string[] = [],
    jsonLd: Record<string, unknown>[] = [],
    jsonLdReviews: Record<string, unknown>[] = [];
  // Visible copy, so a site without CMS markup still lands in the page editor.
  // Only short text nodes are kept and everything is re-cleaned by normalize.
  const copy: { label: string; value: string }[] = [];
  const remember = (label: string, value: string | null | undefined) => {
    const text = (value ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 3 || text.length > 600) return;
    if (copy.some((row) => row.value === text)) return;
    if (copy.length < 120) copy.push({ label, value: text });
  };
  const capture = (
    selector: string,
    getKey: (el: Element) => string | null,
    target = raw,
  ) => {
    let field: string | null = null,
      value = '';
    return {
      selector,
      handler: {
        element(el: Element) {
          const key = getKey(el);
          if (!key || field || target[key]) return;
          field = key;
          value = '';
          el.onEndTag(() => {
            if (value.trim()) target[key] = value;
            field = null;
          });
        },
        text(chunk: Text) {
          if (field)
            value += chunk.text.slice(0, Math.max(0, 4000 - value.length));
        },
      },
    };
  };
  const legacy: Record<string, CmsTextField> = {
    titlu: 'heroTitle',
    heroTitle: 'heroTitle',
    subtitlu: 'heroSubtitle',
    subtitle: 'heroSubtitle',
    anunt: 'announcement',
    announcement: 'announcement',
    telefon: 'phone',
    phone: 'phone',
    email: 'email',
    adresa: 'address',
    address: 'address',
  };
  const copyOf = (label: string) => {
    let value = '';
    return {
      element(el: Element) {
        value = '';
        el.onEndTag(() => remember(label, value));
      },
      text(chunk: { text: string }) {
        value += chunk.text;
      },
    };
  };
  const rewriter = new HTMLRewriter();
  for (const { selector, handler } of [
    capture('[data-vllora-field]', (el) => {
      const value = el.getAttribute('data-vllora-field');
      return cmsTextFields.includes(value as CmsTextField) ? value : null;
    }),
    capture('[data-cms]', (el) =>
      Object.hasOwn(legacy, el.getAttribute('data-cms') || '')
        ? legacy[el.getAttribute('data-cms')!]
        : null,
    ),
    capture('h1', () => 'heroTitle', basic),
    capture('title', () => 'siteName', basic),
  ])
    rewriter.on(selector, handler);
  rewriter
    .on('meta', {
      element(el) {
        const property = el.getAttribute('property') || el.getAttribute('name');
        const value = el.getAttribute('content');
        if (!value) return;
        if (property === 'og:site_name') basic.siteName = value;
        if (property === 'og:image' && !basic.heroImageUrl)
          basic.heroImageUrl = value;
        if (property === 'theme-color') basic.primaryColor = value;
        if (property === 'color-scheme' && /^(dark|light)$/.test(value))
          basic.siteScheme = value;
      },
    })
    .on('img', {
      element(el) {
        const src = el.getAttribute('data-src') || el.getAttribute('src');
        if (!src) return;
        if (el.hasAttribute('data-vllora-hero-image')) raw.heroImageUrl ||= src;
        else if (
          el.hasAttribute('data-vllora-logo') ||
          el.hasAttribute('data-brand-logo')
        )
          raw.logoUrl ||= src;
      },
    })
    .on(
      '[data-vllora-list="images"] img, [data-vllora-gallery] img, #gallery img, #galerie img',
      {
        element(el) {
          const src = el.getAttribute('data-src') || el.getAttribute('src');
          if (src && gallery.length < galleryLimit * 2) gallery.push(src);
        },
      },
    )
    .on('img[data-vllora-gallery-image]', {
      element(el) {
        const src = el.getAttribute('data-src') || el.getAttribute('src');
        if (src && explicit.length < galleryLimit * 2) explicit.push(src);
      },
    })
    // Independent buffer per element: the capture handlers above keep their own
    // state, so nothing here can swallow a title.
    // h1 is captured above into heroTitle; here only the remaining headings.
    .on('h2, h3, h4', copyOf('Titlu'))
    .on('p:not([data-cms]), li, blockquote', copyOf('Text'))
    .on('a[href], button', copyOf('Buton'))
    .on('script[type="application/ld+json"]', {
      text(t) {
        if (jsonLd.length >= productLimit) return;
        for (const entry of ldProducts(t.text)) {
          if (entry.kind === 'review') {
            if (jsonLdReviews.length < reviewLimit) jsonLdReviews.push(entry);
            continue;
          }
          if (jsonLd.length >= productLimit) break;
          jsonLd.push(entry);
        }
      },
    })
    .on('a[href]', {
      element(el) {
        const href = el.getAttribute('href') || '';
        const key = el.getAttribute('data-vllora-link');
        if (/^tel:\+?[0-9 ()-]{5,30}$/i.test(href))
          basic.phone ||= href.slice(4);
        if (/^mailto:[^\s?]+@[^\s?]+$/i.test(href))
          basic.email ||= href.slice(7);
        const wa = href.match(
          /^https:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{7,18})(?:[/?&#]|$)/i,
        );
        if (wa) basic.whatsapp ||= wa[1];
        if (key && urls.has(key as CmsTextField)) raw[key] ||= href;
      },
    });
  await rewriter
    .transform(
      new Response(bytes.slice().buffer, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    )
    .arrayBuffer();
  if (jsonLd.length) raw.jsonLdProducts = jsonLd;
  if (jsonLdReviews.length) raw.reviews = jsonLdReviews;
  return {
    basic,
    raw,
    images: explicit.length ? explicit : gallery,
    copy: copy.slice(0, 40),
  };
}

// Turns detected copy into CMS page fields. Ids stay stable for the same label so
// a second import updates the same fields instead of duplicating them.
export function pageFromCopy(
  path: string,
  title: string,
  copy: { label: string; value: string }[],
): ContentPage | null {
  const fields: PageField[] = [],
    used = new Set<string>();
  for (const row of copy.slice(0, 40)) {
    const base = (row.label === 'Titlu' ? 'titlu' : row.label === 'Buton' ? 'buton' : 'text')
      .toLowerCase();
    let index = 1,
      id = `${base}-${index}`;
    while (used.has(id)) id = `${base}-${++index}`;
    used.add(id);
    fields.push({
      id,
      label: `${row.label} ${index}`.replace(/\s+/, ' '),
      kind: 'text',
      value: row.value,
    });
  }
  return fields.length ? { path, title, fields } : null;
}

// Product / ItemList JSON-LD is the most common machine-readable shop markup.
// Only a handful of fields are read, and every value is re-cleaned by normalize.
function ldProducts(text: string): Record<string, unknown>[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const rows: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 4 || rows.length >= productLimit) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    const type = node['@type'];
    const types = Array.isArray(type) ? type.map(String) : [String(type ?? '')];
    if (types.includes('Product')) {
      const offer = [node.offers]
        .flat()
        .map((value) => (value && typeof value === 'object' ? value : null))
        .find(Boolean) as Record<string, unknown> | null;
      const price = offer?.price ?? offer?.lowPrice ?? node.price;
      const image = Array.isArray(node.image) ? node.image[0] : node.image;
      rows.push({
        name: node.name,
        description: node.description,
        price,
        imageUrl:
          typeof image === 'string'
            ? image
            : image && typeof image === 'object'
              ? (image as Record<string, unknown>).url
              : undefined,
      });
      return;
    }
    if (types.includes('Review')) {
      const author =
        node.author && typeof node.author === 'object'
          ? (node.author as Record<string, unknown>).name
          : node.author;
      const rating = node.reviewRating;
      rows.push({
        kind: 'review',
        name: author,
        rating:
          rating && typeof rating === 'object'
            ? (rating as Record<string, unknown>).ratingValue
            : undefined,
        text: node.reviewBody ?? node.description,
        date: node.datePublished,
      });
      return;
    }
    if (types.includes('ItemList')) {
      visit(node.itemListElement, depth + 1);
      return;
    }
    for (const key of ['item', 'itemListElement']) if (node[key]) visit(node[key], depth + 1);
  };
  visit(data, 0);
  return rows;
}

export async function inspectSite(
  c: Ctx,
  site: { id: string; domain: string },
) {
  if (!(await rate(c.env, `site-import:${site.id}`, 6, 60_000)))
    return fail(
      429,
      'Prea multe încercări de import. Încearcă din nou peste un minut.',
    );
  const origin = `https://${site.domain}`;
  const hosts = new Set([
    site.domain,
    site.domain.startsWith('www.')
      ? site.domain.slice(4)
      : `www.${site.domain}`,
  ]);
  // Fixed paths, no client-supplied target, no cookies and no cross-site redirects.
  const manifestRequest = external(
    `${origin}/.well-known/vllora-content.json`,
    pagePayloadLimit + 64 * 1024,
    'application/json',
    hosts,
  )
    .then((file) => {
      const parsed = object(JSON.parse(new TextDecoder().decode(file.bytes)));
      if (parsed.version !== 1 && parsed.version !== 2) return null;
      const base = new URL('/', file.url).href;
      const result = normalize(object(parsed.content), base, 'manifest');
      // Import never accepts media IDs from a public website.
      if (parsed.version === 2)
        result.pages = normalizePages(parsed.pages, base).map(
          (page): ContentPage => ({
            ...page,
            fields: page.fields.map(({ media: _media, ...field }) => field),
          }),
        );
      return result;
    })
    .catch(() => null);
  if (c.req.query('pages') === '1') {
    const manifest = await manifestRequest;
    if (manifest?.pages)
      return c.json({ ...normalize({}, origin, 'manifest'), pages: manifest.pages });
    // No CMS manifest: propose the home page copy so the editor is not empty.
    const home = await external(origin, 512 * 1024, 'text/html', hosts)
      .then((file) => readHtml(file.bytes))
      .catch(() => null);
    const page = home ? pageFromCopy('/', 'Prima pagină', home.copy) : null;
    return c.json({
      ...normalize({}, origin, 'manifest'),
      pages: page ? [page] : [],
    });
  }
  const [manifest, html, brand] = await Promise.all([
    manifestRequest,
    external(origin, 512 * 1024, 'text/html', hosts)
      .then(async (file) => ({
        ...(await readHtml(file.bytes)),
        url: file.url,
      }))
      .catch(() => null),
    discovery(c.env, site.domain).catch(() => null),
  ]);
  const fallback = normalize(
    {
      ...html?.basic,
      ...(brand?.name ? { siteName: brand.name } : {}),
      ...(brand?.logo ? { logoUrl: brand.logo } : {}),
      ...(brand?.primary ? { primaryColor: brand.primary } : {}),
      secondaryColor: brand?.secondary,
      accentColor: brand?.accent,
      siteScheme: brand?.scheme || html?.basic.siteScheme,
      ...html?.raw,
      images: html?.images,
    },
    html?.url || origin,
    'html',
  );
  const result: SiteImport = manifest
    ? {
        ...manifest,
        fields: { ...fallback.fields, ...manifest.fields },
        images: manifest.images.length ? manifest.images : fallback.images,
      }
    : fallback;
  if (
    !Object.keys(result.fields).length &&
    !result.images.length &&
    !result.hours.length &&
    !result.services.length &&
    !result.pages?.length
  )
    return fail(
      422,
      'Nu am găsit date publice de importat. Verifică adresa site-ului sau adaugă manifestul CMS.',
    );
  return c.json(result);
}
