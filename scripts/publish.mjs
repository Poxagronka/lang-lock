// Uploads dist/lang-lock-<version>.zip to the Chrome Web Store and submits it for review.
// Skips when the store already has this version or a newer one. Usage: CWS_TOKEN=<access token> node scripts/publish.mjs
// CI gets the token through Workload Identity Federation (.github/workflows/publish.yml); scope chromewebstore.
import { readFileSync } from 'node:fs';

const PUBLISHER = '9fdbacb4-c72b-4124-bdd7-9896d933f6be';
const ITEM = 'mampkgcdadbkegndjkadehheljddcepa';
const ITEM_URL = `https://chromewebstore.googleapis.com/v2/publishers/${PUBLISHER}/items/${ITEM}`;
const UPLOAD_URL = `https://chromewebstore.googleapis.com/upload/v2/publishers/${PUBLISHER}/items/${ITEM}:upload`;
const headers = { authorization: `Bearer ${process.env.CWS_TOKEN}` };
const root = new URL('..', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(`${root}extension/manifest.json`, 'utf8'));

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${url} failed: ${res.status} ${body}`);
  return JSON.parse(body);
}

// "1.0.10" > "1.0.9": compare numerically, part by part.
const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

const status = await call(`${ITEM_URL}:fetchStatus`);
const known = [status.submittedItemRevisionStatus, status.publishedItemRevisionStatus]
  .flatMap((r) => r?.distributionChannels ?? [])
  .map((c) => c.crxVersion);
const latest = known.reduce((a, b) => (newer(b, a) ? b : a), '0');
if (!newer(version, latest)) {
  console.log(`skip: manifest ${version} is not newer than the store's ${latest}`);
  process.exit(0);
}

let upload = await call(UPLOAD_URL, {
  method: 'POST',
  headers: { 'content-type': 'application/zip' },
  body: readFileSync(`${root}dist/lang-lock-${version}.zip`),
});
// A large package is processed asynchronously: poll fetchStatus until the upload settles.
for (let i = 0; upload.uploadState === 'IN_PROGRESS' && i < 30; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  upload = { uploadState: (await call(`${ITEM_URL}:fetchStatus`)).lastAsyncUploadState };
}
if (upload.uploadState !== 'SUCCEEDED') throw new Error(`upload ${version}: ${JSON.stringify(upload)}`);
console.log(`uploaded ${version}`);

const published = await call(`${ITEM_URL}:publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
console.log(`submitted ${version} for review: ${published.state}`);
