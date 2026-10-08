// Builds dist/lang-lock-<version>.zip from extension/ for the Chrome Web Store.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(`${root}extension/manifest.json`, 'utf8'));
const out = `${root}dist/lang-lock-${version}.zip`;
mkdirSync(`${root}dist`, { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-qrX', out, '.', '-x', '.*'], { cwd: `${root}extension` });
console.log(out);
