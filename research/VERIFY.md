# Lang Lock — verification against the research sample

Date: 2026-10-09. Egress country: GR. Same 50 sites, the research detector (`detect.mjs`) and its block rules.

Setup: `npm run verify` loads the unpacked `extension/` into Playwright Chromium 156 (new headless, `launchPersistentContext`, `--load-extension`). The browser locale is `pl-PL` and the user agent drops `HeadlessChrome`, as in the research. The target language is set through the service worker (`chrome.storage.sync`). One persistent profile per run, 6 tabs in parallel. A page counts as settled after 10 s without a main-frame navigation (max 40 s). Results: `verify-en-run1.json`, `verify-en-run2.json`, `verify-de.json`, `verify-pl.json`.

The extension runs every layer at once: Accept-Language `en` (DNR), `navigator.language` `en` (MAIN world), then at most one redirect (site rule, then hreflang, then URL token), each checked for 2xx first. The research G column is the best research variant (header + navigator + hreflang + URL token + switcher-link click).

## Success criterion

| check | target | run 1 | run 2 |
|---|---|---|---|
| sites in English (of 46 loaded in research) | ≥ 28 (G) | **33** | **32** |
| Polish sites in English (of 18 loaded) | > 6 (G) | **10** | **9** |
| extension redirects that end on a 404/403 page | 0 | 0 | 0 |
| redirect loops | 0 | 0 | 0 |

Both runs pass. The run-2 drop is uw.edu.pl: no redirect happened in that run. Three single-site reruns all redirected to `en.uw.edu.pl` (see Flaky below).

## Per site (target `en`)

`layer` = which layer made the extension redirect (`rule`, `hreflang`, `token`). An empty layer with `en` means the header and the navigator override were enough.

