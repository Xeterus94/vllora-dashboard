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

Câmpuri text: `heroTitle`, `heroSubtitle`, `announcement`, `aboutTitle`, `aboutText`, `bookingLabel`, `phone`, `whatsapp`, `email`, `address`. Linkuri: `bookingUrl`, `mapsUrl`, `facebook`, `instagram`, `phone`, `whatsapp`, `email`. Liste: `services` (`name`, `description`, `price`, `duration`), `hours` (`day`, `time`), `images` (elemente `img` cu `data-vllora-item="url"`), `documents` (link cu `data-vllora-item="url"`; în interior, `span` cu `data-vllora-item="name"`). Pune atributele de text pe elemente-frunză, nu pe containere cu iconițe sau alte elemente.

Dacă o valoare sau listă este goală, rămâne conținutul de rezervă; adaugă `data-vllora-empty="replace"` pe elementele de text/listă care trebuie golite explicit. Dacă site-ul folosește CSP, permite originea API în `connect-src` și originea imaginilor din răspuns în `img-src`. Scriptul nu conține parole sau tokenuri și nu introduce HTML din CMS.

Publică întregul folder al site-ului (inclusiv adaptorul `/admin` deja funcțional) abia după ce ai adaptat selectorii la designul lui. Testează editarea textului și listele pe o copie înainte de publicarea pe domeniul principal. Site-urile cu programări, carusele sau alte componente dinamice pot avea nevoie de integrare în scriptul lor, nu doar de marcarea HTML-ului.
