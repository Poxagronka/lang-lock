// Prints markdown tables from results.json for FINDINGS.md.
import { readFileSync } from 'node:fs';

const { meta, results } = JSON.parse(readFileSync(new URL('./results.json', import.meta.url)));
const V = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const ok = (v) => v && !v.error && !v.blocked && !(v.status >= 400);
const isEn = (v) => ok(v) && v.lang === 'en';
const host = (u) => new URL(u).hostname.replace(/^www\./, '');

function cell(name, v) {
  if (!v) return '-';
  if (v.error) return 'ERR';
  if (v.blocked) return `BLK(${v.status ?? ''})`;
  if (v.status >= 400) return `HTTP${v.status}`;
  let s = v.lang;
  if (name === 'E' && !v.skipped) s += ' ↪hreflang';
  if (name === 'F' && v.attempts && !v.rewriteFailed) s += ` ↪${v.attempts.at(-1).kind}`;
  if (name === 'F' && v.rewriteFailed) s += ' (rewrite ✗)';
  if (name === 'G' && v.switcherHref) s += ' ↪link';
  return s;
}

console.log(`Egress: ${meta.egressCountry}, run ${meta.date}, ${meta.browser}\n`);
console.log('| # | group | site | html lang A | A | B | C | D | E | F | G | en hreflang | switcher |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
results.forEach((r, i) => {
  const v = r.variants || {};
  const sw = v.D?.switcher || v.A?.switcher ? 'yes' : 'no';
  const cells = V.map((k) => cell(k, v[k]));
  console.log(`| ${i + 1} | ${r.group} | ${host(r.url)} | ${v.A?.htmlLang || ''} | ${cells.join(' | ')} | ${v.D?.enAlternates?.length || 0} | ${sw} |`);
});

function coverage(rows, label) {
  const loaded = rows.filter((r) => ok(r.variants?.A) || ok(r.variants?.D));
  console.log(`\n**${label}** — ${rows.length} sites, ${loaded.length} loaded (not blocked/error in A or D)\n`);
  console.log('| variant | reach en | of loaded |');
  console.log('|---|---|---|');
  for (const k of V) {
    const n = rows.filter((r) => isEn(r.variants?.[k])).length;
    console.log(`| ${k} | ${n} | ${((100 * n) / (loaded.length || 1)).toFixed(0)}% |`);
  }
  const gain = (k, base) => rows.filter((r) => isEn(r.variants?.[k]) && !isEn(r.variants?.[base])).map((r) => host(r.url));
  console.log(`\nB gains over A: ${gain('B', 'A').join(', ') || '-'}`);
  console.log(`C gains over A: ${gain('C', 'A').join(', ') || '-'}`);
  console.log(`D gains over B: ${gain('D', 'B').join(', ') || '-'}`);
  console.log(`E gains over D: ${gain('E', 'D').join(', ') || '-'}`);
  console.log(`F gains over E: ${gain('F', 'E').join(', ') || '-'}`);
  console.log(`G gains over F: ${gain('G', 'F').join(', ') || '-'}`);
}
coverage(results, 'All sites');
coverage(results.filter((r) => r.group === 'pl'), 'Polish sites');

console.log('\n### Not English after G\n');
for (const r of results) {
  const v = r.variants || {};
  if (isEn(v.G)) continue;
  const why = [];
  if (v.F?.error || v.D?.error) why.push(`error: ${(v.F?.error || v.D?.error).slice(0, 80)}`);
  if (v.D?.blocked) why.push(`blocked (status ${v.D.status}, "${v.D.title}")`);
  why.push(`D lang=${v.D?.lang} html=${v.D?.htmlLang} final=${v.D?.finalUrl}`);
  why.push(`enHreflang=${v.D?.enAlternates?.length || 0} switcher=${v.D?.switcher || 'none'}`);
  if (v.F?.attempts) why.push(`rewrite tries: ${v.F.attempts.map((a) => `${a.url}→${a.status} ${a.lang}`).join('; ')}`);
  console.log(`- ${host(r.url)} (${r.group}): ${why.join(' · ')}`);
}

console.log('\n### Pitfalls\n');
for (const r of results) {
  const v = r.variants || {};
  const h = host(r.url);
  if (v.E && !v.E.skipped) {
    if (v.E.selfLink) console.log(`- ${h}: hreflang en points to the current URL`);
    if (v.E.bouncedBack) console.log(`- ${h}: hreflang target redirected back to ${v.E.finalUrl}`);
    if (ok(v.E) && v.E.lang !== 'en') console.log(`- ${h}: hreflang ${v.E.hreflangUsed} → ${v.E.finalUrl} gave ${v.E.lang}`);
    if (v.E.error) console.log(`- ${h}: hreflang navigation error ${v.E.error}`);
  }
  for (const a of v.F?.attempts || []) {
    if (a.error || a.status >= 400 || a.lang !== 'en') {
      console.log(`- ${h}: rewrite ${a.kind} ${a.url} → ${a.error || `${a.status} ${a.lang} ${a.finalUrl}`}`);
    }
  }
  for (const k of ['A', 'D']) {
    const x = v[k];
    if (ok(x) && x.htmlLang && x.lang !== 'none' && !x.htmlLang.toLowerCase().startsWith(x.lang)) {
      console.log(`- ${h} ${k}: html lang "${x.htmlLang}" but text detected ${x.lang} (${x.conf})`);
    }
  }
  if (v.G?.switcherHref && ok(v.G) && v.G.lang !== 'en') console.log(`- ${h}: switcher link ${v.G.switcherHref} gave ${v.G.lang}`);
  const redirectsDiffer = ok(v.A) && ok(v.D) && v.A.finalUrl !== v.D.finalUrl;
  if (redirectsDiffer) console.log(`- ${h}: final URL A=${v.A.finalUrl} D=${v.D.finalUrl}`);
}
