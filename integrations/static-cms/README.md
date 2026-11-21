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
