// Prints the markdown tables for research/VERIFY.md: verify runs vs research variant G.
// Usage: node scripts/report.mjs research/verify-en-run1.json research/verify-en-run2.json
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const LangLock = require('../extension/lib.js');
globalThis.LangLock = LangLock; // rules.js reads it as a global.
const { siteRule } = require('../extension/rules.js');

const load = (f) => JSON.parse(readFileSync(f, 'utf8')).results;
const research = load('research/results.json');
const runs = process.argv.slice(2).map(load);
const cell = (r) => (!r || r.error ? 'ERR' : r.blocked ? `BLK(${r.status})` : r.lang);
const gCell = (v) => (v.error ? 'ERR' : v.blocked ? 'BLK' : v.lang);

// Which layer moved the page: site rule, URL token or hreflang (the rest).
function layer(ext) {
  if (!ext) return '';
  const starts = (c) => c && (ext.to === c || ext.to.startsWith(c.replace(/\/$/, '')));
  if (starts(siteRule(ext.from, 'en'))) return 'rule';
  if (starts(LangLock.rewriteLocaleUrl(ext.from, 'en'))) return 'token';
  return 'hreflang';
}

// Research denominator: sites that loaded in A or D.
const loaded = new Set(
  research.filter((s) => ['A', 'D'].some((k) => !s.variants[k].error && !s.variants[k].blocked)).map((s) => s.url),
);

console.log('| # | group | site | G (research) | run 1 | run 2 | layer | final URL (run 2) |');
console.log('|---|---|---|---|---|---|---|---|');
research.forEach((s, i) => {
  const [r1, r2] = runs.map((run) => run.find((r) => r.url === s.url));
  const ext = r2?.ext || r1?.ext;
  const host = new URL(s.url).hostname.replace(/^www\./, '');
  const final = r2?.finalUrl && r2.finalUrl.length > 70 ? `${r2.finalUrl.slice(0, 70)}…` : r2?.finalUrl || '';
  console.log(`| ${i + 1} | ${s.group} | ${host} | ${gCell(s.variants.G)} | ${cell(r1)} | ${cell(r2)} | ${layer(ext)} | ${final} |`);
});

const en = (rows, pl) => rows.filter((r) => loaded.has(r.url) && (!pl || r.group === 'pl') && !r.blocked && !r.error && r.lang === 'en');
const gRows = research.map((s) => ({ ...s, ...s.variants.G }));
console.log('\n| | all sites en (of 46 loaded) | Polish sites en (of 18 loaded) |');
console.log('|---|---|---|');
console.log(`| G (research) | ${en(gRows).length} | ${en(gRows, true).length} |`);
runs.forEach((run, i) => console.log(`| Lang Lock run ${i + 1} | ${en(run).length} | ${en(run, true).length} |`));

for (const [i, run] of runs.entries()) {
  const ext = run.filter((r) => r.ext);
  const bad = ext.filter((r) => r.status >= 400 || r.blocked);
  const undone = ext.filter((r) => !bad.includes(r) && r.navs.some((n) => /^4\d\d /.test(n)));
  const loops = run.filter((r) => r.loop);
  const list = (rows, key) => (rows.length ? ` (${rows.map((r) => r[key]).join(', ')})` : '');
  console.log(`\nRun ${i + 1}: extension redirects ${ext.length}, ending on 4xx/blocked pages ${bad.length}${list(bad, 'finalUrl')}, ` +
    `undone after landing on a 4xx ${undone.length}${list(undone, 'url')}, redirect loops ${loops.length}${list(loops, 'url')}.`);
}
