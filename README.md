# Lang Lock — Force Site Language

A minimal Chrome extension (Manifest V3) that makes every site use one language that you pick. No framework, no build step, no data collection.

## What it does

Pick a language in the popup (or "Off"). Lang Lock then works in three layers:

1. **Accept-Language header.** A `declarativeNetRequest` dynamic rule sets `Accept-Language` on every request type, including XHR, because SPAs load their strings by XHR. `pl-PL` becomes `pl-PL,pl;q=0.9`. A bare code such as `en` stays `en`.
2. **navigator.language.** `nav.js` runs in the MAIN world at `document_start` in all frames. It redefines `navigator.language` and `navigator.languages` on `Navigator.prototype`. `Intl` stays as it is.
3. **Redirect to the site's own translation.** `content.js` runs once per page in the top frame at `document_idle`. When `chrome.i18n.detectLanguage` on the page text (or `<html lang>` when the detection is not reliable) says the page is not in your language, it tries in this order:
   - a verified site rule from `rules.js` (Google `hl`, PayPal `locale.x`, Trenitalia, some Polish sites with an English section),
   - the `<link rel="alternate" hreflang>` that matches your language,
   - a rewrite of a locale token that is already in the URL (`/el-gr/` → `/en-us/`, `?hl=pl` → `?hl=en`).

   The service worker checks each candidate with `HEAD` (then `GET`) and uses the first one that answers 2xx and does not bounce back. It redirects at most once per tab in 15 seconds and never twice from the same URL in a tab, so redirect loops cannot happen. If the redirect still lands on a 4xx page (a bot wall can answer the check with 2xx and the browser with 403), the page goes back to where it came from. It never guesses a token that is not in the URL and never clicks switcher links (research showed false positives).

### How the MAIN world learns the language

The MAIN world has no `chrome.storage`, and the value must be known synchronously, before page scripts run. The second DNR rule appends `Server-Timing: langlock;desc="<tags>"` to every `main_frame` and `sub_frame` response. `nav.js` reads it with `performance.getEntriesByType('navigation')[0].serverTiming`. `npm run navcheck` proves it: an inline `<head>` script sees the new value on secure and insecure http pages, in iframes, on pages with their own `Server-Timing`, on pages from the HTTP cache (DNR still applies) and after a language change. No cookie is used, so the site server never sees the value.

## Limits

- **Geo-IP sites.** Some sites pick the language only from your IP address. Lang Lock fixes them only with a site rule (Google, PayPal, Microsoft through the URL token).
- **Bot blocks.** Sites that block automated traffic (allegro.pl, ceneo.pl, alza.cz, bol.com in the test run) show the block page whatever the language.
- **No translation.** A site with no version in your language stays as it is (olx.pl, onet.pl, wp.pl, gov.pl, rakuten.co.jp and others).
- **Thin translations.** Some sites have only a small English section (Polish banks). The site rules send you to that section's home page, not to a translation of the page you opened.
- **What is not covered.** `Intl`, `navigator.language` inside web workers, `about:blank` frames, server-side account language settings, a locale token inside a file name (except the Trenitalia rule).

## Install from source

1. `npm install` (only for tests, lint and the verification run; the extension itself has no dependencies).
2. Open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick the `extension/` folder.
3. Click the toolbar icon and pick a language. Reload open tabs.

## Development

| command | what it does |
|---|---|
| `npm test` | Unit tests for the pure URL-rewrite, hreflang and header-value functions (`extension/lib.js`, `extension/rules.js`). |
| `npm run lint` | ESLint, zero warnings allowed. |
| `npm run verify -- <lang> [out.json] [urlFilter]` | Loads the unpacked extension in Chromium (new headless, Polish browser locale) and visits the 50 research sites. Results: `research/verify-<lang>.json`. |
| `npm run navcheck` | Local checks: page scripts see the overridden `navigator.language` from their first line, and a redirect that lands on a 403 is undone. |
| `npm run zip` | Builds `dist/lang-lock-<version>.zip` from `extension/` only. |
| `npm run icons` / `npm run screenshots` | Regenerate the icons and the 1280x800 store screenshot. |

Research and the verification report live in `research/` (`FINDINGS.md`, `VERIFY.md`).

## Publish to the Chrome Web Store

1. Bump `version` in `extension/manifest.json` and `package.json`.
2. Run `npm test`, `npm run lint`, then `npm run zip`.
3. In the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), create a new item and upload `dist/lang-lock-<version>.zip`.
4. Fill the listing from `store/LISTING.md`: descriptions, category, single-purpose statement, permission justifications. Upload `extension/icons/128.png` and `store/screenshot-1.png`.
5. Host `store/PRIVACY.md` at a public URL (for example the GitHub file view) and paste the link as the privacy policy. Declare that no user data is collected.
6. Submit for review. Expect a longer review because of the `<all_urls>` host permission.
