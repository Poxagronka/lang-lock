# Lang Lock — Privacy Policy

Last updated: 2026-10-09.

## What Lang Lock collects

Nothing. Lang Lock has no server, no analytics, no telemetry and no ads. It does not store or send your browsing history, page content, cookies or personal data. It reads a sample of the page text only to detect the page language on your device.

Debug log is an option in the popup, and it is off by default. When you turn it on, Lang Lock keeps its last 50 language decisions on your device: the page URL, the detected languages and the redirect result. It never sends them. You copy them yourself with the Copy debug log button. Turning the option off deletes them.

## What Lang Lock stores

One setting: the language you pick in the popup (for example `en` or `off`). Chrome keeps it in `chrome.storage.sync`, so it follows your Chrome profile if you turn on Chrome sync. Lang Lock also keeps a short-lived note per tab in `chrome.storage.session` (the time of its last redirect in that tab, and the URLs it redirected from and to) to prevent redirect loops and to undo a redirect that lands on an error page. Lang Lock deletes the note when the tab closes, and Chrome deletes it when the browser closes.

## What leaves your browser

Nothing goes to the developer or to any analytics or ad service. The extension changes requests that your browser already sends, and sends a few requests of its own:

- It sets the `Accept-Language` header to your language on requests to the sites you visit.
- Before it moves a page to the site's own translation, the extension's background script sends its own status-check requests: a `HEAD` request to each candidate translated URL, then a `GET` request when the `HEAD` request fails, until one answers 2xx (at most three candidates per page). These requests carry your cookies for that site, as a normal visit does. A candidate URL comes from the page itself (its `hreflang` links or its own URL) or from a small built-in list of known translation URLs, so it can be on another domain that the page links to (for example the site's English subdomain).

The page text sample that decides "is this page already in my language" stays on your device: Chrome's built-in `chrome.i18n.detectLanguage` runs locally.

## Why Lang Lock needs access to all sites

The language must be set on every site you open, before the page loads. `<all_urls>` lets the `declarativeNetRequest` rule change the `Accept-Language` header on every site, lets the content script read the page language and `hreflang` links, and lets the service worker check a translated URL before it redirects you. The extension cannot do its single job on a site it has no access to.

## Contact

Open an issue in the project repository.
