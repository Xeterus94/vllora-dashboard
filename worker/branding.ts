import { dev, fail, readBytes, validHost, type Env, type Site } from './core';
import { saveImage } from './media';

export const color = (value: unknown): string | undefined =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
export const discoveredColor = (value: unknown) =>
  color(value) ||
  (typeof value === 'string' && /^#[\da-f]{3}$/i.test(value)
    ? '#' + [...value.slice(1)].map((c) => c + c).join('')
    : undefined);
interface Brand {
  name?: string;
  logo?: string;
  primary?: string;
  secondary?: string;
  accent?: string;
  scheme?: 'light' | 'dark';
  source: 'well-known' | 'html' | 'default';
}
const normalizeName = (v: unknown) =>
  typeof v === 'string'
    ? v.replace(/\s+/g, ' ').trim().slice(0, 100) || undefined
    : undefined;
export const absolute = (v: unknown, base: string) => {
  try {
    return typeof v === 'string' && v.trim()
      ? safeUrl(new URL(v, base).href)?.href
      : undefined;
  } catch {
    return undefined;
  }
};
function safeUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      validHost(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}
export async function external(
  input: string,
  limit: number,
  accept: string,
  hosts?: Set<string>,
) {
  let url = safeUrl(input);
  const signal = AbortSignal.timeout(5500);
  for (let hop = 0; hop <= 2 && url; hop++) {
    if (hosts && !hosts.has(url.hostname)) break;
    const response = await fetch(url.href, {
      redirect: 'manual',
      signal,
      headers: { Accept: accept },
    });
    if (response.status >= 300 && response.status < 400) {
      const link = response.headers.get('Location');
      await response.body?.cancel();
      url = link ? safeUrl(new URL(link, url).href) : null;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      break;
    }
    return { bytes: await readBytes(response, limit), url: url.href };
  }
  throw new Error('External source unavailable');
}
function parseLinkedLogo(input: unknown, depth = 0): string | undefined {
  if (!input || typeof input !== 'object' || depth > 5) return;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = parseLinkedLogo(item, depth + 1);
      if (found) return found;
    }
    return;
  }
  const record = input as Record<string, unknown>,
    logo = record.logo;
  if (typeof logo === 'string') return logo;
  if (logo && typeof logo === 'object') {
    const v = logo as Record<string, unknown>;
    if (typeof v.url === 'string') return v.url;
    if (typeof v.contentUrl === 'string') return v.contentUrl;
  }
  return parseLinkedLogo(record['@graph'], depth + 1);
}
export async function discovery(
  env: Env,
  domain: string,
  force = false,
): Promise<Brand> {
  // Avoid contacting real customer sites from dev/test fixtures.
  if (dev(env)) return { source: 'default' };
  const key = `brand:v1:${domain}`;
  if (!force) {
    try {
      const cached = await env.BRAND_CACHE?.get<Brand>(key, 'json');
      if (cached) return cached;
    } catch {
      /* optional cache */
    }
  }
  const base = `https://${domain}`,
    alternate = domain.startsWith('www.') ? domain.slice(4) : `www.${domain}`,
    hosts = new Set([domain, alternate]);
  let brand: Brand = { source: 'default' };
  try {
    const file = await external(
      `${base}/.well-known/vllora-brand.json`,
      32768,
      'application/json',
      hosts,
    );
    const b = JSON.parse(new TextDecoder().decode(file.bytes));
    brand = {
      name: normalizeName(b.name),
      logo: absolute(b.logo, file.url),
      primary: discoveredColor(b.colors?.primary),
      secondary: discoveredColor(b.colors?.secondary),
      accent: discoveredColor(b.colors?.accent),
      scheme:
        b.scheme === 'dark' || b.scheme === 'light' ? b.scheme : undefined,
      source: 'well-known',
    };
    if (
      !brand.logo &&
      !brand.name &&
      !brand.primary &&
      !brand.secondary &&
      !brand.accent &&
      !brand.scheme
    )
      throw new Error();
  } catch {
    try {
      const file = await external(base, 512 * 1024, 'text/html', hosts),
        html = new TextDecoder().decode(file.bytes);
      let title = '',
        og = '',
        appName = '',
        markedLogo = '',
        ld = '',
        icon = '',
        theme = '',
        styles = '',
        inTitle = false;
      const stylesheets = new Set<string>();
      const rewrite = new HTMLRewriter()
        .on('title', {
          element(e) {
            inTitle = true;
            e.onEndTag(() => {
              inTitle = false;
            });
          },
          text(t) {
            if (inTitle) title += t.text;
          },
        })
        .on('meta', {
          element(e) {
            if (e.getAttribute('property') === 'og:site_name')
              og = e.getAttribute('content') || '';
            if (e.getAttribute('name') === 'application-name')
              appName = e.getAttribute('content') || '';
            if (e.getAttribute('name') === 'theme-color' && !theme)
              theme = e.getAttribute('content') || '';
          },
        })
        .on('link', {
          element(e) {
            const rel = e.getAttribute('rel')?.toLowerCase().split(/\s+/) ?? [];
            const href = absolute(e.getAttribute('href'), file.url);
            if (!href) return;
            if (
              rel.includes('apple-touch-icon') ||
              (!icon && rel.includes('icon') && !/\.ico(?:[?#]|$)/i.test(href))
            )
              icon = href;
            if (
              rel.includes('stylesheet') &&
              stylesheets.size < 2 &&
              hosts.has(new URL(href).hostname)
            )
              stylesheets.add(href);
          },
        })
        .on('img', {
          element(e) {
            if (markedLogo) return;
            const classes = (e.getAttribute('class') || '').split(/\s+/);
            const label = e.getAttribute('alt') || '';
            if (
              e.hasAttribute('data-brand-logo') ||
              /^logo(?:\s|$)/i.test(label) ||
              [e.getAttribute('id'), ...classes].some(
                (value) => value && /^(?:brand-|site-)?logo$/i.test(value),
              )
            )
              markedLogo = absolute(e.getAttribute('src'), file.url) || '';
          },
        })
        .on('script[type="application/ld+json"]', {
          text(t) {
            if (ld.length < 16000) ld += t.text;
            if (t.lastInTextNode) {
              try {
                const found = parseLinkedLogo(JSON.parse(ld));
                if (found) linked = found;
              } catch {
                /* malformed JSON-LD */
              }
              ld = '';
            }
          },
        })
        .on('style', {
          text(t) {
            if (styles.length < 64000) styles += t.text;
          },
        })
        .on('[style]', {
          element(e) {
            if (styles.length < 64000)
              styles += ';' + (e.getAttribute('style') || '');
          },
        });
      let linked = '';
      await rewrite
        .transform(
          new Response(html, {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        )
        .arrayBuffer();
      const linkedCSS = await Promise.all(
        [...stylesheets].map(async (url) => {
          try {
            const result = await external(url, 128 * 1024, 'text/css', hosts);
            return new TextDecoder().decode(result.bytes);
          } catch {
            return '';
          }
        }),
      );
      const palette = [styles, ...linkedCSS];
      const css = (pattern: RegExp) => {
        for (const source of palette) {
          const found = discoveredColor(source.match(pattern)?.[1]);
          if (found) return found;
        }
      };
      const counts = new Map<string, number>();
      for (const token of styles.match(/#[a-f0-9]{3}(?:[a-f0-9]{3})?\b/gi) ||
        []) {
        const c = discoveredColor(token);
        if (c && !['#ffffff', '#000000'].includes(c))
          counts.set(c, (counts.get(c) || 0) + 1);
      }
      const frequent = [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
      brand = {
        name: normalizeName(og || appName || title),
        logo: absolute(linked, file.url) || markedLogo || icon || undefined,
        primary:
          discoveredColor(theme) ||
          css(
            /(?:^|[;{\s])--(?:brand|(?:brand-|color-)?primary):\s*(#[0-9a-f]+)\b/i,
          ) ||
          frequent[0],
        secondary:
          css(/(?:^|[;{\s])--(?:brand-|color-)?secondary:\s*(#[0-9a-f]+)\b/i) ||
          frequent[1],
        accent: css(
          /(?:^|[;{\s])--(?:brand-|color-)?accent:\s*(#[0-9a-f]+)\b/i,
        ),
        source: 'html',
      };
    } catch {
      brand = { source: 'default' };
    }
  }
  try {
    await env.BRAND_CACHE?.put(key, JSON.stringify(brand), {
      expirationTtl: brand.source === 'default' ? 300 : 86400,
    });
  } catch {
    /* optional cache */
  }
  return brand;
}
export async function importImage(
  env: Env,
  site: string,
  input: unknown,
  limit?: number,
) {
  if (typeof input !== 'string' || input.length > 2048 || !safeUrl(input))
    return fail(400, 'Folosește un URL HTTPS public.');
  const url = new URL(input);
  const file = await external(input, limit ?? 8 * 1024 * 1024, 'image/*').catch(
    (error) => {
      if (error?.status === 413) throw error;
      return fail(422, 'Imaginea nu a putut fi descărcată.');
    },
  );
  return saveImage(
    env,
    site,
    url.pathname.split('/').pop() || 'Imagine importată',
    file.bytes,
    limit,
  );
}
export async function applyBrand(env: Env, site: Site, force = false) {
  if (site.brand_source === 'manual' && !force)
    return { skipped: true, brand: null, logo: null };
  const brand = await discovery(env, site.domain, force);
  if (brand.source === 'default')
    return { skipped: false, brand: null, logo: null };
  const logo = brand.logo
    ? await importImage(env, site.id, brand.logo, 200 * 1024).catch(() => null)
    : null;
  return { skipped: false, brand, logo };
}
