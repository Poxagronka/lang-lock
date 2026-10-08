// Runs variants A-F for every site and writes results.json.
// Usage: node run.mjs [concurrency] [urlFilter]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { SITES } from './sites.mjs';
import { detectLanguage, rewriteCandidates, pickHreflang } from './detect.mjs';

const CONCURRENCY = Number(process.argv[2] || 6);
const FILTER = process.argv[3] || '';
const NAV_TIMEOUT = 30000;
const VARIANT_TIMEOUT = 75000;
const PL_HEADER = 'pl-PL,pl;q=0.9';
const NAV_EN = `(() => {
  const d = (k, v) => Object.defineProperty(Navigator.prototype, k, { get: () => v, configurable: true });
  d('language', 'en'); d('languages', Object.freeze(['en']));
})();`;

const VARIANTS = {
  A: { locale: 'pl-PL', header: PL_HEADER },
  B: { locale: 'pl-PL', header: 'en' },
  C: { locale: 'pl-PL', header: PL_HEADER, initScript: NAV_EN },
  D: { locale: 'en-US', header: 'en-US,en;q=0.9' },
};

const BLOCK_RE =
  /captcha|access denied|just a moment|attention required|are you a robot|pardon our interruption|request blocked|verify you are human|unusual traffic|checking your browser|bot detection|is blocked|temporarily blocked|403 forbidden|zablokowan|robot/i;

// Runs inside the page: collect language signals.
function inspectPage() {
  const SW_TEXT =
    /^(en|eng|english|pl|polski|deutsch|français|español|italiano|nederlands|čeština|українська|日本語|português|language|languages|język|wersja językowa|sprache|langue|idioma|lingua|taal|jazyk|мова|言語)$/i;
  const SW_ATTR = /language|język|jezyk|sprache|langue|idioma|lingua|jazyk|taal|мова|言語|locale/i;
  let switcher = null;
  if (document.querySelector('body a[hreflang]')) switcher = 'a[hreflang]';
  const els = [...document.querySelectorAll('a, button, select, [role=button], [aria-label], [title]')].slice(0, 4000);
  for (const el of els) {
    if (switcher) break;
    const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;
    if (SW_ATTR.test(label)) switcher = `attr:${label.trim().slice(0, 40)}`;
    else if (SW_TEXT.test((el.textContent || '').trim())) switcher = `text:${el.textContent.trim().slice(0, 20)}`;
    else if (el.tagName === 'SELECT' && /english/i.test(el.textContent)) switcher = 'select';
  }
  return {
    htmlLang: document.documentElement.lang || '',
    title: document.title.slice(0, 120),
    alternates: [...document.querySelectorAll('link[rel~="alternate"][hreflang]')].map((l) => ({
      hreflang: l.getAttribute('hreflang'),
      href: l.href,
    })),
    text: (document.body ? document.body.innerText : '').slice(0, 20000),
    switcher,
    navLang: [navigator.language, ...navigator.languages].join('|'),
    intlLocale: Intl.DateTimeFormat().resolvedOptions().locale,
  };
}

async function inspect(page) {
  for (let i = 0; i < 3; i++) {
    try {
      return await page.evaluate(inspectPage);
    } catch {
      await page.waitForTimeout(2000); // Context destroyed by a client-side navigation: retry.
    }
  }
  throw new Error('inspect failed');
}

