# SKILL2BUDGET Toolkit

**De la ce știi să faci la ce faci cu primii bani.** Discover → Create → Earn → Manage.

Prototipul digital al proiectului SKILL2BUDGET pentru concursul Banometru, realizat de echipa Cryptochicks. Un site static (HTML, CSS, JavaScript), fără server și fără bază de date: totul rulează în browser.

## Ce conține

| Secțiune | Ce face |
|---|---|
| **Modulul 1 – Skill Value Calculator** | Abilitate, serviciu, timp, costuri directe și preț → venit, costuri, diferența după costuri, valoare pe oră, marjă. |
| **Modulul 2 – First Income Planner** | Împarte venitul virtual (implicit 400 de lei) între Nevoi, Dorințe, Economii și Dezvoltare, apoi trage cele 4 cărți de eveniment (Tentația, Neprevăzut, Obiectivul tău, Investește în tine). Istoric al deciziilor cu argumente și comparație între varianta A și varianta B. |
| **Provocarea de 30 de zile** | Skill2Budget Passport: 4 săptămâni deblocate pe rând, câte un nivel pe săptămână, certificat digital printabil la final. |
| **Fișe de lucru** | My Skill Passport și Price Your Skill, completabile pe ecran sau printabile, plus informațiile legale pentru minori. |
| **Cod QR** | Generează și descarcă un cod QR către site, pentru afișe și stații. |

Progresul se salvează în `localStorage`, adică doar în browserul și pe dispozitivul elevului.

## Rulare locală

```powershell
python -m http.server 8000
```

Apoi deschide <http://localhost:8000>. Funcționează și deschizând direct `index.html`; codul QR are nevoie de internet pentru biblioteca `qrcodejs`.

## Publicare

Pentru că e un site static, poate fi publicat pe GitHub Pages (Settings → Pages → branch `main`, folder `/`), Netlify sau pe orice hosting. După publicare, pune linkul final în secțiunea „Cod QR” ca să generezi codul pentru afișe.

## Paleta de culori

| Rol | NCS | Hex (aproximativ) |
|---|---|---|
| Verde principal | S 6020-G10Y | `#3D6249` |
| Accent verde deschis | S 4010-G10Y | `#7E9C86` |
| Neutru deschis | S 3005-G80Y | `#C3C5B0` |
| Fundal închis | — | `#1E211E` |

Valorile hex sunt aproximări pe ecran ale codurilor NCS.
