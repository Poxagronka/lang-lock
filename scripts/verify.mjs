// Loads the unpacked extension in Chromium and visits the research sites with a Polish browser locale.
// Usage: node scripts/verify.mjs [lang=en] [out=research/verify-<lang>.json] [urlRegExp] [concurrency=6]
import { writeFileSync } from 'node:fs';
import { SITES } from '../research/sites.mjs';
import { detectLanguage } from '../research/detect.mjs';
import { launch, setTarget } from './browser.mjs';

const [LANG = 'en', OUT = `research/verify-${LANG}.json`, FILTER = '', CONC = '6'] = process.argv.slice(2);
const QUIET_MS = 10000; // The page counts as settled after this long without a main-frame navigation.
const MAX_WAIT_MS = 40000;
const BLOCK_RE =
  /captcha|access denied|just a moment|attention required|are you a robot|pardon our interruption|request blocked|verify you are human|unusual traffic|checking your browser|bot detection|is blocked|temporarily blocked|403 forbidden|zablokowan|robot/i;

const inspect = () => ({
  htmlLang: document.documentElement.lang || '',
  title: document.title.slice(0, 120),
  text: (document.body ? document.body.innerText : '').slice(0, 20000),
  navLang: navigator.languages.join(','),
});

// The redirect the extension made in this tab, read from the service worker's session storage.
async function extRedirect(ctx, url) {
  const sw = ctx.serviceWorkers()[0];
  return sw
    ?.evaluate(async (u) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === u);
      return tab ? (await chrome.storage.session.get(`tab${tab.id}`))[`tab${tab.id}`] || null : null;
    }, url)
    .catch(() => null);
}

async function visit(ctx, site) {
  const page = await ctx.newPage();
  const navs = [];
  let lastNav = Date.now();
  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) {
      navs.push({ url: r.url(), status: r.status() });
      lastNav = Date.now();
    }
  });
  const rec = { ...site };
  try {
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const start = Date.now();
    while (Date.now() - lastNav < QUIET_MS && Date.now() - start < MAX_WAIT_MS) await page.waitForTimeout(500);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    let info;
    for (let i = 0; i < 3 && !info; i++) info = await page.evaluate(inspect).catch(() => page.waitForTimeout(2000));
    if (!info) throw new Error('inspect failed');
    const det = detectLanguage(info.text);
    const docs = navs.filter((n) => n.status < 300 || n.status >= 400); // Drop 3xx hops.
    const status = docs.at(-1)?.status ?? null;
    Object.assign(rec, {
      status,
      finalUrl: page.url(),
      lang: det.lang,
      conf: det.conf,
      htmlLang: info.htmlLang,
      navLang: info.navLang,
      ext: await extRedirect(ctx, page.url()),
      navs: navs.map((n) => `${n.status} ${n.url}`),
      loop: navs.length > 10 || navs.some((n) => navs.filter((m) => m.url === n.url).length > 2),
      blocked:
        [401, 403, 429, 503].includes(status) ||
        /captcha|challenge/i.test(page.url()) ||
        ((BLOCK_RE.test(info.title) || BLOCK_RE.test(info.text.slice(0, 1500))) && info.text.length < 3000),
      snippet: info.text.replace(/\s+/g, ' ').slice(0, 120),
    });
  } catch (e) {
    rec.error = e.message.split('\n')[0];
    rec.navs = navs.map((n) => `${n.status} ${n.url}`);
  }
  await page.close().catch(() => {});
  const cell = rec.error ? 'ERR' : rec.blocked ? `BLK(${rec.status})` : rec.lang;
  console.log(`${site.url} -> ${cell} ${rec.finalUrl || ''}${rec.ext ? ' [ext redirect]' : ''}`);
  return rec;
}

const { ctx, sw } = await launch();
await setTarget(sw, LANG);
const sites = SITES.filter((s) => new RegExp(FILTER).test(s.url));
const results = new Array(sites.length);
let next = 0;
const worker = async () => {
  while (next < sites.length) {
    const i = next++;
    results[i] = await visit(ctx, sites[i]);
  }
};
await Promise.all(Array.from({ length: Number(CONC) }, worker));
await ctx.close();
writeFileSync(OUT, JSON.stringify({ meta: { lang: LANG, date: new Date().toISOString() }, results }, null, 1));
console.log(`wrote ${OUT}`);
