/* =========================================================================
   Vllora Studio Master Dashboard — standalone build
   Tailwind CSS (CDN) + Chart.js (CDN) · all logic inline
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------- constants */
  var PORTFOLIO_API = '/api/admin/portfolio';
  var LIVE_POLL_MS = 30000;
  var LIVE_STALE_MS = 90000;
  var DAYS = 730;
  var INDUSTRIES = ['Hospitality', 'Wellness', 'Retail', 'Professional', 'Creative', 'Home Services', 'Unspecified'];
  var IND_COLOR = { Hospitality: '#f97316', Wellness: '#10b981', Retail: '#8b5cf6', Professional: '#3b82f6', Creative: '#ec4899', 'Home Services': '#eab308', Unspecified: '#94a3b8' };
  var SEGMENT_PALETTE = ['#0ea5e9', '#14b8a6', '#f43f5e', '#a855f7', '#f59e0b', '#22c55e', '#6366f1', '#d946ef'];
  function segmentColor(name) {
    if (Object.prototype.hasOwnProperty.call(IND_COLOR, name)) return IND_COLOR[name];
    return SEGMENT_PALETTE[hash(name) % SEGMENT_PALETTE.length];
  }
  var PLAN_COLORS = { Basic: '#38bdf8', Standard: '#6366f1', WaaS: '#a855f7' };
  var PLAN_DEFAULTS = { Basic: { m: 29, a: 295 }, Standard: { m: 59, a: 600 }, WaaS: { m: 99, a: 1000 } };
  var SETTINGS_KEY = 'vllora-studio-settings-v1';
  var DEFAULT_SEGMENTS = ['Hospitality', 'Wellness', 'Retail', 'Professional', 'Creative', 'Home Services'];
  var LANGUAGE_KEY = 'vllora-studio-language-v1';
  var STATUS_COLORS = { Online: '#10b981', Active: '#10b981', Degraded: '#f59e0b', Down: '#ef4444', Suspended: '#a855f7', Unknown: '#94a3b8' };
  var RANGES = [
    { key: '30d', label: '30D', days: 30, bucket: 1 },
    { key: '90d', label: '90D', days: 90, bucket: 7 },
    { key: '6m', label: '6M', days: 182, bucket: 7 },
    { key: '12m', label: '12M', days: 365, bucket: 31 }
  ];
  var C = {
    primary: '#6366f1', gold: '#D6B46C', burgundy: '#6B1C2E', amber: '#f59e0b', green: '#10b981', rose: '#f43f5e', violet: '#8b5cf6'
  };

  /* ------------------------------------------------------- translations */
  var RO = {
    'Overview': 'Prezentare generală', 'Revenue': 'Venituri', 'Hosting & Uptime': 'Găzduire și disponibilitate',
    'Content Ops': 'Operațiuni conținut', 'Clients': 'Clienți', 'Settings': 'Setări', 'Master Menu': 'Meniu principal',
    'Master Dashboard': 'Panou principal', 'Portfolio overview': 'Prezentarea portofoliului', 'Filters': 'Filtre',
    'All billing': 'Toate facturările', 'All segments': 'Toate segmentele', 'All plans': 'Toate abonamentele',
    'Monthly': 'Lunar', 'Annual': 'Anual', 'Reset': 'Resetează', 'Current': 'Curent',
    'Previous period': 'Perioada anterioară', 'Previous': 'Anterior', 'New': 'Nou', 'Churned': 'Pierdut', 'Net': 'Net',
    'Recurring revenue growth': 'Evoluția veniturilor recurente', 'MRR by hosting plan': 'MRR după abonament',
    'Click a slice to filter the dashboard': 'Apasă un segment pentru a filtra panoul',
    'New vs churned MRR': 'MRR nou vs. pierdut', 'MRR by client segment': 'MRR după segmentul clienților',
    'Current vs previous period · click a bar to filter': 'Perioada curentă vs. anterioară · apasă o bară pentru filtrare',
    'Hosted sites performance': 'Performanța site-urilor găzduite',
    'Illustrative traffic history (not live visitor data)': 'Istoric ilustrativ al traficului (nu sunt date live despre vizitatori)',
    'Portfolio uptime vs 99.9% SLA': 'Disponibilitatea portofoliului vs. SLA 99,9%',
    'Live site status': 'Starea live a site-urilor',
    'Right now across all hosted sites': 'În acest moment, pentru toate site-urile găzduite',
    'Content update requests': 'Cereri de actualizare a conținutului', 'Opened': 'Deschise', 'Resolved': 'Rezolvate',
    'Activity': 'Activitate', 'Subscriptions, incidents and client requests': 'Abonamente, incidente și cereri ale clienților',
    'Client sites & subscriptions': 'Site-uri și abonamente ale clienților', 'Search client, domain…': 'Caută client, domeniu…',
    'Add New Client': 'Adaugă client nou', 'Add new client': 'Adaugă client nou', 'Save Changes': 'Salvează modificările',
    'Delete': 'Șterge', 'Cancel': 'Anulează', 'Edit client': 'Editează clientul', 'Status & Billing': 'Stare și facturare',
    'Site Content (CMS)': 'Conținut site (CMS)', 'Client name *': 'Nume client *', 'Domain *': 'Domeniu *',
    'Site status': 'Starea site-ului', 'Active': 'Activ', 'Suspended': 'Suspendat',
    'Site live, billed normally': 'Site activ, facturat normal', 'Taken offline, no MRR': 'Site dezactivat, fără MRR',
    'Hosting plan': 'Abonament de găzduire', 'Manage subscriptions': 'Gestionează abonamentele',
    'Selecting a plan fills its default prices, which you can customize for this client.': 'Selectarea unui abonament completează prețurile implicite, pe care le poți modifica pentru acest client.',
    'Billing cycle': 'Ciclu de facturare', 'Monthly price (USD)': 'Preț lunar (USD)', 'Annual price (USD)': 'Preț anual (USD)',
    'Next renewal date': 'Data următoarei reînnoiri', 'Effective MRR': 'MRR efectiv', 'as billed': 'conform facturării',
    'Special announcement banner': 'Banner pentru anunț special', 'Hero Title': 'Titlu principal', 'Subtitle': 'Subtitlu',
    'Phone': 'Telefon', 'Address': 'Adresă', 'Google Maps URL': 'URL Google Maps',
    'Image URLs (GitHub / jsDelivr) — one per line': 'URL-uri imagini (GitHub / jsDelivr) — câte unul pe linie',
    'or': 'sau', 'Username': 'Nume de utilizator', 'Password': 'Parolă',
    'Sign in to Vllora Studio': 'Autentificare în Vllora Studio', 'Open Master Dashboard': 'Deschide panoul principal',
    'Explore with demo data (no login)': 'Explorează cu date demo (fără autentificare)',
    'Connection failed': 'Conexiune eșuată',
    'Manage access or reset password': 'Administrare acces sau resetare parolă',
    'Monitoring not configured': 'Monitorizarea nu este configurată',
    'No request feed configured': 'Nu este configurată o sursă de cereri',
    'Unknown': 'Necunoscut',
    'Billing contact email': 'Email de facturare',
    'Open visual editor': 'Deschide editorul vizual',
    'Edit text, services, opening hours and photos in the visual editor. Review the preview before publishing.': 'Editează textele, serviciile, programul și pozele în editorul vizual. Verifică previzualizarea înainte de publicare.',
    'CMS fields below are public on active sites through the content API.': 'Câmpurile de mai jos sunt publice prin API-ul CMS pentru site-urile active.',
    'Deleting also removes this site’s portal access, media and analytics records held in the dashboard.': 'Ștergerea elimină și accesul la portal, fișierele media și statisticile salvate în panou.',
    ') and accept': ') și să accepte', 'Vllora Studio Master Dashboard · Client portfolio & CMS': 'Vllora Studio Master Dashboard · Portofoliu clienți și CMS',
    'Show password': 'Afișează parola', 'Open menu': 'Deschide meniul', 'Close menu': 'Închide meniul',
    'Close editor': 'Închide editorul', 'Close settings': 'Închide setările', 'Toggle dark mode': 'Comută modul întunecat',
    'Log out': 'Deconectare', 'Refresh from API': 'Reîmprospătează din API',
    'Previous page': 'Pagina anterioară', 'Next page': 'Pagina următoare',
    'Studio settings': 'Setări studio', 'Set your revenue goal and the subscriptions available to clients.': 'Configurează obiectivul de venit și abonamentele disponibile pentru clienți.',
    'Monthly goal': 'Obiectiv lunar', 'The target used to track monthly recurring revenue progress.': 'Ținta folosită pentru progresul veniturilor recurente lunare.',
    'MRR goal (USD)': 'Obiectiv MRR (USD)', 'Available subscriptions': 'Abonamente oferite',
    'These plans and default prices appear when you add or edit a client. Existing contracts are not changed automatically.': 'Aceste planuri și prețuri implicite apar când adaugi sau editezi un client. Contractele existente nu sunt modificate automat.',
    'Add subscription': 'Adaugă abonament', 'Removing or renaming a plan does not change existing client subscriptions.': 'Retragerea sau redenumirea unui plan nu modifică abonamentele clienților existenți.',
    'Settings are saved in this browser.': 'Setările se salvează în acest browser.', 'Save settings': 'Salvează setările',
    'Plan name': 'Nume abonament', 'Monthly (USD)': 'Lunar (USD)', 'Annual (USD)': 'Anual (USD)',
    'At least one plan is required': 'Este necesar cel puțin un plan', 'Remove this plan from your offer': 'Retrage abonamentul din ofertă',
    'Existing plan': 'Plan existent', 'e.g. Business': 'ex.: Business',
    'Fresh sourdough, baked every morning': 'Pâine cu maia, coaptă în fiecare dimineață',
    'Family-run bakery in the heart of Portland…': 'Brutărie de familie în inima orașului Portland…',
    'Summer sale — 20% off all catering orders': 'Ofertă de vară — 20% reducere la toate comenzile de catering',
    '123 Main St, Portland OR': 'Str. Principală 123, Portland OR',
    'Invalid username or password (server rejected the credentials).': 'Nume de utilizator sau parolă invalide (serverul a respins credențialele).',
    'Worker did not return JSON. Check the endpoint URL.': 'Worker-ul nu a returnat JSON. Verifică URL-ul endpointului.',
    'Worker did not return a client list.': 'Worker-ul nu a returnat o listă de clienți.',
    'Custom period': 'Perioadă personalizată', 'Start date': 'Data de început', 'End date': 'Data de sfârșit',
    'Apply period': 'Aplică perioada', 'Statistics compare the selected period with the previous period of the same length.': 'Statisticile compară perioada selectată cu perioada anterioară de aceeași lungime.',
    'Choose both a start and an end date.': 'Alege atât data de început, cât și data de sfârșit.',
    'The start date must be before the end date.': 'Data de început trebuie să fie înaintea datei de sfârșit.',
    'The end date cannot be in the future.': 'Data de sfârșit nu poate fi în viitor.',
    'Only the last 2 years of history are available.': 'Este disponibil doar istoricul ultimilor 2 ani.',
    'Client segment': 'Segment client', 'Manage segments': 'Gestionează segmentele', 'New segment': 'Segment nou',
    'Add segment': 'Adaugă segment', 'e.g. Restaurants': 'ex.: Restaurante', 'Client segments': 'Segmente de clienți',
    'Segments are available when you add or edit a client and in the dashboard filters. Clients keep their current segment.': 'Segmentele sunt disponibile când adaugi sau editezi un client și în filtrele panoului. Clienții își păstrează segmentul curent.',
    'Segment name': 'Nume segment', 'At least one segment is required': 'Este necesar cel puțin un segment', 'Remove this segment': 'Elimină acest segment',
    'At least one segment is required.': 'Este necesar cel puțin un segment.', 'Add at least one segment.': 'Adaugă cel puțin un segment.',
    'Each segment needs a valid name, different from "All" and "Unspecified".': 'Fiecare segment trebuie să aibă un nume valid, diferit de „All” și „Unspecified”.',
    'Each segment must have a unique name.': 'Fiecare segment trebuie să aibă un nume unic.',
    'You can configure up to 100 segments.': 'Poți configura maximum 100 de segmente.',
    'Enter a segment name (up to 60 characters), different from "All" and "Unspecified".': 'Introdu un nume de segment (maximum 60 de caractere), diferit de „All” și „Unspecified”.',
    'Segment could not be added.': 'Segmentul nu a putut fi adăugat.',
    'Site Visitors': 'Vizitatori site', 'Visitors': 'Vizitatori', 'no comparison available': 'nicio comparație disponibilă',
    'Partial data: some clients have no visitor history from the Worker': 'Date parțiale: unii clienți nu au istoric de vizitatori de la Worker',
    'No visitor history from the Worker': 'Nu există istoric de vizitatori de la Worker',
    'Daily visitors reported by the Worker analytics': 'Vizitatori zilnici raportați de analytics-ul Worker-ului',
    'Daily visitors from the Worker · some clients have no history': 'Vizitatori zilnici de la Worker · unii clienți nu au istoric',
    'No daily visitor history from the Worker': 'Nu există istoric zilnic de vizitatori de la Worker',
    'Monthly Recurring Revenue': 'Venit recurent lunar', 'Active Clients': 'Clienți activi',
    'Client Churn': 'Pierderea clienților', 'Portfolio Uptime': 'Disponibilitatea portofoliului',
    'Site Visitors (sample)': 'Vizitatori site (exemplu)', 'Open Content Requests': 'Cereri de conținut deschise',
    'vs prev. period': 'vs. perioada anterioară', 'SLA target 99.90%': 'Țintă SLA 99,90%',
    'Illustrative history': 'Istoric ilustrativ', 'queued across portfolio': 'în așteptare în portofoliu',
    'Client / site': 'Client / site', 'Segment': 'Segment', 'Plan': 'Abonament', 'Price': 'Preț', 'Status': 'Stare',
    'Uptime': 'Disponibilitate', 'Visitors (sample)': 'Vizitatori (exemplu)', 'Next renewal': 'Următoarea reînnoire',
    'Actions': 'Acțiuni', 'All': 'Toate', 'Online': 'Online', 'Degraded': 'Degradat', 'Down': 'Indisponibil',
    'Edit': 'Editează', 'per year': 'pe an', 'per month': 'pe lună',
    'No sites match the current filters.': 'Niciun site nu corespunde filtrelor curente.',
    'No plans match the filters.': 'Niciun abonament nu corespunde filtrelor.',
    'No queued requests for this segment.': 'Nu există cereri în așteptare pentru acest segment.',
    'No recent activity for this segment.': 'Nu există activitate recentă pentru acest segment.', 'healthy': 'sănătoase',
    'Hospitality': 'Ospitalitate', 'Wellness': 'Sănătate și wellness', 'Retail': 'Comerț',
    'Professional': 'Servicii profesionale', 'Creative': 'Creativ', 'Home Services': 'Servicii pentru casă', 'Unspecified': 'Nespecificat',
    'Text update': 'Actualizare text', 'Image swap': 'Schimbare imagine', 'New page': 'Pagină nouă',
    'SEO tweak': 'Optimizare SEO', 'Bug fix': 'Rezolvare eroare', 'Menu / pricing': 'Meniu / prețuri', 'Blog post': 'Articol blog',
    'today': 'azi', 'yesterday': 'ieri', 'Worker unreachable — showing last known data.': 'Worker indisponibil — se afișează ultimele date cunoscute.',
    'Retry': 'Reîncearcă', 'Investigate': 'Investighează', 'Review': 'Verifică',
    'Demo data': 'Date demo', 'Live API': 'API live', 'Offline': 'Offline',
    'Good morning': 'Bună dimineața', 'Good afternoon': 'Bună ziua', 'Good evening': 'Bună seara',
    'WaaS portfolio, hosting subscriptions & live CMS': 'Portofoliu WaaS, abonamente de găzduire și CMS live',
    'demo mode, changes stay in this tab.': 'mod demo, modificările rămân în această filă.',
    'Demo mode — the new client stays in this tab.': 'Mod demo — noul client rămâne în această filă.',
    'changes POST to your Worker.': 'modificările sunt trimise prin POST către Worker.',
    'Creates the record via POST to your Worker.': 'Creează înregistrarea prin POST către Worker.',
    'Saving…': 'Se salvează…', 'Confirm delete': 'Confirmă ștergerea',
    'Client name and domain are required.': 'Numele clientului și domeniul sunt obligatorii.',
    'Could not load the client list with those credentials.': 'Lista clienților nu a putut fi încărcată cu aceste credențiale.',
    'Enter both username and password.': 'Introdu numele de utilizator și parola.', 'Connecting to Worker…': 'Se conectează la Worker…',
    'Live visitors are unavailable in demo mode. Connect your Worker to view real traffic.': 'Vizitatorii live nu sunt disponibili în modul demo. Conectează Worker-ul pentru trafic real.',
    'Live visitor data is unavailable while the Worker is disconnected.': 'Datele despre vizitatori live nu sunt disponibile cât Worker-ul este deconectat.',
    'Live visitor data is out of date. Waiting for the Worker to respond.': 'Datele despre vizitatori live sunt expirate. Se așteaptă răspunsul Worker-ului.',
    'Filtered live counts require the Worker to return liveVisitors for every matching client.': 'Totalurile live filtrate necesită ca Worker-ul să returneze liveVisitors pentru fiecare client potrivit.',
    'The Worker must return an analytics-backed liveVisitors count; no estimate is shown.': 'Worker-ul trebuie să returneze un număr liveVisitors din analytics; nu se afișează estimări.',
    'active visitors': 'vizitatori activi', 'live visitors unavailable': 'vizitatori live indisponibili',
    'Visitor count supplied by the Worker. Refreshed every 30 seconds; date ranges do not change the live count.': 'Număr de vizitatori furnizat de Worker. Actualizat la fiecare 30 de secunde; intervalele de date nu schimbă numărul live.',
    'Net new': 'MRR net nou', 'Active subscriptions': 'Abonamente active', 'over the selected period': 'pe perioada selectată',
    'Total MRR': 'MRR total', 'Goal: $10,000 MRR': 'Obiectiv: 10.000 USD MRR',
    'Each subscription needs a valid name, different from "All".': 'Fiecare abonament trebuie să aibă un nume valid, diferit de „All”.',
    'Each subscription must have a unique name.': 'Fiecare abonament trebuie să aibă un nume unic.',
    'Enter valid monthly and annual prices greater than or equal to zero.': 'Introdu prețuri lunare și anuale valide, mai mari sau egale cu zero.',
    'Enter an MRR goal greater than zero.': 'Introdu un obiectiv MRR mai mare decât zero.',
    'Add at least one valid subscription.': 'Adaugă cel puțin un abonament valid.',
    'Settings could not be saved in this browser.': 'Setările nu au putut fi salvate în acest browser.',
    'At least one subscription is required.': 'Este necesar cel puțin un abonament.',
    'You can configure up to 50 subscriptions.': 'Poți configura maximum 50 de abonamente.',
    'Sample data generated for demonstration': 'Date exemplu generate pentru demonstrație',
    'Worker unavailable · last fetched data may be out of date': 'Worker indisponibil · ultimele date preluate pot fi expirate'
  };
  var RO_PARTS = [
    ['WaaS portfolio, hosting subscriptions & live CMS', 'Portofoliu WaaS, abonamente de găzduire și CMS live'],
    ['Sample data generated for demonstration', 'Date exemplu generate pentru demonstrație'],
    ['Worker unavailable · last fetched data may be out of date', 'Worker indisponibil · ultimele date preluate pot fi expirate'],
    ['demo mode, changes stay in this tab.', 'mod demo, modificările rămân în această filă.'],
    ['changes POST to your Worker.', 'modificările sunt trimise prin POST către Worker.'],
    ['Illustrative history', 'Istoric ilustrativ'], ['Worker analytics', 'Analytics Worker'], ['suspended this period', 'suspendări în această perioadă'],
    ['Cannot reach ', 'Nu se poate accesa '], ['. Check the Worker URL and network connection.', '. Verifică URL-ul Worker-ului și conexiunea la rețea.'],
    ['. Changes were not saved.', '. Modificările nu au fost salvate.'], ['Worker responded with ', 'Worker-ul a răspuns cu '], ['Save failed (', 'Salvare eșuată ('],
    ['Last 30 days', 'Ultimele 30 de zile'], ['Last 90 days', 'Ultimele 90 de zile'],
    ['Last 6 months', 'Ultimele 6 luni'], ['Last 12 months', 'Ultimele 12 luni'],
    ['vs previous period', 'vs. perioada anterioară'], ['Monthly billing', 'Facturare lunară'],
    ['Annual billing', 'Facturare anuală'], ['synced ', 'sincronizat la '], ['(filtered)', '(filtrat)'],
    ['Goal: ', 'Obiectiv: '], ['% of target', '% din obiectiv'], ['fetched ', 'preluat la '],
    ['Connected to Worker API as ', 'Conectat la API-ul Worker ca '], [' — client list loaded', ' — lista clienților a fost încărcată'],
    ['Connected to ', 'Conectat la '], [' live clients', ' clienți live'], ['traffic history is illustrative', 'istoricul traficului este ilustrativ'],
    ['Updated client ', 'Client actualizat '], ['Created client ', 'Client creat '], ['Deleted client ', 'Client șters '],
    [' subscribed to ', ' s-a abonat la '], [' was suspended', ' a fost suspendat'], [' is currently unreachable', ' este indisponibil momentan'],
    ['Opened the dashboard with demo data', 'Panoul a fost deschis cu date demo'],
    ['Current: ', 'Curent: '], ['Prev: ', 'Anterior: '], ['Previous: ', 'Anterior: '], ['New +', 'Noi +'],
    ['Lost −', 'Pierdut −'], ['Net: ', 'Net: '], ['Churned: ', 'Pierdut: '], ['New: ', 'Nou: '],
    ['Change: ', 'Schimbare: '], ['Clients: ', 'Clienți: '], ['Uptime: ', 'Disponibilitate: '],
    ['Visitors: ', 'Vizitatori: '], ['Opened: ', 'Deschise: '], ['Resolved: ', 'Rezolvate: '],
    [' opened · ', ' deschise · '], [' resolved this period', ' rezolvate în această perioadă'],
    [' over the selected period', ' pe perioada selectată'], [' this period', ' în această perioadă'], ['this period', 'această perioadă'],
    ['% of portfolio', '% din portofoliu'], [' / day avg', ' / zi medie'], ['/mo', '/lună']
  ];
  var originalText = new WeakMap(), originalAttrs = new WeakMap();
  function locale() { return state.lang === 'ro' ? 'ro-RO' : 'en-US'; }
  function t(value) {
    if (Array.isArray(value)) return value.map(t);
    if (value === null || value === undefined) return value;
    var raw = String(value);
    if (state.lang !== 'ro') return raw;
    var leading = (raw.match(/^\s*/) || [''])[0], trailing = (raw.match(/\s*$/) || [''])[0];
    var text = raw.trim().replace(/\s+/g, ' '), translated;
    if (Object.prototype.hasOwnProperty.call(RO, text)) translated = RO[text];
    else {
      translated = text;
      for (var i = 0; i < RO_PARTS.length; i++) translated = translated.split(RO_PARTS[i][0]).join(RO_PARTS[i][1]);
      var match;
      if ((match = translated.match(/^(\d+) image(s?)$/))) translated = match[1] + (match[2] ? ' imagini' : ' imagine');
      else if ((match = translated.match(/^(\d+) plans$/))) translated = match[1] + ' abonamente';
      else if ((match = translated.match(/^(\d+) of (\d+) sites · click Edit to change billing & CMS$/))) translated = match[1] + ' din ' + match[2] + ' site-uri · apasă Editează pentru facturare și CMS';
      else if ((match = translated.match(/^Showing (\d+)–(\d+) of (\d+)$/))) translated = 'Se afișează ' + match[1] + '–' + match[2] + ' din ' + match[3];
      else if ((match = translated.match(/^(\d+)d ago$/))) translated = 'acum ' + match[1] + ' zile';
      else if ((match = translated.match(/^(\d+)mo ago$/))) translated = 'acum ' + match[1] + ' luni';
      else if ((match = translated.match(/^(\d+) site is down:$/))) translated = match[1] + ' site este indisponibil:';
      else if ((match = translated.match(/^(\d+) sites are down:$/))) translated = match[1] + ' site-uri sunt indisponibile:';
      else if ((match = translated.match(/^(\d+) suspended site:$/))) translated = match[1] + ' site suspendat:';
      else if ((match = translated.match(/^(\d+) suspended sites:$/))) translated = match[1] + ' site-uri suspendate:';
      else if ((match = translated.match(/^Used by (\d+) (client|clients)\.$/))) translated = 'Folosit de ' + match[1] + (match[2] === 'client' ? ' client' : ' clienți') + '.';
      else if ((match = translated.match(/^Edit (.+)$/))) translated = 'Editează ' + match[1];
      else if ((match = translated.match(/^Remove plan (.+)$/))) translated = 'Retrage abonamentul ' + match[1];
      else if ((match = translated.match(/^Good (morning|afternoon|evening), (.+)$/))) translated = ({morning:'Bună dimineața', afternoon:'Bună ziua', evening:'Bună seara'})[match[1]] + ', ' + match[2];
      else if ((match = translated.match(/ · ([^·]+) plan(?= ·|$)/))) translated = translated.replace(match[0], ' · plan ' + match[1]);
      else if ((match = translated.match(/^\+(\d+) more$/))) translated = '+' + match[1] + ' în plus';
    }
    return leading + translated + trailing;
  }
  function localizeDOM() {
    document.documentElement.lang = state.lang;
    function textNode(node) {
      if (!node.textContent.trim()) return;
      var record = originalText.get(node);
      if (!record) { record = { source: node.textContent, displayed: null }; originalText.set(node, record); }
      if (record.displayed !== null && node.textContent !== record.displayed) record.source = node.textContent;
      var next = t(record.source);
      if (node.textContent !== next) node.textContent = next;
      record.displayed = next;
    }
    function walk(node) {
      if (node.nodeType === 3) { textNode(node); return; }
      if (node.nodeType !== 1 || /^(SCRIPT|STYLE|SVG|NOSCRIPT)$/.test(node.tagName) || node.hasAttribute('data-no-i18n')) return;
      var attrs = originalAttrs.get(node);
      if (!attrs) { attrs = {}; originalAttrs.set(node, attrs); }
      ['title', 'placeholder', 'aria-label'].forEach(function (name) {
        if (!node.hasAttribute(name)) return;
        var current = node.getAttribute(name), record = attrs[name];
        if (!record) record = attrs[name] = { source: current, displayed: null };
        if (record.displayed !== null && current !== record.displayed) record.source = current;
        var next = t(record.source);
        if (current !== next) node.setAttribute(name, next);
        record.displayed = next;
      });
      Array.prototype.forEach.call(node.childNodes, walk);
    }
    walk(document.body);
    $$('[data-language-toggle]').forEach(function (button) {
      var label = $('.language-toggle-label', button);
      if (label) label.textContent = state.lang === 'en' ? 'RO' : 'EN';
      var help = state.lang === 'en' ? 'Switch to Romanian' : 'Switch to English';
      button.title = help;
      button.setAttribute('aria-label', help);
      button.setAttribute('aria-pressed', state.lang === 'ro' ? 'true' : 'false');
    });
  }
  function setLanguage(lang) {
    state.lang = lang === 'ro' ? 'ro' : 'en';
    try { localStorage.setItem(LANGUAGE_KEY, state.lang); } catch (e) {}
    if (!$('#app').classList.contains('hidden')) render();
    else { syncFilterUI(); localizeDOM(); }
  }
  function loadLanguage() {
    try { return localStorage.getItem(LANGUAGE_KEY) === 'ro' ? 'ro' : 'en'; } catch (e) { return 'en'; }
  }

  /* ------------------------------------------------------------- state */
  var state = {
    lang: loadLanguage(),  // persisted interface language: en | ro
    auth: null,            // Staff identity only; the session is in an HttpOnly cookie.
    demo: false,           // no-auth demo mode
    live: false,           // data came from the Worker
    clients: [],
    settings: loadSettings(),
    settingsDraft: null,
    settingsReturnFocus: null,
    liveVisitors: null,    // real portfolio count from the Worker, if supplied
    liveVisitorsAt: null,
    livePollBusy: false,
    filters: { range: '90d', industry: 'All', plan: 'All', billing: 'All', customStart: null, customEnd: null },
    status: 'All',
    sort: { key: 'mrr', dir: 'desc' },
    page: 0,
    query: '',
    revMetric: 'mrr',
    perfMetric: 'visitors',
    editing: null,         // client id or null (create)
    form: null,
    saving: false,
    deleteArmed: false,
    logs: [],
    lastSync: null,
    apiError: null,
    dash: null
  };

  var charts = {};
  var refreshGeneration = 0;

  /* ------------------------------------------------------------ helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function defaultSettings() {
    return {
      goal: 10000,
      plans: Object.keys(PLAN_DEFAULTS).map(function (name) {
        return { name: name, monthly: PLAN_DEFAULTS[name].m, annual: PLAN_DEFAULTS[name].a };
      }),
      segments: DEFAULT_SEGMENTS.slice()
    };
  }
  function cleanSegments(list) {
    if (!Array.isArray(list)) return null;
    var seen = Object.create(null), out = [];
    for (var i = 0; i < list.length; i++) {
      if (typeof list[i] !== 'string') return null;
      var name = list[i].trim(), key = name.toLowerCase();
      if (!name || name.length > 60 || key === 'all' || key === 'unspecified') return null;
      if (seen[key]) continue;
      seen[key] = true;
      out.push(name);
    }
    return out.length && out.length <= 100 ? out : null;
  }
  function validSettings(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.plans) || !value.plans.length || value.plans.length > 50) return null;
    var goal = Number(value.goal);
    if (!Number.isFinite(goal) || goal <= 0 || goal > 1000000000) return null;
    var seen = Object.create(null), plans = [];
    for (var i = 0; i < value.plans.length; i++) {
      var p = value.plans[i];
      if (!p || typeof p.name !== 'string') return null;
      var name = p.name.trim(), lower = name.toLowerCase();
      var monthly = Number(p.monthly), annual = Number(p.annual);
      if (!name || name.length > 60 || lower === 'all' || seen[lower] ||
          !Number.isFinite(monthly) || monthly < 0 || monthly > 1000000000 ||
          !Number.isFinite(annual) || annual < 0 || annual > 1000000000) return null;
      seen[lower] = true;
      plans.push({ name: name, monthly: monthly, annual: annual });
    }
    var segments = value.segments === undefined ? DEFAULT_SEGMENTS.slice() : cleanSegments(value.segments);
    if (!segments) return null;
    return { goal: goal, plans: plans, segments: segments };
  }
  function findSegment(name) {
    var key = String(name || '').trim().toLowerCase();
    return state.settings.segments.filter(function (s) { return s.toLowerCase() === key; })[0] || null;
  }
  function segmentChoices() {
    var out = state.settings.segments.slice();
    state.clients.forEach(function (c) {
      if (c.industry && c.industry !== 'Unspecified' && !out.some(function (s) { return s.toLowerCase() === c.industry.toLowerCase(); })) out.push(c.industry);
    });
    return out;
  }
  function loadSettings() {
    try {
      var saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      return validSettings(saved) || defaultSettings();
    } catch (e) {
      return defaultSettings();
    }
  }
  function findPlan(name) {
    var key = String(name || '').trim().toLowerCase();
    return state.settings.plans.filter(function (p) { return p.name.toLowerCase() === key; })[0] || null;
  }
  function planDefaults(name) {
    var configured = findPlan(name);
    if (configured) return { m: configured.monthly, a: configured.annual };
    return Object.prototype.hasOwnProperty.call(PLAN_DEFAULTS, name) ? PLAN_DEFAULTS[name] : { m: 0, a: 0 };
  }
  function hash(str) {
    var h = 2166136261, i;
    str = String(str);
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dayDate(i) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return d;
  }
  function fmtMoney(n, compact) {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : (n % 1 === 0 || Math.abs(n) >= 1000 ? 0 : 2) }).format(n);
  }
  function fmtNum(n, compact) {
    return new Intl.NumberFormat(locale(), { notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 1 : 0 }).format(n);
  }
  function fmtDate(i) { return dayDate(i).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }); }
  function isoDay(date) {
    var m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + m + '-' + d;
  }
  function dayIndexFromISO(iso, fallback) {
    if (!iso) return fallback;
    var t = Date.parse(iso);
    if (isNaN(t)) return fallback;
    var diff = Math.floor((Date.now() - t) / 86400000);
    return Math.max(0, Math.min(DAYS - 1, DAYS - 1 - diff));
  }
  function planColor(p) {
    if (Object.prototype.hasOwnProperty.call(PLAN_COLORS, p)) return PLAN_COLORS[p];
    var pal = ['#6366f1', '#06b6d4', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
    return pal[hash(p) % pal.length];
  }
  function isDark() { return document.documentElement.classList.contains('dark'); }
  function textColor() { return isDark() ? '#94a3b8' : '#64748b'; }
  function gridColor() { return isDark() ? '#1e293b' : '#eef2f7'; }
  function surfaceColor() { return isDark() ? '#0f172a' : '#ffffff'; }

  /* ------------------------------------------------ normalisation (API) */
  function pick(raw, nested, keys) {
    var i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      if (raw[k] !== undefined && raw[k] !== null && raw[k] !== '') return raw[k];
      if (nested && nested[k] !== undefined && nested[k] !== null && nested[k] !== '') return nested[k];
    }
    return undefined;
  }
  function asStr(v, fb) { return typeof v === 'string' ? v : (v === null || v === undefined ? (fb || '') : String(v)); }
  function asNum(v, fb) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v))) return Number(v);
    return fb || 0;
  }
  function asImages(v) {
    if (Array.isArray(v)) return v.map(function (x) { return asStr(x).trim(); }).filter(Boolean);
    if (typeof v === 'string') return v.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    return [];
  }
  function visitorCount(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) value = value.count;
    if (typeof value === 'string') {
      if (!/^\d+$/.test(value.trim())) return null;
      value = Number(value);
    }
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  // GET may include liveVisitors for the portfolio and/or for each client.
  // These must be measured by the Worker or its analytics provider.
  function readLiveVisitors(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    var keys = ['liveVisitors', 'live_visitors', 'activeVisitors', 'active_visitors', 'visitorsNow'];
    for (var i = 0; i < keys.length; i++) {
      var count = visitorCount(source[keys[i]]);
      if (count !== null) return count;
    }
    var groups = ['analytics', 'metrics', 'realtime', 'traffic', 'data'];
    for (var j = 0; j < groups.length; j++) {
      var group = source[groups[j]];
      if (group && typeof group === 'object' && !Array.isArray(group)) {
        for (var k = 0; k < keys.length; k++) {
          var nested = visitorCount(group[keys[k]]);
          if (nested !== null) return nested;
        }
      }
    }
    return null;
  }
  function normPlan(v) {
    var name = asStr(v).trim();
    if (!name) return 'Unspecified';
    var configured = findPlan(name);
    return configured ? configured.name : name;
  }
  function normState(v, active) {
    if (v === false || ((v === undefined || v === null || v === '') && active === false)) return 'suspended';
    var s = asStr(v, 'active').toLowerCase();
    return ['suspended', 'suspend', 'paused', 'disabled', 'inactive', 'cancelled', 'canceled'].indexOf(s) > -1 ? 'suspended' : 'active';
  }
  function slugOf(domain) {
    return asStr(domain).toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split('.')[0].replace(/[^a-z0-9-]/g, '') || 'client';
  }

  /** Normalise one Worker record (variant-b: {content:{…}} preferred, flat tolerated). */
  function normalizeClient(raw, idx) {
    var nested = null, keys = ['content', 'cms', 'siteContent', 'site_content', 'config'], i;
    for (i = 0; i < keys.length; i++) {
      if (raw[keys[i]] && typeof raw[keys[i]] === 'object') { nested = raw[keys[i]]; break; }
    }
    var name = asStr(pick(raw, nested, ['businessName', 'name', 'client', 'business', 'siteName', 'title', 'company']), 'Client ' + (idx + 1));
    var domain = asStr(pick(raw, nested, ['domain', 'hostname', 'host', 'subdomain', 'url', 'siteUrl', 'slug']));
    if (domain.indexOf('://') > -1) { try { domain = new URL(domain).hostname; } catch (e) {} }
    if (!domain) domain = slugOf(name) + '.mysites.dev';

    var plan = normPlan(pick(raw, nested, ['tier', 'plan', 'package', 'planName']));
    var billingRaw = asStr(pick(raw, nested, ['billing', 'billingCycle', 'cycle', 'frequency']), 'monthly').toLowerCase();
    var billing = (billingRaw.indexOf('annual') === 0 || billingRaw.indexOf('year') === 0) ? 'Annual' : 'Monthly';
    var def = planDefaults(plan);
    var monthly = asNum(pick(raw, nested, ['monthlyPrice', 'priceMonthly', 'price_monthly', 'monthly', 'mrr']), billing === 'Monthly' ? asNum(pick(raw, nested, ['price', 'amount']), def.m) : def.m);
    var annual = asNum(pick(raw, nested, ['annualPrice', 'priceAnnual', 'price_annual', 'annual', 'yearlyPrice']), billing === 'Annual' ? asNum(pick(raw, nested, ['price', 'amount']), def.a) : def.a);
    var mrr = billing === 'Annual' ? Math.round((annual / 12) * 100) / 100 : Math.round(monthly * 100) / 100;

    var renewal = asStr(pick(raw, nested, ['nextRenewal', 'renewalDate', 'next_renewal', 'renewsAt', 'renewal', 'nextBillingDate']));
    if (renewal && !/^\d{4}-\d{2}-\d{2}$/.test(renewal)) {
      var rt = Date.parse(renewal);
      renewal = isNaN(rt) ? (/^\d{4}-\d{2}-\d{2}$/.test(renewal) ? renewal : '') : isoDay(new Date(rt));
    }

    var st = normState(pick(raw, nested, ['state', 'status', 'accountStatus']), raw.active);
    var email = asStr(pick(raw, nested, ['contactEmail', 'email', 'contact', 'owner']));
    var content = {
      heroTitle: asStr(pick(raw, nested, ['heroTitle', 'hero_title', 'heroHeading', 'headline'])),
      heroSubtitle: asStr(pick(raw, nested, ['heroSubtitle', 'hero_subtitle', 'subtitle', 'tagline'])),
      announcement: asStr(pick(raw, nested, ['announcement', 'specialAnnouncement', 'banner', 'bannerText'])),
      phone: asStr(pick(raw, nested, ['phone', 'phoneNumber', 'tel'])),
      whatsapp: asStr(pick(raw, nested, ['whatsapp', 'whatsApp', 'whats_app'])),
      email: asStr(pick(raw, nested, ['email', 'contactEmail'])),
      address: asStr(pick(raw, nested, ['address', 'location', 'street'])),
      mapsUrl: asStr(pick(raw, nested, ['mapsUrl', 'googleMapsUrl', 'mapUrl'])),
      facebook: asStr(pick(raw, nested, ['facebook', 'facebookUrl'])),
      instagram: asStr(pick(raw, nested, ['instagram', 'instagramUrl'])),
      images: asImages(pick(raw, nested, ['images', 'imageUrls', 'gallery', 'photos']))
    };

    var id = asStr(pick(raw, null, ['id', 'slug', 'clientId', 'key']), 'live-' + (idx + 1));
    var createdISO = pick(raw, null, ['createdAt', 'created', 'joinedAt', 'startDate', 'signupDate']);
    var created = dayIndexFromISO(typeof createdISO === 'string' ? createdISO : null, DAYS - 365);
    var suspendISO = pick(raw, null, ['suspendedAt', 'updatedAt']);
    var suspendedAt = st === 'suspended'
      ? dayIndexFromISO(typeof suspendISO === 'string' ? suspendISO : null, null)
      : null;
    var health = asStr(pick(raw, nested, ['health', 'siteStatus', 'uptimeState']), 'Unknown');
    if (st === 'suspended') health = 'Suspended';
    if (['Online', 'Degraded', 'Down', 'Suspended'].indexOf(health) === -1) health = 'Unknown';

    return {
      id: id, slug: asStr(pick(raw, null, ['slug']), slugOf(domain)), name: name, domain: domain, state: st, health: health,
      plan: plan, billing: billing, monthly: monthly, annual: annual, mrr: mrr,
      renewal: renewal, email: email || content.email || '', contactEmail: typeof raw.contactEmail === 'string' ? raw.contactEmail : email,
      industry: asStr(pick(raw, nested, ['industry', 'segment', 'category', 'vertical']), 'Unspecified'),
      content: content, createdAt: created, suspendedAt: suspendedAt,
      liveVisitors: readLiveVisitors(raw), raw: raw
    };
  }

  /* ----------------------------------------- synthetic traffic history */
  function withHistory(c) {
    var r = rng(hash(c.id || c.domain || c.name)), i, dow;
    var base = c.plan === 'WaaS' ? 120 : c.plan === 'Standard' ? 72 : 40;
    var wknd = (c.industry === 'Hospitality' || c.industry === 'Retail') ? 1.3 : c.industry === 'Professional' ? 0.6 : 1;
    var visitors = new Array(DAYS), downtime = new Array(DAYS);
    for (i = 0; i < DAYS; i++) {
      if (i < c.createdAt) { visitors[i] = 0; downtime[i] = 0; continue; }
      dow = dayDate(i).getDay();
      var wk = (dow === 0 || dow === 6) ? wknd : 1;
      var ramp = Math.min(1, 0.35 + (i - c.createdAt) / 90);
      visitors[i] = Math.max(0, Math.round(base * wk * ramp * (0.72 + r() * 0.6)));
      downtime[i] = r() < 0.006 ? Math.round(20 + r() * 180) : (r() < 0.05 ? Math.round(1 + r() * 10) : 0);
    }
    // Force a realistic current health for demo-ish look on live data
    if (c.health === 'Down') downtime[DAYS - 1] = Math.max(downtime[DAYS - 1], 60);
    if (c.health === 'Degraded') downtime[DAYS - 1] = Math.max(downtime[DAYS - 1], 18);
    c.visitors = visitors;
    c.downtime = downtime;
    c.visitorsSource = 'sample';
    return c;
  }

  /* ------------------------------------- real visitor history (Worker) */
  // Accepts `visitorHistory`/`dailyVisitors` as an object { 'YYYY-MM-DD': count }
  // or an array of { date, visitors|count }. Unknown days are null, not zero.
  function readVisitorHistory(raw) {
    var source = pick(raw, raw.analytics && typeof raw.analytics === 'object' ? raw.analytics : null,
      ['visitorHistory', 'visitor_history', 'dailyVisitors', 'daily_visitors', 'visitorsByDay', 'visitors_by_day']);
    if (!source) return null;
    var entries = [];
    if (Array.isArray(source)) {
      source.forEach(function (row) {
        if (!row || typeof row !== 'object') return;
        var date = row.date || row.day || row.datetime || row.at;
        var count = visitorCount(row.visitors !== undefined ? row.visitors : (row.count !== undefined ? row.count : row.visits));
        if (date && count !== null) entries.push([String(date), count]);
      });
    } else if (typeof source === 'object') {
      Object.keys(source).forEach(function (date) {
        var count = visitorCount(source[date]);
        if (count !== null) entries.push([date, count]);
      });
    }
    if (!entries.length) return null;
    var history = new Array(DAYS);
    for (var i = 0; i < DAYS; i++) history[i] = null;
    var known = 0;
    entries.forEach(function (entry) {
      var parsed = Date.parse(entry[0]);
      if (isNaN(parsed)) return;
      var parts = entry[0].match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var day = parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : new Date(parsed);
      day.setHours(0, 0, 0, 0);
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var index = DAYS - 1 - Math.round((today - day) / 86400000);
      if (index >= 0 && index < DAYS) { history[index] = (history[index] || 0) + entry[1]; known++; }
    });
    return known ? history : null;
  }
  function withLiveHistory(c, raw) {
    c.downtime = null;
    var real = readVisitorHistory(raw);
    if (real) {
      c.visitors = real;
      c.visitorsSource = 'worker';
    } else {
      // No traffic history from the Worker: keep the arrays, but mark them unknown.
      c.visitors = new Array(DAYS).fill(null);
      c.visitorsSource = 'none';
    }
    return c;
  }
  function visitorHistoryStatus(list) {
    var worker = 0, none = 0, sample = 0;
    list.forEach(function (c) {
      if (c.visitorsSource === 'worker') worker++;
      else if (c.visitorsSource === 'none') none++;
      else sample++;
    });
    if (sample && !worker && !none) return 'sample';
    if (worker && !none && !sample) return 'worker';
    if (!worker && !sample) return 'none';
    return 'partial';
  }

  /* ------------------------------------------------------ demo dataset */
  var DEMO_NAMES = {
    Hospitality: ['Bluebird Bakery', 'Saffron & Sage Bistro', 'The Copper Kettle', 'Harbor Street Tacos', 'Juniper Coffee Co', 'Nonna Rosa Trattoria', 'Little Fig Wine Bar', 'Golden Hour Brunch'],
    Wellness: ['Lotus Flow Yoga', 'Peak Physio', 'Evergreen Dental', 'Mindful Path Therapy', 'Ironclad Fitness', 'Glow Skin Studio', 'Rooted Acupuncture', 'Clearview Optometry'],
    Retail: ['Thread & Needle', 'Paper Moon Stationery', 'Wildflower Florist', 'Oak & Ember Candles', 'Vinyl Haven Records', 'Pawsome Pet Supply', 'Terra Ceramics', 'The Book Nook'],
    Professional: ['Hartley Law Group', 'Brightside Accounting', 'Keystone Realty', 'Meridian Financial', 'Atlas Architects', 'Clarity HR Consulting', 'Pinnacle Insurance', 'Ledger & Co CPAs'],
    Creative: ['Studio Marlowe Photo', 'Inkwell Tattoo', 'Echo Sound Lab', 'Frame & Field Films', 'Mosaic Wedding Co', 'Canvas Kids Art', 'Velvet Room Events', 'Driftwood Design'],
    'Home Services': ['ProFlow Plumbing', 'Greenleaf Landscaping', 'Sparkle Clean Co', 'Volt Electric', 'Summit Roofing', 'Cozy Home HVAC', 'Fresh Coat Painters', 'Handy Hank Repairs'],
    Unspecified: []
  };

  function buildDemo() {
    var list = [], idx = 0;
    INDUSTRIES.forEach(function (ind) {
      DEMO_NAMES[ind].forEach(function (name) {
        var r = rng(hash(name)), i;
        var plan = ['Basic', 'Standard', 'Standard', 'WaaS'][Math.floor(r() * 4)];
        var billing = r() < 0.32 ? 'Annual' : 'Monthly';
        var def = PLAN_DEFAULTS[plan];
        var created = Math.min(DAYS - 4, Math.floor(Math.pow(r(), 0.75) * (DAYS - 40)));
        var suspended = r() < 0.11;
        var health = 'Online';
        if (!suspended && r() < 0.05) health = r() < 0.4 ? 'Down' : 'Degraded';
        var renew = new Date(); renew.setDate(renew.getDate() + Math.floor(r() * 300) - 20);
        var client = {
          id: 'c' + (++idx),
          slug: slugOf(name),
          name: name,
          domain: name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '') + ['.com', '.com', '.co', '.studio'][Math.floor(r() * 4)],
          state: suspended ? 'suspended' : 'active',
          health: suspended ? 'Suspended' : health,
          plan: plan, billing: billing, monthly: def.m, annual: def.a,
          mrr: billing === 'Annual' ? Math.round((def.a / 12) * 100) / 100 : def.m,
          renewal: isoDay(renew),
          email: 'hello@' + name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) + '.com',
          industry: ind,
          createdAt: created,
          suspendedAt: suspended ? DAYS - 3 - Math.floor(r() * 30) : null,
          content: {
            heroTitle: 'Welcome to ' + name,
            heroSubtitle: 'Trusted by the local community since day one',
            announcement: r() < 0.35 ? 'Seasonal offer — mention this banner for 10% off' : '',
            phone: '+1 (555) 0' + String(100 + Math.floor(r() * 899)),
            whatsapp: '+1555' + String(1000000 + Math.floor(r() * 8999999)),
            email: 'hello@' + name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) + '.com',
            address: (100 + Math.floor(r() * 899)) + ' Main St, Portland OR',
            mapsUrl: 'https://maps.google.com/?q=' + encodeURIComponent(name),
            facebook: 'https://facebook.com/' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            instagram: 'https://instagram.com/' + name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            images: r() < 0.5 ? ['https://cdn.jsdelivr.net/gh/demo/repo@main/' + slugOf(name) + '-1.jpg', 'https://cdn.jsdelivr.net/gh/demo/repo@main/' + slugOf(name) + '-2.jpg'] : []
          },
          openRequests: Math.floor(r() * 4)
        };
        list.push(withHistory(client));
      });
    });
    return list;
  }

  /* ---------------------------------------------------- client filters */
  function matchFilters(c) {
    var f = state.filters;
    if (f.industry !== 'All' && c.industry !== f.industry) return false;
    if (f.plan !== 'All' && c.plan !== f.plan) return false;
    if (f.billing !== 'All' && c.billing !== f.billing) return false;
    return true;
  }
  function liveVisitorSummary() {
    if (state.demo) return { value: null, message: 'Live visitors are unavailable in demo mode. Connect your Worker to view real traffic.' };
    if (!state.auth || !state.live || state.apiError) return { value: null, message: 'Live visitor data is unavailable while the Worker is disconnected.' };
    if (!state.liveVisitorsAt || Date.now() - state.liveVisitorsAt.getTime() > LIVE_STALE_MS) {
      return { value: null, message: 'Live visitor data is out of date. Waiting for the Worker to respond.' };
    }

    var filtered = state.filters.industry !== 'All' || state.filters.plan !== 'All' || state.filters.billing !== 'All';
    if (!filtered && state.liveVisitors !== null) return { value: state.liveVisitors, message: '' };

    var active = state.clients.filter(function (c) { return c.state === 'active' && matchFilters(c); });
    if (active.length && active.every(function (c) { return c.liveVisitors !== null && c.liveVisitors !== undefined; })) {
      return { value: active.reduce(function (total, c) { return total + c.liveVisitors; }, 0), message: '' };
    }
    var hasSource = state.liveVisitors !== null || state.clients.some(function (c) { return c.liveVisitors !== null && c.liveVisitors !== undefined; });
    if (!active.length && hasSource) return { value: 0, message: '' };
    return {
      value: null,
      message: filtered
        ? 'Filtered live counts require the Worker to return liveVisitors for every matching client.'
        : 'The Worker must return an analytics-backed liveVisitors count; no estimate is shown.'
    };
  }
  function renderLiveVisitors() {
    var summary = liveVisitorSummary();
    var available = summary.value !== null;
    $('#liveNow').textContent = available ? fmtNum(summary.value) : '--';
    $('#liveNowLabel').textContent = available ? 'active visitors' : 'live visitors unavailable';
    $('#liveNowMobile').textContent = $('#liveNow').textContent;
    $('#liveNowMobileLabel').textContent = $('#liveNowLabel').textContent;
    $('#liveDot').className = 'relative h-2 w-2 rounded-full ' + (available ? 'bg-emerald-500' : 'bg-slate-400');
    $('#livePulse').className = available ? 'ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70' : 'hidden';
    $('#liveNowUpdated').classList.toggle('hidden', !available || !state.liveVisitorsAt);
    $('#liveNowUpdated').textContent = available && state.liveVisitorsAt ? 'fetched ' + state.liveVisitorsAt.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    $('#liveVisitorsBadge').title = available
      ? 'Visitor count supplied by the Worker. Refreshed every 30 seconds; date ranges do not change the live count.'
      : summary.message;
    $('#liveVisitorsHint').textContent = summary.message;
    $('#liveVisitorsHint').classList.toggle('hidden', !summary.message);
    localizeDOM();
  }
  function activeAt(c, t) { return c.createdAt <= t && (c.suspendedAt === null ? c.state !== 'suspended' : c.suspendedAt > t); }
  function counted(c) { return !state.demo || c.state !== 'suspended'; }
  function mrrAt(list, t) {
    var s = 0, i;
    for (i = 0; i < list.length; i++) if (activeAt(list[i], t) && counted(list[i])) s += list[i].billing === 'Annual' ? Math.round(list[i].annual * 100) : 12 * Math.round(list[i].monthly * 100);
    return Math.round(s / 12) / 100;
  }
  function countAt(list, t) {
    var n = 0, i;
    for (i = 0; i < list.length; i++) if (activeAt(list[i], t) && counted(list[i])) n++;
    return n;
  }
  // Returns null when no client has a measured value in the window.
  function visitorsBetween(list, a, b) {
    var v = 0, i, d, known = false;
    for (i = 0; i < list.length; i++) {
      if (!list[i].visitors) continue;
      for (d = Math.max(0, a); d <= b; d++) {
        var value = list[i].visitors[d];
        if (typeof value === 'number') { v += value; known = true; }
      }
    }
    return known ? v : null;
  }
  function uptimeBetween(list, a, b) {
    var down = 0, days = 0, i, d;
    for (i = 0; i < list.length; i++) {
      if (!list[i].downtime) continue;
      for (d = Math.max(a, list[i].createdAt); d <= b; d++) {
        if (!activeAt(list[i], d)) continue;
        days++; down += list[i].downtime[d];
      }
    }
    return days === 0 ? (state.demo ? 100 : null) : 100 * (1 - down / (days * 1440));
  }
  function openRequestsAt(list, t) {
    var n = 0, i;
    for (i = 0; i < list.length; i++) {
      if (list[i].state === 'suspended') continue;
      if (list[i].openRequests && list[i].openRequests > 0 && activeAt(list[i], t)) n += list[i].openRequests;
    }
    return n;
  }

  /* --------------------------------------------------------- dashboard */
  function dayIndexOfISO(iso) {
    var parsed = Date.parse(iso + 'T00:00:00');
    if (isNaN(parsed)) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var parts = entry[0].match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var day = parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : new Date(parsed);
      day.setHours(0, 0, 0, 0);
    return DAYS - 1 - Math.round((today - day) / 86400000);
  }
  function resolveRange() {
    var f = state.filters;
    if (f.range === 'custom' && f.customStart && f.customEnd) {
      var start = dayIndexOfISO(f.customStart), end = dayIndexOfISO(f.customEnd);
      if (start !== null && end !== null && start <= end && end <= DAYS - 1 && start >= 0) {
        var days = end - start + 1;
        return { key: 'custom', label: 'Custom', days: days, bucket: days <= 45 ? 1 : days <= 240 ? 7 : 31, start: start, end: end };
      }
    }
    var preset = RANGES.filter(function (r) { return r.key === f.range; })[0] || RANGES[1];
    return { key: preset.key, label: preset.label, days: preset.days, bucket: preset.bucket, start: DAYS - 1 - preset.days + 1, end: DAYS - 1 };
  }
  function computeDash() {
    var f = state.filters;
    var range = resolveRange();
    var end = range.end, start = range.start, prevStart = start - range.days, prevEnd = start - 1;
    var list = state.clients.filter(matchFilters);

    var buckets = [], be, bs, i, k;
    for (be = end; be >= start; be -= range.bucket) {
      bs = Math.max(start, be - range.bucket + 1);
      var newS = list.filter(function (c) { return c.createdAt >= bs && c.createdAt <= be; });
      var churnS = list.filter(function (c) { return c.suspendedAt !== null && c.suspendedAt >= bs && c.suspendedAt <= be; });
      var opened = 0, resolved = 0;
      for (i = 0; i < list.length; i++) {
        var c = list[i], r2 = rng(hash(c.id) + bs);
        var rate = (c.plan === 'WaaS' ? 4 : c.plan === 'Standard' ? 2.5 : 1.2) * range.bucket / 30;
        opened += Math.round(rate * (0.4 + r2() * 1.4));
        resolved += Math.round(rate * (0.3 + r2() * 1.5));
      }
      buckets.unshift({
        label: range.bucket >= 28
          ? dayDate(be).toLocaleDateString(locale(), { month: 'short', year: '2-digit' })
          : dayDate(be).toLocaleDateString(locale(), { month: 'short', day: 'numeric' }),
        mrr: mrrAt(list, be), prevMrr: mrrAt(list, be - range.days),
        clients: countAt(list, be), prevClients: countAt(list, be - range.days),
        newMrr: Math.round(newS.reduce(function (a, c) { return a + (c.state === 'suspended' ? 0 : c.mrr); }, 0)),
        churnedMrr: Math.round(churnS.reduce(function (a, c) { return a + c.mrr; }, 0)),
        newClients: newS.length, churned: churnS.length,
        visitors: visitorsBetween(list, bs, be), prevVisitors: visitorsBetween(list, bs - range.days, be - range.days),
        uptime: uptimeBetween(list, bs, be),
        opened: opened, resolved: resolved
      });
    }

    var mrr = mrrAt(list, end), prevMrr = mrrAt(list, prevEnd);
    var clients = countAt(list, end), prevClients = countAt(list, prevEnd);
    var base = countAt(list, start - 1) + list.filter(function (c) { return c.createdAt >= start && c.createdAt <= end; }).length;
    var lost = list.filter(function (c) { return c.suspendedAt !== null && c.suspendedAt >= start && c.suspendedAt <= end; }).length;
    var churn = base ? (100 * lost) / base : 0;
    var pbase = countAt(list, prevStart - 1) + list.filter(function (c) { return c.createdAt >= prevStart && c.createdAt <= prevEnd; }).length;
    var plost = list.filter(function (c) { return c.suspendedAt !== null && c.suspendedAt >= prevStart && c.suspendedAt <= prevEnd; }).length;
    var pchurn = pbase ? (100 * plost) / pbase : 0;
    var up = uptimeBetween(list, start, end), pup = uptimeBetween(list, prevStart, prevEnd);
    var vis = visitorsBetween(list, start, end), pvis = visitorsBetween(list, prevStart, prevEnd);
    var open = openRequestsAt(list, end), popen = openRequestsAt(list, prevEnd);
    var visitorsStatus = visitorHistoryStatus(list);
    var visitorsLabel = visitorsStatus === 'sample' ? 'Site Visitors (sample)' : 'Site Visitors';
    var visitorsHint = visitorsStatus === 'sample'
      ? 'Illustrative history · ' + fmtNum(Math.round((vis || 0) / range.days)) + ' / day avg'
      : visitorsStatus === 'worker'
        ? 'Worker analytics · ' + fmtNum(Math.round((vis || 0) / range.days)) + ' / day avg'
        : visitorsStatus === 'partial'
          ? 'Partial data: some clients have no visitor history from the Worker'
          : 'No visitor history from the Worker';

    var kpis = [
      { key: 'mrr', label: 'Monthly Recurring Revenue', value: mrr, prev: prevMrr, fmt: 'money', upGood: true, hint: 'ARR ' + fmtMoney(mrr * 12, true), spark: buckets.map(function (b) { return b.mrr; }) },
      { key: 'clients', label: 'Active Clients', value: clients, prev: prevClients, fmt: 'int', upGood: true, hint: 'ARPC ' + fmtMoney(clients ? mrr / clients : 0), spark: buckets.map(function (b) { return b.clients; }) },
      { key: 'churn', label: 'Client Churn', value: churn, prev: pchurn, fmt: 'pct', upGood: false, hint: lost + ' suspended this period', spark: buckets.map(function (b) { return b.churned; }) },
      { key: 'uptime', label: 'Portfolio Uptime', value: up, prev: pup, fmt: 'pct', upGood: true, hint: state.demo ? 'SLA target 99.90%' : 'Monitoring not configured', spark: buckets.map(function (b) { return b.uptime || 0; }) },
      { key: 'visitors', label: visitorsLabel, value: vis, prev: pvis, fmt: 'int', upGood: true, hint: visitorsHint, unavailable: vis === null, spark: buckets.map(function (b) { return b.visitors === null ? 0 : b.visitors; }) },
      { key: 'open', label: 'Open Content Requests', value: state.demo ? open : null, prev: state.demo ? popen : null, fmt: 'int', upGood: false, hint: state.demo ? 'queued across portfolio' : 'No request feed configured', spark: buckets.map(function (b) { return b.opened; }) }
    ];

    // plan donut (mrr by plan, active now)
    var planMap = Object.create(null), planSeen = Object.create(null);
    list.forEach(function (c) {
      planSeen[c.plan] = true;
      if (activeAt(c, end) && counted(c)) planMap[c.plan] = (planMap[c.plan] || 0) + c.mrr;
    });
    var byPlan = Object.keys(planSeen).map(function (p) { return { name: p, value: Math.round(planMap[p] || 0), color: planColor(p) }; })
      .sort(function (a, b) { return b.value - a.value || a.name.localeCompare(b.name); });

    // segments
    var segments = Array.from(new Set(segmentChoices().concat(['Unspecified']).concat(list.map(function (c) { return c.industry; }))));
    var bySegment = segments.map(function (ind) {
      var sub = list.filter(function (c) { return c.industry === ind; });
      return { name: ind, current: mrrAt(sub, end), previous: mrrAt(sub, prevEnd), clients: countAt(sub, end) };
    }).filter(function (s) { return s.current > 0 || s.previous > 0; })
      .sort(function (a, b) { return b.current - a.current; });

    // statuses
    var counts = { Online: 0, Degraded: 0, Down: 0, Suspended: 0, Unknown: 0 };
    list.forEach(function (c) {
      if (c.createdAt > end) return;
      counts[c.state === 'suspended' ? 'Suspended' : c.health] = (counts[c.state === 'suspended' ? 'Suspended' : c.health] || 0) + 1;
    });
    var byStatus = ['Online', 'Degraded', 'Down', 'Suspended', 'Unknown'].map(function (s) { return { name: s, value: counts[s] || 0 }; })
      .filter(function (s) { return s.value > 0; });

    // request types (demo/live synthetic breakdown of the queue)
    var types = [['Text update', 0], ['Image swap', 0], ['New page', 0], ['SEO tweak', 0], ['Bug fix', 0], ['Menu / pricing', 0], ['Blog post', 0]];
    list.forEach(function (c) {
      var r2 = rng(hash(c.id + 'type'));
      var n = c.openRequests || 0;
      for (i = 0; i < n; i++) types[Math.floor(r2() * types.length)][1]++;
    });
    var byType = types.filter(function (t) { return t[1] > 0; }).map(function (t) { return { name: t[0], value: t[1] }; })
      .sort(function (a, b) { return b.value - a.value; });

    return {
      range: range, start: start, end: end, prevStart: prevStart, prevEnd: prevEnd,
      list: list, buckets: buckets, kpis: kpis, byPlan: byPlan, bySegment: bySegment,
      byStatus: byStatus, byType: byType, mrr: mrr, clients: clients, visitorsStatus: visitorsStatus
    };
  }

  /* ---------------------------------------------------------- rendering */
  function fmtKpi(v, fmt) {
    if (fmt === 'money') return fmtMoney(v);
    if (fmt === 'pct') return v.toFixed(v > 99 ? 2 : 1) + '%';
    return fmtNum(v, v >= 100000);
  }

  function sparkPath(values, w, h) {
    if (!values.length) return '';
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values), span = (max - min) || 1;
    return values.map(function (v, i) {
      var x = (i / Math.max(1, values.length - 1)) * w;
      var y = h - ((v - min) / span) * (h - 4) - 2;
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
  }

  function renderKpis(dash) {
    var html = dash.kpis.map(function (k, i) {
      var unavailable = !!k.unavailable || k.value === null || k.value === undefined;
      var value = unavailable ? 0 : k.value, prev = k.prev === null || k.prev === undefined ? null : k.prev;
      var delta = prev === null ? 0 : (k.fmt === 'pct' ? value - prev : (prev === 0 ? (value > 0 ? 100 : 0) : ((value - prev) / Math.abs(prev)) * 100));
      var flat = Math.abs(delta) < (k.fmt === 'pct' ? 0.005 : 0.05);
      var up = delta > 0;
      var good = flat ? null : (up === k.upGood);
      var label = k.fmt === 'pct' ? (up ? '+' : '') + delta.toFixed(Math.abs(delta) < 0.1 ? 2 : 1) + ' pts' : (up ? '+' : '') + delta.toFixed(1) + '%';
      var tone = good === null ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        : good ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400';
      var arrow = flat
        ? '<path d="M5 12h14"/>'
        : (up ? '<path d="M7 17L17 7M17 7H8M17 7v9"/>' : '<path d="M7 7l10 10M17 17H8M17 17v-9"/>');
      var color = ['#6366f1', '#06bdf4', '#f43f5e', '#10b981', '#8b5cf6', '#f59e0b'][i] || '#6366f1';
      var comparison = unavailable || prev === null
        ? '<span class="text-[11px] text-slate-400">no comparison available</span>'
        : '<span class="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ' + tone + '">' +
          '<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + arrow + '</svg>' + (flat ? '0.0%' : label) + '</span>' +
          '<span class="text-[11px] text-slate-400">vs prev. period</span>';
      return '<div class="card fade-up relative overflow-hidden p-4" style="animation-delay:' + (i * 50) + 'ms">' +
        '<div class="flex items-start justify-between gap-2"><span class="text-xs font-medium leading-tight text-slate-500 dark:text-slate-400">' + esc(k.label) + '</span></div>' +
        '<div class="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900 dark:text-white">' + (unavailable ? '--' : fmtKpi(value, k.fmt)) + '</div>' +
        '<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">' + comparison + '</div>' +
        '<div class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">' + esc(k.hint) + '</div>' +
        '<div class="pointer-events-none -mx-4 -mb-4 mt-2 h-12">' +
        '<svg viewBox="0 0 200 48" preserveAspectRatio="none" class="h-full w-full">' +
        '<defs><linearGradient id="sp' + k.key + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + color + '" stop-opacity=".35"/><stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
        '<path d="' + sparkPath(k.spark, 200, 48) + ' L200 48 L0 48 Z" fill="url(#sp' + k.key + ')"/>' +
        '<path d="' + sparkPath(k.spark, 200, 48) + '" fill="none" stroke="' + color + '" stroke-width="1.75"/>' +
        '</svg></div></div>';
    }).join('');
    $('#kpiGrid').innerHTML = html;
  }

  /* ------------------------------------------------------------ charts */
  function grad(ctx, color, a1, a2) {
    var area = ctx.chart && ctx.chart.chartArea;
    if (!area) return color;
    var g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, hexA(color, a1));
    g.addColorStop(1, hexA(color, a2));
    return g;
  }
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function baseOpts() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark() ? 'rgba(15,23,42,.96)' : 'rgba(255,255,255,.97)',
          titleColor: isDark() ? '#f8fafc' : '#0f172a',
          bodyColor: isDark() ? '#cbd5e1' : '#475569',
          borderColor: isDark() ? '#334155' : '#e2e8f0',
          borderWidth: 1, padding: 10, cornerRadius: 10, boxPadding: 4,
          titleFont: { family: 'Inter', size: 12, weight: '600' },
          bodyFont: { family: 'Inter', size: 11 },
          displayColors: true
        }
      },
      scales: {
        x: { grid: { color: gridColor(), drawTicks: false }, border: { display: false }, ticks: { color: textColor(), font: { family: 'Inter', size: 11 }, maxRotation: 0, autoSkipPadding: 18 } },
        y: { grid: { color: gridColor(), drawTicks: false }, border: { display: false }, ticks: { color: textColor(), font: { family: 'Inter', size: 11 } } }
      }
    };
  }
  function mkChart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    var el = document.getElementById(id);
    if (!el) return;
    if (cfg.data && Array.isArray(cfg.data.datasets)) {
      cfg.data.datasets.forEach(function (dataset) {
        if (typeof dataset.label === 'string') dataset.label = t(dataset.label);
      });
    }
    var callbacks = cfg.options && cfg.options.plugins && cfg.options.plugins.tooltip && cfg.options.plugins.tooltip.callbacks;
    if (callbacks) {
      Object.keys(callbacks).forEach(function (name) {
        if (typeof callbacks[name] !== 'function') return;
        var original = callbacks[name];
        callbacks[name] = function () { return t(original.apply(this, arguments)); };
      });
    }
    charts[id] = new Chart(el.getContext('2d'), cfg);
  }

  function renderCharts(dash) {
    var labels = dash.buckets.map(function (b) { return b.label; });
    var isMrr = state.revMetric === 'mrr';

    /* Revenue line */
    var ro = baseOpts();
    ro.scales.y.ticks.callback = function (v) { return isMrr ? fmtMoney(v, true) : fmtNum(v); };
    ro.plugins.tooltip.callbacks = {
      label: function (ctx) {
        var b = dash.buckets[ctx.dataIndex];
        var v = isMrr ? b.mrr : b.clients, p = isMrr ? b.prevMrr : b.prevClients;
        return (isMrr ? 'Current: ' + fmtMoney(v) : 'Current: ' + fmtNum(v)) +
          '  ·  Prev: ' + (isMrr ? fmtMoney(p) : fmtNum(p)) +
          '  ·  New +' + (isMrr ? fmtMoney(b.newMrr) : b.newClients) +
          '  ·  Lost −' + (isMrr ? fmtMoney(b.churnedMrr) : b.churned);
      }
    };
    mkChart('chartRevenue', {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Previous period', data: dash.buckets.map(function (b) { return isMrr ? b.prevMrr : b.prevClients; }), borderColor: textColor(), borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, tension: .35, fill: false },
          {
            label: 'Current', data: dash.buckets.map(function (b) { return isMrr ? b.mrr : b.clients; }),
            borderColor: C.primary, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5,
            pointHoverBackgroundColor: C.primary, pointHoverBorderColor: surfaceColor(), pointHoverBorderWidth: 2,
            tension: .35, fill: true,
            backgroundColor: function (ctx) { return grad(ctx, C.primary, .30, 0); }
          }
        ]
      },
      options: ro
    });

    /* Plan donut */
    var totalPlan = dash.byPlan.reduce(function (a, b) { return a + b.value; }, 0);
    mkChart('chartPlan', {
      type: 'doughnut',
      data: { labels: dash.byPlan.map(function (p) { return p.name; }), datasets: [{ data: dash.byPlan.map(function (p) { return p.value; }), backgroundColor: dash.byPlan.map(function (p) { return p.color; }), borderColor: surfaceColor(), borderWidth: 2, hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: baseOpts().plugins.tooltip,
        },
        onClick: function (e, els) {
          if (!els.length) return;
          var name = dash.byPlan[els[0].index].name;
          setFilter('plan', state.filters.plan === name ? 'All' : name);
        }
      }
    });
    renderPlanCenter(dash, null);

    /* Growth: new vs churned bars + net line */
    var go = baseOpts();
    go.scales.y.stacked = false;
    go.scales.y.ticks.callback = function (v) { return fmtMoney(v, true); };
    go.plugins.tooltip.callbacks = {
      label: function (ctx) {
        var b = dash.buckets[ctx.dataIndex];
        if (ctx.datasetIndex === 2) return 'Net: ' + fmtMoney(b.newMrr - b.churnedMrr);
        if (ctx.datasetIndex === 1) return 'Churned: ' + fmtMoney(b.churnedMrr) + ' (' + b.churned + ')';
        return 'New: ' + fmtMoney(b.newMrr) + ' (' + b.newClients + ')';
      }
    };
    var netData = dash.buckets.map(function (b) { return b.newMrr - b.churnedMrr; });
    mkChart('chartGrowth', {
      data: {
        labels: labels,
        datasets: [
          { type: 'bar', label: 'New', data: dash.buckets.map(function (b) { return b.newMrr; }), backgroundColor: '#10b981', borderRadius: 4, maxBarSize: 26, order: 2 },
          { type: 'bar', label: 'Churned', data: dash.buckets.map(function (b) { return -b.churnedMrr; }), backgroundColor: '#f43f5e', borderRadius: 4, maxBarSize: 26, order: 2 },
          { type: 'line', label: 'Net', data: netData, borderColor: C.primary, borderWidth: 2, pointRadius: 0, tension: .3, order: 1 }
        ]
      },
      options: go
    });
    var net = netData.reduce(function (a, b) { return a + b; }, 0);
    $('#growthSub').innerHTML = 'Net new <span class="font-semibold text-slate-700 dark:text-slate-200">' + fmtMoney(net) + '</span> this period';

    /* Segment bars */
    var so = baseOpts();
    so.indexAxis = 'y';
    so.scales.x.ticks.callback = function (v) { return fmtMoney(v, true); };
    so.scales.y.grid = { display: false };
    so.plugins.tooltip.callbacks = {
      label: function (ctx) {
        var s = dash.bySegment[ctx.dataIndex];
        var ch = s.previous ? ((s.current - s.previous) / s.previous) * 100 : 0;
        return ['Current: ' + fmtMoney(s.current), 'Previous: ' + fmtMoney(s.previous), 'Change: ' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%', 'Clients: ' + s.clients];
      }
    };
    mkChart('chartSegment', {
      type: 'bar',
      data: {
        labels: dash.bySegment.map(function (s) { return t(s.name); }),
        datasets: [
          { label: 'Current', data: dash.bySegment.map(function (s) { return s.current; }), backgroundColor: dash.bySegment.map(function (s) { var color = segmentColor(s.name); return state.filters.industry === 'All' || state.filters.industry === s.name ? color : hexA(color, .3); }), borderRadius: 4, maxBarSize: 14, order: 1 },
          { label: 'Previous', data: dash.bySegment.map(function (s) { return s.previous; }), backgroundColor: isDark() ? '#475569' : '#cbd5e1', borderRadius: 4, maxBarSize: 14, order: 2 }
        ]
      },
      options: so,
      onClick: function (e, els) {
        if (!els.length) return;
        var name = dash.bySegment[els[0].index].name;
        setFilter('industry', state.filters.industry === name ? 'All' : name);
      }
    });

    /* Performance: visitors or uptime */
    var perfUptime = state.perfMetric === 'uptime';
    var po = baseOpts();
    if (perfUptime) {
      var ups = dash.buckets.map(function (b) { return b.uptime; }).filter(Number.isFinite);
      var minUp = Math.min.apply(null, ups.concat([99.9]));
      po.scales.y.min = Math.floor((minUp - 0.05) * 10) / 10;
      po.scales.y.max = 100;
      po.scales.y.ticks.callback = function (v) { return v.toFixed(1) + '%'; };
      po.plugins.tooltip.callbacks = { label: function (ctx) { return 'Uptime: ' + ctx.parsed.y.toFixed(3) + '%'; } };
    } else {
      po.scales.y.ticks.callback = function (v) { return fmtNum(v, true); };
      po.plugins.tooltip.callbacks = {
        label: function (ctx) {
          var b = dash.buckets[ctx.dataIndex];
          var fmtMaybe = function (v) { return v === null || v === undefined ? '--' : fmtNum(v); };
          return 'Visitors: ' + fmtMaybe(b.visitors) + '  ·  Prev: ' + fmtMaybe(b.prevVisitors);
        }
      };
      po.spanGaps = false;
    }
    var perfDatasets = perfUptime
      ? [{ label: 'Uptime', data: dash.buckets.map(function (b) { return b.uptime; }), borderColor: '#10b981', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: .3, fill: true, backgroundColor: function (ctx) { return grad(ctx, '#10b981', .25, 0); } }]
      : [
        { label: 'Previous period', data: dash.buckets.map(function (b) { return b.prevVisitors; }), borderColor: textColor(), borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, tension: .35 },
        { label: 'Visitors', data: dash.buckets.map(function (b) { return b.visitors; }), borderColor: C.violet, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: .35, fill: true, backgroundColor: function (ctx) { return grad(ctx, C.violet, .3, 0); } }
      ];
    mkChart('chartPerf', { type: 'line', data: { labels: labels, datasets: perfDatasets }, options: po });
    var perfSubtitle = perfUptime ? (state.demo ? 'Portfolio uptime vs 99.9% SLA' : 'Monitoring not configured')
      : dash.visitorsStatus === 'sample' ? 'Illustrative traffic history (not live visitor data)'
      : dash.visitorsStatus === 'worker' ? 'Daily visitors reported by the Worker analytics'
      : dash.visitorsStatus === 'partial' ? 'Daily visitors from the Worker · some clients have no history'
      : 'No daily visitor history from the Worker';
    $('#perfSub').textContent = perfSubtitle;

    /* Status donut */
    mkChart('chartStatus', {
      type: 'doughnut',
      data: { labels: dash.byStatus.map(function (s) { return t(s.name); }), datasets: [{ data: dash.byStatus.map(function (s) { return s.value; }), backgroundColor: dash.byStatus.map(function (s) { return STATUS_COLORS[s.name]; }), borderColor: surfaceColor(), borderWidth: 2, hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: { legend: { display: false }, tooltip: baseOpts().plugins.tooltip }
      }
    });
    var totalSt = dash.byStatus.reduce(function (a, b) { return a + b.value; }, 0);
    var okSt = (dash.byStatus.filter(function (s) { return s.name === 'Online'; })[0] || { value: 0 }).value;
    $('#statusCenter').innerHTML = '<div><div class="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">' +
      (state.demo ? (totalSt ? Math.round((okSt / totalSt) * 100) : 0) + '%' : '—') + '</div><div class="text-[11px] text-slate-500 dark:text-slate-400">healthy</div></div>';
    $('#statusList').innerHTML = dash.byStatus.map(function (s) {
      return '<li><button data-status="' + esc(s.name) + '" class="status-jump flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">' +
        '<span class="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span class="h-2 w-2 rounded-full" style="background:' + STATUS_COLORS[s.name] + '"></span>' + esc(s.name) + '</span>' +
        '<span class="font-semibold tabular-nums text-slate-900 dark:text-white">' + s.value + '</span></button></li>';
    }).join('');

    /* Requests */
    var qo = baseOpts();
    qo.scales.y.ticks.callback = function (v) { return v; };
    qo.plugins.tooltip.callbacks = {
      label: function (ctx) {
        var b = dash.buckets[ctx.dataIndex];
        return (ctx.datasetIndex === 0 ? 'Opened: ' : 'Resolved: ') + (ctx.datasetIndex === 0 ? b.opened : b.resolved);
      }
    };
    mkChart('chartRequests', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Opened', data: dash.buckets.map(function (b) { return b.opened; }), backgroundColor: '#f59e0b', borderRadius: 3, maxBarSize: 16 },
          { label: 'Resolved', data: dash.buckets.map(function (b) { return b.resolved; }), backgroundColor: '#10b981', borderRadius: 3, maxBarSize: 16 }
        ]
      },
      options: qo
    });
    var openedTotal = dash.buckets.reduce(function (a, b) { return a + b.opened; }, 0);
    var resolvedTotal = dash.buckets.reduce(function (a, b) { return a + b.resolved; }, 0);
    $('#reqSub').textContent = state.demo ? fmtNum(openedTotal) + ' opened · ' + fmtNum(resolvedTotal) + ' resolved this period' : 'No request feed configured';
    var maxType = Math.max.apply(null, dash.byType.map(function (t) { return t.value; }).concat([1]));
    $('#reqTypes').innerHTML = dash.byType.slice(0, 5).map(function (t) {
      return '<div class="flex items-center gap-3 text-xs">' +
        '<span class="w-24 shrink-0 truncate text-slate-500 dark:text-slate-400">' + esc(t.name) + '</span>' +
        '<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700" style="width:' + Math.round((t.value / maxType) * 100) + '%"></div></div>' +
        '<span class="w-8 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">' + t.value + '</span></div>';
    }).join('') || '<p class="text-xs text-slate-400">No queued requests for this segment.</p>';

    var first = dash.buckets[0] ? (isMrr ? dash.buckets[0].mrr : dash.buckets[0].clients) : 0;
    var last = dash.buckets.length ? (isMrr ? dash.buckets[dash.buckets.length - 1].mrr : dash.buckets[dash.buckets.length - 1].clients) : 0;
    var growth = first ? ((last - first) / first) * 100 : 0;
    $('#revSub').innerHTML = (isMrr ? 'MRR' : 'Active subscriptions') + ' over the selected period · <span style="color:' +
      (growth >= 0 ? '#10b981' : '#f43f5e') + '">' + (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%</span>';
  }

  function renderPlanCenter(dash, hoverName) {
    var total = dash.byPlan.reduce(function (a, b) { return a + b.value; }, 0);
    var focus = null;
    if (hoverName) focus = dash.byPlan.filter(function (p) { return p.name === hoverName; })[0];
    else if (state.filters.plan !== 'All') focus = dash.byPlan.filter(function (p) { return p.name === state.filters.plan; })[0];
    $('#planCenter').innerHTML = '<div><div class="text-[11px] font-medium uppercase tracking-wide text-slate-400">' +
      esc(focus ? focus.name : 'Total MRR') + '</div><div class="text-xl font-semibold tabular-nums text-slate-900 dark:text-white">' +
      fmtMoney(focus ? focus.value : total) + '</div><div class="text-[11px] text-slate-500 dark:text-slate-400">' +
      (focus ? (total ? Math.round((focus.value / total) * 100) : 0) + '% of portfolio' : dash.byPlan.length + ' plans') + '</div></div>';
  }

  function renderPlanLegend(dash) {
    $('#planLegend').innerHTML = dash.byPlan.map(function (p) {
      var on = state.filters.plan === p.name;
      return '<button data-plan="' + esc(p.name) + '" class="plan-pick flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ' +
        (on ? 'border-[#6366f1]/50 bg-[#6366f1]/10' : 'border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60') + '">' +
        '<span class="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"><span class="h-2 w-2 rounded-full" style="background:' + p.color + '"></span>' + esc(p.name) + '</span>' +
        '<span class="font-semibold tabular-nums text-slate-900 dark:text-white">' + fmtMoney(p.value, true) + '</span></button>';
    }).join('') || '<p class="col-span-2 text-xs text-slate-400">No plans match the filters.</p>';
  }

  /* ---------------------------------------------------------- table UI */
  var COLUMNS = [
    { key: 'client', label: 'Client / site', sortable: true, cls: 'pl-4 sm:pl-5' },
    { key: 'industry', label: 'Segment', sortable: true },
    { key: 'plan', label: 'Plan', sortable: true },
    { key: 'price', label: 'Price', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'uptime', label: 'Uptime', sortable: true },
    { key: 'visitors', label: 'Visitors', sortable: true },
    { key: 'renewal', label: 'Next renewal', sortable: true },
    { key: 'actions', label: 'Actions', sortable: false, cls: 'pr-4 text-right sm:pr-5' }
  ];
  var STATUS_CHIPS = ['All', 'Online', 'Degraded', 'Down', 'Suspended', 'Unknown'];

  function rowStatus(c) { return c.state === 'suspended' ? 'Suspended' : c.health; }

  function buildRows(dash) {
    return dash.list.map(function (c) {
      var down = 0, days = 0, vis = 0, i;
      var visKnown = false;
      for (i = Math.max(dash.start, c.createdAt); i <= dash.end; i++) {
        if (typeof c.visitors[i] === 'number') { vis += c.visitors[i]; visKnown = true; }
        if (c.downtime && activeAt(c, i)) { days++; down += c.downtime[i]; }
      }
      return {
        c: c, status: rowStatus(c),
        uptime: days ? 100 * (1 - down / (days * 1440)) : null,
        visitors: visKnown ? vis : null,
        price: c.billing === 'Annual' ? c.annual : c.monthly
      };
    });
  }

  function filteredRows(dash) {
    var q = state.query.trim().toLowerCase();
    var rows = buildRows(dash).filter(function (r) {
      if (state.status !== 'All' && r.status !== state.status) return false;
      if (!q) return true;
      return (r.c.name + ' ' + r.c.domain + ' ' + r.c.email + ' ' + r.c.plan + ' ' + r.c.industry).toLowerCase().indexOf(q) > -1;
    });
    var order = { Down: 0, Suspended: 1, Degraded: 2, Online: 3 };
    var k = state.sort.key, dir = state.sort.dir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      var va, vb;
      switch (k) {
        case 'client': va = a.c.name; vb = b.c.name; break;
        case 'industry': va = a.c.industry; vb = b.c.industry; break;
        case 'plan': va = planDefaults(a.c.plan).m || a.c.mrr; vb = planDefaults(b.c.plan).m || b.c.mrr; break;
        case 'price': va = a.price; vb = b.price; break;
        case 'status': va = order[a.status]; vb = order[b.status]; break;
        case 'uptime': va = a.uptime; vb = b.uptime; break;
        case 'visitors': va = a.visitors === null ? -1 : a.visitors; vb = b.visitors === null ? -1 : b.visitors; break;
        case 'renewal': va = a.c.renewal || '9999'; vb = b.c.renewal || '9999'; break;
        default: va = a.c.mrr; vb = b.c.mrr;
      }
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
    return rows;
  }

  function pill(status) {
    var map = {
      Online: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
      Degraded: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30',
      Down: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30',
      Suspended: 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/30'
    };
    var dot = { Online: 'bg-emerald-500', Degraded: 'bg-amber-500', Down: 'bg-red-500', Suspended: 'bg-purple-500' };
    var animate = (status === 'Down' || status === 'Online') ? '<span class="ping absolute inline-flex h-full w-full rounded-full opacity-60 ' + dot[status] + '"></span>' : '';
    return '<span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ' + (map[status] || map.Online) + '">' +
      '<span class="relative flex h-1.5 w-1.5">' + animate + '<span class="relative inline-flex h-1.5 w-1.5 rounded-full ' + (dot[status] || 'bg-slate-400') + '"></span></span>' + esc(status) + '</span>';
  }

  var PAGE = 10;

  function renderTable(dash) {
    var all = filteredRows(dash);
    var counts = { All: all.length };
    all.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });

    $('#statusChips').innerHTML = STATUS_CHIPS.map(function (s) {
      var on = state.status === s;
      return '<button data-chip="' + s + '" class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ' +
        (on ? 'border-[#6B1C2E] bg-[#6B1C2E] text-[#F8EAC8] shadow-sm dark:border-[#D6B46C] dark:bg-[#6B1C2E] dark:text-[#F8EAC8]' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800') +
        '">' + s + '<span class="rounded-full px-1.5 text-[10px] tabular-nums ' + (on ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800') + '">' + (counts[s] || 0) + '</span></button>';
    }).join('');

    $('#tableHead').innerHTML = COLUMNS.map(function (col) {
      if (!col.sortable) return '<th class="whitespace-nowrap px-3 py-2.5 font-medium ' + (col.cls || '') + '">' + col.label + '</th>';
      var active = state.sort.key === col.key;
      var icon = active
        ? (state.sort.dir === 'asc' ? '<path d="M12 19V5M5 12l7-7 7 7"/>' : '<path d="M12 5v14M19 12l-7 7-7-7"/>')
        : '<path d="M7 9l5-5 5 5M7 15l5 5 5-5" opacity=".4"/>';
      return '<th class="whitespace-nowrap px-3 py-2.5 font-medium ' + (col.cls || '') + '">' +
        '<button data-sort="' + col.key + '" class="inline-flex items-center gap-1 transition-colors hover:text-slate-900 dark:hover:text-white ' + (active ? 'text-slate-900 dark:text-white' : '') + '">' +
        col.label + '<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + icon + '</svg></button></th>';
    }).join('');

    var pages = Math.max(1, Math.ceil(all.length / PAGE));
    if (state.page > pages - 1) state.page = pages - 1;
    var visible = all.slice(state.page * PAGE, state.page * PAGE + PAGE);

    $('#tableBody').innerHTML = visible.map(function (r) {
      var c = r.c;
      var initials = c.name.split(' ').slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
      var upCls = r.uptime >= 99.9 ? 'text-emerald-600 dark:text-emerald-400' : r.uptime >= 99.5 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
      return '<tr data-open="' + esc(c.id) + '" class="group cursor-pointer transition-colors hover:bg-[#6B1C2E]/[0.04] dark:hover:bg-slate-800/50">' +
        '<td class="py-2.5 pl-4 pr-3 sm:pl-5"><div class="flex items-center gap-2.5">' +
        '<div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white" style="background:' + segmentColor(c.industry) + '">' + esc(initials) + '</div>' +
        '<div class="min-w-0"><div class="truncate font-medium text-slate-900 dark:text-white">' + esc(c.name) + '</div>' +
        '<div class="truncate text-[11px] text-slate-400">' + esc(c.domain) + '</div></div></div></td>' +
        '<td class="px-3 py-2.5 text-slate-600 dark:text-slate-300">' + esc(c.industry) + '</td>' +
        '<td class="px-3 py-2.5"><div class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background:' + planColor(c.plan) + '"></span>' +
        '<span class="font-medium text-slate-700 dark:text-slate-200">' + esc(c.plan) + '</span></div><div class="text-[11px] text-slate-400">' + c.billing + '</div></td>' +
        '<td class="px-3 py-2.5 font-semibold tabular-nums text-slate-900 dark:text-white">' + fmtMoney(r.price) + '<div class="text-[11px] font-normal text-slate-400">' + (c.billing === 'Annual' ? 'per year' : 'per month') + '</div></td>' +
        '<td class="px-3 py-2.5">' + pill(r.status) + '</td>' +
        '<td class="px-3 py-2.5 font-medium tabular-nums ' + upCls + '">' + (r.uptime !== null ? r.uptime.toFixed(2) + '%' : '—') + '</td>' +
        '<td class="px-3 py-2.5 tabular-nums text-slate-700 dark:text-slate-200">' + (r.visitors === null ? '—' : fmtNum(r.visitors, true)) + '</td>' +
        '<td class="px-3 py-2.5 text-slate-500 dark:text-slate-400">' + (c.renewal ? esc(c.renewal) : '—') + '</td>' +
        '<td class="py-2.5 pl-3 pr-4 text-right sm:pr-5"><button data-edit="' + esc(c.id) + '" class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-[#6B1C2E] transition-colors hover:border-[#6B1C2E]/40 hover:bg-[#6B1C2E]/5 dark:border-slate-700 dark:text-[#E8CB8A] dark:hover:border-[#D6B46C]/40 dark:hover:bg-[#D6B46C]/10">' +
        '<svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Edit</button></td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="' + COLUMNS.length + '" class="py-12 text-center text-sm text-slate-400">No sites match the current filters.</td></tr>';

    $('#tableSub').textContent = all.length + ' of ' + buildRows(dash).length + ' sites · click Edit to change billing & CMS';
    $('#pageInfo').textContent = 'Showing ' + (all.length ? state.page * PAGE + 1 : 0) + '–' + Math.min(all.length, (state.page + 1) * PAGE) + ' of ' + all.length;
    $('#pageLabel').textContent = (state.page + 1) + ' / ' + pages;
    $('#prevPage').disabled = state.page === 0;
    $('#nextPage').disabled = state.page >= pages - 1;
  }

  /* ----------------------------------------------------------- alerts */
  function renderAlerts(dash) {
    var out = [];
    if (state.apiError) {
      out.push('<div class="fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">' +
        '<svg class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22M16.7 16.7A9 9 0 1 1 7.3 7.3"/></svg>' +
        '<div class="min-w-0 flex-1 text-amber-800 dark:text-amber-200"><span class="font-semibold">Worker unreachable — showing last known data.</span> <span class="opacity-80">' + esc(state.apiError) + '</span></div>' +
        '<button id="retryBtn" class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">Retry</button></div>');
    }
    var down = dash.list.filter(function (c) { return activeAt(c, dash.end) && c.state === 'active' && c.health === 'Down'; });
    if (down.length) {
      out.push('<div class="fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm dark:border-rose-500/30 dark:bg-rose-500/10">' +
        '<svg class="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>' +
        '<div class="min-w-0 flex-1 text-rose-800 dark:text-rose-200"><span class="font-semibold">' + down.length + ' site' + (down.length > 1 ? 's are' : ' is') + ' down:</span> ' + down.map(function (c) { return esc(c.domain); }).join(', ') + '</div>' +
        '<button data-edit="' + esc(down[0].id) + '" class="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Investigate</button></div>');
    }
    var sus = dash.list.filter(function (c) { return c.state === 'suspended'; });
    if (sus.length) {
      out.push('<div class="fade-up flex flex-wrap items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm dark:border-purple-500/30 dark:bg-purple-500/10">' +
        '<svg class="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' +
        '<div class="min-w-0 flex-1 text-purple-800 dark:text-purple-200"><span class="font-semibold">' + sus.length + ' suspended site' + (sus.length > 1 ? 's' : '') + ':</span> ' +
        sus.slice(0, 4).map(function (c) { return esc(c.domain); }).join(', ') + (sus.length > 4 ? ' +' + (sus.length - 4) + ' more' : '') + '</div>' +
        '<button id="jumpSuspended" class="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700">Review</button></div>');
    }
    $('#alerts').innerHTML = out.join('');
  }

  /* -------------------------------------------------------- activity */
  function renderActivity(dash) {
    var evts = [];
    dash.list.forEach(function (c) {
      if (c.createdAt >= DAYS - 21) evts.push({ s: c.createdAt, t: c.name + ' subscribed to ' + c.plan + ' (' + fmtMoney(c.mrr) + '/mo)', k: 'up' });
      if (c.suspendedAt !== null && c.suspendedAt >= DAYS - 21) evts.push({ s: c.suspendedAt, t: c.name + ' was suspended', k: 'down' });
      if (c.health === 'Down') evts.push({ s: DAYS - 1, t: c.domain + ' is currently unreachable', k: 'alert' });
    });
    evts.sort(function (a, b) { return b.s - a.s; });
    var icons = {
      up: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M17 8h5', 'M19.5 5.5v5'],
      down: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M17 11h5'],
      alert: ['M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4M12 17h.01'],
      edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z']
    };
    function iconPaths(ic) {
      return ic.map(function (d) { return '<path d="' + d + '"/>'; }).join('');
    }
    var tones = {
      up: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      down: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      alert: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      edit: 'bg-[#6B1C2E]/10 text-[#6B1C2E] dark:bg-[#D6B46C]/15 dark:text-[#E8CB8A]'
    };
    var logsHtml = state.logs.slice(0, 8).map(function (l) {
      var ic = icons.edit;
      return '<li class="fade-up flex items-start gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">' +
        '<span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg ' + tones.edit + '"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + iconPaths(ic) + '</svg></span>' +
        '<div class="min-w-0 flex-1"><p class="text-xs leading-snug text-slate-700 dark:text-slate-200">' + esc(l.text) + '</p><p class="mt-0.5 text-[11px] text-slate-400">' + esc(l.at) + '</p></div></li>';
    }).join('');
    var evHtml = evts.slice(0, 14).map(function (e) {
      var ic = icons[e.k];
      var diff = DAYS - 1 - e.s;
      var when = diff <= 0 ? 'today' : diff === 1 ? 'yesterday' : diff < 30 ? diff + 'd ago' : Math.floor(diff / 30) + 'mo ago';
      return '<li class="fade-up flex items-start gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">' +
        '<span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg ' + tones[e.k] + '"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + iconPaths(ic) + '</svg></span>' +
        '<div class="min-w-0 flex-1"><p class="text-xs leading-snug text-slate-700 dark:text-slate-200">' + esc(e.t) + '</p><p class="mt-0.5 text-[11px] text-slate-400">' + when + '</p></div></li>';
    }).join('');
    $('#activityList').innerHTML = (logsHtml + evHtml) || '<li class="py-8 text-center text-xs text-slate-400">No recent activity for this segment.</li>';
  }

  /* ------------------------------------------------------- master render */
  function render() {
    var dash = computeDash();
    state.dash = dash;

    // header bits
    var range = dash.range;
    var rangeLabel = range.key === 'custom'
      ? fmtDate(range.start) + ' – ' + fmtDate(range.end)
      : { '30d': 'Last 30 days', '90d': 'Last 90 days', '6m': 'Last 6 months', '12m': 'Last 12 months' }[state.filters.range];
    var bits = [rangeLabel + ' vs previous period'];
    $('#customRangeLabel').textContent = range.key === 'custom' ? rangeLabel : 'Custom period';
    $('#customRangeBtn').className = 'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ' +
      (range.key === 'custom'
        ? 'border-[#6B1C2E] bg-[#6B1C2E] text-[#F8EAC8] dark:border-[#D6B46C] dark:bg-[#6B1C2E]'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800');
    if (state.filters.industry !== 'All') bits.push(state.filters.industry);
    if (state.filters.plan !== 'All') bits.push(state.filters.plan + ' plan');
    if (state.filters.billing !== 'All') bits.push(state.filters.billing + ' billing');
    if (state.live && state.lastSync) bits.push('synced ' + state.lastSync.toLocaleTimeString(locale()));
    $('#rangeLabel').textContent = bits.join(' · ');
    $('#resetFilters').classList.toggle('hidden', !(
      state.filters.range !== '90d' || state.filters.industry !== 'All' || state.filters.plan !== 'All' || state.filters.billing !== 'All' || state.status !== 'All'
    ));
    $('#resetFilters').classList.toggle('inline-flex', $('#resetFilters').classList.contains('hidden') === false);

    // sidebar goal
    var pct = Math.round((dash.mrr / state.settings.goal) * 100);
    $('#goalTitle').textContent = 'Goal: ' + fmtMoney(state.settings.goal) + ' MRR';
    $('#goalBar').style.width = Math.min(100, pct) + '%';
    $('#goalLabel').textContent = pct + '% of target' + ((state.filters.industry !== 'All' || state.filters.plan !== 'All' || state.filters.billing !== 'All') ? ' (filtered)' : '');
    $('#mobileGoalTitle').textContent = $('#goalTitle').textContent;
    $('#mobileGoalBar').style.width = $('#goalBar').style.width;
    $('#mobileGoalLabel').textContent = $('#goalLabel').textContent;

    renderAlerts(dash);
    renderKpis(dash);
    renderCharts(dash);
    renderPlanLegend(dash);
    renderTable(dash);
    renderActivity(dash);
    renderFooter(dash);
    renderLiveVisitors();
    syncFilterUI();
    localizeDOM();
  }

  function renderFooter(dash) {
    var host = state.auth ? location.host : '';
    if (state.demo) $('#footer').textContent = 'Vllora Studio Master Dashboard · Sample data generated for demonstration';
    else if (state.live) $('#footer').textContent = 'Vllora Studio Master Dashboard · Connected to ' + host + ' · ' + state.clients.length + ' live clients · historical MRR uses current rates';
    else $('#footer').textContent = 'Vllora Studio Master Dashboard · Worker unavailable · last fetched data may be out of date';
  }

  function syncFilterUI() {
    $$('#rangeGroup button').forEach(function (b) {
      var on = b.dataset.range === state.filters.range;
      b.className = 'rounded-md font-medium transition-all ' + (b.dataset.size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs') + ' ' +
        (on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200');
    });
    $$('#revMetric button').forEach(function (b) {
      var on = b.dataset.metric === state.revMetric;
      b.className = 'rounded-md px-3 py-1.5 text-xs font-medium transition-all ' +
        (on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200');
    });
    $$('#perfMetric button').forEach(function (b) {
      var on = b.dataset.metric === state.perfMetric;
      b.className = 'rounded-md px-3 py-1.5 text-xs font-medium transition-all ' +
        (on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200');
    });
    var industries = segmentChoices();
    if (state.clients.some(function (c) { return c.industry === 'Unspecified'; })) industries.push('Unspecified');
    $('#fIndustry').innerHTML = '<option value="All">All segments</option>' + industries.map(function (i) { return '<option value="' + esc(i) + '">' + esc(i) + '</option>'; }).join('');
    var plans = Array.from(new Set(state.settings.plans.map(function (p) { return p.name; }).concat(state.clients.map(function (c) { return c.plan; }))));
    $('#fPlan').innerHTML = '<option value="All">All plans</option>' + plans.map(function (name) {
      var plan = findPlan(name);
      return '<option value="' + esc(name) + '">' + esc(name) + (plan ? ' · ' + fmtMoney(plan.monthly) : '') + '</option>';
    }).join('');
    $('#fIndustry').value = state.filters.industry;
    $('#fPlan').value = state.filters.plan;
    $('#fBilling').value = state.filters.billing;
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    state.page = 0;
    render();
  }

  /* ------------------------------------------------------------ API IO */
  async function apiRequest(path, body) {
    var res;
    try {
      res = await fetch(path, {
        cache: 'no-store', credentials: 'same-origin',
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Accept': 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('Could not reach the dashboard API. Check your connection.');
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var error = new Error(data.error || 'Dashboard API error (' + res.status + ').');
      error.status = res.status;
      throw error;
    }
    return data;
  }

  async function fetchClients() {
    var data = await apiRequest(PORTFOLIO_API);
    if (!Array.isArray(data.clients)) throw new Error('Worker did not return a client list.');
    return {
      clients: data.clients.map(function (raw, i) { return withLiveHistory(normalizeClient(raw, i), raw); }),
      liveVisitors: readLiveVisitors(data)
    };
  }

  async function postClient(payload) { return apiRequest(PORTFOLIO_API, payload); }

  async function refresh(silent) {
    var requestAuth = state.auth;
    if (!requestAuth) return false;
    var requestId = ++refreshGeneration;
    if (!silent) { $('#refreshIcon').classList.add('animate-spin'); }
    try {
      var snapshot = await fetchClients();
      if (state.auth !== requestAuth || requestId !== refreshGeneration) return false;
      state.clients = snapshot.clients;
      state.liveVisitors = snapshot.liveVisitors;
      state.liveVisitorsAt = new Date();
      state.live = true;
      state.apiError = null;
      state.lastSync = new Date();
      renderConnBadge();
      render();
      return true;
    } catch (e) {
      if (state.auth !== requestAuth || requestId !== refreshGeneration) return false;
      if (e.status === 401 || e.status === 403) {
        clearSession();
        showLoginError(e.message);
        return false;
      }
      state.apiError = e.message;
      state.live = false;
      state.liveVisitors = null;
      state.liveVisitorsAt = null;
      renderConnBadge();
      render();
      return false;
    } finally {
      if (requestId === refreshGeneration) $('#refreshIcon').classList.remove('animate-spin');
    }
  }

  function pollLiveVisitors() {
    if (!state.auth || state.demo || document.hidden || $('#app').classList.contains('hidden')) return;
    renderLiveVisitors();
    if (state.saving || state.livePollBusy) return;
    var pollAuth = state.auth;
    state.livePollBusy = true;
    refresh(true).finally(function () {
      if (state.auth === pollAuth) state.livePollBusy = false;
    });
  }

  function addLog(text) {
    var d = new Date();
    state.logs.unshift({ text: text, at: d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) });
    state.logs = state.logs.slice(0, 20);
  }

  /* ------------------------------------------------------- theme + nav */
  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('vllora-theme', dark ? 'dark' : 'light'); } catch (e) {}
    if (state.clients.length) render();
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('vllora-theme'); } catch (e) {}
    var dark = saved ? saved === 'dark' : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', !!dark);
  }

  /* ---------------------------------------------------------- settings */
  function planUsage(name) {
    return state.clients.filter(function (c) { return c.plan.toLowerCase() === name.toLowerCase(); }).length;
  }
  function settingsError(message) {
    var el = $('#settingsError');
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
    if (message) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    localizeDOM();
  }
  function renderSettingsPlans() {
    var plans = state.settingsDraft.plans;
    $('#settingsPlans').innerHTML = plans.map(function (p, i) {
      var used = p.originalName ? planUsage(p.originalName) : 0;
      var disabled = plans.length === 1;
      var suffix = 'settings-plan-' + i;
      return '<div class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">' +
        '<div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_36px]">' +
        '<div class="col-span-2 sm:col-span-1"><label class="lbl" for="' + suffix + '-name">Plan name</label>' +
        '<input id="' + suffix + '-name" data-plan-index="' + i + '" data-plan-field="name" class="field" maxlength="60" placeholder="e.g. Business" value="' + esc(p.name) + '" /></div>' +
        '<div><label class="lbl" for="' + suffix + '-monthly">Monthly (USD)</label><input id="' + suffix + '-monthly" data-plan-index="' + i + '" data-plan-field="monthly" type="number" min="0" step="0.01" inputmode="decimal" class="field tabular-nums" value="' + esc(p.monthly) + '" /></div>' +
        '<div><label class="lbl" for="' + suffix + '-annual">Annual (USD)</label><input id="' + suffix + '-annual" data-plan-index="' + i + '" data-plan-field="annual" type="number" min="0" step="0.01" inputmode="decimal" class="field tabular-nums" value="' + esc(p.annual) + '" /></div>' +
        '<button type="button" data-remove-plan="' + i + '" ' + (disabled ? 'disabled ' : '') + 'title="' + (disabled ? 'At least one plan is required' : 'Remove this plan from your offer') + '" aria-label="Remove plan ' + esc(p.name || String(i + 1)) + '" class="grid h-10 w-10 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400">' +
        '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button></div>' +
        (used ? '<p class="mt-2 text-[11px] text-slate-400">Used by ' + used + ' ' + (used === 1 ? 'client' : 'clients') + '.</p>' : '') + '</div>';
    }).join('');
    localizeDOM();
  }
  function segmentUsage(name) {
    return state.clients.filter(function (c) { return c.industry.toLowerCase() === name.toLowerCase(); }).length;
  }
  function renderSettingsSegments() {
    var segments = state.settingsDraft.segments;
    $('#settingsSegments').innerHTML = segments.map(function (name, i) {
      var used = segmentUsage(name);
      var disabled = segments.length === 1;
      return '<div class="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">' +
        '<label class="sr-only" for="settings-segment-' + i + '">Segment name</label>' +
        '<input id="settings-segment-' + i + '" data-segment-index="' + i + '" class="field" maxlength="60" placeholder="e.g. Restaurants" value="' + esc(name) + '" />' +
        (used ? '<span class="shrink-0 text-[11px] text-slate-400">' + used + ' ' + (used === 1 ? 'client' : 'clients') + '</span>' : '') +
        '<button type="button" data-remove-segment="' + i + '" ' + (disabled ? 'disabled ' : '') + 'title="' + (disabled ? 'At least one segment is required' : 'Remove this segment') + '" aria-label="Remove segment ' + esc(name || String(i + 1)) + '" class="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400">' +
        '<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button></div>';
    }).join('');
    localizeDOM();
  }
  function openSettings() {
    if (!$('#editor').classList.contains('hidden')) readEditorForm();
    state.settingsReturnFocus = document.activeElement;
    state.settingsDraft = {
      plans: state.settings.plans.map(function (p) {
        return { name: p.name, monthly: String(p.monthly), annual: String(p.annual), originalName: p.name };
      }),
      segments: state.settings.segments.slice()
    };
    $('#mobileNav').classList.add('hidden');
    $('#settingsGoal').value = String(state.settings.goal);
    settingsError('');
    renderSettingsPlans();
    renderSettingsSegments();
    $('#settings').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    $('#settingsGoal').focus();
  }
  function closeSettings() {
    $('#settings').classList.add('hidden');
    state.settingsDraft = null;
    var editorOpen = !$('#editor').classList.contains('hidden');
    if (editorOpen && state.form) {
      var currentClient = state.clients.filter(function (c) { return c.id === state.editing; })[0];
      if (!findPlan(state.form.plan) && (!currentClient || currentClient.plan !== state.form.plan)) {
        var first = state.settings.plans[0];
        state.form.plan = first.name;
        state.form.monthly = String(first.monthly);
        state.form.annual = String(first.annual);
      }
      fillEditor();
    }
    document.body.style.overflow = editorOpen ? 'hidden' : '';
    var target = state.settingsReturnFocus;
    if (target && typeof target.focus === 'function' && !target.closest('#mobileNav')) target.focus();
    else { var headerButton = $('#settingsHeaderBtn'); if (headerButton) headerButton.focus(); }
    state.settingsReturnFocus = null;
  }
  function saveSettings() {
    var goalText = $('#settingsGoal').value.trim();
    var goal = Number(goalText);
    if (!goalText || !Number.isFinite(goal) || goal <= 0 || goal > 1000000000) {
      settingsError('Enter an MRR goal greater than zero.'); return;
    }
    var seen = Object.create(null), plans = [];
    for (var i = 0; i < state.settingsDraft.plans.length; i++) {
      var p = state.settingsDraft.plans[i], name = p.name.trim(), key = name.toLowerCase();
      if (!name || name.length > 60 || key === 'all') {
        settingsError('Each subscription needs a valid name, different from "All".'); return;
      }
      if (seen[key]) { settingsError('Each subscription must have a unique name.'); return; }
      var monthly = Number(p.monthly), annual = Number(p.annual);
      if (String(p.monthly).trim() === '' || String(p.annual).trim() === '' ||
          !Number.isFinite(monthly) || monthly < 0 || monthly > 1000000000 ||
          !Number.isFinite(annual) || annual < 0 || annual > 1000000000) {
        settingsError('Enter valid monthly and annual prices greater than or equal to zero.'); return;
      }
      seen[key] = true;
      plans.push({ name: name, monthly: monthly, annual: annual });
    }
    var segmentSeen = Object.create(null), segments = [];
    for (var j = 0; j < state.settingsDraft.segments.length; j++) {
      var segmentName = String(state.settingsDraft.segments[j] || '').trim(), segmentKey = segmentName.toLowerCase();
      if (!segmentName || segmentName.length > 60 || segmentKey === 'all' || segmentKey === 'unspecified') {
        settingsError('Each segment needs a valid name, different from "All" and "Unspecified".'); return;
      }
      if (segmentSeen[segmentKey]) { settingsError('Each segment must have a unique name.'); return; }
      segmentSeen[segmentKey] = true;
      segments.push(segmentName);
    }
    if (!segments.length) { settingsError('Add at least one segment.'); return; }
    var next = validSettings({ goal: goal, plans: plans, segments: segments });
    if (!next) { settingsError('Add at least one valid subscription.'); return; }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (e) {
      settingsError('Settings could not be saved in this browser.'); return;
    }
    state.settings = next;
    if (state.filters.plan !== 'All' && !findPlan(state.filters.plan) && !state.clients.some(function (c) { return c.plan === state.filters.plan; })) state.filters.plan = 'All';
    if (state.filters.industry !== 'All' && !findSegment(state.filters.industry) && !state.clients.some(function (c) { return c.industry === state.filters.industry; })) state.filters.industry = 'All';
    closeSettings();
    render();
  }

  /* ----------------------------------------------------------- editor */
  function openEditor(id) {
    state.editing = id || null;
    state.deleteArmed = false;
    $('#saveError').classList.add('hidden');
    var c = id ? state.clients.filter(function (x) { return x.id === id; })[0] : null;
    var firstPlan = state.settings.plans[0];
    var def = c ? planDefaults(c.plan) : { m: firstPlan.monthly, a: firstPlan.annual };
    state.form = c ? {
      name: c.name, domain: c.domain, state: c.state, plan: c.plan, billing: c.billing, industry: c.industry || 'Unspecified',
      monthly: String(c.monthly), annual: String(c.annual), renewal: c.renewal || '', contactEmail: c.contactEmail,
      announcement: c.content.announcement, heroTitle: c.content.heroTitle, heroSubtitle: c.content.heroSubtitle,
      phone: c.content.phone, whatsapp: c.content.whatsapp, email: c.content.email, address: c.content.address,
      mapsUrl: c.content.mapsUrl, facebook: c.content.facebook, instagram: c.content.instagram,
      images: (c.content.images || []).join('\n')
    } : {
      name: '', domain: '', state: 'active', plan: firstPlan.name, billing: 'Monthly', industry: state.settings.segments[0],
      monthly: String(def.m), annual: String(def.a), renewal: '', contactEmail: '',
      announcement: '', heroTitle: '', heroSubtitle: '', phone: '', whatsapp: '', email: '',
      address: '', mapsUrl: '', facebook: '', instagram: '', images: ''
    };
    $('#editorTitle').textContent = c ? 'Edit ' + c.name : 'Add new client';
    $('#editorSub').textContent = !state.auth
      ? (c ? c.domain + ' · demo mode, changes stay in this tab.' : 'Demo mode — the new client stays in this tab.')
      : (c ? c.domain + ' · changes POST to your Worker.' : 'Creates the record via POST to your Worker.');
    $('#deleteBtn').classList.toggle('hidden', !c);
    $('#deleteBtn').classList.remove('inline-flex');
    $('#deleteBtn').innerHTML = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg> Delete';
    fillEditor();
    var liveCms = Boolean(state.auth && c);
    $('#edDomain').readOnly = liveCms;
    $('#liveCms').classList.toggle('hidden', !liveCms);
    $('#legacyCms').classList.toggle('hidden', liveCms);
    if (liveCms) $('#liveCmsLink').href = '/portal-admin/?editSite=' + encodeURIComponent(c.id);
    setTab('billing');
    $('#editor').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeEditor(force) {
    if (state.saving && !force) return;   // block backdrop-close mid-save, allow programmatic close
    $('#editor').classList.add('hidden');
    document.body.style.overflow = '';
  }
  function setTab(tab) {
    $('#tab-billing').classList.toggle('hidden', tab !== 'billing');
    $('#tab-cms').classList.toggle('hidden', tab !== 'cms');
    $('#saveBtn').classList.toggle('invisible', tab === 'cms' && state.auth && !!state.editing);
    $$('.editor-tab').forEach(function (b) {
      var on = b.dataset.tab === tab;
      b.className = 'editor-tab flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ' +
        (on ? 'bg-white text-[#6B1C2E] shadow-sm dark:bg-slate-700 dark:text-[#F6E6BC]' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200');
    });
  }
  function renderSegmentSelect() {
    var f = state.form;
    var choices = segmentChoices();
    if (f.industry && !choices.some(function (s) { return s.toLowerCase() === f.industry.toLowerCase(); })) choices.push(f.industry);
    $('#edSegment').innerHTML = choices.map(function (name) {
      return '<option value="' + esc(name) + '">' + esc(name) + '</option>';
    }).join('');
    $('#edSegment').value = f.industry;
    if ($('#edSegment').value !== f.industry) { f.industry = choices[0]; $('#edSegment').value = f.industry; }
  }
  function fillEditor() {
    var f = state.form;
    $('#edName').value = f.name;
    $('#edDomain').value = f.domain;
    renderSegmentSelect();
    $('#edSegmentNewWrap').classList.add('hidden');
    $('#edSegmentNewWrap').classList.remove('grid');
    $('#edSegmentError').classList.add('hidden');
    $('#edMonthly').value = f.monthly;
    $('#edAnnual').value = f.annual;
    $('#edRenewal').value = f.renewal;
    $('#edContactEmail').value = f.contactEmail;
    $('#edAnnouncement').value = f.announcement;
    $('#edHeroTitle').value = f.heroTitle;
    $('#edHeroSubtitle').value = f.heroSubtitle;
    $('#edPhone').value = f.phone;
    $('#edWhatsapp').value = f.whatsapp;
    $('#edEmail').value = f.email;
    $('#edAddress').value = f.address;
    $('#edMaps').value = f.mapsUrl;
    $('#edFacebook').value = f.facebook;
    $('#edInstagram').value = f.instagram;
    $('#edImages').value = f.images;

    var choices = state.settings.plans.slice();
    if (!findPlan(f.plan)) choices.unshift({ name: f.plan, monthly: Number(f.monthly) || 0, annual: Number(f.annual) || 0, legacy: true });
    $('#planOptions').innerHTML = choices.map(function (p) {
      var on = f.plan === p.name;
      return '<button type="button" data-plan-opt="' + esc(p.name) + '" aria-pressed="' + on + '" class="plan-opt rounded-xl border px-2 py-2.5 text-center transition-all ' +
        (on ? 'border-[#6366f1]/70 bg-[#6366f1]/10 ring-1 ring-[#6366f1]/40' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600') + '">' +
        '<span class="block break-words text-xs font-bold text-slate-800 dark:text-slate-100">' + esc(p.name) + '</span>' +
        '<span class="mt-0.5 block text-[11px] tabular-nums text-slate-500 dark:text-slate-400">' + (p.legacy ? 'Existing plan' : fmtMoney(p.monthly) + '/mo') + '</span></button>';
    }).join('');

    $$('.state-opt').forEach(function (b) {
      var on = f.state === b.dataset.state;
      b.className = 'state-opt rounded-xl border p-3 text-left transition-all ' + (on
        ? (b.dataset.state === 'active' ? 'border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-400/40 dark:border-emerald-500/50 dark:bg-emerald-500/10'
          : 'border-purple-400 bg-purple-50/60 ring-1 ring-purple-400/40 dark:border-purple-500/50 dark:bg-purple-500/10')
        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600');
    });
    $$('.bill-opt').forEach(function (b) {
      var on = f.billing === b.dataset.billing;
      b.className = 'bill-opt rounded-md px-4 py-1.5 text-xs font-medium transition-all ' +
        (on ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200');
    });
    updateMrrPreview();
    updateImages();
    localizeDOM();
  }
  function updateMrrPreview() {
    var f = state.form;
    var mrr = f.billing === 'Annual' ? (Number(f.annual) || 0) / 12 : (Number(f.monthly) || 0);
    $('#edMrr').textContent = fmtMoney(mrr) + '/mo';
  }
  function updateImages() {
    var list = (state.form.images || '').split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    $('#imgCount').textContent = list.length + ' image' + (list.length === 1 ? '' : 's');
    $('#imgPreview').innerHTML = list.slice(0, 4).map(function (src) {
      return '<div class="h-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"><img src="' + esc(src) + '" alt="" loading="lazy" class="h-full w-full object-cover" onerror="this.style.display=\'none\'" /></div>';
    }).join('');
    localizeDOM();
  }
  function readEditorForm() {
    var f = state.form;
    f.name = $('#edName').value;
    f.domain = $('#edDomain').value;
    f.industry = $('#edSegment').value || f.industry;
    f.monthly = $('#edMonthly').value;
    f.annual = $('#edAnnual').value;
    f.renewal = $('#edRenewal').value;
    f.contactEmail = $('#edContactEmail').value;
    f.announcement = $('#edAnnouncement').value;
    f.heroTitle = $('#edHeroTitle').value;
    f.heroSubtitle = $('#edHeroSubtitle').value;
    f.phone = $('#edPhone').value;
    f.whatsapp = $('#edWhatsapp').value;
    f.email = $('#edEmail').value;
    f.address = $('#edAddress').value;
    f.mapsUrl = $('#edMaps').value;
    f.facebook = $('#edFacebook').value;
    f.instagram = $('#edInstagram').value;
    f.images = $('#edImages').value;
    return f;
  }

  function buildSavePayload(f, id) {
    var domain = (f.domain || '').trim();
    var existing = id ? state.clients.filter(function (x) { return x.id === id; })[0] : null;
    return {
      action: id ? 'update' : 'create',
      id: id || undefined,
      slug: existing && existing.slug ? existing.slug : slugOf(domain),
      businessName: (f.name || '').trim(),
      domain: domain,
      state: f.state,
      tier: f.plan,
      industry: f.industry,
      billing: f.billing,
      monthlyPrice: Number(f.monthly) || 0,
      annualPrice: Number(f.annual) || 0,
      nextRenewal: f.renewal,
      contactEmail: (f.contactEmail || '').trim(),
      updatedAt: new Date().toISOString(),
      content: state.auth && id ? undefined : {
        heroTitle: f.heroTitle, heroSubtitle: f.heroSubtitle, announcement: f.announcement,
        phone: f.phone, whatsapp: f.whatsapp, email: f.email, address: f.address,
        mapsUrl: f.mapsUrl, facebook: f.facebook, instagram: f.instagram,
        images: (f.images || '').split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean)
      }
    };
  }

  function applyOptimistic(payload, id) {
    var rec = JSON.parse(JSON.stringify(payload));
    rec.id = id || ('live-' + Date.now());
    if (rec.state === 'suspended') { rec.suspendedAt = DAYS - 1; }
    var c = state.auth ? withLiveHistory(normalizeClient(rec, state.clients.length), rec) : withHistory(normalizeClient(rec, state.clients.length));
    if (id) {
      state.clients = state.clients.map(function (x) {
        if (x.id !== id) return x;
        return Object.assign({}, x, c, { id: id, visitors: x.visitors, visitorsSource: x.visitorsSource, downtime: x.downtime, createdAt: x.createdAt, openRequests: x.openRequests, liveVisitors: x.liveVisitors });
      });
    } else {
      state.clients = state.clients.concat([c]);
    }
  }

  async function saveClient() {
    if (state.saving) return;
    var f = readEditorForm();
    if (!f.name.trim() || !f.domain.trim()) {
      showSaveError('Client name and domain are required.');
      return;
    }
    state.saving = true;
    $('#saveBtn').disabled = true;
    $('#saveBtn').innerHTML = '<svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg> Saving…';
    localizeDOM();
    var payload = buildSavePayload(f, state.editing);
    try {
      if (state.auth) await postClient(payload);
      else applyOptimistic(payload, state.editing);
      addLog((state.editing ? 'Updated client ' : 'Created client ') + payload.businessName + (state.auth ? '' : ' (demo)'));
      closeEditor(true);
      if (state.auth) await refresh(true); else render();
    } catch (e) {
      showSaveError(e.message);
    } finally {
      state.saving = false;
      $('#saveBtn').disabled = false;
      $('#saveBtn').innerHTML = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Save Changes';
      localizeDOM();
    }
  }

  async function deleteClient() {
    if (!state.editing || !state.auth || state.saving) return;
    if (!state.deleteArmed) {
      state.deleteArmed = true;
      showSaveError('Deleting also removes this site’s portal access, media and analytics records held in the dashboard.');
      $('#deleteBtn').innerHTML = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Confirm delete';
      localizeDOM();
      return;
    }
    var c = state.clients.filter(function (x) { return x.id === state.editing; })[0];
    state.saving = true;
    $('#deleteBtn').disabled = true;
    try {
      if (state.auth) await postClient({ action: 'delete', id: state.editing, domain: c ? c.domain : state.form.domain });
      state.clients = state.clients.filter(function (x) { return x.id !== state.editing; });
      addLog('Deleted client ' + (c ? c.name : '') + (state.auth ? '' : ' (demo)'));
      closeEditor(true);
      if (state.auth) await refresh(true); else render();
    } catch (e) {
      showSaveError(e.message);
    } finally {
      state.saving = false;
      $('#deleteBtn').disabled = false;
      state.deleteArmed = false;
      $('#deleteBtn').innerHTML = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg> Delete';
      localizeDOM();
    }
  }
  function showSaveError(msg) {
    var el = $('#saveError');
    el.classList.remove('hidden');
    el.classList.add('flex');
    el.textContent = msg;
    localizeDOM();
  }

  /* -------------------------------------------------------- auth flow */
  function showLoginError(msg) {
    var el = $('#loginError');
    if (!msg) { el.classList.add('hidden'); el.classList.remove('flex'); return; }
    el.classList.remove('hidden'); el.classList.add('flex');
    $('#loginErrorMsg').textContent = msg;
    localizeDOM();
  }
  function enterApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    var who = state.auth ? state.auth.username : 'Alex';
    $('#greetBadge').textContent = greeting + ', ' + who;
    $('#headerSub').textContent = new Date().toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) + ' · WaaS portfolio, hosting subscriptions & live CMS';
    $('#refreshBtn').style.display = state.auth ? '' : 'none';
    renderConnBadge();
    render();
  }
  function renderConnBadge() {
    var el = $('#connBadge');
    var on = state.live;
    el.className = 'hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex ' + (on
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300');
    var icon = on
      ? '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 15.8a5.5 5.5 0 0 1 7 0"/><path d="M12 19h.01"/></svg>'
      : '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22M16.7 16.7A9 9 0 1 1 7.3 7.3"/></svg>';
    var label = state.demo ? 'Demo data' : state.live ? 'Live API' : 'Offline';
    el.innerHTML = icon + label + (state.auth && state.live ? '<span class="max-w-36 truncate font-normal opacity-70">' + esc(location.host) + '</span>' : '');
  }

  async function enterStaff(identity) {
    if (!identity.user || identity.user.role !== 'super_admin') throw new Error('Staff access required.');
    if (identity.must_change_password) { location.assign('/portal-admin/'); return; }
    state.auth = { username: identity.user.username };
    state.demo = false;
    // Keep the authenticated shell available if portfolio data is temporarily unavailable.
    await refresh(false);
    if (state.auth) enterApp();
  }
  async function doLogin(username, password) {
    showLoginError('');
    var btn = $('#loginBtn');
    if (btn.disabled) return;
    var original = btn.innerHTML;
    btn.disabled = $('#demoBtn').disabled = true;
    btn.textContent = 'Connecting to Worker…';
    $('#password').value = '';
    localizeDOM();
    try {
      var identity = await apiRequest('/api/auth/login', { username: username, password: password });
      await enterStaff(identity);
    } catch (e) {
      showLoginError(e.message);
    } finally {
      btn.disabled = $('#demoBtn').disabled = false;
      btn.innerHTML = original;
      localizeDOM();
    }
  }
  async function restoreSession() {
    $('#loginBtn').disabled = $('#demoBtn').disabled = true;
    try {
      await enterStaff(await apiRequest('/api/auth/me'));
    } catch (e) { /* No staff session: show the normal login and demo actions. */ }
    finally { $('#loginBtn').disabled = $('#demoBtn').disabled = false; }
  }
  function enterDemo() {
    refreshGeneration++;
    state.auth = null;
    state.demo = true;
    state.live = false;
    state.liveVisitors = null;
    state.liveVisitorsAt = null;
    state.livePollBusy = false;
    state.apiError = null;
    state.clients = buildDemo();
    addLog('Opened the dashboard with demo data');
    enterApp();
  }
  async function logout() {
    if (state.saving) return;
    if (state.auth) {
      try { await apiRequest('/api/auth/logout', {}); }
      catch (e) { state.apiError = e.message; render(); return; }
    }
    clearSession();
  }
  function clearSession() {
    closeEditor(true);
    closeSettings();
    $('#refreshIcon').classList.remove('animate-spin');
    refreshGeneration++;
    state.auth = null; state.demo = false; state.live = false; state.apiError = null;
    state.liveVisitors = null; state.liveVisitorsAt = null;
    state.livePollBusy = false;
    state.clients = []; state.logs = []; state.lastSync = null;
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    showLoginError('');
    $('#password').value = '';
  }

  /* -------------------------------------------------------- CSV export */
  function exportCsv() {
    if (!state.dash) return;
    var rows = filteredRows(state.dash);
    var header = ['Client', 'Domain', 'Segment', 'Plan', 'Billing', 'Price', 'MRR', 'Status', 'Uptime %', 'Visitors', 'Next renewal'];
    var lines = rows.map(function (r) {
      return [r.c.name, r.c.domain, r.c.industry, r.c.plan, r.c.billing, r.price, r.c.mrr, r.status, r.uptime === null ? '' : r.uptime.toFixed(3), r.visitors === null ? '' : r.visitors, r.c.renewal]
        .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
    });
    var blob = new Blob([[header.join(',')].concat(lines).join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vllora-studio-clients.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ------------------------------------------------------------- wiring */
  function wire() {
    // filter controls
    $('#rangeGroup').innerHTML = RANGES.map(function (r) {
      return '<button data-range="' + r.key + '" class="px-3 py-1.5 text-xs font-medium">' + r.label + '</button>';
    }).join('');
    $('#revMetric').innerHTML = '<button data-metric="mrr" class="px-3 py-1.5 text-xs font-medium">MRR</button><button data-metric="clients" class="px-3 py-1.5 text-xs font-medium">Clients</button>';
    $('#perfMetric').innerHTML = '<button data-metric="visitors" class="px-3 py-1.5 text-xs font-medium">Traffic</button><button data-metric="uptime" class="px-3 py-1.5 text-xs font-medium">Uptime</button>';

    $('#rangeGroup').addEventListener('click', function (e) {
      var b = e.target.closest('[data-range]'); if (b) setFilter('range', b.dataset.range);
    });
    function toggleCustomRange(open) {
      var panel = $('#customRangePanel');
      panel.classList.toggle('hidden', !open);
      $('#customRangeBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        var today = isoDay(new Date());
        var fallbackStart = new Date(); fallbackStart.setDate(fallbackStart.getDate() - 29);
        $('#customStart').value = state.filters.customStart || isoDay(fallbackStart);
        $('#customEnd').value = state.filters.customEnd || today;
        $('#customStart').max = today; $('#customEnd').max = today;
        $('#customRangeError').classList.add('hidden');
        $('#customStart').focus();
      }
    }
    $('#customRangeBtn').addEventListener('click', function () { toggleCustomRange($('#customRangePanel').classList.contains('hidden')); });
    $('#customRangeCancel').addEventListener('click', function () { toggleCustomRange(false); });
    $('#customRangeApply').addEventListener('click', function () {
      var startIso = $('#customStart').value, endIso = $('#customEnd').value, error = $('#customRangeError');
      var start = startIso ? dayIndexOfISO(startIso) : null, end = endIso ? dayIndexOfISO(endIso) : null;
      var message = '';
      if (start === null || end === null) message = 'Choose both a start and an end date.';
      else if (start > end) message = 'The start date must be before the end date.';
      else if (end > DAYS - 1) message = 'The end date cannot be in the future.';
      else if (start < 0) message = 'Only the last 2 years of history are available.';
      if (message) { error.textContent = message; error.classList.remove('hidden'); localizeDOM(); return; }
      state.filters.range = 'custom';
      state.filters.customStart = startIso;
      state.filters.customEnd = endIso;
      state.page = 0;
      toggleCustomRange(false);
      render();
    });
    document.addEventListener('click', function (e) {
      if (!$('#customRangePanel').classList.contains('hidden') && !e.target.closest('#customRangePanel') && !e.target.closest('#customRangeBtn')) toggleCustomRange(false);
    });
    $('#revMetric').addEventListener('click', function (e) {
      var b = e.target.closest('[data-metric]'); if (b) { state.revMetric = b.dataset.metric; render(); }
    });
    $('#perfMetric').addEventListener('click', function (e) {
      var b = e.target.closest('[data-metric]'); if (b) { state.perfMetric = b.dataset.metric; render(); }
    });
    $('#fIndustry').addEventListener('change', function () { setFilter('industry', this.value); });
    $('#fPlan').addEventListener('change', function () { setFilter('plan', this.value); });
    $('#fBilling').addEventListener('change', function () { setFilter('billing', this.value); });
    $('#resetFilters').addEventListener('click', function () {
      state.filters = { range: '90d', industry: 'All', plan: 'All', billing: 'All', customStart: null, customEnd: null };
      state.status = 'All'; state.page = 0; render();
    });

    // plan legend + status jumps (delegated)
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-settings]')) { openSettings(); return; }
      if (e.target.closest('[data-close-settings]')) { closeSettings(); return; }
      var planBtn = e.target.closest('.plan-pick');
      if (planBtn) { var p = planBtn.dataset.plan; setFilter('plan', state.filters.plan === p ? 'All' : p); return; }
      var stBtn = e.target.closest('.status-jump');
      if (stBtn) { state.status = stBtn.dataset.status; state.page = 0; render(); $('#sec-clients').scrollIntoView({ behavior: 'smooth' }); return; }
      var chip = e.target.closest('[data-chip]');
      if (chip) { state.status = chip.dataset.chip; state.page = 0; render(); return; }
      var sortBtn = e.target.closest('[data-sort]');
      if (sortBtn) {
        var key = sortBtn.dataset.sort;
        state.sort = state.sort.key === key ? { key: key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' } : { key: key, dir: key === 'client' || key === 'industry' ? 'asc' : 'desc' };
        state.page = 0; render(); return;
      }
      var editBtn = e.target.closest('[data-edit]');
      if (editBtn) { e.stopPropagation(); openEditor(editBtn.dataset.edit); return; }
      var row = e.target.closest('[data-open]');
      if (row) { openEditor(row.dataset.open); return; }
      if (e.target.closest('#jumpSuspended')) { state.status = 'Suspended'; state.page = 0; render(); $('#sec-clients').scrollIntoView({ behavior: 'smooth' }); return; }
      if (e.target.closest('#retryBtn') && state.auth) { refresh(false); return; }
      if (e.target.closest('#exportCsv')) { exportCsv(); return; }
      if (e.target.closest('#addClient')) { openEditor(null); return; }
      if (e.target.closest('[data-close-editor]')) { closeEditor(); return; }
      if (e.target.closest('[data-close-nav]')) { $('#mobileNav').classList.add('hidden'); return; }
      if (e.target.closest('#navOpen')) { $('#mobileNav').classList.remove('hidden'); return; }
      if (e.target.closest('#refreshBtn') && state.auth) { refresh(false); return; }
      if (e.target.closest('#logoutBtn')) { logout(); return; }
      if (e.target.closest('[data-language-toggle]')) { setLanguage(state.lang === 'en' ? 'ro' : 'en'); return; }
      if (e.target.closest('#themeToggle')) { applyTheme(!isDark()); return; }
      if (e.target.closest('#themeToggleLogin')) { applyTheme(!isDark()); return; }
    });

    // editor tabs + options (delegated inside editor)
    $('#editor').addEventListener('click', function (e) {
      var tab = e.target.closest('.editor-tab');
      if (tab) { setTab(tab.dataset.tab); return; }
      var plan = e.target.closest('[data-plan-opt]');
      if (plan) {
        readEditorForm();
        var chosen = findPlan(plan.dataset.planOpt);
        if (chosen && state.form.plan !== chosen.name) {
          state.form.plan = chosen.name;
          state.form.monthly = String(chosen.monthly);
          state.form.annual = String(chosen.annual);
        }
        fillEditor(); return;
      }
      var st = e.target.closest('[data-state]');
      if (st) { readEditorForm(); state.form.state = st.dataset.state; fillEditor(); return; }
      var bill = e.target.closest('[data-billing]');
      if (bill) { readEditorForm(); state.form.billing = bill.dataset.billing; fillEditor(); return; }
      if (e.target.closest('#saveBtn')) { saveClient(); return; }
      if (e.target.closest('#deleteBtn')) { deleteClient(); return; }
    });
    $('#edSegment').addEventListener('change', function () { state.form.industry = this.value; });
    $('#edSegmentNewBtn').addEventListener('click', function () {
      var wrap = $('#edSegmentNewWrap');
      var open = wrap.classList.contains('hidden');
      wrap.classList.toggle('hidden', !open);
      wrap.classList.toggle('grid', open);
      $('#edSegmentError').classList.add('hidden');
      if (open) $('#edSegmentNew').focus();
    });
    function addSegmentFromEditor() {
      var name = $('#edSegmentNew').value.trim(), key = name.toLowerCase();
      var error = $('#edSegmentError');
      if (!name || name.length > 60 || key === 'all' || key === 'unspecified') {
        error.textContent = 'Enter a segment name (up to 60 characters), different from "All" and "Unspecified".';
        error.classList.remove('hidden'); localizeDOM(); return;
      }
      var existing = findSegment(name);
      if (!existing) {
        var next = validSettings({ goal: state.settings.goal, plans: state.settings.plans, segments: state.settings.segments.concat([name]) });
        if (!next) { error.textContent = 'Segment could not be added.'; error.classList.remove('hidden'); localizeDOM(); return; }
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (err) { /* keep in memory */ }
        state.settings = next;
      }
      readEditorForm();
      state.form.industry = existing || name;
      $('#edSegmentNew').value = '';
      fillEditor();
      syncFilterUI();
    }
    $('#edSegmentNewSave').addEventListener('click', addSegmentFromEditor);
    $('#edSegmentNew').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSegmentFromEditor(); } });
    $('#edMonthly').addEventListener('input', function () { state.form.monthly = this.value; updateMrrPreview(); });
    $('#edAnnual').addEventListener('input', function () { state.form.annual = this.value; updateMrrPreview(); });
    $('#edImages').addEventListener('input', function () { state.form.images = this.value; updateImages(); });
    $('#settingsPlans').addEventListener('input', function (e) {
      var field = e.target.dataset.planField, index = Number(e.target.dataset.planIndex);
      if (!field || !state.settingsDraft || !state.settingsDraft.plans[index]) return;
      state.settingsDraft.plans[index][field] = e.target.value;
      settingsError('');
    });
    $('#settingsPlans').addEventListener('click', function (e) {
      var button = e.target.closest('[data-remove-plan]');
      if (!button || !state.settingsDraft) return;
      var index = Number(button.dataset.removePlan), plans = state.settingsDraft.plans, plan = plans[index];
      if (!plan || plans.length <= 1) { settingsError('At least one subscription is required.'); return; }
      plans.splice(index, 1);
      settingsError('');
      renderSettingsPlans();
    });
    $('#settingsGoal').addEventListener('input', function () { settingsError(''); });
    $('#settingsSegments').addEventListener('input', function (e) {
      var index = Number(e.target.dataset.segmentIndex);
      if (!state.settingsDraft || isNaN(index) || !e.target.matches('[data-segment-index]')) return;
      state.settingsDraft.segments[index] = e.target.value;
      settingsError('');
    });
    $('#settingsSegments').addEventListener('click', function (e) {
      var button = e.target.closest('[data-remove-segment]');
      if (!button || !state.settingsDraft) return;
      var index = Number(button.dataset.removeSegment), segments = state.settingsDraft.segments;
      if (segments.length <= 1) { settingsError('At least one segment is required.'); return; }
      segments.splice(index, 1);
      settingsError('');
      renderSettingsSegments();
    });
    $('#addSegmentSetting').addEventListener('click', function () {
      if (!state.settingsDraft || state.settingsDraft.segments.length >= 100) { settingsError('You can configure up to 100 segments.'); return; }
      state.settingsDraft.segments.push('');
      settingsError('');
      renderSettingsSegments();
      var field = $('#settings-segment-' + (state.settingsDraft.segments.length - 1));
      if (field) field.focus();
    });
    $('#addPlanSetting').addEventListener('click', function () {
      if (!state.settingsDraft || state.settingsDraft.plans.length >= 50) { settingsError('You can configure up to 50 subscriptions.'); return; }
      state.settingsDraft.plans.push({ name: '', monthly: '0', annual: '0', originalName: null });
      settingsError('');
      renderSettingsPlans();
      var field = $('#settings-plan-' + (state.settingsDraft.plans.length - 1) + '-name');
      if (field) field.focus();
    });
    $('#settingsForm').addEventListener('submit', function (e) { e.preventDefault(); saveSettings(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#settings').classList.contains('hidden')) closeSettings();
        else if (!$('#editor').classList.contains('hidden')) closeEditor();
        $('#mobileNav').classList.add('hidden');
      }
    });

    // table controls
    var searchTimer;
    $('#tableSearch').addEventListener('input', function () {
      var v = this.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { state.query = v; state.page = 0; render(); }, 160);
    });
    $('#prevPage').addEventListener('click', function () { if (state.page > 0) { state.page--; render(); } });
    $('#nextPage').addEventListener('click', function () { state.page++; render(); });

    // nav links
    $$('.nav-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.querySelector(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#mobileNav').classList.add('hidden');
      });
    });

    // login
    $('#loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var u = $('#username').value.trim(), p = $('#password').value;
      if (!u || !p) { showLoginError('Enter both username and password.'); return; }
      doLogin(u, p);
    });
    $('#demoBtn').addEventListener('click', enterDemo);
    $('#pwToggle').addEventListener('click', function () {
      var f = $('#password');
      f.type = f.type === 'password' ? 'text' : 'password';
    });

    // Poll the authenticated client endpoint; never synthesize a live count.
    setInterval(pollLiveVisitors, LIVE_POLL_MS);
    document.addEventListener('visibilitychange', pollLiveVisitors);
  }

  /* --------------------------------------------------------------- init */
  function init() {
    initTheme();
    wire();
    syncFilterUI();
    localizeDOM();
    if (location.hash.startsWith('#reset=')) location.replace('/portal-admin/' + location.hash);
    else restoreSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
