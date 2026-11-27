# Cum legi `/admin` de un site nou

Două variante, în funcție de unde stă site-ul. În ambele cazuri pașii din dashboard
sunt identici; diferă doar partea de rutare.

## 1. Pregătire în dashboard (obligatoriu, în ambele variante)

1. Deschide `/portal-admin/` (panoul master) → **Adaugă site**.
2. La **Domeniu** scrie hostname-ul exact al site-ului: fără `https://`, fără `/`,
   fără `www.` dacă site-ul nu servește pe `www`. Exemplu: `frizeriata.pages.dev`.
   Hostname-urile se potrivesc **exact**; dacă diferă, `/admin` răspunde
   „Portalul nu există pe acest domeniu.”
3. În site → **Acces client** → completează **Utilizator** și **Nume client** →
   **Generează acces**. Copiază parola temporară: se afișează o singură dată, iar
   clientul o schimbă la prima autentificare.
4. Dacă apare butonul **Sincronizează ruta**, apasă-l (încearcă automat ruta
   `/admin*` în zona Cloudflare, unde tokenul are acces).
5. Opțional, pentru fiecare cont: alege drepturile (**Administrator**, **Editor**,
   **Doar citire** sau bife individuale).

## 2. Varianta A — site pe Cloudflare Pages (`*.pages.dev` sau alt hostname partajat)

Pe un hostname partajat nu poți crea o rută de zonă `/admin*`, deci `/admin` trece
prin proiectul Pages al clientului, cu un Service Binding.

### Prompt pentru agentul care lucrează pe site-ul clientului

```
Leagă portalul de administrare /admin de acest site. Fă exact asta și nimic altceva:

1. Copiază în rădăcina outputului de build (lângă index.html) fișierele
   `_worker.js` și `_routes.json` din integrations/pages-client/ ale
   proiectului vllora-dashboard. Dacă proiectul are deja _worker.js, Functions
   sau _routes.json, integrează doar ramura /admin în configurația existentă —
   nu suprascrie rutele aplicației.
2. În Cloudflare Pages → proiectul acestui site → Settings → Functions →
   Service bindings → Production, adaugă binding-ul:
   nume `VLLORA_PORTAL`, destinație `vllora-dashboard`.
3. Redeploy proiectul.
4. Verifică și raportează: `https://DETALII/admin` face redirect la `/admin/` și
   afișează ecranul de login al portalului (nu 404, nu site-ul public);
   `https://DETALII/` arată neschimbat.

Nu modifica HTML-ul, CSS-ul, rutele publice sau logica site-ului.
```

Înlocuiește `DETALII` cu domeniul exact al site-ului.

### Manual, fără agent

1. În proiectul clientului, copiază `_worker.js` și `_routes.json` din
   [`integrations/pages-client/`](../integrations/pages-client/) în rădăcina
   outputului de build.
2. Cloudflare → **Workers & Pages** → proiectul clientului → **Settings** →
   **Functions** → **Service bindings** → **Add** → Production:
   - Variable name: `VLLORA_PORTAL`
   - Service: `vllora-dashboard`
3. **Deploy** din nou proiectul. Binding-urile nu se aplică retroactiv.
4. Cloudflare → proiectul clientului → **Settings** → **Access** (opțional):
   nu bloca `/admin/*` cu Cloudflare Access, altfel portalul nu mai primește
   cererea.

`_routes.json` trimite către adaptor doar `/admin` și `/admin/*`; restul site-ului
rămâne servit de Pages. Adaptorul păstrează URL-ul, metoda și cookie-urile, iar
portalul verifică în continuare hostname-ul și sesiunea.

## 3. Varianta B — domeniu propriu cu DNS în Cloudflare (proxied)

Aici `/admin` se rezolvă direct pe Worker, fără modificări în site-ul clientului.

1. Verifică în Cloudflare → zona domeniului că înregistrarea DNS este **Proxied**
   (norul portocaliu). Fără proxy, ruta nu se aplică.
2. Cloudflare → zona domeniului → **Workers Routes** → **Add route**:
   - Route: `DETALII/admin*`
   - Worker: `vllora-dashboard`
3. Salvează. Nu e nevoie de redeploy la site-ul clientului.

Dacă tokenul dashboardului nu are acces la zonă, pasul 2 se face manual, ca mai
sus; butonul **Sincronizează ruta** va raporta că nu poate.

## 4. Hostname separat pentru portal (opțional)

Dacă vrei portalul pe alt hostname decât site-ul (ex. `admin.client.ro`), scrie-l
la **Hostname portal** când creezi site-ul. Are nevoie de propriul DNS, certificat
și rutare, iar domeniul principal rămâne identitatea site-ului. Pentru un al
doilea domeniu public al aceleiași afaceri, creează un alias de portal sau un site
nou — nu schimba domeniul principal.

## 5. Verificare finală

| Test | Rezultat așteptat |
| --- | --- |
| `https://DETALII/admin` | redirect la `/admin/` |
| `https://DETALII/admin/` | ecranul de login al portalului, cu numele și culorile site-ului |
| login cu parola temporară | cere setarea unei parole noi, apoi afișează portalul |
| `https://DETALII/` | site-ul public, neschimbat |
| `GET https://DETALII/api/content?site=DETALII` | JSON cu conținutul public (doar dacă site-ul e activ) |

Dacă `/admin/` răspunde 404: hostname-ul din dashboard nu se potrivește exact cu
cel din browser. Dacă răspunde 503 „Portalul client nu este configurat.”, lipsește
binding-ul `VLLORA_PORTAL` sau nu ai redeployat după ce l-ai adăugat. Dacă apare
ecranul de login dar autentificarea eșuează, contul nu a fost generat din
**Acces client** al site-ului respectiv.

## 6. După legare

- Conținutul public ajunge pe site doar dacă site-ul citește datele din CMS:
  vezi [adaptorul pentru pagina publică](../integrations/static-cms/README.md).
- Un cont nou primește implicit toate drepturile; restricționează-le din
  **Acces client** dacă vrei un client „Doar citire”.
- Suspendarea site-ului (**Modul de mentenanță**) oprește și `/admin`, nu doar
  partea publică.
- Tot ce făcea un panou propriu al site-ului (`#/admin` cu parolă în cod,
  produse, poze, recenzii) se face din `/admin`: **Produse (magazin)** și
  **Recenzii**. După ce portalul e legat, șterge panoul vechi din codul site-ului
  și endpoint-urile lui publice, ca să nu rămână o a doua cale de administrare.
  Fără sesiune, scrierile în portal răspund `401`, deci nu există port deschis.
- Pozele de produs se urcă direct din portal (**Încarcă poză**, JPG/PNG/WebP,
  maximum 5 MB, redimensionate automat în WebP) și sunt servite din
  `/media/sites/...`; nu mai e nevoie de un folder de imagini în site.
