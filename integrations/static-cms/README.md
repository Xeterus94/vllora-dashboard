# Legarea unui site static de editorul `/admin`

Acest adaptor este pentru **site-ul public**. Nu înlocuiește `_worker.js` și `_routes.json` din `integrations/pages-client`. Păstrează o copie a site-ului actual. Copiază `vllora-content.js` lângă `index.html`, apoi adaugă înainte de `</body>`:

```html
<script defer src="./vllora-content.js"
  data-api="https://vllora-dashboard.ionstefan0904.workers.dev/api/content"
  data-site="frizeriata.pages.dev"></script>
```

Adaugă atribute doar elementelor pe care vrei să le controleze editorul. Păstrează clasele și conținutul actual ca rezervă. Exemplu:

```html
<h1 class="hero-title" data-vllora-field="heroTitle">Titlul actual</h1>
<p data-vllora-field="heroSubtitle">Subtitlul actual</p>
<p data-vllora-field="announcement" data-vllora-empty="replace"></p>
<img data-vllora-hero-image src="assets/hero.webp" alt="Frizeria" />
<a href="https://example.com/programari" data-vllora-link="bookingUrl">
  <span data-vllora-field="bookingLabel">Programează-te</span>
</a>
<a href="tel:+40123456789" data-vllora-link="phone"><span data-vllora-field="phone">0123456789</span></a>

<div class="services-grid" data-vllora-list="services" data-vllora-template="service-item">
  <!-- Cardurile existente rămân aici, ca rezervă. -->
</div>
<template id="service-item">
  <article class="service-card">
    <h3 data-vllora-item="name"></h3>
    <p data-vllora-item="description"></p>
    <span data-vllora-item="price"></span>
    <small data-vllora-item="duration"></small>
  </article>
</template>
```

Câmpuri text: `siteName`, `heroTitle`, `heroSubtitle`, `announcement`, `aboutTitle`, `aboutText`, `bookingLabel`, `phone`, `whatsapp`, `email`, `address`. Linkuri: `bookingUrl`, `mapsUrl`, `facebook`, `instagram`, `phone`, `whatsapp`, `email`. Liste: `services` (`name`, `description`, `price`, `duration`), `hours` (`day`, `time`), `images` (elemente `img` cu `data-vllora-item="url"`), `documents` (link cu `data-vllora-item="url"`; în interior, `span` cu `data-vllora-item="name"`). Pune atributele de text pe elemente-frunză, nu pe containere cu iconițe sau alte elemente.

Dacă o valoare sau listă este goală, rămâne conținutul de rezervă; adaugă `data-vllora-empty="replace"` pe elementele de text/listă care trebuie golite explicit. Dacă site-ul folosește CSP, permite originea API în `connect-src` și originea imaginilor din răspuns în `img-src`. Scriptul nu conține parole sau tokenuri și nu introduce HTML din CMS.

Publică întregul folder al site-ului (inclusiv adaptorul `/admin` deja funcțional) abia după ce ai adaptat selectorii la designul lui. Testează editarea textului și listele pe o copie înainte de publicarea pe domeniul principal. Site-urile cu programări, carusele sau alte componente dinamice pot avea nevoie de integrare în scriptul lor, nu doar de marcarea HTML-ului.

## Importă conținutul inițial în ambele panouri

În editor, apasă **Importă de pe site**. Worker-ul verifică numai pagina publică de la domeniul configurat și manifestul de mai jos; nu execută scripturile site-ului. Importul oferă sugestii, nu salvează și nu înlocuiește câmpurile sau listele deja completate. O nouă scanare poate corecta linkurile importate anterior sub `/.well-known/` numai când manifestul confirmă aceeași cale la rădăcina site-ului. Imaginile descoperite se păstrează ca URL-uri HTTPS, nu se copiază în R2. Pentru a le stoca drept WebP, descarcă-le și atașează-le din editor. O siglă sau imagine principală încărcată are prioritate față de URL-ul de rezervă.

Pe paginile fără manifest, scanarea încearcă să detecteze din HTML numele, logo-ul, paleta, titlul principal, marcajele `data-vllora-field` / `data-cms`, unele linkuri de contact, imaginea principală (`data-vllora-hero-image` sau `og:image`), și galeria (`data-vllora-gallery`, `#gallery` / `#galerie` sau imagini individuale `data-vllora-gallery-image`). Fără un manifest, serviciile și programul generate din JavaScript nu sunt ghicite.

