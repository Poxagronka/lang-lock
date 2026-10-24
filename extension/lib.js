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

// Final URL of the first candidate that answers 2xx (HEAD, then GET) somewhere other than `from`.
// A candidate that leads back to `from` is a dead end, except the URL token (`token`): a URL that names
// the target language can reset a sticky site locale on a navigation, never on a fetch (cmux.com sets
// its NEXT_LOCALE cookie only for Sec-Fetch-Dest: document). Then the token itself is the target.
async function firstReachable(candidates, from, token, get = fetch) {
  const here = from.split('#')[0];
  let sticky = null;
  for (const url of candidates) {
    for (const method of ['HEAD', 'GET']) {
      const credentials = new URL(url).origin === new URL(from).origin ? 'include' : 'omit';
      const res = await get(url, { method, redirect: 'follow', credentials, signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (res?.ok) {
        if (res.url !== here) return res.url;
        if (url === token) sticky = url;
        break;
      }
    }
  }
  return sticky;
}

const LangLock = { primary, sameLang, pageLanguage, languageList, acceptLanguage, parseToken, rewriteLocaleUrl, pickAlternate, firstReachable };
if (typeof module === 'object') module.exports = LangLock;
else globalThis.LangLock = LangLock;
