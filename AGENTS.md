# AGENTS.md — reguli pentru agenții care lucrează în acest repository

## Suricode (revizuire de securitate)

Repository-ul este conectat la Suricode, un server MCP care rulează o revizuire de securitate după fiecare push.

- Server MCP: `https://mcp.suricode.ai/mcp` (transport HTTP).
- Autentificarea se face cu tokenul din configurația MCP **la nivel de utilizator**, în directorul home. Tokenul **nu** se scrie niciodată în acest repository, în `AGENTS.md`, în `.mcp.json`, `.cursor/mcp.json`, `opencode.json` sau în orice alt fișier versionat.
- Serverul se adaugă o singură dată, în configurația agentului din home, cu numele `shuricode`.
- Instrumentele Suricode apar abia într-o sesiune nouă. Nu încerca să testezi serverul altfel (fără `curl`, fără apeluri directe).

### Rutina obligatorie după fiecare push

1. Află o singură dată id-ul repository-ului cu `list_repositories` și ține-l minte pe toată sesiunea. Dacă repository-ul nu apare în listă, adaugă-l cu `add_repository`, folosind URL-ul de clone al acestui repository.
2. După fiecare push către remote, apelează `start_scan` cu acel id de repository.
3. Jobul returnat conține `expectedFinishAt`. Nu interoga într-o buclă strânsă: așteaptă până la acel moment, apoi apelează `get_scan_status`.
4. Dacă scanarea este încă `queued` sau `running`, citește noul `expectedFinishAt` și așteaptă din nou. Dacă a eșuat, spune utilizatorului ce scrie în `lastError` și oprește-te.
5. Când scanarea s-a încheiat cu succes, apelează `get_scan_fixes`. Dacă răspunde că triajul nu este gata, așteaptă un minut și întreabă din nou.
6. Înregistrează fiecare fix returnat. Dacă există un issue tracker conectat, deschide câte un issue pentru fiecare fix, cu calea fișierului, verdictul și motivul. Dacă nu, adaugă-le în `shuricode-findings.md` în rădăcina repository-ului.
7. Remediază fiecare fix. Începe în plan mode și numește toate fixurile înainte să modifici cod, începând cu cele cu verdictul `rotate`: un credential scurs rămâne periculos până este înlocuit. Ieși din plan mode doar când planul le include pe toate, apoi implementează planul. Nu sări niciun fix pentru că lista este lungă.
8. Fă push la remedieri și pornește următoarea scanare. Un fix este confirmat doar când o scanare ulterioară nu îl mai raportează.

Un finding nu se tratează din proprie inițiativă ca fals pozitiv: Suricode l-a triat deja.

### Note pentru acest repository

- Nu se face merge, deploy sau modificarea resurselor de producție fără cerere explicită. Scopul Suricode este revizuirea, nu publicarea.
- Remedierea unui secret scurs înseamnă rotația lui în Cloudflare/Resend/GitHub, nu doar ștergerea din cod: valoarea rămâne în istoricul Git.
- Valorile sensibile trăiesc în secrete Wrangler (`npx wrangler secret put NUME`) și în `.dev.vars` local, care nu se comite.
