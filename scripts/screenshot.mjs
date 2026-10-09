// Renders the store images from store/src/*.html: store/screenshot-{1..5}.png (1280x800),
// store/promo-small.png (440x280) and store/promo-marquee.png (1400x560).
// First it captures the real extension/popup.html into store/src/popup.png for screenshot 1.
import { chromium } from 'playwright';
import { launch, setTarget } from './browser.mjs';

const store = new URL('../store/', import.meta.url);
const { ctx, sw } = await launch([], 'en-US');
await setTarget(sw, 'en');
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${new URL(sw.url()).host}/popup.html`);
await popup.waitForFunction(() => document.getElementById('lang').value === 'en');
await popup.evaluate(() => (document.body.style.zoom = '1.6'));
await popup.locator('body').screenshot({ path: new URL('src/popup.png', store).pathname });
await ctx.close();

const pages = [
  ...[1, 2, 3, 4, 5].map((n) => [`shot-${n}`, `screenshot-${n}`, 1280, 800]),
  ['promo-small', 'promo-small', 440, 280],
  ['promo-marquee', 'promo-marquee', 1400, 560],
];
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage();
for (const [src, out, width, height] of pages) {
  await page.setViewportSize({ width, height });
  await page.goto(new URL(`src/${src}.html`, store).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL(`${out}.png`, store).pathname });
}
await browser.close();
