# Vllora Studio — Backoffice și portal client

Aplicația React și API-ul rulează în același Cloudflare Worker. Masterul administrează site-uri, conturi, branding, media, metrici și jurnalul de activitate. Clientul intră la `https://domeniul-lui.ro/admin`, își schimbă parola temporară la prima autentificare și vede exclusiv datele propriului site. Domeniul platformei este rezervat masterului.

- **Worker + D1:** sesiuni în cookie `HttpOnly`, limitare persistentă, resetare cu link prin Resend și autorizare pe hostname și site. Portalul nu folosește ID-ul trimis de browser pentru a alege site-ul.
- **R2 + KV:** biblioteca fiecărui site, logo/favicon și branding detectat automat (opțional cache în KV); uploadurile UI se convertesc în WebP înainte de transfer. Metadatele și fișierele sunt separate.
- **Analytics Engine + D1:** trafic prin `track.js`, istoric pe zile și fallback la rollup. Metricile de business folosesc un dataset separat și un registru D1 pentru deduplicare și valori financiare exacte.
- Dashboardul HTML dinaintea acestui modul rămâne în `legacy/standalone-dashboard.html`. Componentele React de demo existente nu mai sunt importate de aplicația nouă.

## Dezvoltare locală

Necesită **Node.js 22.12+**. Nu sunt necesare conturi Cloudflare sau Resend pentru testele locale.

```sh
npm ci
cp .dev.vars.example .dev.vars
# Generează și înlocuiește BOOTSTRAP_TOKEN și TRACK_SALT cu valori aleatorii locale.
npm run db:local
npm run build
npm run dev                       # http://localhost:8787
```

`npm run dev:ui` pornește Vite la `http://localhost:3000` și face proxy la Worker pentru API, tracking, media și `/admin/*`. Interfața master are hot reload; `/admin/` folosește buildul din `dist`, deci reconstruiește-l după modificări ale interfeței tenant. Pentru portalul local, configurează `127.0.0.1 siteclient.com` în fișierul hosts și creează site-ul `siteclient.com` în master. Intră la `http://siteclient.com:8787/admin`. Detectarea automată a brandingului și integrările externe nu sunt necesare în dev.

Inițializează masterul o singură dată prin `POST /api/bootstrap` (vezi mai jos, folosind URL-ul local și tokenul din `.dev.vars`). Nu există parole demo în runtime.

```sh
npm run typecheck             # TypeScript UI + Worker
npm test                      # D1/R2 local, Resend/Cloudflare API simulate, autorizare și rollup cron
npm run test:ui               # Chromium: desktop/mobil, fluxuri de acces, reset și WebP
```

Testele pornesc un Workerd izolat cu baze efemere; nu porni aplicația separat. Pe Linux testul UI folosește un Chromium inclus prin npm (are nevoie de librăriile de sistem Chromium/NSS); în CI se instalează dependențele cu `npx playwright install-deps chromium`. Poți folosi `CHROMIUM_EXECUTABLE` pentru alt executabil sau `npx playwright install chromium` pe macOS/Windows.

## Publicare pe Cloudflare

1. Autentifică Wrangler (`npx wrangler login`) sau configurează un token de deploy în mediul CI. Creează resursele în contul care va găzdui Worker-ul:

   ```sh
   npx wrangler d1 create vllora_backoffice
   npx wrangler r2 bucket create vllora-media
   npx wrangler kv namespace create BRAND_CACHE  # opțional
   ```