| # | group | site | G (research) | run 1 | run 2 | layer | final URL (run 2) |
|---|---|---|---|---|---|---|---|
| 1 | pl | allegro.pl | BLK | BLK(403) | BLK(403) |  | https://allegro.pl/ |
| 2 | pl | olx.pl | pl | pl | pl |  | https://www.olx.pl/ |
| 3 | pl | onet.pl | pl | pl | pl |  | https://www.onet.pl/ |
| 4 | pl | wp.pl | pl | pl | pl |  | https://www.wp.pl/ |
| 5 | pl | gov.pl | pl | pl | pl |  | https://www.gov.pl/ |
| 6 | pl | zus.pl | en | en | en | rule | https://lang.zus.pl/ |
| 7 | pl | mbank.pl | pl | en | en | rule | https://www.mbank.pl/en/ |
| 8 | pl | pkobp.pl | pl | en | en | rule | https://www.pkobp.pl/en |
| 9 | pl | ing.pl | pl | en | en | rule | https://en.ing.pl/ |
| 10 | pl | santander.pl | pl | en | en | rule | https://www.erste.pl/en/about-erste |
| 11 | pl | intercity.pl | en | en | en | token | https://www.intercity.pl/en/ |
| 12 | pl | lot.com | en | en | en |  | https://www.lot.com/gr/en |
| 13 | pl | inpost.pl | en | en | en |  | https://inpost.pl/ |
| 14 | pl | ceneo.pl | BLK | BLK(200) | BLK(200) |  | https://www.ceneo.pl/Captcha/Add?ReturnUrl=%252F&CookieAge=172800 |
| 15 | pl | empik.com | pl | pl | pl |  | https://www.empik.com/ |
| 16 | pl | otodom.pl | pl | pl | pl |  | https://www.otodom.pl/ |
| 17 | pl | pyszne.pl | en | en | en |  | https://www.pyszne.pl/en |
| 18 | pl | mediaexpert.pl | pl | pl | pl |  | https://www.mediaexpert.pl/ |
| 19 | pl | uw.edu.pl | en | en | pl | rule | https://www.uw.edu.pl/ |
| 20 | pl | pw.edu.pl | ERR | pl | pl |  | https://www.pw.edu.pl/ |
| 21 | global | google.com | en | en | en | rule | https://www.google.com/?hl=en |
| 22 | global | youtube.com | en | en | en |  | https://www.youtube.com/ |
| 23 | global | wikipedia.org | en | en | en |  | https://www.wikipedia.org/ |
| 24 | global | microsoft.com | en | en | en | token | https://www.microsoft.com/en-us |
| 25 | global | learn.microsoft.com | en | en | en |  | https://learn.microsoft.com/en-us/ |
| 26 | global | apple.com | en | en | en |  | https://www.apple.com/ |
| 27 | global | ikea.com | en | en | en |  | https://www.ikea.com/ |
| 28 | global | booking.com | en | en | en |  | https://www.booking.com/index.en-gb.html?aid=304142&label=gen173nr-10C… |
| 29 | global | airbnb.com | en | en | en |  | https://www.airbnb.com/ |
| 30 | global | open.spotify.com | en | en | en |  | https://open.spotify.com/ |
| 31 | global | netflix.com | en | en | en |  | https://www.netflix.com/gr-en/ |
| 32 | global | aliexpress.com | en | en | en |  | https://www.aliexpress.com/ |
| 33 | global | paypal.com | el | en | en | rule | https://www.paypal.com/gr/home?locale.x=en_GR |
| 34 | global | docs.github.com | en | en | en |  | https://docs.github.com/en |
| 35 | global | developer.mozilla.org | en | en | en |  | https://developer.mozilla.org/en-US/ |
| 36 | de | amazon.de | en | en | en |  | https://www.amazon.de/ |
| 37 | de | zalando.de | en | en | en |  | https://en.zalando.de/?_rfl=de |
| 38 | de | bahn.de | en | en | en | hreflang | https://int.bahn.de/en |
| 39 | fr | lemonde.fr | en | en | en | hreflang | https://www.lemonde.fr/en/ |
| 40 | fr | sncf-connect.com | en | en | en | hreflang | https://www.sncf-connect.com/en-en |
| 41 | es | renfe.com | en | en | en | token | https://www.renfe.com/es/en |
| 42 | es | elpais.com | es | es | es |  | https://elpais.com/ |
| 43 | it | trenitalia.com | en | en | en | rule | https://www.trenitalia.com/en.html |
| 44 | it | corriere.it | it | it | it |  | https://www.corriere.it/ |
| 45 | nl | bol.com | ERR | BLK(403) | BLK(403) |  | chrome-error://chromewebdata/ |
| 46 | nl | ns.nl | en | en | en | hreflang | https://www.ns.nl/en |
| 47 | cz | alza.cz | BLK | BLK(403) | BLK(403) |  | https://www.alza.cz/ |
| 48 | ua | rozetka.com.ua | uk | uk | uk |  | https://rozetka.com.ua/ |
| 49 | jp | rakuten.co.jp | ja | ja | ja |  | https://www.rakuten.co.jp/ |
| 50 | br | mercadolivre.com.br | pt | pt | pt |  | https://www.mercadolivre.com.br/ |

## Coverage

| | all sites en (of 46 loaded) | Polish sites en (of 18 loaded) |
|---|---|---|
| G (research) | 28 | 6 |
| Lang Lock run 1 | 33 | 10 |
| Lang Lock run 2 | 32 | 9 |

Gains over G: mbank.pl, pkobp.pl, ing.pl, santander.pl (site rules to the verified English sections) and paypal.com (site rule `locale.x=en_GR`). Lost against G: none in run 1, uw.edu.pl in run 2 (flaky, see below). G reached zus.pl, uw.edu.pl, google.com and trenitalia.com by clicking a switcher link. The extension has no link clicking: site rules cover these four, each verified by the G click target in research and by these runs.

## Polish sites (20)

| outcome | count | sites |
|---|---|---|
| English via header (+ navigator) | 3 | lot.com, pyszne.pl, inpost.pl |
| English via URL token | 1 | intercity.pl (`/pl/` → `/en/`) |
| English via site rule | 6 | zus.pl → lang.zus.pl, mbank.pl → /en/, pkobp.pl → /en, ing.pl → en.ing.pl, santander.pl → erste.pl/en, uw.edu.pl → en.uw.edu.pl |
| no English version of the home page | 6 | olx.pl, onet.pl, wp.pl, gov.pl, empik.com, mediaexpert.pl |
| English site exists, no machine-readable link, no verified rule | 1 | pw.edu.pl (eng.pw.edu.pl) |
| wrong hreflang, correctly skipped | 1 | otodom.pl (`hreflang=en` → 404; the 2xx check rejects it, the page stays Polish) |
| bot block | 2 | allegro.pl (403), ceneo.pl (captcha redirect) |

