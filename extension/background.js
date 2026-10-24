importScripts('lib.js');

const ALL_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest',
  'ping', 'csp_report', 'media', 'websocket', 'webtransport', 'webbundle', 'other',
];
const REDIRECT_PAUSE_MS = 15000; // A tab that we just redirected is never redirected again within this window.

async function getLang() {
  const { lang } = await chrome.storage.sync.get('lang');
  return lang || 'en';
}

// Rule 1 sets Accept-Language on every request. Rule 2 hands the language to the MAIN-world
// navigator override through a Server-Timing response header (read synchronously at document_start).
async function applyRules() {
  const lang = await getLang();
  const addRules = lang === 'off' ? [] : [
    {
      id: 1,
      priority: 1,
      condition: { resourceTypes: ALL_TYPES },
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'accept-language', operation: 'set', value: LangLock.acceptLanguage(lang) }],
      },
    },
    {
      id: 2,
      priority: 1,
      condition: { resourceTypes: ['main_frame', 'sub_frame'] },
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'server-timing', operation: 'append', value: `langlock;desc="${LangLock.languageList(lang).join(',')}"` },
        ],
      },
    },
  ];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1, 2], addRules });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { lang } = await chrome.storage.sync.get('lang');
  if (!lang) await chrome.storage.sync.set({ lang: 'en' });
  await applyRules();
});
chrome.storage.onChanged.addListener((changes) => changes.lang && applyRules());

async function redirectTarget(tabId, candidates, from, token) {
  const key = `tab${tabId}`;
  const now = Date.now();
  const last = (await chrome.storage.session.get(key))[key];
  if (last && new URL(last.to).origin === new URL(from).origin && now - last.at < REDIRECT_PAUSE_MS) return null;
  const url = await LangLock.firstReachable(candidates, from, token);
  if (url) await chrome.storage.session.set({ [key]: { at: now, from, to: url } });
  return url;
}

// The page we redirected from, when this tab just landed on our redirect target.
async function undoTarget(tabId, url) {
  const last = (await chrome.storage.session.get(`tab${tabId}`))[`tab${tabId}`];
  return last && new URL(last.to).origin === new URL(url).origin && Date.now() - last.at < REDIRECT_PAUSE_MS ? last.from : null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!sender.tab) return false;
  if (msg.type === 'redirect') redirectTarget(sender.tab.id, msg.candidates, sender.url, msg.token).then(sendResponse);
  else if (msg.type === 'undo') undoTarget(sender.tab.id, sender.url).then(sendResponse);
  else return false;
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab${tabId}`));
