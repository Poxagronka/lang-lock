const TAGS = [
  'en', 'en-GB', 'en-US', 'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'es', 'es-419', 'et', 'fa', 'fi', 'fil', 'fr',
  'he', 'hi', 'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'nb', 'nl', 'pl', 'pt-BR', 'pt-PT', 'ro', 'ru', 'sk',
  'sl', 'sr', 'sv', 'sw', 'ta', 'th', 'tr', 'uk', 'ur', 'vi', 'zh-CN', 'zh-TW', 'kk',
];
const names = new Intl.DisplayNames([chrome.i18n.getUILanguage()], { type: 'language' });
const select = document.getElementById('lang');
select.add(new Option('Off', 'off'));
TAGS.map((t) => [names.of(t), t])
  .sort(([a], [b]) => a.localeCompare(b))
  .forEach(([name, t]) => select.add(new Option(`${name} (${t})`, t)));
chrome.storage.sync.get('lang').then(({ lang }) => (select.value = lang || 'en'));
select.addEventListener('change', () => chrome.storage.sync.set({ lang: select.value }));