pw.edu.pl loaded this time (it timed out in research run 2). It has `eng.pw.edu.pl`, but no hreflang and no token, and research did not verify a rule for it, so it stays Polish.

## Sites that stay non-English, and why

| site | reason |
|---|---|
| allegro.pl, ceneo.pl, alza.cz, bol.com | bot block (403 / captcha / IP block) in every run, research included |
| pw.edu.pl | eng.pw.edu.pl exists but has no hreflang or token; no rule verified yet |
| olx.pl, onet.pl, wp.pl, gov.pl, empik.com, mediaexpert.pl, rozetka.com.ua, rakuten.co.jp, mercadolivre.com.br | no English version reachable without guessing a URL. Guessed `/en` gives 404/403 here (research). |
| otodom.pl | its `hreflang=en` points to a 404. The check skips it. |
| elpais.com, corriere.it | English edition on another host/path (english.elpais.com, corriere.it/english/), a different newsroom, not a translation. No rule added: research did not verify it as the English version of the page. |

## Redirect safety

- 16 (run 1) and 15 (run 2) extension redirects. Every one ended on a 2xx page in English. No redirect loop, no second redirect in a row.
- Earlier run (before the fix): sncf-connect.com `hreflang en` → `/en-en` passed the 2xx check (from the service worker) but the browser navigation got **403** from the bot wall. The research saw the same flake on variant D. Fix: when a page we redirected to answers ≥ 400 (`PerformanceNavigationTiming.responseStatus`), the content script asks the service worker for the source URL and goes back. The source URL is marked in `sessionStorage`, so it does not redirect again. `npm run navcheck` reproduces it locally (HEAD 200, GET 403): `/pl -> /en -> /pl`, then stop. In the two final runs, sncf-connect.com answered 200 both times.

## navigator.language override

The Server-Timing trick works. The DNR rule 2 appends `Server-Timing: langlock;desc="<tags>"` to `main_frame` and `sub_frame` responses. `nav.js` (MAIN world, `document_start`, all frames) reads `performance.getEntriesByType('navigation')[0].serverTiming` and redefines the getters on `Navigator.prototype`. `npm run navcheck` (local http server, inline `<head>` script that stores `navigator.language` before any other code):

| case | inline script sees | iframe sees |
|---|---|---|
| http://127.0.0.1 (secure context) | `de-AT` / `de-AT,de` | `de-AT` |
| reload, back navigation | `de-AT` | `de-AT` |
| page that sends its own `Server-Timing` | `de-AT` (the site entry `db` stays) | `de-AT` |
| http://insecure.test (insecure context) | `de-AT` | `de-AT` |
| second visit served from the HTTP cache (no server hit) | `de-AT` | `de-AT` |
| target changed to `fr`, page still from the HTTP cache | `fr` | `fr` |
| target `off` | `pl-PL` (browser value) | `pl-PL` |

Real sites: `navigator.languages` read after load was `en` on every loaded site in both runs (bol.com showed `pl-PL` on a Chrome error page, which has no response). inpost.pl, whose client-side i18n follows `navigator.language`, shows English with `<html lang="pl">` in both runs, as research variant C did.

## Spot checks: target `de` and `pl`

| site | `de` | `pl` |
|---|---|---|
| google.com | de | pl |
| wikipedia.org | de | en (portal: the detector majority vote reads the many English labels; `navigator` was `pl`) |
| microsoft.com | de (`/el-gr` → `/de-de`, token) | pl (`/el-gr` → `/pl-pl`, token) |
| learn.microsoft.com | de (`/de-de/`) | pl (`/pl-pl/`) |
| airbnb.com | de (de.airbnb.com) | pl (pl.airbnb.com) |
| bahn.de | de | pl (`hreflang pl` → int.bahn.de/pl) |
| lemonde.fr | fr (no `de`/`pl` edition, no redirect) | fr (same) |

The Polish bank rules apply only to target `en`. No spot-check redirect went to an error page.

## Flaky

- uw.edu.pl: run 2 made no redirect. Three reruns of the site alone redirected to en.uw.edu.pl each time. The likely cause is the harness: with 6 tabs, the page reached `document_idle` late and the 10 s quiet window closed before the redirect. Not reproduced.
- sncf-connect.com: bot wall answers 403 to some navigations (see Redirect safety).
- booking.com serves a challenge redirect first, then English by header.
