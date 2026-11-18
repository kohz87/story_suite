// The Studio's parts: their order, names and nav groups, which content key each part shows, and which part a checker problem's path
// belongs to.
//
// Which keys a pack may hold is the game's (packs/limits-parts/kinds.js): a format 4 pack shows the `CONTENT_KEYS` of its `kind`
// in the parts below and anything else under Other. A format 3 pack (no `kind`) opens read-only: the world parts show what they
// group, and the rest (rules, calendar, money and the like) shows under Other as written. Pages that are not one key (`page`) are
// mounted by app.js through views/route.js.

import { CONTENT_KEYS, PACK_FIELDS_V4 } from '../packs/limits-parts/kinds.js';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// `kind`: whose part it is (null: every pack's, drawn for the active pack). `keys`: the content keys it groups, in order.
export const PARTS = Object.freeze([
    { id: 'overview', name: 'Overview', group: 'Pack', icon: '◎', desc: 'Name, version and what it needs', kind: null, keys: [], always: true },
    { id: 'lore', name: 'Lore', group: 'World', icon: '✎', desc: 'Entries, keys, hidden and protected', kind: 'world', keys: ['lore'] },
    { id: 'cast', name: 'Cast', group: 'World', icon: '♥', desc: 'People NPC State starts from', kind: 'world', keys: ['cast'] },
    { id: 'map', name: 'Places & routes', group: 'World', icon: '◍', desc: 'Places, routes, regions, realms', kind: 'world', keys: ['places', 'routes', 'regions', 'realms', 'placeKinds', 'routeKinds', 'markets'] },
    { id: 'conditions', name: 'Conditions', group: 'World', icon: '◐', desc: 'World states and the starting world', kind: 'world', keys: ['conditions', 'start'] },
    { id: 'events', name: 'Events', group: 'World', icon: '✦', desc: 'World events and legacy dated events', kind: 'world', keys: ['worldEvents', 'events'] },
    { id: 'templates', name: 'Templates', group: 'World', icon: '❖', desc: 'Kinds of small happening', kind: 'world', keys: ['templates'] },
    { id: 'powers', name: 'Powers & scores', group: 'World', icon: '⚖', desc: 'Factions, rulers and world meters', kind: 'world', keys: ['powers', 'scores'] },
    { id: 'items', name: 'Items & foes', group: 'World', icon: '▣', desc: 'Named items and the bestiary', kind: 'world', keys: ['items', 'foes'] },
    { id: 'calendar', name: 'Calendar', group: 'Game', icon: '◷', desc: 'Months, weeks, seasons and holidays', kind: 'game', keys: ['calendar'] },
    { id: 'money', name: 'Money', group: 'Game', icon: '¤', desc: 'Coins and the price scale', kind: 'game', keys: ['currency', 'economy'] },
    { id: 'weather', name: 'Weather', group: 'Game', icon: '☁', desc: 'How the weather is drawn', kind: 'game', keys: ['weather'] },
    { id: 'names', name: 'Names', group: 'Game', icon: '✐', desc: 'Name cultures', kind: 'game', keys: ['names'] },
    { id: 'rules', name: 'Rules', group: 'Game', icon: '⚔', desc: 'Rank, levels and the pace', kind: 'game', keys: ['you', 'rpg', 'pacing'] },
    { id: 'trackers', name: 'Trackers', group: 'Game', icon: '▤', desc: 'Meter presets and data modules', kind: 'game', keys: ['meterPresets', 'dataModules'] },
    { id: 'game-start', name: 'Start', group: 'Game', icon: '➤', desc: 'What the player starts with', kind: 'game', keys: ['start'] },
    { id: 'other', name: 'Other', group: 'Pack', icon: '⚙', desc: 'Anything else the pack holds, as written', kind: null, keys: [], rest: true },
    { id: 'timeline', name: 'Dry run', group: 'Check', icon: '▶', desc: 'Run the world for some days', kind: 'world', keys: [], page: 'timeline' },
    { id: 'pairing', name: 'Pairing', group: 'Check', icon: '⇄', desc: 'The world against a game', kind: 'world', keys: [], page: 'pairing' },
    { id: 'problems', name: 'Problems', group: 'Check', icon: '⚠', desc: 'What the pack checker says', kind: null, keys: [], always: true },
]);

// The Overview fields: the format 4 top-level fields bar `content` (a format 3 pack's other top-level fields show under Other).
const OVERVIEW_TOP = PACK_FIELDS_V4.filter(key => key !== 'content');
// key → part id, per kind. `legacy` (format 3) groups by the world parts, plus the legacy dated events.
const GROUPING = {
    world: new Map(PARTS.filter(part => part.kind === 'world').flatMap(part => part.keys.filter(key => CONTENT_KEYS.world.includes(key)).map(key => [key, part.id]))),
    game: new Map(PARTS.filter(part => part.kind === 'game').flatMap(part => part.keys.filter(key => CONTENT_KEYS.game.includes(key)).map(key => [key, part.id]))),
    legacy: new Map(PARTS.filter(part => part.kind === 'world').flatMap(part => part.keys.map(key => [key, part.id]))),
};