Pentru o preluare exactă, publică **`/.well-known/vllora-content.json`** în output-ul site-ului, alături de `index.html` (nu în dashboard). Exemplu:

```json
{
  "version": 1,
  "content": {
    "siteName": "Frizeria TA",
    "primaryColor": "#694432",
    "secondaryColor": "#383030",
    "accentColor": "#D7AC73",
    "siteScheme": "dark",
    "logoUrl": "/assets/logo.webp",
    "heroTitle": "Titlul existent",
    "heroImageUrl": "/assets/hero.webp",
    "images": ["/assets/galerie-1.webp"],
    "services": [{ "name": "Tuns", "description": "Consultanță și styling", "price": "80 lei", "duration": "45 min" }],
    "hours": [{ "day": "Luni", "time": "09:00–18:00" }]
  }
}
```

Linkurile din manifest se rezolvă de la rădăcina site-ului: atât `assets/poza.webp`, cât și `/assets/poza.webp` înseamnă `/assets/poza.webp`, nu `/.well-known/assets/poza.webp`. Pentru consumatorii API personalizați, `content.images` include galeria completă (URL-uri importate și fișiere încărcate); `content.gallery` conține doar metadatele fișierelor încărcate. Câmpurile `heroImageUrl` și `logoUrl` din API-ul public sunt URL-urile efective, cu prioritate pentru fișierul încărcat.

Folosește în manifest numai date publice, pe care ai verificat că vrei să le imporți. Nu include parole, chei, date despre clienți, sau adrese interne. Culorile publicate în CMS se aplică numai dacă site-ul optează pentru ele, de exemplu:

```html
<html lang="ro" data-vllora-theme>
<!-- ... -->
<img data-vllora-logo src="/assets/logo.webp" alt="Siglă" />
<span data-vllora-field="siteName">Numele actual</span>
```

În CSS folosește variabilele `--vllora-primary`, `--vllora-secondary` și `--vllora-accent` cu fallback la culorile existente (ex. `color: var(--vllora-primary, #694432)`). Pentru temă folosește selectorul `[data-vllora-scheme="dark"]` pe elementul marcat. Aceste setări țin de site-ul public; nu schimbă brandingul de autentificare al portalului. Manifestul este pentru import, iar scriptul adaptor este pentru afișarea datelor publicate; unul nu îl înlocuiește pe celălalt.

## Datele firmei în subsol

În fișa clientului sau în **Editează site-ul → Nume și culori → Datele firmei** poți completa denumirea legală, CUI / CIF, numărul Registrului Comerțului și adresa sediului social. Sunt câmpuri **publice** prin CMS: salvează doar datele pe care firma le afișează public. Acestea sunt separate de numele comercial, adresa de contact și setările de facturare.

Adaugă atributele în **subsolul site-ului**, imediat după elementul care afișează numele. Păstrează clasele necesare designului local. Exemplu:

```html
<footer>
  <strong data-vllora-field="siteName">Numele site-ului</strong>
  <div class="company-details">
    <div data-vllora-field="companyName" data-vllora-empty="replace"></div>
    <div data-vllora-field="companyCui" data-vllora-empty="replace"></div>
    <div data-vllora-field="companyRegistry" data-vllora-empty="replace"></div>
    <div data-vllora-field="companyAddress" data-vllora-empty="replace"></div>
  </div>
</footer>
```

Site-urile cu adaptor propriu trebuie să citească aceste patru chei noi din `content`. Câmpurile goale trebuie omise, nu confundate cu datele de facturare din master. Textele se afișează ca text simplu (`textContent`), nu ca HTML.

## Toate paginile în master (manifest CMS v2)

În master, deschide **Conținut site (CMS) → Deschide editorul vizual → Toate paginile**. La deschidere, editorul caută automat inventarul v2 și precompletează câmpurile noi cu valorile originale. Importul nu suprascrie câmpurile deja conectate și modificate, inclusiv imaginile eliminate. Nimic nu apare public până la **Publică modificările**. Importul v1 și fallbackul primei pagini rămân disponibile.

### Leagă designul și datele de editor