// Navigate, wait for settle, return a result record.
async function visit(page, url, navs) {
  navs.length = 0;
  const rec = { requestUrl: url };
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const chain = [];
  for (let r = resp?.request(); r; r = r.redirectedFrom()) chain.unshift(r.url());
  const info = await inspect(page);
  const det = detectLanguage(info.text);
  const blocked =
    [401, 403, 429, 503].includes(resp?.status()) ||
    /captcha|challenge/i.test(page.url()) ||
    ((BLOCK_RE.test(info.title) || BLOCK_RE.test(info.text.slice(0, 1500))) && info.text.length < 3000);
  Object.assign(rec, {
    status: resp ? resp.status() : null,
    finalUrl: page.url(),
    httpRedirects: chain.slice(0, -1),
    clientNavs: [...new Set(navs)].filter((u) => u !== page.url() && !chain.includes(u)),
    htmlLang: info.htmlLang,
    lang: det.lang,
    conf: det.conf,
    letters: det.letters,
    title: info.title,
    alternates: info.alternates.length,
    enAlternates: info.alternates.filter((a) => /^en(-|$)/i.test(a.hreflang)),
    allAlternates: info.alternates.slice(0, 60),
    switcher: info.switcher,
    navLang: info.navLang,
    intlLocale: info.intlLocale,
    blocked: !!blocked,
    snippet: info.text.replace(/\s+/g, ' ').slice(0, 160),
  });
  return rec;
}

// extraHTTPHeaders cannot override the locale-derived Accept-Language, so rewrite it per request
// (this is what a declarativeNetRequest modifyHeaders rule does in the extension).
async function setup(ctx, v) {
  await ctx.route('**/*', (r) => r.continue({ headers: { ...r.request().headers(), 'accept-language': v.header } }));
  if (v.initScript) await ctx.addInitScript(v.initScript);
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`variant timeout ${ms}ms`)), ms))]);
}

async function runVariant(browser, ua, url, name, followUps) {
  const v = VARIANTS[name];
  const ctx = await browser.newContext({
    locale: v.locale,
    userAgent: ua,
    viewport: { width: 1366, height: 900 },
  });
  await setup(ctx, v);
  const page = await ctx.newPage();
  const navs = [];
  page.on('framenavigated', (f) => f === page.mainFrame() && navs.push(f.url()));
  const out = {};
  try {
    out[name] = await withTimeout(visit(page, url, navs), VARIANT_TIMEOUT);
    if (followUps) Object.assign(out, await withTimeout(followUp(page, navs, out[name]), VARIANT_TIMEOUT * 2));
  } catch (e) {
    if (!out[name]) out[name] = { requestUrl: url, error: String(e.message).split('\n')[0] };
    else out.followUpError = String(e.message).split('\n')[0];
  } finally {
    await ctx.close().catch(() => {});
  }
  return out;
}

// G: follow a visible in-page language switcher link to English (only if F did not reach en).
async function followUp(page, navs, d) {
  const out = await followEF(page, navs, d);
  if (out.F.lang === 'en' && !out.F.blocked) {
    out.G = { ...out.F, skipped: 'F reached en' };
    return out;
  }
  const href = await page
    .evaluate(() => {
      const re = /^(en|eng|english|in english|english version|wersja angielska)$/i;
      const host = location.hostname.split('.').slice(-2).join('.');
      const links = [...document.querySelectorAll('a[href]')].filter((a) => a.hostname.endsWith(host));
      const hit =
        links.find((a) => re.test((a.textContent || '').trim())) ||
        links.find((a) => /^en(-|$)/i.test(a.getAttribute('hreflang') || '') || /^en(-|$)/i.test(a.getAttribute('lang') || '')) ||
        links.find((a) => re.test((a.getAttribute('aria-label') || a.getAttribute('title') || '').trim()));
      return hit ? hit.href : null;
    })
    .catch(() => null);
  if (!href) {
    out.G = { ...out.F, skipped: 'no switcher link' };
    return out;
  }
  out.G = await visit(page, href, navs).catch((err) => ({ requestUrl: href, error: err.message.split('\n')[0] }));
  out.G.switcherHref = href;
  return out;
}

