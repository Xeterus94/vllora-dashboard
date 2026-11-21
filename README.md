# Vllora Studio — Backoffice și portal client

Un singur Worker, `vllora-dashboard`, publică din acest repository panoul master și aplicația React pentru portaluri. Sesiunea de staff este comună celor două interfețe de pe domeniul master; sesiunile clienților sunt separate, pe hostname-ul lor.

| Interfață | Adresă | Rol |
| --- | --- | --- |
| **Panoul master complet** | [vllora-dashboard.ionstefan0904.workers.dev](https://vllora-dashboard.ionstefan0904.workers.dev/) | Designul original, cu portofoliu, MRR, abonamente, CMS, setările studioului și modul demo. |
| **Portal client** | `https://domeniul-clientului.ro/admin` | Interfața React simplificată. Clientul își schimbă parola temporară la prima autentificare și vede numai propriul site. |
| **Administrare portaluri client** | [vllora-dashboard…workers.dev/portal-admin/](https://vllora-dashboard.ionstefan0904.workers.dev/portal-admin/) | Operațiuni de staff pentru portaluri: înregistrarea site-ului, accesul clientului, branding, media, metrici și jurnal. |

Panoul master nu redirecționează spre vechiul proiect Pages și nu apelează Worker-ul `dashboard-master`. Site-urile din portofoliu și portalurile folosesc aceleași înregistrări din D1 (`vllora_backoffice`).

- **Worker + D1:** sesiuni în cookie `HttpOnly`, limitare persistentă, resetare cu link prin Resend și autorizare pe hostname și site. Portalul nu folosește ID-ul trimis de browser pentru a alege site-ul.
- **Parole:** PBKDF2-SHA256 cu 210.000 de iterații, calculat într-un Durable Object privat și fără stare. Hash-urile deja salvate în D1 rămân compatibile.
- **R2 + KV:** biblioteca fiecărui site, logo/favicon și branding detectat automat (opțional cache în KV); imaginile din UI sunt optimizate înainte de transfer. Metadatele și fișierele sunt separate.
- **Analytics Engine + D1:** trafic prin `track.js`, istoric pe zile și fallback la rollup. Metricile de business folosesc un dataset separat și un registru D1 pentru deduplicare și valori financiare exacte.
- **Surse:** `master/` pentru panoul complet și `src/` pentru interfața React; `worker/` pentru API și migrații.

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

`npm run dev` servește panoul complet la `http://localhost:8787/` și administrarea portalurilor la `/portal-admin/`. Rulează `npm run build` din nou după modificarea interfețelor (`npm run build:master` e suficient dacă ai schimbat numai `master/`). `npm run dev:ui` oferă și un proxy Vite pe portul 3000, dar folosește aceleași builduri pentru rutele Worker-ului. Pentru portalul local, configurează `127.0.0.1 siteclient.com` în fișierul hosts, creează site-ul `siteclient.com` în master, apoi intră la `http://siteclient.com:8787/admin`.

Inițializează masterul o singură dată prin `POST /api/bootstrap` (vezi mai jos, folosind URL-ul local și tokenul din `.dev.vars`). Nu există parole demo în runtime.

```sh
npm run typecheck             # TypeScript UI + Worker
npm test                      # D1/R2 local, Resend/Cloudflare API simulate, autorizare și rollup cron
npm run test:ui               # Chromium: desktop/mobil, fluxuri de acces, reset și WebP
```

Testele pornesc un Workerd izolat cu baze efemere; nu porni aplicația separat. Pe Linux testul UI folosește un Chromium inclus prin npm (are nevoie de librăriile de sistem Chromium/NSS); în CI se instalează dependențele cu `npx playwright install-deps chromium`. Poți folosi `CHROMIUM_EXECUTABLE` pentru alt executabil sau `npx playwright install chromium` pe macOS/Windows.

## Build și publicare din GitHub

- În Cloudflare → **Workers & Pages → vllora-dashboard → Settings → Builds**, conectează acest repository, ramura de producție `main`, directorul rădăcină `/`. Comanda de build: `npm run build`. Comanda de deploy: `npx wrangler deploy`. Aplică migrațiile înainte de primul deploy al acestei versiuni, conform pasului 3. Dacă alegi să rulezi migrațiile în pipeline, tokenul de build trebuie să aibă acces D1 Edit, iar comanda de deploy devine `npm run db:init && npx wrangler deploy`.
- `npm run build` pregătește React în `dist-portal/` și adaugă masterul în `dist-portal/master/`. CSS, Chart.js și fonturile sunt livrate local de Worker. Nu configura niciun proiect Pages pentru panoul master și nu publica manual fișierele generate.
- `APP_ORIGIN` și `MASTER_API_BASE` rămân pe originea reală a Worker-ului. Poți configura un domeniu propriu pentru Worker în loc de `workers.dev`; adresa veche `pages.dev` nu este noua adresă master.

### Trecerea de la panoul încărcat manual

1. Dacă există date în instalarea veche, exportă/realizează backup înainte să schimbi ceva. Migrarea `0007_portfolio.sql` extinde **doar** D1-ul `vllora_backoffice`: păstrează site-urile, utilizatorii și datele existente aici. Nu copiază date, parole, imagini sau istoricul din vechiul Worker.
2. Completează abonamentele și conținutul pe **site-urile existente** din noul portofoliu, potrivind după domeniu. Adaugă doar domeniile lipsă. Valorile facturării sunt în USD, stocate în cenți; pentru site-urile fără abonament completat, nu se presupune un tarif. MRR istoric se estimează din tarifele curente și datele de creare/suspendare disponibile; nu este un registru de facturi. Setările din „Studio settings” rămân locale în browser, ca în interfața originală.
3. Dacă un site public citește din vechiul CMS, actualizează proiectul acelui site să citească `GET https://vllora-dashboard.ionstefan0904.workers.dev/api/content?site=domeniu-client.ro`. Răspunsul pentru un site activ este `{ businessName, domain, content }`; câmpurile din tabul CMS sunt publice, dar datele de facturare și acces nu sunt. Integrarea clientului trebuie să redea textele ca text, nu ca HTML. Verifică și URL-urile imaginilor, precum și tracking-ul. Fără surse de monitorizare/cereri de conținut, acele secțiuni nu afișează valori simulate în modul autentificat.
4. Verifică loginul master, portalurile și site-urile publice înainte de retragerea resurselor vechi. Folosește „Suspendat” pentru a opri accesul temporar. Ștergerea confirmată din portofoliu elimină site-ul și datele asociate din noul backoffice, inclusiv accesul la portal și media. Nu șterge vechile resurse cât timp mai sunt consumatori sau date neverificate.

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

5. Rulează `npm run deploy`. Wrangler creează automat binding-ul `PASSWORD_KDF` la deploy prin migrația Durable Objects din `wrangler.jsonc`; nu este nevoie să creezi o resursă manual sau să modifici schema D1 pentru acest binding. Creează apoi contul pentru administrarea portalurilor, dacă nu există deja, și elimină `BOOTSTRAP_TOKEN`:

   ```sh
   curl -X POST https://vllora-dashboard.ionstefan0904.workers.dev/api/bootstrap \
     -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" -H 'Content-Type: application/json' \
     -d '{"username":"adminvllora","name":"Ion Stefan","password":"ÎNLOCUIEȘTE_CU_PAROLA_TA_4!"}'
   npx wrangler secret delete BOOTSTRAP_TOKEN
   ```

   Setează și verifică adresa master din **Email recuperare**; clientului îi configurezi adresa din **Acces client**. Trimite un link de test în fiecare caz. În producție furnizorul este întotdeauna Resend, chiar dacă este setat un URL mock de dezvoltare. Fără o adresă salvată, recuperarea automată nu este disponibilă pentru acel cont.
6. Pentru client: domeniul trebuie să fie într-o zonă Cloudflare cu DNS proxied. Worker-ul încearcă să configureze `domeniu-client.ro/admin*`; în editor → **Acces client** poți reîncerca. Dacă zona nu e accesibilă tokenului, adaugă ruta manual, cu scriptul `vllora-dashboard`. Verifică să nu existe un alt admin la acel prefix. Hostname-ul suplimentar (`portal_host`) necesită DNS, certificat și rutare separată; hostname-urile sunt potrivite exact. Domeniul principal rămâne identitatea site-ului; pentru alt domeniu folosește un alias de portal sau creează un site nou.

### `/admin` pe site-uri de client găzduite în Pages

Pentru un hostname partajat `*.pages.dev` (de exemplu `frizeriata.pages.dev`) nu poți crea o rută de zonă Workers `/admin*` pe acel hostname. Ai două opțiuni:

- Folosește un domeniu propriu cu DNS proxied și configurează ruta `/admin*` pentru `vllora-dashboard`, conform pașilor de mai sus.
- Dacă proiectul Pages al clientului este în același cont cu `vllora-dashboard`, înregistrează hostname-ul exact în **Administrare portaluri client → Adaugă site**, apoi adaugă un **Service Binding** numit `VLLORA_PORTAL`, cu destinația `vllora-dashboard`, în setările **Production** ale proiectului Pages al clientului. Copiază fișierele din `integrations/pages-client/` în rădăcina **outputului de build al acelui client** și redeployează proiectul client. `_routes.json` trimite doar `/admin` și `/admin/*` către adaptor; `_worker.js` păstrează URL-ul original, iar portalul verifică hostname-ul și sesiunea. Dacă proiectul are deja `_worker.js`, Functions sau `_routes.json`, integrează ramura `/admin` în configurația existentă; nu suprascrie rutele aplicației clientului.

Adaptorul este opțional și **nu se instalează pe proiectul Pages al masterului**. După configurare, testează atât pagina publică a clientului, cât și `/admin`. Activarea în contul de producție se face separat, în proiectul fiecărui client.

### Media și branding

- `MEDIA_PUBLIC_BASE` gol: fișierele sunt publice prin Worker, cu ETag și CSP `sandbox`. Dacă ai nevoie de livrare directă, configurează **R2 → Public access → Custom domain** pe un **domeniu dedicat imaginilor** și setează `MEDIA_PUBLIC_BASE=https://cdn.domeniu.ro`. URL-urile vechi ale Worker-ului rămân funcționale. Nu încărca documente private; cache-urile deja populate nu expiră instantaneu la ștergere.
- `/admin/` afișează **numele site-ului · Admin Dashboard**, logoul și paleta site-ului inclusiv înainte de autentificare și în ecranele de parolă. Shellul este specific hostname-ului și nu include notițe, date de cont sau tokenuri. Dacă nu există logo, afișează inițialele numelui site-ului.
- La creare și **Configurare → Branding → Rescan**, Worker-ul caută mai întâi `/.well-known/vllora-brand.json`. Fără manifest, încearcă numele din metadatele HTML, logo din JSON-LD, o imagine marcată cu `data-brand-logo` / `class="site-logo"` sau o iconiță acceptată, și culori din HTML sau din variabile declarate în până la două foi CSS de pe hostname-ul site-ului. Logoul detectat este copiat în R2. Setările manuale se păstrează la rescan dacă nu alegi **Forțează rescan**.
- Pentru un branding exact atunci când site-ul nu îl declară detectabil, setează în master numele, culorile, tema și logoul din biblioteca media, sau adaugă pe site manifestul de mai jos (cu valorile reale și un URL către un logo existent), apoi folosește **Forțează rescan**. Nu este necesară o migrare D1 sau înlocuirea adaptorului Pages pentru afișarea brandingului.

  ```json
  {
    "name": "Numele site-ului",
    "logo": "/assets/logo.webp",
    "colors": { "primary": "#6b1c2e", "secondary": "#895c29", "accent": "#f6e6bc" },
    "scheme": "light"
  }
  ```
- Limite: 8 MiB/fișier, 200 MiB/site. SVG-urile cu funcționalități active nu sunt acceptate nici prin API; combinațiile de elemente/atribute suportate sunt în `worker/media.ts`. La încărcarea de pe dispozitiv, imaginile sunt redimensionate după destinație și comprimate în WebP static. Când browserul nu poate exporta WebP nativ, se încarcă un encoder WebAssembly local; dacă se poate decoda, dar nu se poate converti, nu se încarcă originalul. API-ul multipart respinge formatele de imagine diferite de WebP; documentele PDF rămân PDF. Importul server-side de la URL, brandingul detectat automat și fișierele existente păstrează formatul original.
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

| Worker administrare portaluri | Domeniu client (`/admin` prefix) |
| --- | --- |
| `/api/auth/{login,me,logout,change-password,forgot-password,reset-password,sessions/revoke-all}` | `/admin/api/auth/...`, cu aceleași operații |
| `PATCH /api/auth/recovery-email` | — |
| `/api/admin/{overview,sites,audit}`, `/api/admin/sites/:id/{users,stats,metrics,metrics-key,media,refresh-branding,sync-route}` | `/admin/api/portal/{me,stats,metrics,media}`, `GET/PUT /admin/api/portal/content`, `PATCH /admin/api/portal/site` |
| `/api/admin/users/:id` (PATCH/DELETE), `/api/admin/users/:id/reset-password` (POST) | — |
| `/track.js`, `POST /api/{collect,collect-event}`, `GET /media/<key>` | `GET /admin/media/<key>` |

Rapoartele acceptă `days=7`, `30`, `90` sau `365`, inclusiv ziua UTC curentă. Actualizarea automată și cronul la **02:15 UTC** nu înlocuiesc verificarea cu trafic real după deploy.

### Editorul de conținut (master și client)

În `/admin/` → **Editează site-ul**, clientul poate edita prima pagină, secțiunea „Despre”, lista de servicii și prețuri, programul, contactul și galeria. Butoanele cu agrafă aleg imagini sau PDF-uri de pe dispozitiv, iar fișierele din bibliotecă pot fi refolosite. Previzualizarea din portal reprezintă conținutul, nu designul exact al site-ului public. Schimbările de text și referințele de media intră în conținutul public la **Publică modificările**; fișierele încărcate în bibliotecă sunt publice prin link chiar înainte de publicare. Un PDF este servit ca descărcare, nu redat în portal.

În panoul master, alege clientul → **Conținut site (CMS)** → **Deschide editorul vizual**, sau din `/portal-admin/` → client → **Editează site-ul**. Ambele panouri folosesc aceeași înregistrare CMS și verifică versiunea la publicare; modificarea facturării nu rescrie conținutul. Nu este necesară o migrare nouă. `GET /api/content?site=domeniu-client.ro` furnizează și `heroMedia`, `gallery`, `documents`, `services` și `hours`; `images` rămâne disponibil pentru site-urile care folosesc câmpul de galerie vechi. Un site static trebuie să citească aceste date ca să reflecte schimbările: vezi [adaptorul pentru pagina publică](integrations/static-cms/README.md). Site-ul nu este modificat automat, iar editorul nu rescrie codul HTML/CSS sau logica de programare.

Din editorul client sau master, **Importă de pe site** preia o propunere din HTML-ul public ori din `/.well-known/vllora-content.json`, numai pentru câmpurile/listele goale. Nu publică automat, nu descarcă imaginile în R2 și nu încearcă să ruleze JavaScript-ul site-ului; programul și serviciile pot fi descrise în manifest. **Nume și culori** controlează identitatea publică a site-ului; brandingul portalului de autentificare rămâne separat. Vezi [marcajele și formatul manifestului](integrations/static-cms/README.md).
