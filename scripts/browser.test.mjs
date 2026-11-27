import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import bundledChromium from '@sparticuz/chromium';
import {
  bootstrapToken,
  call,
  clientPassword,
  masterPassword,
  png,
  runtime,
} from './test-runtime.mjs';
import { portalIcon } from '../shared/portal-brand.ts';

test(
  'Chromium: configurare master, portal mobil, conversie WebP și resetare',
  { timeout: 90000 },
  async (t) => {
    const env = await runtime();
    t.after(() => env.close());
    const browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_EXECUTABLE ||
        (process.platform === 'linux'
          ? await bundledChromium.executablePath()
          : undefined),
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--no-proxy-server',
        '--host-resolver-rules=MAP siteclient.com 127.0.0.1',
      ],
    });
    t.after(() => browser.close());
    const masterOrigin = `http://localhost:${env.port}`,
      tenantOrigin = `http://siteclient.com:${env.port}`;
    const master = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const client = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      deviceScaleFactor: 1,
      hasTouch: true,
    });
    master.setDefaultTimeout(8000);
    client.setDefaultTimeout(8000);
    const pageErrors = [];
    master.on('pageerror', (e) => pageErrors.push(e.message));
    client.on('pageerror', (e) => pageErrors.push(e.message));
    const login = async (page, username, password) => {
      await page.getByLabel('Utilizator', { exact: true }).fill(username);
      await page.getByLabel('Parolă', { exact: true }).fill(password);
      await page
        .getByRole('button', { name: 'Autentifică-te', exact: true })
        .click();
    };
    assert.equal(
      (
        await call(env.mf, masterOrigin, '/api/bootstrap', {
          method: 'POST',
          headers: { 'x-bootstrap-token': bootstrapToken },
          body: {
            username: 'master.ui',
            password: masterPassword,
            name: 'Master',
          },
        })
      ).status,
      201,
    );
    const noOverflow = async (page, context) => {
      const sizes = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      assert.ok(
        sizes.page <= sizes.viewport,
        `${context}: ${JSON.stringify(sizes)}`,
      );
    };
    const requests = [];
    master.on('request', (request) => requests.push(request.url()));
    const logoFile = 'vllora-logo.svg';
    const assertLogo = async (selector) => {
      const logo = master.locator(selector);
      await logo.waitFor();
      assert.ok((await logo.getAttribute('src')).endsWith(logoFile));
      await logo.evaluate((img) => img.decode());
    };
    const favicon = (page) => page.locator('head link[rel="icon"]');
    await master.goto(`${masterOrigin}/portal-admin/`);
    await assertLogo('.auth-card .brand-lockup img');
    assert.equal(
      await favicon(master).getAttribute('href'),
      `./assets/${logoFile}`,
    );
    await master.goto(masterOrigin);
    await assertLogo('#login img');
    assert.equal(
      await favicon(master).getAttribute('href'),
      `/master/assets/${logoFile}`,
    );
    assert.equal(new URL(master.url()).pathname, '/');
    for (const id of ['username', 'password']) {
      const gaps = await master.locator(`#${id}`).evaluate((input) => {
        const { paddingLeft, paddingRight, borderLeftWidth, borderRightWidth } =
          getComputedStyle(input);
        const box = input.getBoundingClientRect();
        const icon = input.previousElementSibling.getBoundingClientRect();
        const toggle = input.nextElementSibling?.getBoundingClientRect();
        return {
          left:
            box.left +
            parseFloat(borderLeftWidth) +
            parseFloat(paddingLeft) -
            icon.right,
          right:
            toggle &&
            toggle.left -
              (box.right -
                parseFloat(borderRightWidth) -
                parseFloat(paddingRight)),
        };
      });
      assert.ok(gaps.left >= 4, `${id}: text must clear the leading icon`);
      if (id === 'password')
        assert.ok(
          gaps.right >= 4,
          'password: text must clear the visibility toggle',
        );
    }
    await master.locator('#demoBtn').click();
    await master.locator('#app').waitFor();
    await master.locator('#chartPerf').waitFor();
    await assertLogo('#app > aside img');
    assert.ok(await master.evaluate(() => window.Chart.getChart('chartPerf')));
    assert.equal(
      await master
        .locator('#app')
        .evaluate((el) => getComputedStyle(el).minHeight),
      '900px',
    );
    const cards = master.locator('#clientCards .client-summary');
    const cardGrid = master.locator('#clientCards');
    const nav = master.locator('#mobileNav');
    for (const [width, height, columns] of [
      [320, 640, 1],
      [768, 1024, 2],
      [1024, 768, 2],
      [1440, 900, 0],
    ]) {
      await master.setViewportSize({ width, height });
      await noOverflow(master, `master ${width}`);
      if (!columns) {
        await cardGrid.waitFor({ state: 'hidden' });
        await master.locator('#clientDesktopTable').waitFor();
      } else {
        await cardGrid.waitFor();
        await master
          .locator('#clientDesktopTable')
          .waitFor({ state: 'hidden' });
        assert.equal(
          await cardGrid.evaluate(
            (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
          ),
          columns,
        );
      }
    }
    await master.setViewportSize({ width: 320, height: 640 });
    await master.locator('#navOpen').click();
    await nav.waitFor();
    await assertLogo('#mobileNav img');
    await master.keyboard.press('Escape');
    await nav.waitFor({ state: 'hidden' });
    assert.equal(
      await master.locator('#navOpen').getAttribute('aria-expanded'),
      'false',
    );
    await master.locator('#navOpen').click();
    await master.setViewportSize({ width: 1440, height: 900 });
    await nav.waitFor({ state: 'hidden' });
    assert.equal(await master.evaluate(() => document.body.style.overflow), '');
    await master.setViewportSize({ width: 320, height: 640 });
    await master.locator('#customRangeBtn').click();
    const range = master.locator('#customRangePanel');
    await range.waitFor();
    const bounds = await range.boundingBox();
    assert.ok(
      bounds.x >= 0 && bounds.x + bounds.width <= 320,
      JSON.stringify(bounds),
    );
    await master.keyboard.press('Escape');
    await range.waitFor({ state: 'hidden' });
    await master.locator('#customRangeBtn').click();
    await master.locator('#customStart').fill('');
    await master.locator('#customRangeApply').click();
    await master.locator('#customRangeError').waitFor();
    const today = await master.locator('#customEnd').inputValue();
    await master.locator('#customStart').fill(today);
    await master.locator('#customRangeApply').click();
    await range.waitFor({ state: 'hidden' });
    await master.locator('#navOpen').click();
    await nav.locator('a[href="#sec-clients"]').click();
    await nav.waitFor({ state: 'hidden' });
    await master.locator('#clientCardSort').selectOption('client');
    const firstName = await cards.first().locator('h4').innerText();
    await master.locator('#clientCardOrder').click();
    assert.notEqual(await cards.first().locator('h4').innerText(), firstName);
    await master.locator('#clientCardOrder').click();
    await master.locator('#nextPage').click();
    assert.notEqual(await cards.first().locator('h4').innerText(), firstName);
    await master.locator('#tableSearch').fill(firstName);
    await cards.first().filter({ hasText: firstName }).waitFor();
    assert.equal(await cards.count(), 1);
    await cards.first().locator('[data-edit]').click();
    await master.locator('#editorPanel').waitFor();
    assert.equal(await master.locator('#edName').inputValue(), firstName);
    await noOverflow(master, 'editor master 320');
    await master.keyboard.press('Escape');
    await master.locator('#editorPanel').waitFor({ state: 'hidden' });
    assert.ok(
      await cards
        .first()
        .locator('[data-edit]')
        .evaluate((el) => document.activeElement === el),
    );
    await master.locator('#tableSearch').fill('');
    await master.setViewportSize({ width: 1440, height: 900 });
    await master.locator('#logoutBtn').click();
    await master.locator('#login').waitFor();
    await master.getByLabel('Username', { exact: true }).fill('master.ui');
    await master.getByLabel('Password', { exact: true }).fill(masterPassword);
    await master.locator('#loginBtn').click();
    await master.locator('#app').waitFor();
    assert.ok(requests.every((url) => url.startsWith(masterOrigin + '/')));
    await master.setViewportSize({ width: 320, height: 640 });
    await master.route('https://portfolio.example.com/**', (route) =>
      route.fulfill({ body: png, contentType: 'image/png' }),
    );
    await master.route('https://cdn.example.com/keep.webp', (route) =>
      route.fulfill({ body: png, contentType: 'image/png' }),
    );
    await master.locator('#addClient').click();
    await master.locator('#edName').fill('Master UI Portfolio Site');
    await master.locator('#edCompanyName').fill('Compania Master SRL');
    await master.locator('#edCompanyCui').fill('RO00056789');
    await master.locator('#edCompanyRegistry').fill('J23/100/2019');
    await master.locator('#edCompanyAddress').fill('Sediu master nr. 3');
    await master.locator('#edDomain').fill('portfolio.example.com');
    await master.locator('[data-tab="cms"]').click();
    await master.locator('#edHeroTitle').fill('A D1-backed title');
    await master
      .locator('#edImages')
      .fill(
        'https://portfolio.example.com/.well-known/assets/veche.webp\nhttps://cdn.example.com/keep.webp',
      );
    await master.locator('#saveBtn').click();
    await master.locator('#editor').waitFor({ state: 'hidden' });
    await master.reload();
    await cardGrid.getByRole('link', { name: 'Edit website' }).waitFor();
    await master.setViewportSize({ width: 1440, height: 900 });
    await master
      .locator('#clientDesktopTable')
      .getByText('Master UI Portfolio Site', { exact: true })
      .waitFor();
    await master
      .getByRole('row')
      .filter({ hasText: 'Master UI Portfolio Site' })
      .locator('[data-edit]')
      .click();
    // Site administration: real suspend/resume, real certificate read, honest gaps.
    const administration = master.locator('#siteAdminPanel');
    await administration.getByText('Site administration', { exact: true }).waitFor();
    await administration
      .getByText('Enable maintenance mode', { exact: true })
      .waitFor();
    await administration.getByText('Not connected', { exact: true }).waitFor();
    await administration.getByRole('button', { name: 'Check', exact: true }).click();
    await administration
      .getByText('No certificate found', { exact: true })
      .or(administration.getByText('Zone not managed', { exact: true }))
      .or(administration.getByText('Check not configured', { exact: true }))
      .first()
      .waitFor();
    master.once('dialog', (dialog) => dialog.accept());
    await administration.getByRole('button', { name: 'Suspend', exact: true }).click();
    await administration
      .getByRole('button', { name: 'Reactivate', exact: true })
      .waitFor();
    const whileSuspended = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=portfolio.example.com',
    );
    assert.equal(whileSuspended.status, 404);
    master.once('dialog', (dialog) => dialog.accept());
    await administration
      .getByRole('button', { name: 'Reactivate', exact: true })
      .click();
    await administration.getByRole('button', { name: 'Suspend', exact: true }).waitFor();
    await administration.getByRole('button', { name: 'Open editor', exact: true }).click();
    assert.equal(await master.locator('#tab-cms').isVisible(), true);
    await master.locator('[data-tab="billing"]').click();
    await master.locator('[data-tab="cms"]').click();
    await master.locator('#liveCmsLink').click();
    await master
      .getByRole('heading', { name: 'Master UI Portfolio Site', exact: true })
      .waitFor();
    assert.equal(
      await master.getByLabel('Titlu principal', { exact: true }).inputValue(),
      'A D1-backed title',
    );
    // The editor opens on the big preview; the section form is one click away.
    await master.getByRole('button', { name: 'Editor pe secțiuni' }).click();
    await master
      .getByLabel('Titlu principal', { exact: true })
      .fill('Publicat de master');
    await master.route('**/content/import', (route) =>
      route.fulfill({
        json: {
          source: 'manifest',
          fields: {
            siteName: 'Nume detectat',
            primaryColor: '#224466',
            heroTitle: 'Nu suprascrie',
          },
          images: ['https://portfolio.example.com/assets/veche.webp'],
          services: [],
          hours: [],
        },
      }),
    );
    await master
      .getByRole('button', { name: 'Importă de pe site' })
      .click();
    await master
      .getByRole('status')
      .filter({ hasText: 'preluate din manifest' })
      .waitFor();
    assert.equal(
      await master.getByLabel('Titlu principal', { exact: true }).inputValue(),
      'Publicat de master',
    );
    const untouched = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=portfolio.example.com',
    );
    assert.equal(untouched.json.content.siteName, '');
    await master.getByRole('button', { name: 'Nume și culori' }).click();
    assert.equal(
      await master.getByLabel('Denumire firmă', { exact: true }).inputValue(),
      'Compania Master SRL',
    );
    assert.equal(
      await master.getByLabel('CUI / CIF', { exact: true }).inputValue(),
      'RO00056789',
    );

    assert.equal(
      await master.getByLabel('Numele public al site-ului').inputValue(),
      'Nume detectat',
    );
    assert.equal(
      await master.getByLabel('Culoare principală (HEX)').inputValue(),
      '#224466',
    );

    master.once('dialog', (dialog) => dialog.dismiss());
    await master
      .getByRole('button', { name: 'Bibliotecă media', exact: true })
      .click();
    await master
      .getByRole('button', { name: 'Galerie și fișiere', exact: true })
      .click();
    await master
      .locator('img[src="https://portfolio.example.com/assets/veche.webp"]')
      .first()
      .evaluate((img) => img.decode());
    const jpg = Buffer.from(
      await master.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;
        canvas.height = 1200;
        canvas.getContext('2d').fillRect(0, 0, 2400, 1200);
        return canvas.toDataURL('image/jpeg').split(',')[1];
      }),
      'base64',
    );
    const cmsUpload = master.waitForResponse(
      (response) =>
        /\/api\/admin\/sites\/[^/]+\/media$/.test(response.url()) &&
        response.request().method() === 'POST',
    );
    const masterChooser = master.waitForEvent('filechooser');
    await master
      .getByRole('button', { name: 'Atașează poze', exact: true })
      .click();
    await (
      await masterChooser
    ).setFiles({ name: 'portofoliu.jpg', mimeType: 'image/jpeg', buffer: jpg });
    const masterImage = (await (await cmsUpload).json()).item;
    assert.equal(masterImage.content_type, 'image/webp');
    assert.equal(masterImage.width, 2000);
    assert.equal(masterImage.height, 1000);
    assert.ok(masterImage.size < jpg.length);
    const stored = await (
      await master.request.get(new URL(masterImage.url, masterOrigin).href)
    ).body();
    assert.equal(stored.subarray(8, 12).toString(), 'WEBP');
    await master
      .getByRole('status')
      .filter({ hasText: 'Fișiere atașate în editor' })
      .waitFor();
    // Staff edit with the pinned preview: hide it to reach the schematic preview.
    await master
      .getByRole('button', { name: 'Ascunde previzualizarea', exact: true })
      .click();
    await master
      .getByRole('button', { name: 'Previzualizează', exact: true })
      .click();
    await master.getByRole('heading', { name: 'Publicat de master' }).waitFor();
    await master
      .getByRole('button', { name: 'Înapoi la editor', exact: true })
      .click();
    await master
      .getByRole('button', { name: 'Previzualizare alături', exact: true })
      .click();
    await master
      .locator('.cms-publish')
      .getByRole('button', { name: 'Publică modificările' })
      .click();
    await master
      .getByRole('status')
      .filter({ hasText: 'Conținut publicat. Se afișează' })
      .waitFor();
    const fromMaster = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=portfolio.example.com',
    );
    assert.equal(fromMaster.json.content.heroTitle, 'Publicat de master');
    assert.equal(fromMaster.json.businessName, 'Nume detectat');
    assert.equal(fromMaster.json.content.companyRegistry, 'J23/100/2019');
    assert.equal(fromMaster.json.content.gallery[0].id, masterImage.id);
    assert.deepEqual(fromMaster.json.content.images, [
      'https://portfolio.example.com/assets/veche.webp',
      'https://cdn.example.com/keep.webp',
      `${masterOrigin}${masterImage.url}`,
    ]);

    const originalPageImage = 'https://portfolio.example.com/assets/cover.webp';
    await master.unroute('**/content/import');
    const multipageImport = /\/content\/import(?:\?pages=1)?$/;
    await master.route(multipageImport, (route) =>
      route.fulfill({
        json: {
          source: 'manifest',
          fields: {},
          images: [],
          services: [],
          hours: [],
          pages: [
            {
              path: '/',
              title: 'Acasă',
              fields: [
                {
                  id: 'welcome',
                  label: 'Mesaj de bun venit',
                  kind: 'text',
                  value: 'Bun venit!',
                },
              ],
            },
            {
              path: '/despre/',
              title: 'Despre noi',
              fields: [
                {
                  id: 'title',
                  label: 'Titlu Despre',
                  kind: 'text',
                  value: 'Povestea noastră',
                },
                {
                  id: 'photo',
                  label: 'Copertă Despre',
                  kind: 'image',
                  value: originalPageImage,
                },
                {
                  id: 'visits',
                  label: 'Vizite (grafic)',
                  kind: 'number',
                  value: '15',
                },
              ],
            },
          ],
        },
      }),
    );
    const bridge = await readFile(
      new URL('../integrations/static-cms/vllora-content.js', import.meta.url),
      'utf8',
    );
    await master.route('https://portfolio.example.com/**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/bridge.js')
        return route.fulfill({
          contentType: 'application/javascript',
          body: bridge,
        });
      if (pathname === '/api/content')
        return route.fulfill({ json: { content: {} } });
      if (pathname !== '/' && pathname !== '/despre/') return route.fallback();
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html>
        <style>@keyframes fade { to { opacity: .5 } } h1 { animation: fade 2s infinite }</style>
        <h1 data-vllora-text="${pathname === '/' ? 'welcome' : 'title'}">Text original</h1>
        <nav><a href="/despre/">Mergi la Despre</a></nav>
        <img data-vllora-image="photo" src="/assets/cover.webp" alt="Coperta originală">
        <output id="chart">15</output>
        <script>document.addEventListener('vllora:page-content', ({detail}) => {
          const field = detail.fields.get('visits');
          if (field) document.getElementById('chart').textContent = field.value;
        });</script>
        <script defer src="/bridge.js" data-api="https://portfolio.example.com/api/content" data-preview-origin="${masterOrigin}"></script>`,
      });
    });
    await master.reload();
    await master.getByRole('button', { name: 'Editor pe secțiuni' }).click();
    await master.getByRole('button', { name: 'Toate paginile' }).click();
    const choosePage = master.getByLabel('Pagina site-ului');
    await choosePage.selectOption('/despre/');
    assert.equal(
      await master.getByLabel('Titlu Despre').inputValue(),
      'Povestea noastră',
    );
    await master.getByLabel('Titlu Despre').fill('Titlu editat în master');
    await master.getByLabel('Vizite (grafic)').fill('42');
    await master
      .getByRole('checkbox', { name: 'Toate imaginile conectate' })
      .check();
    assert.equal(
      await master.getByLabel('Copertă Despre', { exact: true }).inputValue(),
      originalPageImage,
    );
    await master.getByLabel('Încarcă: Copertă Despre').setInputFiles({
      name: 'coperta.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await master
      .locator('img.cms-slot-image[src^="/media/"][src$=".webp"]')
      .waitFor();
    const replacement = master.locator('img.cms-slot-image[src^="/media/"]');
    await replacement.evaluate((image) => image.decode());
    await master.getByRole('button', { name: 'Elimină imaginea' }).click();
    // Back to the big preview, which shows the draft in the same frame.
    await master.getByRole('button', { name: 'Previzualizare mare' }).click();
    // The phone switch narrows the frame without reloading it.
    await master
      .locator('.cms-big-bar')
      .getByRole('button', { name: 'Telefon', exact: true })
      .click();
    await master.locator('.cms-big .cms-live-narrow').waitFor();
    assert.equal(
      await master.locator('.cms-big-dirty').innerText(),
      'Modificări nepublicate',
    );
    // The big preview owns the frame; the full-screen view is the section
    // editor's own preview, so step into the sections first.
    await master.getByRole('button', { name: 'Editor pe secțiuni' }).click();
    await master
      .getByRole('button', { name: 'Previzualizare pe tot ecranul' })
      .click();
    await master.locator('.cms-live-full .cms-live-frame').waitFor();
    const frame = master.frameLocator(
      '.cms-live-full iframe[title="Site real — previzualizare"]',
    );
    await frame
      .getByRole('heading', { name: 'Titlu editat în master' })
      .waitFor();
    assert.equal(await frame.locator('#chart').textContent(), '42');
    assert.equal(
      await frame
        .getByRole('heading')
        .evaluate((el) => getComputedStyle(el).animationName),
      'fade',
    );
    await frame.locator('[data-vllora-image]').waitFor({ state: 'hidden' });
    // The full-screen preview has no page picker of its own: leave it, choose a
    // page in the form, then come back to the same frame.
    await master.getByRole('button', { name: 'Înapoi la editare' }).click();
    await master.getByRole('button', { name: 'Toate paginile' }).click();
    await master.getByLabel('Pagina site-ului').selectOption('/');
    await master
      .getByRole('button', { name: 'Previzualizare pe tot ecranul' })
      .click();
    await frame.getByRole('heading', { name: 'Bun venit!' }).waitFor();
    await frame.getByRole('link', { name: 'Mergi la Despre' }).click();
    await frame
      .getByRole('heading', { name: 'Titlu editat în master' })
      .waitFor();
    const publicBefore = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=portfolio.example.com',
    );
    assert.equal(publicBefore.json.content.pages, undefined);
    await master.getByRole('button', { name: 'Înapoi la editare' }).click();
    await master.getByRole('button', { name: 'Importă de pe site' }).click();
    await master
      .getByText('Nu există câmpuri goale', { exact: false })
      .waitFor();
    await master
      .locator('.cms-publish')
      .getByRole('button', { name: 'Publică modificările' })
      .click();
    await master
      .getByRole('status')
      .filter({ hasText: 'Conținut publicat. Se afișează' })
      .waitFor();
    const publicAfter = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=portfolio.example.com',
    );
    assert.deepEqual(
      publicAfter.json.content.pages[1].fields.map((field) => field.value),
      ['Titlu editat în master', '', '42'],
    );
    await master.unroute(multipageImport);

    await master.goto(`${masterOrigin}/portal-admin/`);
    await master.getByRole('heading', { name: 'Site-uri și acces' }).waitFor();
    await assertLogo('.master-shell .topbar .brand-lockup img');
    const staffCards = master.locator('.staff-site-cards');
    await master.locator('.staff-site-table').waitFor();
    for (const [width, height] of [
      [320, 640],
      [768, 1024],
      [1024, 768],
    ]) {
      await master.setViewportSize({ width, height });
      await staffCards.waitFor();
      await noOverflow(master, `administrare portale ${width}`);
    }
    await master.setViewportSize({ width: 320, height: 640 });
    await staffCards.getByRole('button', { name: 'Editează site-ul' }).first().click();
    // The portal now opens on the full-width preview; the split view is the
    // optional one, and below 1100px it stays off so the fields stay visible.
    await master
      .getByRole('button', { name: 'Editor pe secțiuni', exact: true })
      .waitFor();
    // The big preview is the landing surface even on a phone, and it really
    // disappears (not just visually) once the section editor takes over.
    assert.equal(await master.locator('.cms-big').isVisible(), true);
    await master
      .getByRole('button', { name: 'Editor pe secțiuni', exact: true })
      .click();
    assert.equal(await master.locator('.cms-big').isVisible(), false);
    await master
      .getByRole('button', { name: 'Previzualizare alături', exact: true })
      .click();
    assert.equal(await master.locator('.cms-pinned').count(), 0);
    // Staff detail page exposes the same administration block.
    const staffAdministration = master
      .locator('.panel')
      .filter({ hasText: 'Administrare site' });
    await master.getByRole('button', { name: 'Configurare', exact: true }).click();
    await staffAdministration
      .getByText('Activează modul de mentenanță', { exact: true })
      .waitFor();
    await staffAdministration
      .getByText('Neconectat', { exact: true })
      .waitFor();
    await staffAdministration
      .getByRole('button', { name: 'Verifică', exact: true })
      .click();
    await staffAdministration
      .getByText('Certificat valid', { exact: true })
      .or(staffAdministration.getByText('Zonă neadministrată', { exact: true }))
      .or(
        staffAdministration.getByText('Verificare neconfigurată', {
          exact: true,
        }),
      )
      .or(staffAdministration.getByText('Niciun certificat găsit', { exact: true }))
      .first()
      .waitFor();
    await noOverflow(master, 'editor administrare 320');
    await master.getByRole('button', { name: 'Înapoi la site-uri' }).click();
    await staffCards.waitFor();
    await master
      .getByRole('button', { name: 'Adaugă site', exact: true })
      .click();
    await master
      .getByLabel('Domeniu', { exact: false })
      .first()
      .fill('siteclient.com');
    await master.getByLabel('Nume afișat (opțional)').fill('Bluebird Studio');
    await master
      .getByLabel('Denumire firmă', { exact: true })
      .fill('Bluebird SRL');
    await master.getByLabel('CUI / CIF', { exact: true }).fill('RO12345678');
    await master
      .getByLabel('Tipul site-ului', { exact: true })
      .selectOption('ecommerce');
    await master
      .getByRole('button', { name: 'Indicator principal: Valoarea comenzilor' })
      .click();
    await master
      .getByLabel('Țintă lunară: Valoarea comenzilor', { exact: true })
      .fill('600000');
    await master
      .getByRole('button', { name: 'Creează site-ul', exact: true })
      .click();
    await master
      .getByRole('heading', { name: 'Bluebird Studio', exact: true })
      .waitFor();
    // Local reviews come from the site; the portal only removes them.
    const seededCookie = (await master.context().cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const seededSite = (
      await call(env.mf, masterOrigin, '/api/admin/sites', {
        cookie: seededCookie,
      })
    ).json.sites.find((s) => s.domain === 'siteclient.com');
    const seededRevision = (
      await call(env.mf, masterOrigin, `/api/admin/sites/${seededSite.id}/content`, {
        cookie: seededCookie,
      })
    ).json.revision;
    const seeded = await call(
      env.mf,
      masterOrigin,
      `/api/admin/sites/${seededSite.id}/content`,
      {
        method: 'PUT',
        cookie: seededCookie,
        body: {
          revision: seededRevision,
          content: {
            siteName: 'Bluebird Studio',
            reviews: [
              {
                name: 'Client mulțumit',
                rating: 5,
                location: 'Brașov',
                text: 'Foarte mulțumit de colaborare.',
                date: '2026-04-01',
              },
              {
                name: 'Recenzie de șters',
                rating: 4,
                location: 'Cluj',
                text: 'Text scurt.',
                date: '2026-04-02',
              },
            ],
          },
        },
      },
    );
    assert.equal(seeded.status, 200);
    assert.equal(seeded.json.content.reviews.length, 2);
    await master
      .getByRole('button', { name: 'Acces client', exact: true })
      .click();
    await master.getByLabel('Utilizator', { exact: true }).fill('client.ui');
    await master.getByLabel('Nume client', { exact: true }).fill('Client UI');
    await master
      .getByLabel('Email de recuperare', { exact: true })
      .fill('client@example.com');
    await master
      .getByRole('button', { name: 'Generează acces', exact: true })
      .click();
    const tmp = await master.locator('.secret code').textContent();
    assert.match(tmp, /^\w{4}-\w{5}-\w{5}$/);

    await master
      .getByRole('button', { name: 'Bibliotecă media', exact: true })
      .click();
    await master
      .getByLabel('Destinația imaginii', { exact: true })
      .selectOption('logo');
    const masterUpload = master.waitForResponse(
      (r) => r.url().includes('/media') && r.request().method() === 'POST',
    );
    await master
      .getByLabel('Alege imagini', { exact: true })
      .setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
    const masterResult = await (await masterUpload).json();
    assert.equal(masterResult.item.content_type, 'image/webp');
    assert.equal(masterResult.item.width, 1);
    await master
      .getByRole('button', { name: 'Setează ca logo', exact: true })
      .click();
    await master
      .getByRole('button', { name: 'Logo actual', exact: true })
      .waitFor();

    // The tab icon follows the client logo as soon as one is stored, so the
    // shell never shows the platform logo for a branded portal.
    const brandedPortal = await call(env.mf, tenantOrigin, '/admin/');
    assert.match(
      brandedPortal.contents,
      /rel="icon" href="[^"]*\/media\/sites\//,
      'the shell should use the client logo for the tab icon',
    );
    // With no logo and no favicon the icon falls back to the site initials in the
    // site colour, never to the platform mark.
    await env.db
      .prepare('UPDATE sites SET logo_media_id=NULL, favicon_media_id=NULL WHERE domain=?')
      .bind('siteclient.com')
      .run();
    const initialsPortal = await call(env.mf, tenantOrigin, '/admin/');
    const initialsIcon = decodeURIComponent(
      initialsPortal.contents.match(/rel="icon" href="([^"]+)"/)[1],
    );
    assert.match(initialsIcon, /^data:image\/svg\+xml,/);
    assert.match(initialsIcon, />BS</, 'the icon should show the site initials');
    assert.match(initialsIcon, /fill="#6b1c2e"/, 'the icon should use the site colour');
    assert.doesNotMatch(initialsPortal.contents, /vllora-logo\.svg"/);
    // Only a portal with no brand information at all keeps the platform mark.
    const platformPortal = portalIcon(
      { name: '', primary_color: '' },
      './assets/vllora-logo.svg',
    );
    assert.equal(platformPortal, './assets/vllora-logo.svg');
    // The dedicated favicon is uploaded below, so only the logo is restored here.
    await env.db
      .prepare("UPDATE sites SET logo_media_id=? WHERE domain='siteclient.com'")
      .bind(masterResult.item.id)
      .run();
    const defaultIcon = await call(
      env.mf,
      tenantOrigin,
      `/admin/assets/${logoFile}`,
    );
    assert.equal(defaultIcon.status, 200);
    assert.equal(defaultIcon.headers.get('content-type'), 'image/svg+xml');
    // A separate favicon can still be configured, but it must not replace the
    // logo as the tab icon. Upload one more image and assign it as favicon.
    await master
      .getByLabel('Destinația imaginii', { exact: true })
      .selectOption('favicon');
    const faviconUpload = master.waitForResponse(
      (r) => r.url().includes('/media') && r.request().method() === 'POST',
    );
    await master
      .getByLabel('Alege imagini', { exact: true })
      .setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: png });
    const faviconResult = await (await faviconUpload).json();
    assert.equal(faviconResult.item.content_type, 'image/webp');
    assert.notEqual(faviconResult.item.id, masterResult.item.id);
    assert.equal(
      await master
        .getByRole('button', { name: 'Folosit ca iconiță', exact: true })
        .isDisabled(),
      true,
      'the logo item already drives the tab icon, so it cannot be a favicon too',
    );
    await master
      .getByRole('button', { name: 'Setează ca favicon', exact: true })
      .click();
    await master
      .getByRole('button', { name: 'Favicon actual', exact: true })
      .waitFor();
    const afterFavicon = await call(env.mf, tenantOrigin, '/admin/');
    assert.match(
      afterFavicon.contents,
      /rel="icon" href="[^"]*\/media\/sites\//,
    );
    assert.ok(
      !afterFavicon.contents.includes(faviconResult.item.url),
      'the tab icon should stay on the logo, not switch to the favicon',
    );

    await env.db
      .prepare(
        'UPDATE sites SET primary_color=?, secondary_color=?, accent_color=?, scheme=? WHERE domain=?',
      )
      .bind('#8674a8', '#76abcc', '#ffb401', 'dark', 'siteclient.com')
      .run();
    const assertClientBrand = async (shell) => {
      const header = client.locator(`${shell} .brand-lockup`);
      await header.getByText('Bluebird Studio', { exact: true }).waitFor();
      await header.getByText('Admin Dashboard', { exact: true }).waitFor();
      assert.doesNotMatch(
        await header.innerText(),
        /Vllora Studio|Portal client/i,
      );
      const image = header.locator('img');
      assert.equal(await favicon(client).count(), 1);
      assert.equal(
        await favicon(client).getAttribute('href'),
        await image.getAttribute('src'),
      );
      // The logo drives the tab icon, even when a separate favicon is stored.
      const stored = await env.db
        .prepare(
          "SELECT f.object_key AS favicon_key FROM sites s LEFT JOIN media f ON f.id=s.favicon_media_id AND f.ready=1 WHERE s.domain='siteclient.com'",
        )
        .first();
      assert.ok(stored?.favicon_key, 'the fixture should keep a favicon');
      assert.ok(
        !(await favicon(client).getAttribute('href')).includes(
          stored.favicon_key,
        ),
        'the tab icon should be the logo, not the separate favicon',
      );

      assert.match(await image.getAttribute('src'), /^\/admin\/media\/sites\//);
      await image.evaluate((img) => img.decode());
      assert.equal(await client.title(), 'Bluebird Studio · Admin Dashboard');
      const style = await client.locator(shell).evaluate((el) => {
        const css = getComputedStyle(el);
        return [
          '--brand-primary',
          '--brand-secondary',
          '--brand-accent',
          'color-scheme',
        ].map((name) => css.getPropertyValue(name).trim());
      });
      // The primary shade is adjusted slightly to remain readable on the dark surface.
      assert.deepEqual(style, ['#8c7bac', '#76abcc', '#ffb401', 'dark']);
    };
    await client.goto(`${tenantOrigin}/admin`);
    assert.equal(new URL(client.url()).pathname, '/admin/');
    await assertClientBrand('.auth-shell');
    await login(client, 'client.ui', tmp);
    await client.getByRole('heading', { name: 'Setează-ți parola' }).waitFor();
    await assertClientBrand('.auth-shell');
    await client.getByLabel('Parola temporară', { exact: true }).fill(tmp);
    await client
      .getByLabel('Parolă nouă', { exact: false })
      .fill(clientPassword);
    await client
      .getByLabel('Confirmă parola', { exact: true })
      .fill(clientPassword);
    await client.getByRole('button', { name: 'Salvează parola' }).click();
    await client
      .getByRole('heading', { name: 'Bluebird Studio', exact: true })
      .waitFor();
    await assertClientBrand('.portal-shell');
    for (const [width, height] of [
      [320, 640],
      [768, 1024],
      [1024, 768],
      [390, 844],
    ]) {
      await client.setViewportSize({ width, height });
      await noOverflow(client, `portal ${width}`);
    }
    const revenue = client.locator('.featured');
    await revenue.waitFor();
    assert.match(
      await revenue.innerText(),
      /Valoarea comenzilor[\s\S]*Necesită integrare[\s\S]*6[.\s]*000,00 RON/,
    );
    assert.equal(
      await client.getByText('Top pagini', { exact: true }).count(),
      0,
    );
    assert.equal(
      await client.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await client
      .getByLabel('Perioadă (UTC)', { exact: true })
      .selectOption('7');
    await client
      .getByRole('heading', { name: 'Rezultatele afacerii' })
      .waitFor();

    await client
      .getByRole('button', { name: 'Editează site-ul', exact: true })
      .click();
    // The portal opens on the big preview; the section form is one click away.
    await client.getByRole('button', { name: 'Editor pe secțiuni' }).click();
    await client
      .getByLabel('Titlu principal', { exact: true })
      .fill('Un titlu din editorul mobil');
    await client.getByRole('button', { name: 'Nume și culori' }).click();
    assert.equal(
      await client.getByLabel('Denumire firmă', { exact: true }).inputValue(),
      'Bluebird SRL',
    );
    await client
      .getByLabel('Adresa sediului social')
      .fill('Adresă editată din mobil');
    await client.getByRole('button', { name: 'Prima pagină' }).click();

    // Simulate a browser returning PNG; the fallback must still encode and upload WebP.
    const restoreCanvas = await client.evaluateHandle(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        original.call(this, callback, 'image/png');
      };
      return () => {
        HTMLCanvasElement.prototype.toBlob = original;
      };
    });
    const fallbackUpload = client.waitForResponse(
      (r) =>
        r.url().includes('/portal/media') && r.request().method() === 'POST',
    );
    const chooser = client.waitForEvent('filechooser');
    await client
      .getByRole('button', { name: 'Atașează imagine principală' })
      .click();
    await (
      await chooser
    ).setFiles({ name: 'hero.png', mimeType: 'image/png', buffer: png });
    const fallbackResult = await (await fallbackUpload).json();
    assert.equal(fallbackResult.item.content_type, 'image/webp');
    assert.match(fallbackResult.item.name, /\.webp$/);
    await restoreCanvas.evaluate((restore) => restore());
    await restoreCanvas.dispose();
    await client
      .getByRole('status')
      .filter({ hasText: 'Fișiere atașate în editor' })
      .waitFor();
    await client.setViewportSize({ width: 320, height: 640 });

    // The section form is visible; the big preview is stepped out of.
    assert.equal(await client.locator('.cms-big').isVisible(), false);
    // A shop's blueprint: the catalogue, never bookings or a price list. The
    // page inventory stays a master tool, so the client does not see it.
    assert.deepEqual(
      await client
        .locator('nav[aria-label="Secțiuni editor"] button')
        .allTextContents(),
      [
        'Prima pagină',
        'Nume și culori',
        'Produse (magazin)',
        'Recenzii',
        'Galerie și fișiere',
        'Contact',
      ],
    );
    // The shop lives in the same portal: full product form, photo upload and
    // review deletion, all through the client session.
    await client
      .getByRole('button', { name: 'Produse (magazin)', exact: true })
      .click();
    await client.getByRole('button', { name: 'Produs nou' }).click();
    await client.getByLabel('Nume produs 1').fill('Amestec gazon mobil');
    await client
      .getByLabel('Categorie 1', { exact: true })
      .selectOption('Semințe & Plante');
    await client.getByLabel('Subcategorie 1', { exact: true }).fill('Gazon');
    await client.getByLabel('Preț întreg 1').fill('69');
    await client.getByLabel('Discount 1 (%)').fill('10');
    await client.getByLabel('Stoc 1').fill('12');
    await client.getByLabel('Unitate / ambalaj 1').fill('1 kg');
    await client.getByLabel('Etichetă (badge) 1').fill('Nou');
    await client.getByLabel('Sezon 1').fill('Primăvară');
    await client
      .getByLabel('Caracteristici 1 (separate cu |)')
      .fill('Rezistent la secetă | Creștere rapidă');
    await client.getByLabel('Bestseller').check();
    // The reduced price is derived, never typed: 69 lei − 10 % = 62,10 lei.
    await client.getByText('Se afișează 62.10 lei, cu 69 lei tăiat.').waitFor();
    const shopPhoto = client.waitForResponse(
      (r) =>
        r.url().includes('/portal/media') && r.request().method() === 'POST',
    );
    const shopChooser = client.waitForEvent('filechooser');
    await client
      .getByRole('button', { name: 'Încarcă poză', exact: true })
      .click();
    await (
      await shopChooser
    ).setFiles({ name: 'gazon.jpg', mimeType: 'image/jpeg', buffer: jpg });
    const shopImage = (await (await shopPhoto).json()).item;
    assert.equal(shopImage.content_type, 'image/webp');
    // The upload fills the Imagine field and the list thumbnail by itself.
    await client
      .locator(`.cms-product-thumb img[src="${shopImage.url}"]`)
      .first()
      .evaluate((img) => img.decode());
    await client
      .getByRole('button', { name: 'Șterge poza', exact: true })
      .click();
    assert.equal(await client.locator('.cms-product-thumb img').count(), 0);
    // A file the shop refuses never leaves the browser.
    const rejected = [];
    client.once('filechooser', () => rejected.push(true));
    const chooserAgain = client.waitForEvent('filechooser');
    await client
      .getByRole('button', { name: 'Încarcă poză', exact: true })
      .click();
    await (
      await chooserAgain
    ).setFiles({ name: 'prea-mare.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(6 * 1024 * 1024, 1) });
    await client
      .getByRole('alert')
      .filter({ hasText: 'Poza produsului poate avea cel mult 5 MB.' })
      .waitFor();
    // Reviews: the two seeded ones are listed; only deletion is offered.
    await client.getByRole('button', { name: 'Recenzii', exact: true }).click();
    assert.equal(await client.locator('.cms-review').count(), 2);
    await client
      .getByRole('button', { name: 'Șterge recenzia: Recenzie de șters' })
      .click();
    assert.equal(await client.locator('.cms-review').count(), 1);
    await client.getByRole('button', { name: 'Produse (magazin)', exact: true }).click();
    await client.getByRole('button', { name: /Ascunde/ }).click();
    assert.equal(
      await client
        .getByRole('button', { name: 'Publică', exact: true })
        .count(),
      1,
    );
    await client.getByRole('button', { name: 'Publică modificările' }).click();
    await client
      .getByRole('status')
      .filter({ hasText: 'Conținut publicat' })
      .waitFor();
    const shopContent = (
      await call(env.mf, masterOrigin, '/api/content?site=siteclient.com')
    ).json.content;
    assert.equal(shopContent.products[0].name, 'Amestec gazon mobil');
    assert.equal(shopContent.products[0].discount, 10);
    assert.equal(shopContent.products[0].stock, 12);
    assert.equal(shopContent.products[0].badge, 'Nou');
    assert.deepEqual(shopContent.products[0].features, [
      'Rezistent la secetă',
      'Creștere rapidă',
    ]);
    assert.equal(shopContent.products[0].bestseller, true);
    // Hidden in the editor, so the public payload keeps it flagged and the
    // adapter drops it from the shop.
    assert.equal(shopContent.products[0].active, false);
    assert.deepEqual(
      shopContent.reviews.map((review) => review.name),
      ['Client mulțumit'],
    );

    // A section outside the shop blueprint becomes reachable as soon as it
    // holds data, so nothing the site already has can be lost.
    await client.evaluate(async () => {
      const me = await (
        await fetch('/admin/api/portal/content', {
          headers: { Accept: 'application/json' },
        })
      ).json();
      await fetch('/admin/api/portal/content', {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          revision: me.revision,
          content: {
            ...me.content,
            services: [
              { name: 'Tuns din portal', price: '90 lei', description: '', duration: '' },
            ],
          },
        }),
      });
    });
    await client.reload();
    await client
      .getByRole('button', { name: 'Editează site-ul', exact: true })
      .click();
    await client.getByRole('button', { name: 'Editor pe secțiuni' }).click();
    await client.getByRole('button', { name: /Servicii și prețuri/ }).click();
    await client.getByLabel('Nume serviciu 1').fill('Tuns din portal');
    await client
      .getByRole('button', { name: 'Galerie și fișiere', exact: true })
      .click();
    await client.getByLabel('Atașează PDF', { exact: true }).setInputFiles({
      name: 'program.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n%%EOF'),
    });
    await client
      .getByRole('status')
      .filter({ hasText: 'Fișiere atașate în editor' })
      .waitFor();
    await client
      .getByRole('button', { name: 'Previzualizează', exact: true })
      .click();
    await client
      .getByRole('heading', { name: 'Un titlu din editorul mobil' })
      .waitFor();
    const preview = client.getByRole('complementary', {
      name: 'Previzualizare conținut',
    });
    await preview
      .getByRole('img', { name: 'Imagine principală' })
      .evaluate((img) => img.decode());
    await preview.getByText('program.pdf', { exact: true }).waitFor();
    await preview
      .locator('footer')
      .getByText('Bluebird SRL', { exact: true })
      .waitFor();
    await preview
      .locator('footer')
      .getByText('Adresă editată din mobil', { exact: true })
      .waitFor();
    assert.equal(
      await client.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await client.getByRole('button', { name: 'Înapoi la editor' }).click();
    await noOverflow(client, 'editor portal 320');
    await client.setViewportSize({ width: 390, height: 844 });
    await client.getByRole('button', { name: 'Publică modificările' }).click();
    await client
      .getByRole('status')
      .filter({ hasText: 'Conținut publicat. Se afișează' })
      .waitFor();
    const publicEditor = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=siteclient.com',
    );
    assert.equal(publicEditor.json.content.services[0].name, 'Tuns din portal');
    assert.equal(publicEditor.json.content.documents[0].name, 'program.pdf');
    assert.equal(
      publicEditor.json.content.companyAddress,
      'Adresă editată din mobil',
    );
    assert.ok(
      publicEditor.json.content.heroMedia.url.startsWith(
        masterOrigin + '/media/',
      ),
    );
    await client.reload();
    await client
      .getByRole('button', { name: 'Editează site-ul', exact: true })
      .click();
    await client.getByRole('button', { name: 'Editor pe secțiuni' }).click();
    assert.equal(
      await client.getByLabel('Titlu principal', { exact: true }).inputValue(),
      'Un titlu din editorul mobil',
    );

    await client
      .getByRole('button', { name: 'Bibliotecă media', exact: true })
      .click();
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="2100" height="1050"><rect width="1050" height="1050" fill="#ff0000"/></svg>';
    const clientUpload = client.waitForResponse(
      (r) =>
        r.url().includes('/portal/media') && r.request().method() === 'POST',
    );
    await client.getByLabel('Alege imagini', { exact: true }).setInputFiles({
      name: 'test.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(svg),
    });
    const uploaded = await (await clientUpload).json();
    assert.equal(uploaded.item.content_type, 'image/webp');
    assert.equal(uploaded.item.width, 2000);
    assert.equal(uploaded.item.height, 1000);
    const pixels = await client.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return [
        context.getImageData(100, 100, 1, 1).data[3],
        context.getImageData(1700, 100, 1, 1).data[3],
      ];
    }, uploaded.item.url);
    assert.deepEqual(pixels, [255, 0]);
    const countMedia = async () =>
      (await env.db.prepare('SELECT COUNT(*) AS n FROM media').first()).n;
    const mediaBeforeInvalid = await countMedia();
    await client.getByLabel('Alege imagini', { exact: true }).setInputFiles({
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    });
    await client.getByRole('alert').filter({ hasText: 'fake.png' }).waitFor();
    assert.equal(await countMedia(), mediaBeforeInvalid);

    await client
      .getByRole('button', { name: 'Deconectare', exact: true })
      .click();
    await client.getByRole('button', { name: 'Ai uitat parola?' }).click();
    await client.getByLabel('Email sau utilizator').fill('client@example.com');
    await client.getByRole('button', { name: 'Trimite linkul' }).click();
    await client
      .getByRole('status')
      .filter({ hasText: 'Dacă există un cont eligibil' })
      .waitFor();
    for (let i = 0; i < 50 && !env.received.length; i++)
      await new Promise((resolve) => setTimeout(resolve, 30));
    const token = env.received[0].text.match(/#reset=(\w+)/)[1];
    await client.goto(`${tenantOrigin}/admin/#reset=${token}`);
    await client
      .getByRole('heading', { name: 'Setează o parolă nouă' })
      .waitFor();
    await assertClientBrand('.auth-shell');
    assert.equal(new URL(client.url()).hash, '');
    await client
      .getByLabel('Parolă nouă', { exact: false })
      .fill('NewClientUi1!');
    await client
      .getByLabel('Confirmă parola', { exact: true })
      .fill('NewClientUi1!');
    await client.getByRole('button', { name: 'Salvează parola' }).click();
    await client
      .getByRole('status')
      .filter({ hasText: 'Parola a fost schimbată' })
      .waitFor();
    await login(client, 'client.ui', 'NewClientUi1!');
    await client.getByRole('heading', { name: 'Bluebird Studio' }).waitFor();

    // A client granted only "Doar citire" gets the overview and nothing else,
    // and the API backs that up: hidden actions are refused, not just invisible.
    const staffCookie = (await master.context().cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const sites = (
      await call(env.mf, masterOrigin, '/api/admin/sites', {
        cookie: staffCookie,
      })
    ).json.sites;
    const bluebird = sites.find((s) => s.domain === 'siteclient.com');
    const viewer = (
      await call(env.mf, masterOrigin, `/api/admin/sites/${bluebird.id}/users`, {
        method: 'POST',
        cookie: staffCookie,
        body: {
          username: 'client.reader',
          name: 'Doar Citire',
          email: 'reader@example.com',
          permissions: ['stats'],
        },
      })
    ).json;
    const readerWatch = await browser.newPage({
      viewport: { width: 1200, height: 900 },
    });
    t.after(() => readerWatch.close());
    await readerWatch.goto(`${tenantOrigin}/admin/`);
    await login(readerWatch, 'client.reader', viewer.temporary_password);
    await readerWatch
      .getByRole('heading', { name: 'Setează-ți parola' })
      .waitFor();
    await readerWatch
      .getByLabel('Parola temporară', { exact: true })
      .fill(viewer.temporary_password);
    await readerWatch
      .getByLabel('Parolă nouă', { exact: false })
      .fill('ClientReader1!');
    await readerWatch
      .getByLabel('Confirmă parola', { exact: true })
      .fill('ClientReader1!');
    await readerWatch.getByRole('button', { name: 'Salvează parola' }).click();
    await readerWatch
      .getByRole('heading', { name: 'Bluebird Studio' })
      .waitFor();
    assert.deepEqual(
      (await readerWatch.locator('.portal-tabs button').allTextContents()).map(
        (label) => label.trim(),
      ),
      ['Prezentare'],
    );
    // The same page refuses the hidden work when asked directly.
    assert.equal(
      await readerWatch.evaluate(
        async () =>
          (
            await fetch('/admin/api/portal/media', {
              headers: { Accept: 'application/json' },
            })
          ).status,
      ),
      403,
    );
    // Exercise the public-site adapter separately; it must not inject markup or unsafe links.
    const publicSite = await browser.newPage();
    t.after(() => publicSite.close());
    const html = `<main data-vllora-theme><h1 data-vllora-field="heroTitle">Original</h1>
      <span data-vllora-field="siteName">Nume vechi</span><picture><source media="(min-width: 1px)" srcset="/old-wide.svg"><img data-vllora-logo src="/old.svg" alt="Siglă"></picture>
      <a data-vllora-link="bookingUrl" href="https://example.org/booking">Rezervă</a>
      <div data-vllora-list="services" data-vllora-template="service"><p>Rezervă existentă</p></div>
      <template id="service"><p data-vllora-item="name"></p></template>
      <div data-vllora-list="products" data-vllora-template="produ"><p>Card existent</p></div>
      <div data-vllora-list="reviews" data-vllora-template="review"><p>Recenzie existentă</p></div>
      <template id="review"><blockquote><b data-vllora-item="name"></b><small data-vllora-item="location"></small>
        <span data-vllora-item="stars" aria-hidden="true"></span><p data-vllora-item="text"></p></blockquote></template>
      <template id="produ"><article class="card"><img data-vllora-item="image" alt=""><b data-vllora-item="name"></b>
        <span data-vllora-item="price"></span><s data-vllora-item="comparePrice"></s>
        <i data-vllora-item="discountLabel"></i><em data-vllora-item="bestseller" data-vllora-label="Bestseller"></em></article></template>
      <footer><div data-vllora-field="companyName"></div><div data-vllora-field="companyCui"></div></footer>
      </main><script defer src="/vllora-content.js" data-api="https://cms.example.org/api/content"></script>`;
    const adapter = await readFile(
      'integrations/static-cms/vllora-content.js',
      'utf8',
    );
    await publicSite.route('https://frizeria.example.org/**', (route) =>
      route.request().url().endsWith('.js')
        ? route.fulfill({ body: adapter, contentType: 'text/javascript' })
        : route.fulfill({
            body: html,
            contentType: 'text/html; charset=utf-8',
          }),
    );
    await publicSite.route('https://cms.example.org/**', (route) =>
      route.fulfill({
        json: {
          content: {
            heroTitle: '<em>Text literal</em>',
            primaryColor: '#224466',
            siteScheme: 'dark',
            siteName: 'Nume nou',
            companyName: '<b>Exemplu SRL</b>',
            companyCui: 'RO12345678',
            logoUrl: 'https://img.example.org/logo.webp',
            services: [{ name: 'Tuns actualizat' }],
            products: [
              {
                name: 'Amestec gazon',
                price: '69 lei',
                discount: 10,
                bestseller: true,
                image: { url: 'https://img.example.org/gazon.webp' },
              },
              { name: 'Îngrășământ', price: '85 lei', discount: 0 },
              // Hidden products stay in the CMS but never reach the shop page.
              { name: 'Ascuns', price: '99 lei', discount: 0, active: false },
            ],
            reviews: [
              {
                name: 'Andrei M.',
                rating: 4,
                location: 'Brașov',
                text: 'Gazonul a răsărit repede.',
              },
            ],
            bookingUrl: 'javascript:void(0)',
          },
        },
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
    );
    await publicSite.goto('https://frizeria.example.org/');
    await publicSite
      .getByRole('heading', { name: '<em>Text literal</em>' })
      .waitFor();
    await publicSite.getByText('Tuns actualizat', { exact: true }).waitFor();
    // A discounted product shows the reduced price and strikes the regular one.
    const deal = publicSite.locator('.card').first();
    await deal.getByText('62.10 lei', { exact: true }).waitFor();
    assert.equal(await deal.locator('s').innerText(), '69 lei');
    assert.equal(await deal.locator('i').innerText(), '−10%');
    assert.equal(await deal.locator('em').innerText(), 'Bestseller');
    assert.equal(
      await deal.locator('img').getAttribute('src'),
      'https://img.example.org/gazon.webp',
    );
    // Without a discount the struck price and the badge are removed, not empty.
    const plain = publicSite.locator('.card').nth(1);
    assert.equal(await plain.locator('s').count(), 0);
    assert.equal(await plain.locator('i').count(), 0);
    assert.equal(await plain.locator('em').count(), 0);
    assert.equal(await plain.getByText('85 lei', { exact: true }).count(), 1);
    // The hidden product is filtered out before the template runs.
    assert.equal(await publicSite.getByText('Ascuns', { exact: true }).count(), 0);
    const review = publicSite.locator('blockquote').first();
    await review.getByText('Andrei M.', { exact: true }).waitFor();
    assert.equal(await review.locator('span').innerText(), '★★★★');
    assert.equal(await review.getByText('Brașov', { exact: true }).count(), 1);
    assert.equal(await publicSite.locator('h1 em').count(), 0);
    await publicSite.getByText('Nume nou', { exact: true }).waitFor();
    await publicSite
      .locator('footer')
      .getByText('<b>Exemplu SRL</b>', { exact: true })
      .waitFor();
    assert.equal(await publicSite.locator('footer b').count(), 0);
    assert.equal(
      await publicSite.getByRole('img', { name: 'Siglă' }).getAttribute('src'),
      'https://img.example.org/logo.webp',
    );
    assert.equal(
      await publicSite.locator('picture source').getAttribute('srcset'),
      null,
    );
    assert.deepEqual(
      await publicSite
        .locator('[data-vllora-theme]')
        .evaluate((el) => [
          el.style.getPropertyValue('--vllora-primary'),
          el.dataset.vlloraScheme,
        ]),
      ['#224466', 'dark'],
    );
    assert.equal(
      await publicSite
        .getByRole('link', { name: 'Rezervă' })
        .getAttribute('href'),
      'https://example.org/booking',
    );
    assert.deepEqual(pageErrors, []);
  },
);
