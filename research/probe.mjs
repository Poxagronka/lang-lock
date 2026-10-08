// Manual probe: does a known English URL exist for sites that stayed non-English? (D settings)
import { chromium } from 'playwright';
import { detectLanguage } from './detect.mjs';

const URLS = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chromium', headless: true });
for (const url of URLS) {
  const ctx = await browser.newContext({ locale: 'en-US' });
  await ctx.route('**/*', (r) => r.continue({ headers: { ...r.request().headers(), 'accept-language': 'en-US,en;q=0.9' } }));
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const [lang, text] = await page.evaluate(() => [document.documentElement.lang, document.body.innerText]);
    const d = detectLanguage(text);
    console.log(`${url} -> ${resp?.status()} ${page.url()} html=${lang} text=${d.lang} (${d.conf}) | ${text.replace(/\s+/g, ' ').slice(0, 70)}`);
  } catch (e) {
    console.log(`${url} -> ERR ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
}
await browser.close();
