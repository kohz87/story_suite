// This device's folded Settings cards, kept in localStorage so a reload opens them folded again. Only the `settings.fold.*` keys are
// kept here; the view's other folds stay as they were (for this session).

const STORAGE_KEY = 'storySuite.ui.settingsFolds';
const PREFIX = 'settings.fold.';
const deviceStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

function read(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.fromEntries(Object.entries(parsed).filter(([k, v]) => k.startsWith(PREFIX) && v === true)) : {};
  } catch { return {}; }
}

/** The port's device prefs store ({ get() → { key: true }, set(key, folded) }) over `storage` (localStorage); without storage it keeps nothing. */
export function settingsFolds(storage = deviceStorage()) {
  return {
    get: () => read(storage),
    set(key, folded) {
      if (typeof key !== 'string' || !key.startsWith(PREFIX)) return;
      const next = read(storage);
      if (folded) next[key] = true; else delete next[key];
      try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode or a full quota: the fold lasts this session */ }
    },
  };
}
