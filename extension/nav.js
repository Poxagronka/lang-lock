// MAIN world, document_start. The service worker's DNR rule appends
// `Server-Timing: langlock;desc="<tags>"` to every document response, so the
// language is known synchronously here, before any page script runs.
(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const entry = nav && nav.serverTiming.find((t) => t.name === 'langlock');
  if (!entry) return;
  const languages = Object.freeze(entry.description.split(','));
  const proto = Navigator.prototype;
  Object.defineProperty(proto, 'language', { get: () => languages[0], configurable: true });
  Object.defineProperty(proto, 'languages', { get: () => languages, configurable: true });
})();
