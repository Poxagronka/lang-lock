# Lang Lock — which mechanisms make sites show English

Date: 2026-10-09. Target language: English. Sample: 50 home pages (20 Polish, 15 global, 15 from DE/FR/ES/IT/NL/CZ/UA/JP/BR).

## Setup and caveats

- **Egress country: GR** (`curl ipinfo.io/country`, OTE, Rhodes). The machine is not in Poland. Geo-IP results below show what a user abroad sees. A user in Poland gets PL geo, so geo-IP cases there would show Polish instead of Greek.
- Browser: Playwright Chromium 156, new headless (`channel: 'chromium'`), normal Chrome UA, fresh context per variant, timezone of the host.
- Accept-Language is rewritten on every request with `context.route` (the same effect as a `declarativeNetRequest` `modifyHeaders` rule). Playwright `extraHTTPHeaders` can NOT override the locale-derived Accept-Language: verified against httpbin, so it was not used.
- navigator override: init script at document start redefines `Navigator.prototype.language/languages`. `Intl` stays `pl-PL` in C.
- Language of the page = heuristic on `body.innerText` (stopwords + distinctive letters + script ranges). It is a majority vote, so a mixed page (English UI, Polish content) can go either way.
- Home pages only. Two full runs. Tables show run 2 (`results.json`). Run 1 is in `results-run1.json`. Flaky between runs: booking.com (A was `pl` in run 1, `en` in run 2 behind a 202 bot challenge), sncf-connect.com (D got 403 in run 1), pw.edu.pl and bol.com (timeouts).

Variants:

| | Accept-Language | navigator | then |
|---|---|---|---|
| A | `pl-PL,pl;q=0.9` | pl-PL | — |
| B | `en` | pl-PL | — |
| C | `pl-PL,pl;q=0.9` | `en` (override) | — |
| D | `en-US,en;q=0.9` | en-US (locale en-US) | — |
| E | as D | as D | follow `<link rel=alternate hreflang=en*>` if `<html lang>` is not en |
| F | as D | as D | rewrite a locale token in the URL (path seg 1-2, subdomain, `lang/hl/locale` query) if E is not en |
| G | as D | as D | extra mechanism found during the run: follow an in-page link with text EN/English (same site) if F is not en |

Cells: detected text language. `↪hreflang`, `↪path`, `↪link` = that step navigated. `BLK` = bot block (403/429/503, captcha URL, block text). `ERR` = timeout.

## Site × variant

