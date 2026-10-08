// Site rules for what the generic layers miss. Each rule was verified in research/.
// test(url) matches the page, to(url, target) returns the URL to try, or null.

const HOME = /^\/(indywidualny\/?|klient-indywidualny\/?)?$/; // Home pages, including the banks' landing redirects.

const SITE_RULES = [
  // Google treats Accept-Language "en" as no preference and falls back to the geo-IP language.
  {
    test: (u) => /^www\.google\.[a-z.]+$/.test(u.hostname) && !u.searchParams.has('hl'),
    to: (u, t) => (u.searchParams.set('hl', t), u.href),
  },
  // PayPal picks the language from geo-IP (/gr/home -> Greek). locale.x=<lang>_<REGION> overrides it.
  {
    test: (u) => /(^|\.)paypal\.com$/.test(u.hostname) && !u.searchParams.has('locale.x'),
    to: (u, t) => {
      const country = /^\/([a-z]{2})\//.exec(u.pathname);
      const region = country ? country[1].toUpperCase() : new Intl.Locale(t).maximize().region;
      u.searchParams.set('locale.x', `${LangLock.primary(t)}_${region}`);
      return u.href;
    },
  },
  // Trenitalia keeps the locale in the file name: /it.html -> /en.html.
  {
    test: (u) => u.hostname === 'www.trenitalia.com' && /^\/[a-z]{2}\.html$/.test(u.pathname),
    to: (u, t) => (u.pathname = `/${LangLock.primary(t)}.html`, u.href),
  },
  // Polish sites: the English section exists but nothing on the home page links to it by hreflang.
  ...[
    [/^www\.mbank\.pl$/, 'https://www.mbank.pl/en/'],
    [/^www\.pkobp\.pl$/, 'https://www.pkobp.pl/en'],
    [/^www\.ing\.pl$/, 'https://en.ing.pl/'],
    [/^www\.(santander|erste)\.pl$/, 'https://www.erste.pl/en'],
    [/^www\.zus\.pl$/, 'https://lang.zus.pl/'], // hreflang en-US points to /en/, which is mostly Polish.
    [/^www\.uw\.edu\.pl$/, 'https://en.uw.edu.pl/'],
  ].map(([host, en]) => ({
    test: (u) => host.test(u.hostname) && HOME.test(u.pathname),
    to: (u, t) => (LangLock.primary(t) === 'en' ? en : null),
  })),
];

function siteRule(href, target) {
  const u = new URL(href);
  const rule = SITE_RULES.find((r) => r.test(u));
  return rule ? rule.to(u, target) : null;
}

if (typeof module === 'object') module.exports = { siteRule };
