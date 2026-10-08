// Local checks: page scripts see the overridden navigator.language from their very first line,
// and a redirect that lands on an error page is undone. Usage: node scripts/navcheck.mjs [lang]
import { createServer } from 'node:http';
import { launch, setTarget } from './browser.mjs';

const LANG = process.argv[2] || 'de-AT';
const PAGE = `<!doctype html><html><head><script>
window.early = [navigator.language, navigator.languages.join(',')].join(' | ');
</script></head><body><p>test</p><iframe src="/frame"></iframe></body></html>`;
const FRAME = `<script>window.early = navigator.language</script>`;

let hits = 0; // Server requests: an unchanged count means the page came from the HTTP cache.
const POLISH = `<!doctype html><html lang="pl"><head><link rel="alternate" hreflang="en" href="/en"></head>
<body><p>${'Witamy na naszej stronie. Znajdziesz tutaj wszystkie informacje o naszych usługach i cenach. '.repeat(5)}</p></body></html>`;
const server = createServer((req, res) => {
  hits++;
  // A bot wall: the HEAD check gets 200, the browser navigation gets 403.
  if (req.url === '/en') return res.writeHead(req.method === 'HEAD' ? 200 : 403).end('blocked');
  if (req.url === '/pl') return res.writeHead(200, { 'content-type': 'text/html' }).end(POLISH);
  const headers = { 'content-type': 'text/html', 'cache-control': 'max-age=3600' };
  if (req.url === '/own-timing') headers['server-timing'] = 'db;dur=53';
  res.writeHead(200, headers);
  res.end(req.url === '/frame' ? FRAME : PAGE);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const { ctx, sw } = await launch([`--host-resolver-rules=MAP insecure.test 127.0.0.1`]);
await setTarget(sw, LANG);
const page = await ctx.newPage();
const frameLang = () => page.frames()[1]?.evaluate(() => window.early);
const report = async (label) => {
  const [early, timing] = await page.evaluate(() => [
    window.early,
    performance.getEntriesByType('navigation')[0].serverTiming.map((t) => `${t.name}:${t.description}`).join(' '),
  ]);
  console.log(`${label.padEnd(34)} early=${early} | iframe=${await frameLang()} | serverTiming=${timing} | server hits=${hits}`);
};

await page.goto(`http://127.0.0.1:${port}/`);
await report('http 127.0.0.1 (secure context)');
await page.reload();
await report('reload (HTTP cache)');
await page.goto(`http://127.0.0.1:${port}/own-timing`);
await page.goBack();
await report('back (bfcache / cache)');
await page.goto(`http://127.0.0.1:${port}/own-timing`);
await report('page with its own Server-Timing');
await page.goto(`http://insecure.test:${port}/`);
await report('http insecure.test (insecure)');
await page.goto(`http://127.0.0.1:${port}/`);
await report('second visit (HTTP cache)');
await setTarget(sw, 'fr');
await page.goto(`http://127.0.0.1:${port}/`);
await report('target fr, cached page');
await page.goto('https://example.com/');
const real = await page.evaluate(() => [navigator.language, navigator.languages.join(','), isSecureContext]);
console.log(`real https site example.com           navigator=${real.join(' | ')}`);
await setTarget(sw, 'en');
const navs = [];
page.on('framenavigated', (f) => f === page.mainFrame() && navs.push(f.url().replace(/^.*:\d+/, '')));
await page.goto(`http://127.0.0.1:${port}/pl`);
await page.waitForTimeout(8000);
console.log(`redirect to a 403 page is undone       navigations=${navs.join(' -> ')}`);
await setTarget(sw, 'off');
await page.goto(`http://127.0.0.1:${port}/`);
await report('off');
await ctx.close();
server.close();
