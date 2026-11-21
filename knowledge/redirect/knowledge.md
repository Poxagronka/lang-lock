# Redirect knowledge

## Language versions on separate domains (2026-11-21)

- A site kept each language on its own registrable domain. A page had `<html lang="de">`, no `<link rel="alternate" hreflang>` and no locale token in path, query or host. Result: "no candidate URL".
- The page had two signals. A language menu listed the languages by name ("English", "Deutsch"), and each link went to the home page of that domain. A banner link went to the same page on the English domain, but its text did not name a language.
- The path is translated on the other domain. The same path answers 404 there.
- Fix: `pickSwitcher` in `extension/lib.js`. It is the last candidate layer, so a site that worked before keeps its behaviour.
- Rules of the layer: only exact link text counts (the name of the target language in itself or in the page language). The page must also link its own language by name. A home link on another origin only names that origin. The target is the deeper link to that origin, when the page has exactly one. A home link is the target only from a home page. A query that only sets the locale (`/?lang=en`) does not make a link deeper.
- This replaces the earlier "never follow switcher links" decision with the strict form that `research/FINDINGS.md` recommends. The 3 wrong hits there came from `title` and `aria-label` matches.
- The same site runs a cookie test. A `GET` with no cookies ends on a 200 stub page at another URL. `HEAD` answers 200 with no redirect, so `firstReachable` returns the candidate itself. If `HEAD` failed, `firstReachable` would return the stub URL. Not fixed: no live case yet.
- Verification: unit test in `test/lib.test.js`. Live check (2026-11-21): Playwright Chromium with the unpacked extension, locale `de-DE`, target `en`. Result: redirect to the banner link, then the site's own 301 to the translated page, `lang=en`.
## Sticky language cookie on a cross-origin candidate (2026-10-31)

- A Django site kept the locale in `django_language`. With that cookie, the apex host (the hreflang target) answers `302` to the locale subdomain. Without it, the apex answers English.
- `firstReachable` omits credentials cross-origin, so the check saw 200 and the real navigation bounced back. The tab guard then stopped all other candidates.
- The site's `en.` host sets `en_subdomain=1`, then redirects to the apex. With that cookie the apex stays English. A check that returned the final URL lost this hop.
- `www` does not reset anything: with the cookie it redirects to the locale subdomain.
- Fix: the tab guard now holds the list of tried candidates. A return to the page tries the next candidate, so the loop ends after each candidate once. A candidate that ends on a tried URL is navigated itself.
- `credentials: 'include'` was rejected: it sends cookies to other origins and changes cookie state during a check.

## Locale only in the subdomain (2026-10-31)

- A search-results page had `<html lang="pl">`, no hreflang links and no locale token in path or query. The locale lived only in the host (`pl.example.com`).
- Result: "no candidate URL", because no layer looked at the host.
- Fix: `rewriteLocaleHost` in `extension/lib.js`. It swaps the leading host label when it names the page language.
- English sites often keep the default English version on `www`, not on `en.`. So for English the candidates are `en.` then `www.`. `firstReachable` skips a host that does not resolve.
- Verification: unit tests in `test/lib.test.js`.
- Live check (2026-10-31): Playwright Chromium with uBlock Origin Lite, target `en`, a `pl.` search page with no hreflang. Result: redirect to the `www` host, same path and query, `lang=en`. The `en.` host did not resolve, and `firstReachable` skipped it.

## Sticky locale cookies vs the reachability check (2026-10-21)

- cmux.com (Next.js) sets a `NEXT_LOCALE` cookie when the user opens `/pl`.
- With that cookie, `/` answers `307 /pl`.
- `/en` sets `NEXT_LOCALE=en` only when `Sec-Fetch-Dest` is not `empty`.
- So no `fetch()` can reset the cookie, from the service worker or from the page. Only a top-level navigation can.
- Effect: the reachability check fetched `/en`, saw it end on `/pl` (back at `from`), and dropped the candidate. The user stayed on `/pl`.
- Fix: `firstReachable(candidates, from, token, get)` keeps the URL-token candidate as a fallback when its fetch bounces back to `from`. A candidate that is not the URL token is still a dead end in that case (aliexpress.com: `www` -> 302 `es.aliexpress.com`).
- `sender.url` keeps the `#hash` of the tab URL. `res.url` of a fetch does not. Compare with the fragment handled on both sides.
- Verification: Playwright Chromium live run on 2026-10-21, locale `es-ES`, target `en`, page `https://cmux.com/pl`. Result: URL `https://cmux.com/`, `lang=en`, cookie `NEXT_LOCALE=en`. Unit tests: `test/lib.test.js` (3 `firstReachable` cases).

## Test tooling (2026-10-21)

- The cmux in-app browser is WKWebView. It runs no Chrome extensions. Use Playwright Chromium (`scripts/browser.mjs`) for live checks.
