import {
  cmsTextFields,
  galleryLimit,
  servicesLimit,
  hoursLimit,
  type SiteImport,
  type CmsTextField,
} from '../shared/site-content';
import { absolute, discoveredColor, discovery, external } from './branding';
import { fail, rate, type Ctx } from './core';
import { fieldText } from './site-content';

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
  return { source, fields, images, services, hours };
}

async function readHtml(bytes: Uint8Array) {
  const raw: Record<string, unknown> = {};
  const basic: Record<string, unknown> = {};
  const explicit: string[] = [],
    gallery: string[] = [];
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
  return { basic, raw, images: explicit.length ? explicit : gallery };
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
  const [manifest, html, brand] = await Promise.all([
    external(
      `${origin}/.well-known/vllora-content.json`,
      64 * 1024,
      'application/json',
      hosts,
    )
      .then((file) => {
        const parsed = object(JSON.parse(new TextDecoder().decode(file.bytes)));
        return parsed.version === 1
          ? normalize(
              object(parsed.content),
              new URL('/', file.url).href,
              'manifest',
            )
          : null;
      })
      .catch(() => null),
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
    !result.services.length
  )
    return fail(
      422,
      'Nu am găsit date publice de importat. Verifică adresa site-ului sau adaugă manifestul CMS.',
    );
  return c.json(result);
}
