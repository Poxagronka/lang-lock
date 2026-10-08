import js from '@eslint/js';
import globals from 'globals';

const browser = { ...globals.browser, ...globals.serviceworker, ...globals.webextensions };

export default [
  { ignores: ['research/', 'dist/', 'node_modules/'] },
  js.configs.recommended,
  { files: ['extension/**/*.js'], languageOptions: { sourceType: 'script', globals: { ...browser, module: 'readonly' } } },
  // Globals that lib.js and rules.js define for the scripts loaded after them.
  { files: ['extension/{background,content,rules}.js'], languageOptions: { globals: { LangLock: 'readonly' } } },
  { files: ['extension/content.js'], languageOptions: { globals: { siteRule: 'readonly' } } },
  { files: ['test/**/*.js'], languageOptions: { sourceType: 'commonjs', globals: globals.node } },
  // Scripts also hold functions that run inside the page or the service worker.
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...browser } } },
];