2. În `wrangler.jsonc` completează `database_id`. Dacă folosești KV, adaugă `"kv_namespaces": [{"binding":"BRAND_CACHE","id":"ID_UL_TĂU"}]`. Setează `APP_ORIGIN` și `MASTER_API_BASE` la originea HTTPS reală a platformei și configurează domeniul personalizat în Cloudflare (sau adaugă `routes: [{ pattern: "portal.domeniu.ro", custom_domain: true }]` în configurație). Lasă `assets.run_worker_first: true`: fără el, hostname-ul poate să nu fie verificat înainte de servirea shell-ului.
3. Aplică `npm run db:init` **înainte de deploy**, după backup pentru o bază existentă. Migrațiile numerotate din `worker/migrations/` se aplică în ordine; `worker/schema.sql` este echivalentul pentru o **bază goală**. Pentru o instalare externă care are deja tabele dar nu are istoricul Wrangler, compară schema și aplică doar migrările lipsă (nu rula schema completă peste datele existente).
4. Configurează secretele cu `npx wrangler secret put NUME` (niciun secret nu se pune în Git):

   | Secret | Utilizare |
   | --- | --- |
   | `BOOTSTRAP_TOKEN` | Temporar, aleatoriu, minim 16 caractere, numai pentru crearea masterului |
   | `TRACK_SALT` | Sare aleatorie pentru hashul zilnic al vizitatorului; recomandat `openssl rand -hex 32` |
   | `CF_ACCOUNT_ID` + `CF_AE_API_TOKEN` | Analytics Engine SQL; token cu **Account → Analytics → Read** pentru contul respectiv |
   | `CF_API_TOKEN` | Opțional: automatizare rute, **Zone:Read** și **Workers Routes:Edit** strict pe zonele administrate |
   | `RESEND_API_KEY` + `EMAIL_FROM` | Recuperare parolă; domeniu expeditor verificat în Resend cu înregistrările DNS cerute |

5. Rulează `npm run deploy`. Creează apoi masterul și elimină `BOOTSTRAP_TOKEN`:

   ```sh
   curl -X POST https://portal.domeniu.ro/api/bootstrap \
     -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" -H 'Content-Type: application/json' \
     -d '{"username":"vllora","name":"Administrator","password":"ÎNLOCUIEȘTE_CU_PAROLA_TA_4!"}'
   npx wrangler secret delete BOOTSTRAP_TOKEN
   ```

   Setează și verifică adresa master din **Email recuperare**; clientului îi configurezi adresa din **Acces client**. Trimite un link de test în fiecare caz. În producție furnizorul este întotdeauna Resend, chiar dacă este setat un URL mock de dezvoltare. Fără o adresă salvată, recuperarea automată nu este disponibilă pentru acel cont.
6. Pentru client: domeniul trebuie să fie într-o zonă Cloudflare cu DNS proxied. Worker-ul încearcă să configureze `domeniu-client.ro/admin*`; în editor → **Acces client** poți reîncerca. Dacă zona nu e accesibilă tokenului, adaugă ruta manual, cu scriptul `vllora-backoffice`. Verifică să nu existe un alt admin la acel prefix. Hostname-ul suplimentar (`portal_host`) necesită DNS, certificat și rutare separată; hostname-urile sunt potrivite exact. Domeniul principal rămâne identitatea site-ului; pentru alt domeniu folosește un alias de portal sau creează un site nou.

### Media și branding

- `MEDIA_PUBLIC_BASE` gol: fișierele sunt publice prin Worker, cu ETag și CSP `sandbox`. Dacă ai nevoie de livrare directă, configurează **R2 → Public access → Custom domain** pe un **domeniu dedicat imaginilor** și setează `MEDIA_PUBLIC_BASE=https://cdn.domeniu.ro`. URL-urile vechi ale Worker-ului rămân funcționale. Nu încărca documente private; cache-urile deja populate nu expiră instantaneu la ștergere.
- La creare și rescan, Worker-ul încearcă `/.well-known/vllora-brand.json`; altfel caută metadate și culori în HTML. Contractul acceptă `name`, `logo`, `colors: {primary, secondary, accent}` și `scheme: "light" | "dark"`. Logoul detectat este copiat în R2 (nu hotlink/base64). Schimbările manuale se păstrează la rescan dacă nu alegi **Forțează rescan**.
- Limite: 8 MiB/fișier, 200 MiB/site. SVG-urile cu funcționalități active nu sunt acceptate nici prin API; combinațiile de elemente/atribute suportate sunt în `worker/media.ts`. În UI, SVG-urile și imaginile animate se rasterizează într-un WebP static, ca toate uploadurile UI. Importul server-side păstrează formatul.
- Pentru site-uri cu `logo_data` vechi, după migrațiile D1 apelează `POST /api/admin/maintenance/migrate-logos` cu sesiunea master. Este idempotent; rândurile neacceptate apar în `skipped` și nu sunt șterse.

