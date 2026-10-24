const test = require('node:test');
const assert = require('node:assert/strict');
const LangLock = require('../extension/lib.js');

globalThis.LangLock = LangLock;
const { siteRule } = require('../extension/rules.js');
const { acceptLanguage, languageList, rewriteLocaleUrl, pickAlternate, firstReachable, pageLanguage } = LangLock;

test('Accept-Language value', () => {
  assert.equal(acceptLanguage('en'), 'en');
  assert.equal(acceptLanguage('pl-PL'), 'pl-PL,pl;q=0.9');
  assert.equal(acceptLanguage('pt-BR'), 'pt-BR,pt;q=0.9');
  assert.deepEqual(languageList('de-AT'), ['de-AT', 'de']);
});

test('path token keeps shape and case', () => {
  assert.equal(rewriteLocaleUrl('https://www.microsoft.com/el-gr/', 'en'), 'https://www.microsoft.com/en-us/');
  assert.equal(rewriteLocaleUrl('https://x.com/el-GR/a', 'de'), 'https://x.com/de-DE/a');
  assert.equal(rewriteLocaleUrl('https://x.com/el_gr', 'en-GB'), 'https://x.com/en_gb');
  assert.equal(rewriteLocaleUrl('https://www.intercity.pl/pl/', 'en'), 'https://www.intercity.pl/en/');
  assert.equal(rewriteLocaleUrl('https://x.com/PL/', 'en'), 'https://x.com/EN/');
  assert.equal(rewriteLocaleUrl('https://www.renfe.com/es/es', 'en'), 'https://www.renfe.com/es/en');
});

test('a country code is not a language token', () => {
  assert.equal(rewriteLocaleUrl('https://www.paypal.com/gr/home', 'en'), null);
  assert.equal(rewriteLocaleUrl('https://www.lot.com/gr/pl', 'en'), 'https://www.lot.com/gr/en');
});

test('no token, or the token is already the target', () => {
  assert.equal(rewriteLocaleUrl('https://www.olx.pl/', 'en'), null);
  assert.equal(rewriteLocaleUrl('https://x.com/products/123', 'en'), null);
  assert.equal(rewriteLocaleUrl('https://x.com/en-us/', 'en'), null);
  assert.equal(rewriteLocaleUrl('https://x.com/a/b/pl/', 'en'), null); // Only segments 1-2.
});

test('query token', () => {
  assert.equal(rewriteLocaleUrl('https://x.com/?hl=pl', 'en'), 'https://x.com/?hl=en');
  assert.equal(rewriteLocaleUrl('https://x.com/?locale=pl_PL&q=1', 'de'), 'https://x.com/?locale=de_DE&q=1');
  assert.equal(rewriteLocaleUrl('https://x.com/?lang=foo', 'en'), null);
});

test('hreflang pick: exact, then primary subtag', () => {
  const alts = [
    { hreflang: 'x-default', href: 'd' },
    { hreflang: 'en-GB', href: 'gb' },
    { hreflang: 'en', href: 'en' },
    { hreflang: 'de', href: 'de' },
  ];
  assert.equal(pickAlternate(alts, 'en').href, 'en');
  assert.equal(pickAlternate(alts, 'en-GB').href, 'gb');
  assert.equal(pickAlternate(alts, 'en-US').href, 'en');
  assert.equal(pickAlternate(alts, 'pl'), null);
});

test('site rules', () => {
  assert.equal(siteRule('https://www.google.com/', 'en'), 'https://www.google.com/?hl=en');
  assert.equal(siteRule('https://www.google.com/?hl=pl', 'en'), null);
  assert.equal(siteRule('https://www.paypal.com/gr/home', 'en'), 'https://www.paypal.com/gr/home?locale.x=en_GR');
  assert.equal(siteRule('https://www.mbank.pl/indywidualny/', 'en'), 'https://www.mbank.pl/en/');
  assert.equal(siteRule('https://www.mbank.pl/indywidualny/', 'de'), null);
  assert.equal(siteRule('https://www.mbank.pl/kontakt/', 'en'), null);
  assert.equal(siteRule('https://www.trenitalia.com/it.html', 'de'), 'https://www.trenitalia.com/de.html');
  assert.equal(siteRule('https://example.com/', 'en'), null);
});

