// Pure helpers shared by the service worker, the content script and the node tests.

// Chrome's language detector still answers with the legacy codes "iw" (Hebrew) and "no" (Norwegian).
const ALIASES = { iw: 'he', no: 'nb', in: 'id' };
const primary = (tag) => {
  const p = tag.split(/[-_]/)[0].toLowerCase();
  return ALIASES[p] || p;
};
const sameLang = (a, b) => primary(a) === primary(b);
// The first page language that is not the target: <html lang> (the UI), then the text detector.
// User text such as English titles on a Polish site must not hide a UI in another language.
const pageLanguage = (htmlLang, textLang, target) => [htmlLang, textLang].find((l) => l && !sameLang(l, target));

// "pl-PL" -> ["pl-PL", "pl"], "en" -> ["en"].
function languageList(tag) {
  return tag.includes('-') ? [tag, primary(tag)] : [tag];
}

// "pl-PL" -> "pl-PL,pl;q=0.9", "en" -> "en".
function acceptLanguage(tag) {
  const [first, second] = languageList(tag);
  return second ? `${first},${second};q=0.9` : first;
}

const KNOWN = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
const TOKEN = /^([a-z]{2})(?:([-_])([a-z]{2}))?$/i;

// Parse a URL locale token ("en", "el-gr", "pl_PL"). Null when it is not a known language.
function parseToken(s) {
  const m = TOKEN.exec(s || '');
  return m && KNOWN.of(m[1].toLowerCase()) ? { lang: m[1], sep: m[2], region: m[3] } : null;
}

// Rewrite a token to the target, keeping its shape and case: "el-gr" -> "en-us", "PL" -> "EN".
function rewriteToken(tok, target) {
  let out = primary(target);
  if (tok.region) {
    const region = new Intl.Locale(target).maximize().region || tok.region;
    const r = tok.region === tok.region.toUpperCase() ? region.toUpperCase() : region.toLowerCase();
    out += tok.sep + r;
  }
  return tok.lang === tok.lang.toUpperCase() ? out.toUpperCase() : out;
}

// Replace an existing locale token: path segment 2 then 1 ("/es/es" is country/language),
// or a hl/lang/locale/language query value. A token counts only when it names the page's own
// language (pageLang), so a word such as /id/ or /it/ is not taken for a locale.
// Returns the new URL, or null when the URL has no token or already carries the target.
function rewriteLocaleUrl(href, target, pageLang) {
  const u = new URL(href);
  const segs = u.pathname.split('/');
  for (const i of [2, 1]) {
    const tok = parseToken(segs[i]);
    if (!tok || (pageLang && !sameLang(tok.lang, pageLang))) continue;
    if (sameLang(tok.lang, target)) return null;
    segs[i] = rewriteToken(tok, target);
    u.pathname = segs.join('/');
    return u.href;
  }
  for (const p of ['hl', 'lang', 'locale', 'language']) {
    const tok = parseToken(u.searchParams.get(p));
    if (!tok || (pageLang && !sameLang(tok.lang, pageLang))) continue;
    if (sameLang(tok.lang, target)) return null;
    u.searchParams.set(p, rewriteToken(tok, target));
    return u.href;
  }
  return null;
}

// Swap a locale subdomain for the target: "pl.example.com" -> "en.example.com". For English, also the
// "www" host, where many sites keep their default English version. Only a label that names the page's
// own language counts, so a host such as "it.example.com" on an English page is left alone.
function rewriteLocaleHost(href, target, pageLang) {
  const u = new URL(href);
  const [label, ...rest] = u.hostname.split('.');
  const tok = parseToken(label);
  if (rest.length < 2 || !tok || !sameLang(tok.lang, pageLang) || sameLang(tok.lang, target)) return [];
  const labels = primary(target) === 'en' ? ['en', 'www'] : [primary(target)];
  return labels.map((l) => ((u.hostname = [l, ...rest].join('.')), u.href));
}

// Pick the hreflang alternate for the target: exact match, then the bare primary subtag, then any region.
function pickAlternate(alternates, target) {
  const t = target.toLowerCase();
  return (
    alternates.find((a) => a.hreflang.toLowerCase() === t) ||
    alternates.find((a) => a.hreflang.toLowerCase() === primary(t)) ||
    alternates.find((a) => a.hreflang.toLowerCase() !== 'x-default' && sameLang(a.hreflang, t)) ||
    null
  );
}

// Pick the site's own language switcher link for the target. Only exact link text counts: the name of the
// target language in itself or in the page language ("English", "Englisch"). Looser matches (title,
// aria-label) led to wrong pages in research. The page must also link its own language by name ("Deutsch"),
// so a stray link named "English" in an article is not a switcher.
// A switcher often links to the home page of the other version, and from a deeper page that loses the page.
// Then a home link on another origin only names that origin, and the first deeper link to it is the target.
// A home link itself is the target only from a home page.
function pickSwitcher(links, target, pageLang, from) {
  const [to, own] = [primary(target), primary(pageLang)];
  if (!parseToken(own)) return null;
  const name = (lang, locale) => new Intl.DisplayNames([locale], { type: 'language' }).of(lang).toLowerCase();
  const text = (l) => l.text.trim().toLowerCase();
  if (!links.some((l) => text(l) === name(own, own))) return null;
  const names = [name(to, to), name(to, own)];
  const here = new URL(from);
  const homePath = (u) => /^\/([a-z]{2}([-_][a-z]{2})?\/?)?$/i.test(u.pathname);
  const isHome = (u) => homePath(u) && !u.search;
  for (const l of links) {
    if (!names.includes(text(l))) continue;
    const u = new URL(l.href);
    if (u.href.split('#')[0] === from.split('#')[0]) continue;
    if (!isHome(u)) return u.href;
    const deeper = u.origin !== here.origin && links.map((x) => new URL(x.href)).find((x) => x.origin === u.origin && !isHome(x));
    if (deeper) return deeper.href;
    if (homePath(here)) return u.href;
  }
  return null;
}

// Final URL of the first candidate that answers 2xx (HEAD, then GET) somewhere other than `from`.
// A candidate that leads back to `from` is a dead end, except the URL token (`token`): a URL that names
// the target language can reset a sticky site locale on a navigation, never on a fetch (cmux.com sets
// its NEXT_LOCALE cookie only for Sec-Fetch-Dest: document). Then the token itself is the target.
// A candidate that ends on a `tried` URL stays itself: its own hop can set the cookie that the tried URL needs.
async function firstReachable(candidates, from, token, get = fetch, tried = []) {
  const here = from.split('#')[0];
  let sticky = null;
  for (const url of candidates) {
    for (const method of ['HEAD', 'GET']) {
      const credentials = new URL(url).origin === new URL(from).origin ? 'include' : 'omit';
      const res = await get(url, { method, redirect: 'follow', credentials, signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (res?.ok) {
        if (res.url !== here) return tried.includes(res.url) ? url : res.url;
        if (url === token) sticky = url;
        break;
      }
    }
  }
  return sticky;
}

const LangLock = { primary, sameLang, pageLanguage, languageList, acceptLanguage, parseToken, rewriteLocaleUrl, rewriteLocaleHost, pickAlternate, pickSwitcher, firstReachable };
if (typeof module === 'object') module.exports = LangLock;
else globalThis.LangLock = LangLock;