### Tracking și metrici de business

Copiază din editor tagul clientului:

```html
<script async src="https://portal.domeniu.ro/track.js" data-vllora-site="TOKEN_PUBLIC_SITE"></script>
<a href="/meniu" data-vllora-event="menu_view">Vezi meniul</a>
<main data-vllora-view="product_view">...</main>
```

Scriptul nu setează cookie-uri de analytics și nu transmite cookie-uri la colector. Folosește `sessionStorage` pentru a aproxima sesiunile pe filă. Vizitatorii sunt deduplicați pe zi, nu pe întreaga perioadă; adresa IP nu este stocată în clar. Revizuiește cerințele de confidențialitate și consimțământ aplicabile site-ului înainte de activare. Analytics Engine poate eșantiona datele. Fără acces SQL, statisticile de trafic afișează ce există deja în rollup, nu rezultate live.

`shared/metrics.ts` definește profilurile, evenimentele și sursa browser/server. Profilul este doar un șablon; selectarea nu instalează integrări și nu recuperează retroactiv evenimente. Folosește `window.Vllora?.track('add_to_cart')` după reușita acțiunii; linkurile telefon/email/WhatsApp se detectează automat. Evenimentele browser sunt orientative, nu dovezi de tranzacții.

Pentru comenzi sau programări confirmate, generează cheia server o singură dată și păstreaz-o numai în backend. Raportează după confirmarea evenimentului de către integrarea ta, nu la încărcarea paginii de mulțumire:

```sh
curl -X POST https://portal.domeniu.ro/api/collect-event \
  -H "Authorization: Bearer $VLLORA_SERVER_KEY" -H 'Content-Type: application/json' \
  -d '{"site":"TOKEN_PUBLIC_SITE","event":"order_paid","event_id":"order-paid-001","amount_cents":12550,"currency":"RON"}'
```

`event_id` trebuie să rămână stabil la retry (8–100 caractere, fără date personale). `amount_cents` este un întreg în unități minore; moneda per site se blochează după prima comandă raportată. `order_paid` actualizează numărul și valoarea; nu trimite eveniment `revenue`. Identificatorii și sumele duplicate nu rescriu primul eveniment. Nu trimite date de contact în payload, URL-uri sau ID-uri de eveniment. Nu există conectori automați pentru procesatoare/CRM, nici contabilizare de taxe, retururi sau atribuirea vânzărilor. Planifică rollup/arhivare pentru registre D1 de volum mare.

### Rute API principale

| Domeniu master | Domeniu client (`/admin` prefix) |
| --- | --- |
| `/api/auth/{login,me,logout,change-password,forgot-password,reset-password,sessions/revoke-all}` | `/admin/api/auth/...`, cu aceleași operații |
| `PATCH /api/auth/recovery-email` | — |
| `/api/admin/{overview,sites,audit}`, `/api/admin/sites/:id/{users,stats,metrics,metrics-key,media,refresh-branding,sync-route}` | `/admin/api/portal/{me,stats,metrics,media}`, `PATCH /admin/api/portal/site` |
| `/api/admin/users/:id` (PATCH/DELETE), `/api/admin/users/:id/reset-password` (POST) | — |
| `/track.js`, `POST /api/{collect,collect-event}`, `GET /media/<key>` | `GET /admin/media/<key>` |

Rapoartele acceptă `days=7`, `30`, `90` sau `365`, inclusiv ziua UTC curentă. Actualizarea automată și cronul la **02:15 UTC** nu înlocuiesc verificarea cu trafic real după deploy.
