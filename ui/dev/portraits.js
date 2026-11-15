// Dev harness only: shows the mock's portrait photos on elements carrying data-portrait; the letter circle stays the fallback.
const KNOWN = new Set(['astra', 'brann', 'rika', 'temiwa', 'torka']);

/** Applies the photos under `root` now and after every redraw; returns a stop function. */
export function usePortraits(root, MutationObserverClass = globalThis.MutationObserver) {
  let busy = false;
  const apply = () => {
    if (busy) return;
    busy = true;
    for (const el of root.querySelectorAll('[data-portrait]')) {
      const name = el.dataset.portrait;
      if (!KNOWN.has(name) || el.style.backgroundImage) continue;
      el.style.backgroundImage = `url("img/${name}.webp")`;
      el.textContent = '';
    }
    busy = false;
  };
  apply();
  const watcher = new MutationObserverClass(apply);
  watcher.observe(root, { childList: true, subtree: true });
  return () => watcher.disconnect();
}
