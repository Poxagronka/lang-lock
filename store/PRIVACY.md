# Lang Lock — Privacy Policy

Last updated: 2026-10-09.

## What Lang Lock collects

Nothing. Lang Lock has no server, no analytics, no telemetry and no ads. It does not read, store or send your browsing history, page content, cookies or personal data.

## What Lang Lock stores

One setting: the language you pick in the popup (for example `en` or `off`). Chrome keeps it in `chrome.storage.sync`, so it follows your Chrome profile if you turn on Chrome sync. Lang Lock also keeps a short-lived note per tab in `chrome.storage.session` (the time of its last redirect in that tab) to prevent redirect loops. Chrome deletes it when the browser closes.

## What leaves your browser

Nothing goes to the developer or to any third party. The extension changes requests that your browser already sends:

- It sets the `Accept-Language` header to your language on requests to the sites you visit.
- Before it moves a page to the site's own translation, it checks that the translated URL exists with one `HEAD` (or `GET`) request to that site. The URL comes from the page itself (its `hreflang` links or its own URL) or from a small built-in list of known translation URLs.

The page text sample that decides "is this page already in my language" stays on your device: Chrome's built-in `chrome.i18n.detectLanguage` runs locally.

## Why Lang Lock needs access to all sites

The language must be set on every site you open, before the page loads. `<all_urls>` lets the `declarativeNetRequest` rule change the `Accept-Language` header on every site, lets the content script read the page language and `hreflang` links, and lets the service worker check a translated URL before it redirects you. The extension cannot do its single job on a site it has no access to.

## Contact

Open an issue in the project repository.
