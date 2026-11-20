import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

export const masterPassword = 'MasterPass!2026';
export const clientPassword = 'ClientPass!2026';
export const bootstrapToken = 'local-fixture-bootstrap-2026';
export const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/zCwAAAAASUVORK5CYII=',
  'base64',
);
export async function runtime({ bindings = {}, outbound } = {}) {
  const received = [];
  let rejectEmail = false;
  const { outputFiles } = await build({
    entryPoints: ['worker/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: outputFiles[0].text,
      compatibilityDate: '2026-01-01',
      host: '127.0.0.1',
      port: 0,
      d1Databases: { DB: 'test-backoffice' },
      r2Buckets: { MEDIA: 'test-media' },
      kvNamespaces: { BRAND_CACHE: 'test-branding' },
      bindings: {
        ENVIRONMENT: 'development',
        APP_ORIGIN: 'http://localhost',
        BOOTSTRAP_TOKEN: bootstrapToken,
        TRACK_SALT: 'local-test-visitor-salt',
        RESEND_API_KEY: 'mock',
        EMAIL_FROM: 'Test <noreply@example.com>',
        DEV_EMAIL_API_URL: 'https://mock-email.example.com/emails',
        ...bindings,
      },
      outboundService:
        outbound ??
        (async (request) => {
          if (new URL(request.url).hostname !== 'mock-email.example.com')
            return new Response(null, { status: 502 });
          received.push(await request.json());
          return new Response('{}', {
            status: rejectEmail ? 500 : 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }),
      serviceBindings: {
        ASSETS: async (request) => {
          const pathname = new URL(request.url).pathname;
          const root = resolve('dist'),
            path = resolve(
              root,
              `.` + (pathname === '/' ? '/index.html' : pathname),
            );
          if (!path.startsWith(root + '/'))
            return new Response(null, { status: 404 });
          try {
            if (!(await stat(path)).isFile())
              return new Response(null, { status: 404 });
            const type = path.endsWith('.css')
              ? 'text/css'
              : path.endsWith('.js')
                ? 'application/javascript'
                : 'text/html';
            return new Response(
              request.method === 'HEAD' ? null : await readFile(path),
              { headers: { 'Content-Type': type } },
            );
          } catch {
            return new Response(null, { status: 404 });
          }
        },
      },
    }),
  );
  try {
    const port = (await mf.ready).port,
      db = await mf.getD1Database('DB');
    const schema = await readFile('worker/schema.sql', 'utf8');
    await db.batch(
      schema
        .trim()
        .split(/;\n(?=(?:CREATE|ALTER|INSERT))/)
        .map((sql) => db.prepare(sql)),
    );
    return {
      mf,
      db,
      port,
      received,
      rejectEmail: (value) => {
        rejectEmail = value;
      },
      close: () => mf.dispose(),
    };
  } catch (e) {
    await mf.dispose();
    throw e;
  }
}
export async function call(
  mf,
  base,
  path,
  { method = 'GET', cookie, headers = {}, body } = {},
) {
  const url = new URL(path, base),
    form = body instanceof FormData;
  const multipart = form ? new Response(body) : null;
  const response = await mf.dispatchFetch(url.href, {
    method,
    redirect: 'manual',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined
        ? {}
        : {
            'Content-Type':
              multipart?.headers.get('content-type') ?? 'application/json',
          }),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : multipart
          ? Buffer.from(await multipart.arrayBuffer())
          : JSON.stringify(body),
  });
  const contents = await response.text(),
    json = response.headers.get('content-type')?.includes('application/json')
      ? JSON.parse(contents)
      : null;
  return {
    status: response.status,
    headers: response.headers,
    contents,
    json,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