| # | group | site | html lang A | A | B | C | D | E | F | G | en hreflang | switcher |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | pl | allegro.pl | pl | BLK(403) | BLK(403) | BLK(403) | BLK(403) | BLK(403) | BLK(403) | BLK(403) | 0 | no |
| 2 | pl | olx.pl | pl | pl | pl | pl | pl | pl | pl | pl | 0 | no |
| 3 | pl | onet.pl | pl | pl | pl | pl | pl | pl | pl | pl | 0 | no |
| 4 | pl | wp.pl | pl | pl | pl | pl | pl | pl | pl | pl | 0 | no |
| 5 | pl | gov.pl | pl-PL | pl | pl | pl | pl | pl | pl | pl | 0 | no |
| 6 | pl | zus.pl | pl-PL | pl | pl | pl | pl | pl ↪hreflang | pl | en ↪link | 1 | yes |
| 7 | pl | mbank.pl | pl-PL | pl | pl | pl | pl | pl | pl | pl | 0 | yes |
| 8 | pl | pkobp.pl | pl | pl | pl | pl | pl | pl | pl | pl | 0 | no |
| 9 | pl | ing.pl | pl | pl | pl | pl | pl | pl | pl | pl ↪link | 0 | no |
| 10 | pl | santander.pl | pl | pl | pl | pl | pl | pl | pl | pl | 0 | no |
| 11 | pl | intercity.pl | pl | pl | pl | pl | pl | pl | en ↪path | en | 0 | yes |
| 12 | pl | lot.com | pl | pl | en | pl | en | en | en | en | 58 | no |
| 13 | pl | inpost.pl | pl | pl | pl | en | en | en ↪hreflang | en | en | 1 | yes |
| 14 | pl | ceneo.pl |  | BLK(200) | BLK(200) | BLK(200) | BLK(200) | BLK(200) | BLK(200) | BLK(200) | 0 | no |
| 15 | pl | empik.com | pl | pl | pl | pl | pl | pl | pl | pl ↪link | 0 | yes |
| 16 | pl | otodom.pl | pl | pl | pl | pl | pl | HTTP404 | HTTP404 | HTTP404 | 1 | no |
| 17 | pl | pyszne.pl | pl | pl | en | pl | en | en | en | en | 1 | no |
| 18 | pl | mediaexpert.pl | pl | pl | pl | pl | pl | pl | pl | pl ↪link | 0 | yes |
| 19 | pl | uw.edu.pl | pl-PL | pl | pl | pl | pl | pl | pl | en ↪link | 0 | yes |
| 20 | pl | pw.edu.pl | pl | pl | ERR | pl | ERR | ERR | ERR | ERR | 0 | yes |
| 21 | global | google.com | pl-GR | pl | el | pl | el | el | el | en ↪link | 0 | yes |
| 22 | global | youtube.com | pl-PL | pl | en | pl | en | en | en | en | 0 | yes |
| 23 | global | wikipedia.org | pl | pl | pl | en | en | en | en | en | 0 | yes |
| 24 | global | microsoft.com | el-GR | el | el | el | el | el | en ↪path | en | 0 | no |
| 25 | global | learn.microsoft.com | pl-pl | pl | en | pl | en | en | en | en | 0 | yes |
| 26 | global | apple.com | en-US | en | en | en | en | en | en | en | 61 | no |
| 27 | global | ikea.com | en | en | en | en | en | en | en | en | 47 | yes |
| 28 | global | booking.com |  | en | en | en | en | en | en | en | 0 | no |
| 29 | global | airbnb.com | pl | pl | en | pl | en | en | en | en | 12 | yes |
| 30 | global | open.spotify.com | pl | pl | en | pl | en | en | en | en | 0 | yes |
| 31 | global | netflix.com | en | en | en | en | en | en | en | en | 0 | yes |
| 32 | global | aliexpress.com | en | en | en | en | en | en | en | en | 3 | yes |
| 33 | global | paypal.com | el-GR | el | el | el | el | el | el | el | 0 | no |
| 34 | global | docs.github.com | en | en | en | en | en | en | en | en | 0 | yes |
| 35 | global | developer.mozilla.org | en-US | en | en | en | en | en | en | en | 0 | no |
| 36 | de | amazon.de | pl-pl | pl | en | pl | en | en | en | en | 0 | yes |
| 37 | de | zalando.de | de-DE | de | en | de | en | en | en | en | 3 | yes |
| 38 | de | bahn.de | de | de | de | de | de | en ↪hreflang | en | en | 1 | yes |
| 39 | fr | lemonde.fr | fr | fr | fr | fr | fr | en ↪hreflang | en | en | 4 | yes |
| 40 | fr | sncf-connect.com | fr-fr | fr | fr | fr | fr | en ↪hreflang | en | en | 2 | no |
| 41 | es | renfe.com | es | es | es | es | es | en ↪hreflang | en | en | 1 | yes |
| 42 | es | elpais.com | es-ES | es | es | es | es | es | es | es | 0 | no |
| 43 | it | trenitalia.com | it | it | it | it | it | it | it | en ↪link | 0 | yes |
| 44 | it | corriere.it | it-IT | it | it | it | it | it | it | it | 0 | no |
| 45 | nl | bol.com |  | ERR | ERR | BLK(200) | ERR | ERR | ERR | ERR | 0 | no |
| 46 | nl | ns.nl | nl | nl | nl | nl | nl | en ↪hreflang | en | en | 1 | yes |
| 47 | cz | alza.cz | pl-pl | BLK(403) | BLK(403) | BLK(403) | BLK(403) | BLK(403) | BLK(403) | BLK(403) | 0 | no |
| 48 | ua | rozetka.com.ua | uk | uk | uk | uk | uk | uk | uk | uk | 0 | no |
| 49 | jp | rakuten.co.jp | ja | ja | ja | ja | ja | ja | ja | ja | 0 | no |
| 50 | br | mercadolivre.com.br | pt-BR | pt | pt | pt | pt | pt | pt | pt | 0 | no |

## Coverage (run 2)

Denominator = sites that loaded in A or D (not blocked, no error): 46 of 50.

