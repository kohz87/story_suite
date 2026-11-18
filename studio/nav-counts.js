// What the nav and a page's head say about each part (mocks MK-2, MK-6, MK-7): a part's count, or its problems in the danger red
// ("✕ 2") or its warnings ("! 1"); Problems as "errors · warnings"; Pairing "—" while it cannot be checked; and the page's line of
// counts in words ("320 places · 352 routes"), not content keys.

const NOUNS = {
    lore: ['entry', 'entries'], cast: ['person', 'people'], places: ['place', 'places'], routes: ['route', 'routes'], regions: ['region', 'regions'], realms: ['realm', 'realms'],
    markets: ['market', 'markets'], conditions: ['condition', 'conditions'], worldEvents: ['world event', 'world events'], events: ['legacy event', 'legacy events'],
    templates: ['template', 'templates'], powers: ['power', 'powers'], scores: ['score', 'scores'], items: ['item', 'items'], foes: ['foe', 'foes'],
    meterPresets: ['meter preset', 'meter presets'], dataModules: ['data module', 'data modules'],
};
const QUIET = new Set(['start', 'overview', 'timeline']); // parts whose row shows no number
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
// What a game part's object counts (the mock's nav: Calendar 12 months, Money its coins, Weather its tables, Names its cultures).
const ITEMS = {
    calendar: value => (Array.isArray(value?.months) ? value.months.length : null),
    currency: value => (Array.isArray(value?.coins) ? value.coins.length : null),
    weather: value => (Array.isArray(value?.tables) ? value.tables.length : null),
    names: value => Object.keys(value).filter(key => key !== 'banned').length,
};

// A part's number: its lists' records and its counted objects; null when it holds neither (Rules, a game's Start).
function countOf(part) {
    const counts = (part.sections ?? []).map(section => (Array.isArray(section.value) ? section.value.length : isObj(section.value) && ITEMS[section.key] ? ITEMS[section.key](section.value) : null)).filter(n => n !== null);
    if (counts.length) return counts.reduce((sum, n) => sum + n, 0);
    return (part.sections ?? []).length && part.sections.every(section => section.absent) ? 0 : null;
}

/** What a part holds in words, lists only ("320 places · 352 routes"); '' when it holds no list. */
export function countWords(part) {
    return part.always ? '' : (part.sections ?? []).filter(section => !section.absent && NOUNS[section.key] && Array.isArray(section.value))
        .map(section => `${section.count} ${NOUNS[section.key][section.count === 1 ? 0 : 1]}`).join(' · ');
}

/** A part's page line: its description, then what it holds in words. */
export function partLine(part) {
    const counts = countWords(part);
    return counts ? `${part.desc}. ${counts}` : part.desc;
}

const said = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * Each nav row's badge: part id → `{ text, bad, title }`. `packs`: `{ world, game }` (the open sessions, each with `check` and
 * `legacy`), `active`: the kind the shared parts (Overview, Other, Problems) belong to; `titleOf(pack)` names a pack.
 */
export function navBadges(parts, packs, active, titleOf = pack => pack.name, pairOf = null) {
    const out = {};
    for (const part of parts) {
        const pack = part.kind ? packs[part.kind] : packs[active];
        const check = pack?.check;
        if (!check || QUIET.has(part.id)) continue;
        const n = part.sections ? countOf(part) : null;
        const plain = n === null ? undefined : { text: String(n), bad: false, title: null };
        if (pack.legacy) { if (!part.page && part.id !== 'problems' && plain) out[part.id] = plain; continue; } // not checked
        if (part.id === 'problems') {
            const e = check.errors.length, w = check.warnings.length;
            out[part.id] = e ? { text: w ? `${e} · ${w}` : String(e), bad: true, title: `${said(e, 'problem')}${w ? `, ${said(w, 'warning')}` : ''}` }
                : { text: w ? `! ${w}` : '0', bad: false, title: w ? said(w, 'warning') : 'No problems' };
            continue;
        }
        if (part.id === 'pairing') {
            const blocked = [packs.world, packs.game].find(item => item?.check?.errors.length);
            const pair = blocked || packs.world?.legacy || packs.game?.legacy ? null : pairOf?.(packs.world?.doc, packs.game?.doc ?? null);
            if (blocked && !blocked.legacy) out[part.id] = { text: '—', bad: false, title: `Not checked: ${titleOf(blocked)} has problems` };
            else if (pair) out[part.id] = pair.errors ? { text: `✕ ${pair.errors}`, bad: true, title: said(pair.errors, 'problem') } : { text: pair.warnings ? `! ${pair.warnings}` : '0', bad: false, title: pair.warnings ? said(pair.warnings, 'warning') : 'The pair fits' };
            continue;
        }
        const mine = check.byPart?.[part.id] ?? [];
        const errors = mine.filter(problem => problem.level === 'error').length;
        const warnings = mine.length - errors;
        if (errors) out[part.id] = { text: `✕ ${errors}`, bad: true, title: said(errors, 'problem') };
        else if (warnings) out[part.id] = { text: `! ${warnings}`, bad: false, title: said(warnings, 'warning') };
        else if (plain) out[part.id] = plain;
    }
    return out;
}
