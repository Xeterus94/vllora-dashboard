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

    await client.goto(`${tenantOrigin}/admin`);
    assert.equal(new URL(client.url()).pathname, '/admin/');
    await login(client, 'client.ui', tmp);
    await client.getByRole('heading', { name: 'Setează-ți parola' }).waitFor();
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
    await client.getByLabel('Alege imagini', { exact: true }).setInputFiles({
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    });
    await client.getByRole('alert').filter({ hasText: 'fake.png' }).waitFor();
    assert.equal(
      (await env.db.prepare('SELECT COUNT(*) AS n FROM media').first()).n,
      2,
    );

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
    assert.deepEqual(pageErrors, []);
  },
);
