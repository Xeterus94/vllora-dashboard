import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
