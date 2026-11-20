import { SaxesParser } from 'saxes';
import {
  all,
  audit,
  fail,
  publicMediaUrl,
  random,
  readBytes,
  required,
  stmt,
  type Ctx,
  type Env,
} from './core';

export const MAX_FILE = 8 * 1024 * 1024,
  QUOTA = 200 * 1024 * 1024;
export const KEY =
  /^sites\/site_[0-9a-f]{24}\/m_[0-9a-f]{24}\.(png|jpg|webp|gif|svg|avif|ico)$/;
interface MediaRow {
  id: string;
  site_id: string;
  object_key: string;
  name: string;
  content_type: string;
  size: number;
  width: number | null;
  height: number | null;
  created_at: number;
}
interface Image {
  ext: string;
  type: string;
  width?: number;
  height?: number;
}
const svgElements = new Set(
  'svg g defs symbol use path rect circle ellipse line polyline polygon text tspan title desc linearGradient radialGradient stop clipPath mask pattern'.split(
    ' ',
  ),
);
const svgAttributes = new Set(
  'id class version viewBox preserveAspectRatio x y x1 y1 x2 y2 width height rx ry cx cy r fx fy fr d points pathLength dx dy rotate textLength lengthAdjust font-family font-size font-weight font-style text-anchor dominant-baseline alignment-baseline fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset opacity transform gradientTransform gradientUnits spreadMethod offset stop-color stop-opacity clip-path clip-rule clipPathUnits mask maskUnits maskContentUnits patternUnits patternContentUnits patternTransform color display visibility overflow href'.split(
    ' ',
  ),
);
function safeSvg(bytes: Uint8Array): Image | null {
  // Reject active SVG content, including on direct public R2/CDN delivery where Worker headers do not apply.
  try {
    const xml = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    }).decode(bytes);
    const parser = new SaxesParser({ xmlns: true });
    let root = false;
    let level = 0;
    let count = 0;
    const reject = () => {
      throw new Error('Unsupported SVG');
    };
    parser.on('doctype', reject);
    parser.on('processinginstruction', reject);
    parser.on('error', reject);
    parser.on('opentag', (tag) => {
      if (
        ++count > 20000 ||
        ++level > 100 ||
        tag.uri !== 'http://www.w3.org/2000/svg' ||
        !svgElements.has(tag.local)
      )
        return reject();
      if (!root) {
        if (tag.local !== 'svg') return reject();
        root = true;
      }
      for (const attr of Object.values(tag.attributes)) {
        if (attr.uri === 'http://www.w3.org/2000/xmlns/') continue;
        if (
          (attr.uri &&
            !(
              attr.uri === 'http://www.w3.org/1999/xlink' &&
              attr.local === 'href'
            )) ||
          !svgAttributes.has(attr.local)
        )
          return reject();
        if (attr.local === 'href' && !/^#[\w.:-]+$/.test(attr.value))
          return reject();
        if (
          /url/i.test(attr.value) &&
          !/^url\(\s*#[\w.:-]+\s*\)$/.test(attr.value)
        )
          return reject();
        if (/[\\<>]/.test(attr.value)) return reject();
      }
    });
    parser.on('closetag', () => {
      level--;
    });
    parser.write(xml).close();
    return root ? { ext: 'svg', type: 'image/svg+xml' } : null;
  } catch {
    return null;
  }
}
export function imageType(b: Uint8Array): Image | null {
  if (b.length < 12) return null;
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength),
    ascii = (p: number, n: number) =>
      String.fromCharCode(...b.subarray(p, p + n));
  const dimensions = (
    ext: string,
    type: string,
    width: number,
    height: number,
  ) => (width > 0 && height > 0 ? { ext, type, width, height } : null);
  if (
    b.length >= 33 &&
    d.getUint32(0) === 0x89504e47 &&
    d.getUint32(4) === 0x0d0a1a0a &&
    d.getUint32(8) === 13 &&
    ascii(12, 4) === 'IHDR'
  )
    return dimensions('png', 'image/png', d.getUint32(16), d.getUint32(20));
  if (/^GIF8[79]a$/.test(ascii(0, 6)))
    return dimensions(
      'gif',
      'image/gif',
      d.getUint16(6, true),
      d.getUint16(8, true),
    );
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    for (let p = 2; p + 3 < b.length; ) {
      if (b[p++] !== 0xff) break;
      while (b[p] === 0xff) p++;
      const marker = b[p++];
      if (marker === 0xda || marker === 0xd9 || p + 2 > b.length) break;
      const size = d.getUint16(p);
      if (size < 2 || p + size > b.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker) &&
        size >= 8
      )
        return dimensions(
          'jpg',
          'image/jpeg',
          d.getUint16(p + 5),
          d.getUint16(p + 3),
        );
      p += size;
    }
    return null;
  }
  if (
    b.length >= 26 &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 4) === 'WEBP' &&
    d.getUint32(4, true) + 8 <= b.length &&
    20 + d.getUint32(16, true) <= b.length
  ) {
    const mode = ascii(12, 4),
      u24 = (p: number) => b[p] + b[p + 1] * 256 + b[p + 2] * 65536;
    if (mode === 'VP8X' && b.length >= 30)
      return dimensions('webp', 'image/webp', 1 + u24(24), 1 + u24(27));
    if (mode === 'VP8L' && b[20] === 0x2f) {
      const packed = d.getUint32(21, true);
      return dimensions(
        'webp',
        'image/webp',
        1 + (packed & 0x3fff),
        1 + ((packed >>> 14) & 0x3fff),
      );
    }
    if (
      mode === 'VP8 ' &&
      b.length >= 30 &&
      b[23] === 0x9d &&
      b[24] === 1 &&
      b[25] === 0x2a
    )
      return dimensions(
        'webp',
        'image/webp',
        d.getUint16(26, true) & 0x3fff,
        d.getUint16(28, true) & 0x3fff,
      );
    return null;
  }
  if (
    b.length >= 22 &&
    d.getUint16(0, true) === 0 &&
    d.getUint16(2, true) === 1 &&
    d.getUint16(4, true) > 0 &&
    6 + 16 * d.getUint16(4, true) <= b.length
  ) {
    const offset = d.getUint32(18, true),
      length = d.getUint32(14, true);
    if (length && offset >= 22 && offset + length <= b.length)
      return dimensions('ico', 'image/x-icon', b[6] || 256, b[7] || 256);
  }
  if (
    b.length >= 16 &&
    ascii(4, 4) === 'ftyp' &&
    d.getUint32(0) >= 16 &&
    d.getUint32(0) <= b.length
  ) {
    const avif = (p: number) => ['avif', 'avis'].includes(ascii(p, 4));
    if (avif(8)) return { ext: 'avif', type: 'image/avif' };
    for (let p = 16; p + 4 <= Math.min(d.getUint32(0), 256); p += 4)
      if (avif(p)) return { ext: 'avif', type: 'image/avif' };
  }
  if (
    b.length <= 512 * 1024 &&
    new TextDecoder().decode(b.subarray(0, 256)).trimStart().startsWith('<')
  )
    return safeSvg(b);
  return null;
}
const view = (env: Env, row: MediaRow, prefix: string) => ({
  id: row.id,
  name: row.name,
  size: row.size,
  width: row.width,
  height: row.height,
  content_type: row.content_type,
  created_at: row.created_at,
  url: publicMediaUrl(env, row.object_key, prefix),
});
export async function saveImage(
  env: Env,
  site: string,
  name: string,
  bytes: Uint8Array,
  limit = MAX_FILE,
) {
  if (!bytes.length || bytes.length > limit)
    return fail(413, 'Imaginea depășește limita admisă.');
  const image = imageType(bytes);
  if (!image) return fail(415, 'Format de imagine invalid sau SVG nesigur.');
  const id = `m_${random(12)}`,
    key = `sites/${site}/${id}.${image.ext}`,
    now = Date.now();
  const reserved = await stmt(
    env,
    `INSERT INTO media(id,site_id,object_key,name,content_type,size,width,height,created_at)
    SELECT ?,id,?,?,?,?,?,?,? FROM sites WHERE id=? AND status!='deleting'
    AND (SELECT COALESCE(SUM(size),0) FROM media WHERE site_id=?) + ? <= ?`,
    id,
    key,
    name.slice(0, 200),
    image.type,
    bytes.length,
    image.width ?? null,
    image.height ?? null,
    now,
    site,
    site,
    bytes.length,
    QUOTA,
  ).run();
  if (!reserved.meta.changes)
    return fail(413, 'Cota site-ului a fost depășită sau site-ul se șterge.');
  try {
    await env.MEDIA.put(key, bytes, {
      httpMetadata: {
        contentType: image.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
    await stmt(env, 'UPDATE media SET ready=1 WHERE id=?', id).run();
  } catch (err) {
    // Keep the reservation if cleanup itself fails so cron/site deletion can retry it.
    await env.MEDIA.delete(key);
    await stmt(env, 'DELETE FROM media WHERE id=?', id).run();
    throw err;
  }
  return {
    id,
    site_id: site,
    object_key: key,
    name: name.slice(0, 200),
    content_type: image.type,
    size: bytes.length,
    width: image.width ?? null,
    height: image.height ?? null,
    created_at: now,
  };
}
export async function listMedia(c: Ctx, site: string, prefix = '') {
  const [rows, usage] = await Promise.all([
    all<MediaRow>(
      c.env,
      'SELECT * FROM media WHERE site_id=? AND ready=1 ORDER BY created_at DESC',
      site,
    ),
    stmt(
      c.env,
      'SELECT COALESCE(SUM(size),0) AS used FROM media WHERE site_id=?',
      site,
    ).first<number>('used'),
  ]);
  return c.json({
    items: rows.map((row) => view(c.env, row, prefix)),
    used: usage ?? 0,
    quota: QUOTA,
    delivery: c.env.MEDIA_PUBLIC_BASE ? 'cdn' : 'worker',
  });
}
export async function upload(c: Ctx, site: string, prefix = '') {
  const raw = c.req.raw,
    contentType = raw.headers.get('content-type') || '';
  if (!/^multipart\/form-data\b/i.test(contentType))
    return fail(415, 'Folosește un upload multipart.');
  const data = await readBytes(raw, MAX_FILE + 65536);
  const form = await new Response(data, {
    headers: { 'Content-Type': contentType },
  })
    .formData()
    .catch(() => fail(400, 'Upload invalid.'));
  const file = form.get('file');
  if (!file || typeof file === 'string') return fail(400, 'Alege o imagine.');
  const item = await saveImage(
    c.env,
    site,
    file.name,
    new Uint8Array(await file.arrayBuffer()),
  );
  await audit(c.env, 'media_uploaded', c.get('user').id, site).run();
  return c.json({ item: view(c.env, item, prefix) }, 201);
}
export async function removeImage(c: Ctx, site: string, id: string) {
  const row = required(
    await stmt(
      c.env,
      'SELECT object_key FROM media WHERE site_id=? AND id=? AND ready=1',
      site,
      id,
    ).first<{ object_key: string }>(),
  );
  await c.env.MEDIA.delete(row.object_key);
  await c.env.DB.batch([
    stmt(c.env, 'DELETE FROM media WHERE id=? AND site_id=?', id, site),
    audit(c.env, 'media_deleted', c.get('user').id, site),
  ]);
  return c.json({ ok: true });
}
export async function serveMedia(c: Ctx, key: string) {
  if (!KEY.test(key)) return fail(404, 'Imaginea nu există.');
  const object =
    c.req.method === 'HEAD'
      ? await c.env.MEDIA.head(key)
      : await c.env.MEDIA.get(key);
  if (!object) return fail(404, 'Imaginea nu există.');
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set(
    'Content-Security-Policy',
    "sandbox; default-src 'none'; style-src 'unsafe-inline'",
  );
  if (
    c.req
      .header('If-None-Match')
      ?.split(',')
      .some((v) =>
        ['*', object.httpEtag].includes(v.trim().replace(/^W\//, '')),
      )
  )
    return new Response(null, { status: 304, headers });
  headers.set('Content-Length', String(object.size));
  return new Response('body' in object ? (object as R2ObjectBody).body : null, {
    headers,
  });
}
