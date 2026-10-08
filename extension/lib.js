// Pure helpers shared by the service worker, the content script and the node tests.

const primary = (tag) => tag.split(/[-_]/)[0].toLowerCase();
const sameLang = (a, b) => primary(a) === primary(b);

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
// or a hl/lang/locale/language query value.
// Returns the new URL, or null when the URL has no token or already carries the target.
function rewriteLocaleUrl(href, target) {
  const u = new URL(href);
  const segs = u.pathname.split('/');
  for (const i of [2, 1]) {
    const tok = parseToken(segs[i]);
    if (!tok) continue;
    if (sameLang(tok.lang, target)) return null;
    segs[i] = rewriteToken(tok, target);
    u.pathname = segs.join('/');
    return u.href;
  }
  for (const p of ['hl', 'lang', 'locale', 'language']) {
    const tok = parseToken(u.searchParams.get(p));
    if (!tok) continue;
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

const LangLock = { primary, sameLang, languageList, acceptLanguage, parseToken, rewriteLocaleUrl, pickAlternate };
if (typeof module === 'object') module.exports = LangLock;
else globalThis.LangLock = LangLock;
