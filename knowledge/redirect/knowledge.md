# Redirect knowledge

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