| mechanism | all sites reach en | Polish sites reach en (18 loaded) |
|---|---|---|
| A baseline pl | 7 (15%) | 0 |
| B header only | 15 (33%) | 2 (lot.com, pyszne.pl) |
| C navigator only | 9 (20%) | 1 (inpost.pl) |
| D header + navigator | 17 (37%) | 3 |
| E = D + hreflang | 22 (48%) | 3 |
| F = E + URL rewrite | 24 (52%) | 4 (+intercity.pl) |
| G = F + switcher link | 28 (61%) | 6 (+zus.pl, uw.edu.pl) |

Gains per step:

- B over A (+8): lot.com, pyszne.pl, youtube, learn.microsoft, airbnb, spotify, amazon.de, zalando.de.
- C over A (+2): inpost.pl (client-side i18n), wikipedia.org portal.
- D over B: exactly the C gains (inpost.pl, wikipedia.org). D = B ∪ C. The `Intl`/locale change adds nothing on this sample.
- E over D (+5): bahn.de → int.bahn.de/en, lemonde.fr/en/, sncf-connect.com, renfe.com/es/en, ns.nl/en. Zero Polish sites.
- F over E (+2): intercity.pl, microsoft.com (`/el-gr/` → `/en-us/`).
- G over F (+4): zus.pl → lang.zus.pl, uw.edu.pl → en.uw.edu.pl, google.com → `setprefs?hl=en`, trenitalia.com `/it.html` → `/en.html`.

## Polish sites (20)

| outcome | count | sites |
|---|---|---|
| English via header (B) | 2 | lot.com, pyszne.pl (redirects to `/en`) |
| English via navigator (C) | 1 | inpost.pl |
| English via URL rewrite (F) | 1 | intercity.pl |
| English via switcher link (G) | 2 | zus.pl, uw.edu.pl |
| English version exists, but nothing on the page leads to it in a machine-readable way | 4 | mbank.pl (`/en/`), pkobp.pl (`/en`), ing.pl (`en.ing.pl`), santander.pl→erste.pl (`/en`). Verified with `probe.mjs`. These are thin corporate/expat sections, not translations of the home page. |
| wrong hreflang | 1 | otodom.pl: `hreflang=en` → 404 |
| no English version | 6 | olx.pl, onet.pl, wp.pl, gov.pl (portal home; `/web/gov/en` redirects back), empik.com (`/en` 404), mediaexpert.pl (`/en` → 403 bot page) |
| bot block | 2 | allegro.pl (403 every variant), ceneo.pl (captcha redirect) |
| timeout | 1 | pw.edu.pl (run 1: `pl` in all variants; `eng.pw.edu.pl` exists) |

The Polish web is the hard case. Header + navigator give English on 3 of 18. Polish sites almost never publish hreflang to English (2 of 18, and 1 of them is broken).

## Sites that stay non-English, with reason

| site | reason |
|---|---|
| allegro.pl, alza.cz | bot block (403 in every variant; alza = Cloudflare "Just a moment") |
| ceneo.pl | bot block (captcha redirect) |
| bol.com | bot block / IP block ("IP address is blocked" in run 1, timeouts in run 2) |
| pw.edu.pl | timeout in run 2 (no English via A-F in run 1) |
| paypal.com | **geo-IP**: `/gr/home`, `el-GR` in every variant. `?locale.x=en_GR` gives English (probe). No hreflang, no token the generic rewrite knows (`gr` is a country). |
| olx.pl, onet.pl, wp.pl, gov.pl, empik.com, mediaexpert.pl, rakuten.co.jp, mercadolivre.com.br, rozetka.com.ua | no English version of the home page (rozetka `/en/` → 403 check page; rakuten has a separate global.rakuten.com) |
| elpais.com, corriere.it | English edition exists on a different host/path (english.elpais.com, corriere.it/english/), but no hreflang and no EN link found |
| mbank.pl, pkobp.pl, ing.pl, santander.pl | English section exists, not linked by hreflang or a detectable switcher |
| otodom.pl | wrong hreflang (en → 404) |

Cookie/account settings: not measured (fresh contexts, no login). Google stores the choice in a cookie via `setprefs`. A logged-in account language setting is out of reach for an extension.

## How often geo-IP decides the language

On 46 loaded sites, geo-IP (GR) overrode the browser language on **3**: google.com, microsoft.com, paypal.com.

