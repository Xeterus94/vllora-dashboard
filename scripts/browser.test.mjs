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
      viewport: { width: 1240, height: 900 },
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
    const requests = [];
    master.on('request', (request) => requests.push(request.url()));
    await master.goto(masterOrigin);
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
    assert.ok(await master.evaluate(() => window.Chart.getChart('chartPerf')));
    assert.equal(
      await master
        .locator('#app')
        .evaluate((el) => getComputedStyle(el).minHeight),
      '900px',
    );
    await master.locator('#logoutBtn').click();
    await master.locator('#login').waitFor();
    await master.getByLabel('Username', { exact: true }).fill('master.ui');
    await master.getByLabel('Password', { exact: true }).fill(masterPassword);
    await master.locator('#loginBtn').click();
    await master.locator('#app').waitFor();
    await master.locator('#addClient').click();
    await master.locator('#edName').fill('Master UI Portfolio Site');
    await master.locator('#edDomain').fill('portfolio.example.com');
    await master.locator('[data-tab="cms"]').click();
    await master.locator('#edHeroTitle').fill('A D1-backed title');
    await master.locator('#saveBtn').click();
    await master.locator('#editor').waitFor({ state: 'hidden' });
    await master.reload();
    await master
      .getByText('Master UI Portfolio Site', { exact: true })
      .waitFor();
    assert.ok(requests.every((url) => url.startsWith(masterOrigin + '/')));
    await master
      .getByRole('row')
      .filter({ hasText: 'Master UI Portfolio Site' })
      .locator('[data-edit]')
      .click();
    await master.locator('[data-tab="cms"]').click();
    await master.locator('#liveCmsLink').click();
    await master
      .getByRole('heading', { name: 'Master UI Portfolio Site', exact: true })
      .waitFor();
    assert.equal(
      await master.getByLabel('Titlu principal', { exact: true }).inputValue(),
      'A D1-backed title',
    );
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
          images: [],
          services: [],
          hours: [],
        },
      }),
    );
    await master.getByRole('button', { name: 'Importă de pe site' }).click();
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
    await master
      .getByRole('button', { name: 'Previzualizează', exact: true })
      .click();
    await master.getByRole('heading', { name: 'Publicat de master' }).waitFor();
    await master.getByRole('button', { name: 'Înapoi la editor' }).click();
    await master.getByRole('button', { name: 'Publică modificările' }).click();
    await master
      .getByRole('status')
      .filter({ hasText: 'Conținut publicat' })
      .waitFor();
    const fromMaster = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=portfolio.example.com',
    );
    assert.equal(fromMaster.json.content.heroTitle, 'Publicat de master');
    assert.equal(fromMaster.json.businessName, 'Nume detectat');
    assert.equal(fromMaster.json.content.gallery[0].id, masterImage.id);

    await master.goto(`${masterOrigin}/portal-admin/`);
    await master.getByRole('heading', { name: 'Site-uri și acces' }).waitFor();
    await master
      .getByRole('button', { name: 'Adaugă site', exact: true })
      .click();
    await master
      .getByLabel('Domeniu', { exact: false })
      .first()
      .fill('siteclient.com');
    await master.getByLabel('Nume afișat (opțional)').fill('Bluebird Studio');
    await master
      .getByLabel('Profilul site-ului', { exact: false })
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
    await client
      .getByLabel('Titlu principal', { exact: true })
      .fill('Un titlu din editorul mobil');
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
    await client
      .getByRole('button', { name: 'Servicii și prețuri', exact: true })
      .click();
    await client.getByRole('button', { name: 'Adaugă serviciu' }).click();
    await client.getByLabel('Nume serviciu 1').fill('Tuns din portal');
    await client.getByLabel('Preț 1').fill('90 lei');
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
    assert.equal(
      await client.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await client.getByRole('button', { name: 'Înapoi la editor' }).click();
    await client.getByRole('button', { name: 'Publică modificările' }).click();
    await client
      .getByRole('status')
      .filter({ hasText: 'Conținut publicat' })
      .waitFor();
    const publicEditor = await call(
      env.mf,
      masterOrigin,
      '/api/content?site=siteclient.com',
    );
    assert.equal(publicEditor.json.content.services[0].name, 'Tuns din portal');
    assert.equal(publicEditor.json.content.documents[0].name, 'program.pdf');
    assert.ok(
      publicEditor.json.content.heroMedia.url.startsWith(
        masterOrigin + '/media/',
      ),
    );
    await client.reload();
    await client
      .getByRole('button', { name: 'Editează site-ul', exact: true })
      .click();
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
    // Exercise the public-site adapter separately; it must not inject markup or unsafe links.
    const publicSite = await browser.newPage();
    t.after(() => publicSite.close());
    const html = `<main data-vllora-theme><h1 data-vllora-field="heroTitle">Original</h1>
      <span data-vllora-field="siteName">Nume vechi</span><img data-vllora-logo src="/old.svg" alt="Siglă">
      <a data-vllora-link="bookingUrl" href="https://example.org/booking">Rezervă</a>
      <div data-vllora-list="services" data-vllora-template="service"><p>Rezervă existentă</p></div>
      <template id="service"><p data-vllora-item="name"></p></template>
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
            logoUrl: 'https://img.example.org/logo.webp',
            services: [{ name: 'Tuns actualizat' }],
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
    assert.equal(await publicSite.locator('h1 em').count(), 0);
    await publicSite.getByText('Nume nou', { exact: true }).waitFor();
    assert.equal(
      await publicSite.getByRole('img', { name: 'Siglă' }).getAttribute('src'),
      'https://img.example.org/logo.webp',
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