test('a token that is not the page language is a word, not a locale', () => {
  assert.equal(rewriteLocaleUrl('https://x.com/id/12345', 'en', 'pl'), null);
  assert.equal(rewriteLocaleUrl('https://x.com/uk/shop', 'de', 'en'), null);
  assert.equal(rewriteLocaleUrl('https://x.com/de/it/', 'en', 'de'), 'https://x.com/en/it/');
  assert.equal(rewriteLocaleUrl('https://x.com/?lang=it&hl=pl', 'en', 'pl'), 'https://x.com/?lang=it&hl=en');
  assert.equal(rewriteLocaleUrl('https://www.intercity.pl/pl/', 'en', 'pl-PL'), 'https://www.intercity.pl/en/');
});

test("Chrome's legacy detector codes match the popup tags", () => {
  assert.ok(LangLock.sameLang('iw', 'he'));
  assert.ok(LangLock.sameLang('no', 'nb'));
  assert.equal(rewriteLocaleUrl('https://x.com/no/', 'nb', 'no'), null);
});

// A fake fetch: url -> final URL after redirects (status 200), or a number (that status, no redirect).
const site = (map) => async (url) => {
  const v = map[url];
  return typeof v === 'number' ? { ok: v < 300, url } : { ok: true, url: v };
};

test('a sticky locale cookie: the URL token that leads back here is still the target', async () => {
  // cmux.com with NEXT_LOCALE=pl: every fetch ends on /pl, but a navigation to /en resets the cookie.
  const pl = 'https://cmux.com/pl';
  const en = 'https://cmux.com/en';
  const get = site({ 'https://cmux.com/': pl, [en]: pl, [`${en}#top`]: pl });
  assert.equal(await firstReachable(['https://cmux.com/', en], pl, en, get), en);
  // The tab URL keeps its fragment: a fetch that ends on /pl still leads back to /pl#top.
  assert.equal(await firstReachable(['https://cmux.com/', `${en}#top`], `${pl}#top`, `${en}#top`, get), `${en}#top`);
});

test('a redirect back here is a dead end for a candidate that is not the URL token', async () => {
  // aliexpress.com from Spain: hreflang en -> www.aliexpress.com -> 302 es.aliexpress.com.
  const from = 'https://es.aliexpress.com/?gatewayAdapt=glo2esp';
  assert.equal(await firstReachable(['https://www.aliexpress.com/'], from, null, site({ 'https://www.aliexpress.com/': from })), null);
});

test('a candidate that lands elsewhere still wins, and a 404 is never a target', async () => {
  const get = site({ 'https://x.com/': 'https://x.com/pl', 'https://x.com/en': 'https://x.com/en', 'https://x.com/de': 404 });
  assert.equal(await firstReachable(['https://x.com/', 'https://x.com/en'], 'https://x.com/pl', null, get), 'https://x.com/en');
  assert.equal(await firstReachable(['https://x.com/de'], 'https://x.com/pl', 'https://x.com/de', get), null);
});

test('page language: the <html lang> UI wins over user text in the target language', () => {
  assert.equal(pageLanguage('pl', 'en', 'en'), 'pl'); // pl.chaturbate.com: Polish UI, English room titles
  assert.equal(pageLanguage('en', 'de', 'en'), 'de'); // a boilerplate lang="en" on a German page
  assert.equal(pageLanguage('', 'pl', 'en'), 'pl');
  assert.equal(pageLanguage('pl', null, 'en'), 'pl');
  assert.equal(pageLanguage('en-US', 'en', 'en'), undefined);
  assert.equal(pageLanguage('', null, 'en'), undefined);
});
