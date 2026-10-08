// Language heuristics: text language detection and URL locale token rewrite.

const STOP = {
  en: 'the and of to for with on your you our from more about this that are is by sign help search new all shop learn see get find',
  pl: 'się nie jest dla oraz przez więcej twój zobacz szukaj konto pomoc może jak że czy już tylko które który są będzie także sklep',
  de: 'und der die das mit für nicht ist auf sie ein eine den von zu mehr ihre jetzt alle bei auch über unsere',
  fr: 'le la les et des du pour une est vous sur avec plus pas nos votre dans au aux tous qui que',
  es: 'el los las y del para con una por más su sus está tu nuestro todos como que también',
  it: 'il di che è per non una con della del sono gli le più tutti nostro tuo anche alla questo',
  nl: 'de het een van en voor met niet op je jouw onze meer alle bij ook zijn naar uw',
  cs: 'je na se pro do že jsou jako nebo více vše také který při od jak',
  pt: 'o os as e do da dos das para com uma não mais seu sua você nossos também em',
};
const STOP_SETS = Object.fromEntries(
  Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(/\s+/).filter(Boolean))]),
);
// Characters that are distinctive for one Latin-script language.
const CHARS = { pl: /[ąęłńśźżĄĘŁŃŚŹŻ]/g, cs: /[ěřůťďňĚŘŮŤĎŇ]/g, de: /[äöüßÄÖÜ]/g, pt: /[ãõÃÕ]/g, es: /[ñ¿¡Ñ]/g };

const count = (s, re) => (s.match(re) || []).length;

export function detectLanguage(text) {
  const t = (text || '').slice(0, 20000);
  const letters = count(t, /\p{L}/gu);
  if (letters < 80) return { lang: 'none', conf: 0, letters };
  const script = (re) => count(t, re) / letters;
  if (script(/[぀-ヿ]/g) > 0.05) return { lang: 'ja', conf: 1, letters };
  if (script(/[一-鿿]/g) > 0.2) return { lang: 'zh', conf: 1, letters };
  if (script(/[Ͱ-Ͽ]/g) > 0.3) return { lang: 'el', conf: 1, letters };
  if (script(/[Ѐ-ӿ]/g) > 0.3) {
    return { lang: count(t, /[іїєґІЇЄҐ]/g) >= count(t, /[ыэъёЫЭЪЁ]/g) ? 'uk' : 'ru', conf: 1, letters };
  }
  const words = t.toLowerCase().match(/\p{L}+/gu) || [];
  const score = Object.fromEntries(Object.keys(STOP_SETS).map((k) => [k, 0]));
  for (const w of words) for (const k in STOP_SETS) if (STOP_SETS[k].has(w)) score[k] += 1;
  for (const k in CHARS) score[k] += count(t, CHARS[k]) * 0.5;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, v]) => s + v, 0) || 1;
  return { lang: ranked[0][1] > 0 ? ranked[0][0] : 'none', conf: +(ranked[0][1] / total).toFixed(2), letters };
}

// Language codes that a locale token may carry (2-letter ISO 639-1, non-English).
const LANGS = new Set(
  'pl de fr es it nl cs cz pt ru uk ua ja zh ko sv da no nb fi el tr hu ro sk bg hr sl lt lv et he ar br mx'.split(' '),
);
const isLocaleToken = (s) => {
  const m = /^([a-z]{2})(?:[-_]([a-z]{2}))?$/i.exec(s);
  return !!m && LANGS.has(m[1].toLowerCase());
};

// Return candidate English URLs built from locale tokens in the URL (path, subdomain, query).
export function rewriteCandidates(href) {
  const u = new URL(href);
  const out = [];
  const segs = u.pathname.split('/');
  // Only the first two path segments can hold a locale.
  for (let i = 1; i <= 2 && i < segs.length; i++) {
    if (!isLocaleToken(segs[i])) continue;
    const variants = segs[i].length > 2 ? ['en-us', 'en-gb', 'en'] : ['en'];
    for (const v of variants) {
      const s = [...segs];
      s[i] = segs[i] === segs[i].toUpperCase() ? v.toUpperCase() : v;
      const c = new URL(u);
      c.pathname = s.join('/');
      out.push({ kind: 'path', url: c.href });
    }
    break;
  }
  const labels = u.hostname.split('.');
  if (labels.length > 2 && isLocaleToken(labels[0])) {
    const c = new URL(u);
    c.hostname = ['en', ...labels.slice(1)].join('.');
    out.push({ kind: 'subdomain', url: c.href });
  }
  for (const p of ['lang', 'hl', 'locale', 'language', 'lng', 'lc']) {
    const v = u.searchParams.get(p);
    if (v && isLocaleToken(v)) {
      const c = new URL(u);
      c.searchParams.set(p, 'en');
      out.push({ kind: 'query', url: c.href });
    }
  }
  return out;
}

// Pick the best English hreflang alternate.
export function pickHreflang(alternates) {
  const en = alternates.filter((a) => /^en(-|$)/i.test(a.hreflang));
  const order = ['en-us', 'en', 'en-gb'];
  en.sort((a, b) => {
    const ia = order.indexOf(a.hreflang.toLowerCase());
    const ib = order.indexOf(b.hreflang.toLowerCase());
    return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib);
  });
  return en[0] || null;
}
