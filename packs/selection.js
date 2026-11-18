// The job: which installed packs a chat reads. Format 3 packs by their on/off switch (as before); format 4 packs by the selected world and the
// selected game, plus the trackers (data modules, meter presets) of every other game pack, which are offered in every chat (pack-format-4 D5).

const TRACKERS = ['dataModules', 'meterPresets'];
const views = new WeakMap();

/** A game pack that holds trackers and nothing else: always offered, never selected. */
export function isAddOn(pack) {
    if (pack?.kind !== 'game') return false;
    if (pack.currency || pack.economy || pack.calendar || pack.weather || pack.pacing || pack.start) return false;
    return Object.entries(pack.content ?? {}).every(([key, value]) => TRACKERS.includes(key) || (Array.isArray(value) && value.length === 0));
}

// The pack as far as its trackers go: no money, calendar, weather, start or other content, so a game that is not the selected one adds nothing but trackers.
function trackersOf(pack) {
    if (!views.has(pack)) {
        const kept = TRACKERS.filter(key => Array.isArray(pack.content?.[key]) && pack.content[key].length);
        views.set(pack, kept.length ? Object.freeze({
            id: pack.id, ...(pack.format !== undefined ? { format: pack.format } : {}), kind: pack.kind, version: pack.version, name: pack.name, author: pack.author, description: pack.description, requires: pack.requires,
            currency: null, economy: null, calendar: null, content: { items: [], events: [], ...Object.fromEntries(kept.map(key => [key, pack.content[key]])) }, start: null, layouts: [], screens: [], theme: {},
        }) : null);
    }
    return views.get(pack);
}

/**
 * The packs a chat reads, in order: the enabled format 3 packs (list order), the selected world, the selected game, then the trackers of every other game pack.
 * `valid`: `[{ entry, pack }]` for the installed packs that check, in list order. `selected`: `{ world, game }` ids or null. An add-on cannot be the selected game.
 */
export function readPacks(valid, selected) {
    const pick = kind => valid.find(({ pack }) => pack.kind === kind && pack.id === selected?.[kind] && !isAddOn(pack))?.pack ?? null;
    const world = pick('world');
    const game = pick('game');
    return [
        ...valid.filter(({ entry, pack }) => !pack.kind && entry.enabled !== false).map(({ pack }) => pack),
        ...(world ? [world] : []),
        ...(game ? [game] : []),
        ...valid.filter(({ pack }) => pack.kind === 'game' && pack !== game).map(({ pack }) => trackersOf(pack)).filter(Boolean),
    ];
}
