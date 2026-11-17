// A small note the Settings view keeps in the saved settings (`storySuite.notes`): what a card's module switch turned off, so turning it on puts it back.

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** → { keep(key, value), kept(key) → value | null } over `root()` (SillyTavern's extension settings); `save` is saveSettingsDebounced. No schema: the settings page and the goldens never see it. */
export function createCardNotes({ root, save = () => {} }) {
    const notes = (make) => {
        const es = root?.();
        if (!isObject(es)) return null;
        if (!isObject(es.storySuite)) { if (!make) return null; es.storySuite = {}; }
        if (!isObject(es.storySuite.notes)) { if (!make) return null; es.storySuite.notes = {}; }
        return es.storySuite.notes;
    };
    return {
        keep(key, value) { const n = notes(true); if (n) { n[String(key)] = structuredClone(value); save(); } },
        kept(key) { const v = notes(false)?.[String(key)]; return v === undefined ? null : structuredClone(v); },
    };
}
