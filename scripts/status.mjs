// Prints the Chrome Web Store review status of the item. Usage: node scripts/status.mjs [--json]
// Needs an OAuth Desktop client JSON at ~/.config/lang-lock/client.json. The first run opens a consent page.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PUBLISHER = '9fdbacb4-c72b-4124-bdd7-9896d933f6be';
const ITEM = 'mampkgcdadbkegndjkadehheljddcepa';
const DIR = join(homedir(), '.config/lang-lock');
const TOKEN = join(DIR, 'token.json');
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore.readonly';
const client = JSON.parse(readFileSync(join(DIR, 'client.json'), 'utf8')).installed;

async function exchange(params) {
  const res = await fetch(client.token_uri, {
    method: 'POST',
    body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret, ...params }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Installed-app loopback flow with PKCE: one browser consent, then the refresh token is kept.
async function consent() {
  const verifier = randomBytes(32).toString('base64url');
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const url = new URL(client.auth_uri);
  url.search = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  });
  execFile('open', [url.href]);
  const code = await new Promise((resolve, reject) =>
    server.on('request', (req, res) => {
      const q = new URL(req.url, redirect).searchParams;
      if (!q.has('code') && !q.has('error')) return res.writeHead(404).end();
      res.end(q.has('code') ? 'Done, you can close this tab' : `Error: ${q.get('error')}`);
      server.close();
      q.has('code') ? resolve(q.get('code')) : reject(new Error(`consent failed: ${q.get('error')}`));
    }),
  );
  const token = await exchange({ code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' });
  writeFileSync(TOKEN, JSON.stringify(token, null, 2), { mode: 0o600 });
  return token.access_token;
}

async function accessToken() {
  const refresh = existsSync(TOKEN) && JSON.parse(readFileSync(TOKEN, 'utf8')).refresh_token;
  if (!refresh) return consent();
  return (await exchange({ refresh_token: refresh, grant_type: 'refresh_token' })).access_token;
}

const res = await fetch(`https://chromewebstore.googleapis.com/v2/publishers/${PUBLISHER}/items/${ITEM}:fetchStatus`, {
  headers: { authorization: `Bearer ${await accessToken()}` },
});
const body = await res.text();
if (!res.ok) {
  console.error(`fetchStatus failed: ${res.status} ${body}`);
  process.exit(1);
}
if (process.argv.includes('--json')) {
  console.log(body);
} else {
  const s = JSON.parse(body);
  const rev = (r) => `${r?.state ?? 'none'} [${(r?.distributionChannels ?? []).map((c) => `${c.crxVersion}@${c.deployPercentage}%`).join(', ')}]`;
  console.log(
    `submitted: ${rev(s.submittedItemRevisionStatus)} | published: ${rev(s.publishedItemRevisionStatus)} | takenDown: ${!!s.takenDown} | warned: ${!!s.warned}`,
  );
}