1. Pune versiunea actuală de `vllora-content.js` pe **fiecare pagină publică**, după codul care ascultă datele de grafic. Păstrează CSS-ul, animațiile și scripturile existente. Nu adăuga scriptul pentru a edita pagini private, rezervări, date despre clienți sau setări interne.
2. Marchează elementele editabile cu identificatori stabili per pagină. `data-vllora-text` se pune pe elemente fără markup copil, de exemplu un `<span>` aflat în interiorul unui titlu animat. Pentru imagini, marchează `<img>` (inclusiv în `<picture>`). Pentru fundaluri, folosește `data-vllora-background`; valoarea inițială este în `data-vllora-value`. SVG-urile sau graficele desenate ca fișiere imagine pot fi tratate ca imagini. Titlurile, textele din butoane, etichetele și valorile grafice trebuie mapate separat dacă vrei să le editezi separat.

```html
<h1 class="reveal"><span data-vllora-text="title" data-vllora-label="Titlu">Despre noi</span></h1>
<img data-vllora-image="cover" data-vllora-label="Copertă" src="/assets/cover.webp" alt="Echipa">
<canvas id="chart" data-vllora-number="yearly.total" data-vllora-label="Total anual" data-vllora-value="425"></canvas>
<script defer src="/chart-app.js"></script>
<script defer src="/vllora-content.js" data-api="https://dashboard.example.com/api/content"></script>
```

3. Generează `/.well-known/vllora-content.json` din folderul public final, înainte de deploy. Rulează `node integrations/static-cms/build-manifest.mjs /cale/catre/site-output` din checkoutul dashboardului după `npm ci`, de exemplu într-un workflow GitHub Actions cu ambele proiecte. Scriptul citește textele, adresele imaginilor și valorile marcate din HTML, păstrează `content` din vechiul manifest și nu accesează rețeaua. Nu rula pe un director care conține pagini sau date private. Dacă paginile sau câmpurile sunt generate în browser, generează manifestul din aceleași date publice pe care le folosește aplicația și aplică valorile în componentele originale; scanarea HTML nu execută codul site-ului.

Format minim, dacă îl generezi din aplicație:

```json
{
  "version": 2,
  "content": {},
  "pages": [
    { "path": "/despre/", "title": "Despre noi", "fields": [
      { "id": "title", "label": "Titlu", "kind": "text", "value": "Despre noi" },
      { "id": "cover", "label": "Copertă", "kind": "image", "value": "/assets/cover.webp" },
      { "id": "yearly.total", "label": "Total anual", "kind": "number", "value": "425" }
    ] }
  ]
}
```

Căile paginilor sunt locale, publice și fără query/fragment. URL-urile relative ale imaginilor v2 se rezolvă față de pagina declarată, la fel ca în HTML. Limitele sunt 40 de pagini, 800 de câmpuri, 6.000 de caractere pentru un text și 320 KiB de date pentru pagini. Un `value` gol pentru un câmp de imagine ascunde imaginea conectată, fără a șterge fișierul din repository. Înlocuirea prin încărcare folosește pipeline-ul WebP al masterului.

### Grafice și previzualizare reală

Adaptorul nu rescrie automat bibliotecile de grafice. Leagă datele de evenimentul `vllora:page-content` și actualizează graficul original; păstrezi astfel culorile, animația și interacțiunile. Valorile numerice vin ca șiruri, iar șirul gol înseamnă valoare ștearsă:

```js
document.addEventListener('vllora:page-content', ({ detail }) => {
  const field = detail.fields.get('yearly.total');
  if (field?.kind === 'number' && field.value !== '') {
    chart.data.datasets[0].data[0] = Number(field.value);
    chart.update();
  }
});
```

În master, **Previzualizează site-ul real** încarcă pagina originală de la domeniul clientului și rulează animațiile ei în cadrul de previzualizare. Navigarea între pagini și lățimea de telefon sunt disponibile. Adaptorul acceptă draftul numai din cadrul deschis de originea dashboardului configurat (`data-api` sau, dacă originile diferă, `data-preview-origin="https://dashboard.example.com"`). Site-ul trebuie să permită afișarea în iframe din originea masterului (CSP `frame-ancestors` pe rutele publice; păstrează protecțiile `/admin`). În lipsa adaptorului vezi doar site-ul publicat; dacă site-ul blochează iframe-ul, folosește **Deschide pagina publicată**. Cadrul nu acordă permisiune formularelor native, popup-urilor sau navigării părintelui; pentru aplicații cu rezervări, analytics sau alte efecte declanșate din JavaScript, dezactivează aceste acțiuni în modul încorporat la nivelul site-ului.
