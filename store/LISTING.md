# Chrome Web Store listing

## Name

Lang Lock — Force Site Language

## Short description (max 132 characters)

Make every site show the language you choose: Accept-Language, navigator.language and a safe redirect to the site's own translation.

## Detailed description

Sites guess your language from your IP address, your browser settings or a cookie. Lang Lock makes them all use one language that you pick.

Pick a language in the popup. Lang Lock then:

- sends your language in the Accept-Language header on every request,
- makes navigator.language and navigator.languages report your language before any page script runs,
- moves you to the site's own translation when the page still shows another language: it follows the page's hreflang link, or changes the language part of the URL (for example /el-gr/ to /en-us/), or uses a short list of known translation URLs. It checks that the translated page exists before it moves you, and it moves you at most once.

It never guesses URLs, never clicks on the page and never translates text. A site with no translation stays as it is.

Choose "Off" to stop all of it.

No data collection, no account, no server. Everything runs in your browser.

Limits: sites that choose the language only by IP address and give no other option, sites that block automated or unusual traffic, and sites with no version in your language.

## Single purpose

Lang Lock has one purpose: make websites show the language that the user picks. Every feature (the Accept-Language header, the navigator.language value and the redirect to the site's own translation) serves that purpose.

## Permission justifications

| permission | why |
|---|---|
| `storage` | Keeps the chosen language (`chrome.storage.sync`) and a per-tab note of the last redirect (time, from and to URL) that prevents redirect loops and undoes a redirect to an error page (`chrome.storage.session`). |
| `declarativeNetRequest` | One dynamic rule sets the `Accept-Language` request header to the chosen language. A second rule adds a `Server-Timing` response header to page documents that carries the language to the page script, so `navigator.language` is correct before any site script runs. |
| host permission `<all_urls>` | The header rule and the content scripts must run on every site the user opens. The service worker also sends `HEAD` (then `GET`) requests to check that a translated URL answers 2xx before it redirects. |
| content scripts on `<all_urls>` | `nav.js` sets `navigator.language` at document start. `content.js` reads the page language and its `hreflang` links, and redirects to the translation once. |

Remote code: none. All code ships in the package.

Data usage: the extension collects no user data. It does not sell or transfer data, and does not use data for purposes unrelated to its single purpose.

## Category

Tools (alternative: Accessibility).

## Language

English.

## Assets

All images come from HTML sources in `store/src/`. Regenerate them with `npm run icons` and `npm run screenshots`.

| asset | file | size |
|---|---|---|
| Icon (96x96 artwork, 16 px transparent padding) | `extension/icons/128.png` | 128x128 |
| Screenshot 1: "Pick one language. Every site follows it." (real popup) | `store/screenshot-1.png` | 1280x800 |
| Screenshot 2: "Polish sites in English" (before and after) | `store/screenshot-2.png` | 1280x800 |
| Screenshot 3: "Works before the page loads" (Accept-Language, navigator.language) | `store/screenshot-3.png` | 1280x800 |
| Screenshot 4: "Follows the site's own translation" (hreflang, URL token) | `store/screenshot-4.png` | 1280x800 |
| Screenshot 5: "No data. No account. No server." | `store/screenshot-5.png` | 1280x800 |
| Small promo tile | `store/promo-small.png` | 440x280 |
| Marquee promo tile | `store/promo-marquee.png` | 1400x560 |

Screenshots and promo tiles are 24-bit PNG without alpha, as the store requires. The images use only fictional `.example` sites, no real brands.
