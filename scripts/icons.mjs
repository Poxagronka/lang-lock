// Renders store/src/icon.html into extension/icons/{16,48,128}.png (transparent background).
import { chromium } from 'playwright';

const src = new URL('../store/src/icon.html', import.meta.url).href;
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const page = await browser.newPage();
for (const size of [16, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.goto(`${src}?size=${size}`);
  await page.evaluate(() => document.fonts.ready);
  const path = new URL(`../extension/icons/${size}.png`, import.meta.url).pathname;
  await page.screenshot({ path, omitBackground: true });
}
await browser.close();
