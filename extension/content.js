// ISOLATED world, top frame, document_idle. When the page text is not in the target language,
// ask the service worker to move to the site's own version: site rule, hreflang, URL locale token.
(async () => {
  const SETTLE_MS = 1500; // Let client-side rendering put its text in place first.
  const GUARD = `langlock:${location.href}`;
  if (window.top !== window) return;
  // Our redirect landed on an error page (a bot wall can answer 403 to the browser but 2xx to the check): go back.
  if (performance.getEntriesByType('navigation')[0]?.responseStatus >= 400) {
    const from = await chrome.runtime.sendMessage({ type: 'undo' });
    if (from) location.replace(from);
    return;
  }
  if (sessionStorage.getItem(GUARD)) return;
  const { lang: target = 'en' } = await chrome.storage.sync.get('lang');
  if (target === 'off') return;
  await new Promise((r) => setTimeout(r, SETTLE_MS));

  const text = (document.body?.innerText || '').slice(0, 5000);
  const det = await chrome.i18n.detectLanguage(text);
  const pageLang = det.isReliable ? det.languages[0]?.language : document.documentElement.lang;
  if (!pageLang || LangLock.sameLang(pageLang, target)) return;

  const alternates = [...document.querySelectorAll('link[rel~="alternate"][hreflang]')].map((l) => ({
    hreflang: l.getAttribute('hreflang'),
    href: l.href,
  }));
  const candidates = [
    siteRule(location.href, target),
    LangLock.pickAlternate(alternates, target)?.href,
    LangLock.rewriteLocaleUrl(location.href, target, pageLang),
  ].filter((u) => u && u !== location.href);
  if (!candidates.length) return;

  const url = await chrome.runtime.sendMessage({ type: 'redirect', candidates });
  if (!url) return;
  sessionStorage.setItem(GUARD, '1');
  location.replace(url);
})();
