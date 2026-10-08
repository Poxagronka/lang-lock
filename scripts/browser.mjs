// Launches Chromium (new headless) with the unpacked extension, by default with a Polish browser locale.
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXT = new URL('../extension', import.meta.url).pathname;

// Headless Chromium says "HeadlessChrome" in its user agent, and many sites block that.
async function userAgent() {
  const b = await chromium.launch({ channel: 'chromium', headless: true });
  const ua = await (await b.newPage()).evaluate(() => navigator.userAgent);
  await b.close();
  return ua.replace('HeadlessChrome', 'Chrome');
}

export async function launch(args = [], locale = 'pl-PL') {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'langlock-')), {
    channel: 'chromium',
    headless: true,
    locale,
    userAgent: await userAgent(),
    viewport: { width: 1366, height: 900 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--lang=${locale}`, ...args],
  });
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  return { ctx, sw };
}

// Set the target through the service worker and wait until the DNR rules match it.
export async function setTarget(sw, lang) {
  await sw.evaluate(async (l) => {
    const sleep = () => new Promise((r) => setTimeout(r, 100));
    while (!(await chrome.storage.sync.get('lang')).lang) await sleep(); // onInstalled finished
    await chrome.storage.sync.set({ lang: l });
    for (let i = 0; i < 100; i++) {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const value = rules[0]?.action.requestHeaders?.[0].value;
      if (l === 'off' ? rules.length === 0 : value?.startsWith(l)) return;
      await sleep();
    }
    throw new Error('rules not applied');
  }, lang);
}
