# Redirect knowledge

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
