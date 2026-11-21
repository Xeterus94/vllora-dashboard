import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import pages from '../integrations/pages-client/_worker.js';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('Pages livrează doar masterul original; Worker-ul primește separat aplicația React', async () => {
  const [legacy, pagesHtml, portalHtml] = await Promise.all([
    read('legacy/standalone-dashboard.html'),
    read('dist/index.html'),
    read('dist-portal/index.html'),
  ]);
  assert.equal(pagesHtml, legacy);
  assert.deepEqual(await readdir(new URL('../dist/', import.meta.url)), [
    'index.html',
  ]);
  assert.match(pagesHtml, /dashboard-master\.ionstefan0904\.workers\.dev/);
  assert.match(pagesHtml, /Portfolio overview/);
  assert.doesNotMatch(
    portalHtml,
    /Portfolio overview|dashboard-master\.ionstefan0904/,
  );
  assert.match(portalHtml, /src="\.\/assets\//);
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
