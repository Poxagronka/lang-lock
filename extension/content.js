// ISOLATED world, top frame, document_idle. When the page text is not in the target language,
// ask the service worker to move to the site's own version: site rule, hreflang, URL locale token.
(async () => {
  const SETTLE_MS = 1500; // Let client-side rendering put its text in place first.
  const LOG_SIZE = 50;
  const GUARD = `langlock:${location.href}`;
  if (window.top !== window) return;
  const { lang: target = 'en', debug } = await chrome.storage.sync.get(['lang', 'debug']);
  const rec = { at: new Date().toISOString(), url: location.href, target };
  // With "Debug log" on in the popup, keep why this page was or was not redirected. It never leaves the device.
  const done = async (result) => {
    if (!debug) return;
    const { log = [] } = await chrome.storage.local.get('log');
    await chrome.storage.local.set({ log: [...log, { ...rec, result }].slice(-LOG_SIZE) });
  };
  // Our redirect landed on an error page (a bot wall can answer 403 to the browser but 2xx to the check): go back.
  if (performance.getEntriesByType('navigation')[0]?.responseStatus >= 400) {
    const from = await chrome.runtime.sendMessage({ type: 'undo' });
    if (from) location.replace(from);
    return done(from ? `undo to ${from}` : 'error page, nothing to undo');
  }
  if (sessionStorage.getItem(GUARD)) return done('already redirected from here in this tab');
  if (target === 'off') return;
  await new Promise((r) => setTimeout(r, SETTLE_MS));

  const text = (document.body?.innerText || '').slice(0, 5000);
  const det = await chrome.i18n.detectLanguage(text);
  const textLang = det.isReliable ? det.languages[0]?.language : null;
  const pageLang = LangLock.pageLanguage(document.documentElement.lang, textLang, target);
  Object.assign(rec, { htmlLang: document.documentElement.lang, detected: det.languages[0], reliable: det.isReliable, pageLang });
  if (!pageLang) return done('page is already in the target language');

  const alternates = [...document.querySelectorAll('link[rel~="alternate"][hreflang]')].map((l) => ({
    hreflang: l.getAttribute('hreflang'),
    href: l.href,
  }));
  const token = LangLock.rewriteLocaleUrl(location.href, target, pageLang);
  const candidates = [
    ...new Set([siteRule(location.href, target), LangLock.pickAlternate(alternates, target)?.href, token]),
  ].filter((u) => u && u !== location.href);
  Object.assign(rec, { hreflangs: alternates.map((a) => a.hreflang), candidates });
  if (!candidates.length) return done('no candidate URL');

  const url = await chrome.runtime.sendMessage({ type: 'redirect', candidates, token });
  if (!url) return done('no candidate reachable, or paused after a recent redirect');
  sessionStorage.setItem(GUARD, '1');
  await done(`redirect to ${url}`);
  location.replace(url);
})();
