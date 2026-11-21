import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import pages from '../integrations/pages-client/_worker.js';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('Worker-ul livrează master și React separat, cu CSS și JS locale', async () => {
  const [source, masterHtml, masterJs, css, portalHtml, config] =
    await Promise.all([
      read('master/index.html'),
      read('dist-portal/master/index.html'),
      read('dist-portal/master/assets/master.js'),
      read('dist-portal/master/assets/master.css'),
      read('dist-portal/index.html'),
      read('wrangler.jsonc'),
    ]);
  assert.equal(masterHtml, source);
  assert.doesNotMatch(masterHtml, /(?:src|href)="https?:/);
  assert.doesNotMatch(
    masterJs + config,
    /dashboard-master\.ionstefan0904|MASTER_DASHBOARD_URL|vllorastudio-panou-master\.pages\.dev|Authorization/,
  );
  assert.match(masterHtml, /Portfolio overview/);
  assert.match(masterJs, /\/api\/admin\/portfolio/);
  assert.match(css, /grid-template-columns/);
  assert.doesNotMatch(portalHtml, /Portfolio overview|master\/assets/);
  assert.match(portalHtml, /src="\.\/assets\//);
});

test('Master și portal folosesc aceeași siglă Vllora din build', async () => {
  const logo = await read('public/assets/vllora-logo.svg');
  assert.ok(logo.startsWith('<svg '));
  for (const prefix of ['dist-portal', 'dist-portal/master']) {
    assert.equal(await read(`${prefix}/assets/vllora-logo.svg`), logo);
  }
});

test('Generatorul CMS v2 citește valorile originalelor publice fără a rescrie paginile', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'vllora-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const subdir of ['echipa', 'admin', '.well-known'])
    await mkdir(join(root, subdir));
  const html = `<!doctype html><title>Echipă &amp; valori</title>
    <h1 class="animate"><span data-vllora-text="title" data-vllora-label="Titlu">Ani &amp; povești</span></h1>
    <img data-vllora-image="cover" src="../assets/foto.webp">
    <canvas data-vllora-number="graph.total" data-vllora-value="4.2"></canvas>`;
  await writeFile(join(root, 'index.html'), '<title>Acasă</title>');
  await writeFile(join(root, 'echipa', 'index.html'), html);
  await writeFile(join(root, 'admin', 'index.html'), '<title>Privat</title>');
  const target = join(root, '.well-known', 'vllora-content.json');
  await writeFile(
    target,
    JSON.stringify({ version: 1, content: { siteName: 'Vechi' } }),
  );
  execFileSync(process.execPath, [
    'integrations/static-cms/build-manifest.mjs',
    root,
  ]);
  assert.equal(
    await readFile(join(root, 'echipa', 'index.html'), 'utf8'),
    html,
  );
  const manifest = JSON.parse(await readFile(target, 'utf8'));
  assert.equal(manifest.version, 2);
  assert.equal(manifest.content.siteName, 'Vechi');
  assert.deepEqual(manifest.pages.map(({ path }) => path).sort(), [
    '/',
    '/echipa/',
  ]);
  assert.deepEqual(
    manifest.pages.find(({ path }) => path === '/echipa/'),
    {
      path: '/echipa/',
      title: 'Echipă & valori',
      fields: [
        { id: 'title', label: 'Titlu', kind: 'text', value: 'Ani & povești' },
        {
          id: 'cover',
          label: 'cover',
          kind: 'image',
          value: '../assets/foto.webp',
        },
        {
          id: 'graph.total',
          label: 'graph.total',
          kind: 'number',
          value: '4.2',
        },
      ],
    },
  );
});

test('adaptorul Pages păstrează site-ul normal și trimite doar /admin la Worker-ul portalului', async () => {
  const routes = JSON.parse(
    await read('integrations/pages-client/_routes.json'),
  );
  assert.deepEqual(routes.include, ['/admin', '/admin/*']);
  const observed = [];
  const env = {
    ASSETS: {
      fetch(request) {
        observed.push(['assets', request]);
        return new Response('site');
      },
    },
    VLLORA_PORTAL: {
      fetch(request) {
        observed.push(['portal', request]);
        return new Response('portal');
      },
    },
  };
  const host = 'https://example-client.pages.dev';
  for (const path of ['/', '/administrator', '/assets/app.js']) {
    const request = new Request(`${host}${path}`);
    assert.equal(await (await pages.fetch(request, env)).text(), 'site');
    assert.deepEqual(observed.pop(), ['assets', request]);
  }
  for (const path of [
    '/admin',
    '/admin/',
    '/admin/api/auth/login?from=client',
  ]) {
    const request = new Request(`${host}${path}`, {
      method: 'POST',
      body: '{}',
    });
    assert.equal(await (await pages.fetch(request, env)).text(), 'portal');
    assert.deepEqual(observed.pop(), ['portal', request]);
  }
  assert.equal(
    (await pages.fetch(new Request(`${host}/admin/`), { ASSETS: env.ASSETS }))
      .status,
    503,
  );
});