/**
 * How the Studio holds a parsed pack: `{ kind: 'world'|'game', legacy }`. `legacy` is a pack below format 4 (or with no format),
 * which opens read-only in the world slot. A format 4 pack whose `kind` is not "game" goes to the world slot; the checker says why.
 */
export function kindOf(doc) {
    const legacy = !isObject(doc) || typeof doc.format !== 'number' || doc.format < 4;
    return { kind: !legacy && doc.kind === 'game' ? 'game' : 'world', legacy };
}

const count = value => (Array.isArray(value) ? value.length : (isObject(value) ? Object.keys(value).length : 1));

// What a format 4 pack's part shows when the pack holds none of its keys (a new pack): each key's empty value, which the first edit there
// writes (app.js puts it before that edit's patches); `undefined` is the editor's own "not set" card. A key left out here is not shown:
// the game's currency, rpg, pacing and dataModules have no empty value the checker takes, and the editors of regions, powers and items
// offer realms, scores and foes themselves; the editor of the part's other key offers each of them.
const EMPTY = {
    world: { lore: [], cast: [], places: [], routes: [], regions: [], placeKinds: {}, routeKinds: {}, markets: [], conditions: [], start: {},
        worldEvents: [], templates: [], powers: [], items: [] },
    game: { calendar: { months: [] }, economy: {}, weather: undefined, names: {}, you: {}, meterPresets: [], start: {} },
};

/**
 * The parts of a parsed pack (`doc`, or null): `[{ ...part, sections: [{ key, where, value, count, absent? }], count }]`, its kind's
 * parts and the shared ones. A format 4 pack's part it holds nothing of is still listed (count 0), its sections `absent` with each key's
 * empty value (EMPTY); a format 3 pack's, and Other with nothing in it, are left out unless `always` shown. Page parts are not included.
 */
export function partsOf(doc) {
    const { kind, legacy } = kindOf(doc);
    const grouping = GROUPING[legacy ? 'legacy' : kind];
    const content = isObject(doc?.content) ? doc.content : {};
    const top = isObject(doc) ? doc : {};
    const out = [];
    for (const part of PARTS) {
        if (part.page || (part.kind && part.kind !== kind)) continue;
        const sections = [];
        for (const key of part.keys) if (content[key] !== undefined && grouping.get(key) === part.id) sections.push({ key, where: 'content', value: content[key] });
        if (part.id === 'overview') for (const key of OVERVIEW_TOP) if (top[key] !== undefined) sections.push({ key, where: 'top', value: top[key] });
        if (part.rest) {
            for (const key of Object.keys(content)) if (!grouping.has(key)) sections.push({ key, where: 'content', value: content[key] });
            for (const key of Object.keys(top)) if (key !== 'content' && !OVERVIEW_TOP.includes(key)) sections.push({ key, where: 'top', value: top[key] });
        }
        const counted = sections.map(section => ({ ...section, count: count(section.value) }));
        if (!counted.length && !part.always && !legacy && part.kind === kind) {
            for (const key of part.keys) if (Object.hasOwn(EMPTY[kind], key) && grouping.get(key) === part.id) counted.push({ key, where: 'content', value: structuredClone(EMPTY[kind][key]), count: 0, absent: true });
        }
        if (!counted.length && !part.always) continue;
        out.push({ ...part, sections: counted, count: part.id === 'overview' ? 0 : counted.reduce((sum, section) => sum + section.count, 0) });
    }
    return out;
}

/**
 * The part a checker path belongs to, and the record in it, for a pack of `kind` ('world', 'game'; left out: format 3):
 * `content.cast[3].secrets[1]` → `{ part: 'cast', rec: 'cast.3' }`, `requires.suite` → `{ part: 'overview', rec: null }`.
 * A content key the kind does not hold, and a top-level field Overview does not show, go to Other.
 */
export function partOfPath(path, kind = 'legacy') {
    const grouping = GROUPING[kind] ?? GROUPING.legacy;
    const text = String(path ?? '');
    const key = /^content\.([A-Za-z]+)(?:\[(\d+)\])?/.exec(text);
    if (key) return { part: grouping.get(key[1]) ?? 'other', rec: key[2] !== undefined ? `${key[1]}.${key[2]}` : null };
    const top = /^([A-Za-z]+)/.exec(text);
    return { part: top && top[1] !== 'content' && !OVERVIEW_TOP.includes(top[1]) ? 'other' : 'overview', rec: null };
}
