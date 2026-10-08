// Renders the popup into a 1280x800 store screenshot: store/screenshot-1.png.
import { launch, setTarget } from './browser.mjs';

const { ctx, sw } = await launch([], 'en-US');
await setTarget(sw, 'pl');
const id = new URL(sw.url()).host;
const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`chrome-extension://${id}/popup.html`);
await page.waitForFunction(() => document.getElementById('lang').value === 'pl');
await page.evaluate(() => {
  const select = document.getElementById('lang');
  select.size = 14;
  const card = document.createElement('div');
  card.append(...document.body.childNodes);
  card.style.cssText = 'width:300px;padding:16px;background:#fff;border-radius:12px;box-shadow:0 10px 40px #0003';
  const text = document.createElement('div');
  text.innerHTML =
    '<h1 style="font-size:44px;margin:0 0 16px">Lang Lock</h1>' +
    '<p style="font-size:22px;line-height:1.5;color:#334155;margin:0">Pick one language.<br>Every site follows it:<br>' +
    'Accept-Language, navigator.language<br>and the site\'s own translation.</p>';
  document.body.style.cssText =
    'width:auto;height:800px;margin:0;display:flex;align-items:center;justify-content:center;gap:96px;background:#e0e7ff';
  card.style.zoom = '1.6';
  text.style.width = '460px';
  document.body.append(text, card);
  select.scrollTop = ((select.selectedIndex - 6) * select.scrollHeight) / select.options.length;
});
await page.screenshot({ path: 'store/screenshot-1.png' });
await ctx.close();