- google.com: header `pl` gives Polish, but header `en` gives **Greek**. Google treats `en` as "no preference" and falls back to the country language. `?hl=en` fixes it (probe).
- microsoft.com: always `/el-gr/`. The path rewrite to `/en-us/` fixes it.
- paypal.com: always `/gr/home` Greek. Only the site-specific `?locale.x=en_GR` fixes it.
- lot.com uses geo for the country (`/gr/…`) but the header for the language (`/gr/pl` vs `/gr/en`). That is fine.

All three geo cases are fixable with a URL parameter or path, so "geo-IP" is not a dead end. It needs site rules.

## Pitfalls seen

- **Accept-Language override in tests**: Playwright `extraHTTPHeaders` silently loses to the locale header. In the extension, DNR `modifyHeaders` must use `set` on `accept-language` for `main_frame` AND `xmlhttprequest`/`sub_frame`: SPAs (spotify, youtube) fetch strings by XHR.
- **Wrong hreflang**: otodom.pl `hreflang=en` → 404 page. zus.pl `hreflang=en-US` → `/en/` with `html lang=en-US` but mostly Polish text. Validate the target (status < 400) and give up after one hop.
- **Redirect loops**: no hreflang target bounced back in this sample, but pyszne.pl, learn.microsoft.com and airbnb redirect by header. A hreflang/rewrite redirect must not fight a header-driven redirect: keep a per-tab "already redirected for this URL" flag and never redirect twice in a row.
- **URL rewrite false positives**: the generic rewrite made 0 wrong hits here, because it fires only on an existing locale token. Guessing `/en` on a site without a token is unsafe: olx/empik/onet/pw → 404, mediaexpert → 403 bot page, rozetka → security check. A locale token inside a file name (`/it.html`) is not covered.
- **Switcher-link false positives**: 3 of 7 G clicks went to the wrong page: ing.pl → `/premium`, empik.com → an English-press category, mediaexpert.pl → a TV category. The match on `aria-label`/`title` is the cause. Use only exact link text (`EN`, `English`) or `hreflang`/`lang=en` on the anchor, then verify the result.
- `<html lang>` lies in both directions: inpost.pl says `pl` while the text is English (client-side i18n). alza.cz's challenge page says `pl-pl`. Do not rely on `html lang` alone to decide "already English".
- Bot defences react to header changes: sncf-connect.com returned 403 to `en-US` in one run only. booking.com serves a 202 challenge. An extension in a real profile with cookies will see less of this than headless.

## Recommendation for the extension

1. **Must: Accept-Language override via DNR** (`modifyHeaders`, `set`, all resource types). Biggest single gain: +8 sites, the only mechanism that works on most global sites.
2. **Must: navigator.language/languages override** (MAIN world, `document_start`, `all_frames`). Cheap, +2 sites (client-side i18n). Skip the `Intl` override: it added nothing here.
3. **Should: hreflang follow**, top-level only, once per URL, only when `<html lang>` AND detected text are not the target, with a status check of the target. +5 sites (news, rail). Low risk: 8 hreflang hops, 1 went to a 404 and 1 to a thin, mostly Polish page.
4. **Should: URL locale-token rewrite**, only when the URL already has a token (path seg 1-2, subdomain, `lang/hl/locale` query). +2 sites, 0 false positives. Never guess a token that is not there.
5. **Could: switcher-link follow** with strict matching, opt-in per site. +4 sites, but 3 wrong hits in 7 with loose matching.
6. **Should: small site-rule table** for the geo cases and the large sites: google `hl=en`, paypal `locale.x=en_<CC>`, Polish banks `/en`. That covers what generic rules cannot.

Expected ceiling with 1-4 on this sample: 24 of 46 loaded sites (52%) in English. With 5-6: about 28-30. The rest have no English version (about 11) or block bots (4).

## Files

- `sites.mjs` — the 50 URLs. `run.mjs` — runner (`node run.mjs [concurrency] [urlFilter]`, `node run.mjs --check` verifies the overrides). `detect.mjs` — language heuristic, URL rewrite, hreflang pick. `report.mjs` — tables. `probe.mjs` — manual URL probe.
- `results.json` (run 2), `results-run1.json` (run 1, no G, older block rules), `report.out`, `run.log`.