// E: follow hreflang en. F: rewrite the URL locale token. Both reuse the D context.
async function followEF(page, navs, d) {
  const out = {};
  const htmlEn = /^en/i.test(d.htmlLang);
  const alt = pickHreflang(d.allAlternates || []);
  if (!htmlEn && alt) {
    const e = await visit(page, alt.href, navs).catch((err) => ({ requestUrl: alt.href, error: err.message.split('\n')[0] }));
    e.hreflangUsed = alt.hreflang;
    e.selfLink = alt.href === d.finalUrl;
    e.bouncedBack = e.finalUrl === d.finalUrl;
    out.E = e;
  } else {
    out.E = { ...d, skipped: htmlEn ? 'html lang is en' : 'no en hreflang' };
  }
  const base = out.E.lang === 'en' ? null : out.E.finalUrl || d.finalUrl;
  if (!base) {
    out.F = { ...out.E, skipped: 'E reached en' };
    return out;
  }
  const cands = rewriteCandidates(base);
  if (!cands.length) {
    out.F = { ...out.E, skipped: 'no locale token' };
    return out;
  }
  const attempts = [];
  for (const c of cands.slice(0, 3)) {
    const r = await visit(page, c.url, navs).catch((err) => ({ requestUrl: c.url, error: err.message.split('\n')[0] }));
    attempts.push({ kind: c.kind, url: c.url, status: r.status, finalUrl: r.finalUrl, lang: r.lang, htmlLang: r.htmlLang, error: r.error });
    if (r.lang === 'en' && !(r.status >= 400)) {
      out.F = { ...r, attempts };
      return out;
    }
  }
  out.F = { ...out.E, attempts, rewriteFailed: true };
  return out;
}

async function runSite(browser, ua, site) {
  const res = { ...site, variants: {} };
  for (const name of ['A', 'B', 'C']) Object.assign(res.variants, await runVariant(browser, ua, site.url, name, false));
  Object.assign(res.variants, await runVariant(browser, ua, site.url, 'D', true));
  for (const k of ['E', 'F', 'G']) if (!res.variants[k]) res.variants[k] = { ...res.variants.D, skipped: 'D failed' };
  const s = Object.entries(res.variants)
    .filter(([k]) => k.length === 1)
    .map(([k, v]) => `${k}=${v.error ? 'ERR' : v.blocked ? 'BLK' : v.lang}`)
    .join(' ');
  console.log(`${site.url} ${s}`);
  return res;
}

async function main() {
  const egress = await fetch('https://ipinfo.io/country').then((r) => r.text()).catch(() => '?');
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const probe = await browser.newPage();
  const ua = (await probe.evaluate(() => navigator.userAgent)).replace('HeadlessChrome', 'Chrome');
  await probe.close();
  const sites = SITES.filter((s) => s.url.includes(FILTER));
  const results = new Array(sites.length);
  let next = 0;
  const worker = async () => {
    while (next < sites.length) {
      const i = next++;
      results[i] = await runSite(browser, ua, sites[i]).catch((e) => ({ ...sites[i], fatal: e.message }));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();
  const file = FILTER ? `results-${FILTER.replace(/\W+/g, '_')}.json` : 'results.json';
  const meta = { egressCountry: egress.trim(), date: new Date().toISOString(), userAgent: ua, browser: 'chromium new-headless' };
  writeFileSync(file, JSON.stringify({ meta, results }, null, 1));
  console.log(`wrote ${file}`);
}

// Allow `node run.mjs --check` to verify header/navigator overrides against an echo service.
if (process.argv[2] === '--check') {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  for (const [name, v] of Object.entries(VARIANTS)) {
    const ctx = await browser.newContext({ locale: v.locale });
    await setup(ctx, v);
    const page = await ctx.newPage();
    await page.goto('https://httpbin.org/headers');
    const h = JSON.parse(await page.textContent('body')).headers['Accept-Language'];
    const n = await page.evaluate(() => [navigator.language, navigator.languages.join(','), Intl.DateTimeFormat().resolvedOptions().locale]);
    console.log(name, 'Accept-Language:', h, '| navigator:', n.join(' / '));
    await ctx.close();
  }
  await browser.close();
} else {
  await main();
}
