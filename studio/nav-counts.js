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

/** A part's page line: its description, then what it holds in words (lists only: "320 places · 352 routes"). */
export function partLine(part) {
    const counts = part.always ? [] : part.sections.filter(section => !section.absent && NOUNS[section.key] && Array.isArray(section.value))
        .map(section => `${section.count} ${NOUNS[section.key][section.count === 1 ? 0 : 1]}`);
    return counts.length ? `${part.desc}. ${counts.join(' · ')}` : part.desc;
}

const said = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

/**
 * Each nav row's badge: part id → `{ text, bad, title }`. `packs`: `{ world, game }` (the open sessions, each with `check` and
 * `legacy`), `active`: the kind the shared parts (Overview, Other, Problems) belong to; `titleOf(pack)` names a pack.
 */
export function navBadges(parts, packs, active, titleOf = pack => pack.name) {
    const out = {};
    for (const part of parts) {
        const pack = part.kind ? packs[part.kind] : packs[active];
        const check = pack?.check;
        if (!check || QUIET.has(part.id)) continue;
        if (pack.legacy) { if (!part.page && part.id !== 'problems') out[part.id] = { text: String(part.count ?? 0), bad: false, title: null }; continue; } // not checked
        if (part.id === 'problems') {
            const e = check.errors.length, w = check.warnings.length;
            out[part.id] = e ? { text: w ? `${e} · ${w}` : String(e), bad: true, title: `${said(e, 'problem')}${w ? `, ${said(w, 'warning')}` : ''}` }
                : { text: w ? `! ${w}` : '0', bad: false, title: w ? said(w, 'warning') : 'No problems' };
            continue;
        }
        if (part.id === 'pairing') {
            const blocked = [packs.world, packs.game].find(item => item?.check?.errors.length);
            if (blocked && !blocked.legacy) out[part.id] = { text: '—', bad: false, title: `Not checked: ${titleOf(blocked)} has problems` };
            continue;
        }
        const mine = check.byPart?.[part.id] ?? [];
        const errors = mine.filter(problem => problem.level === 'error').length;
        const warnings = mine.length - errors;
        if (errors) out[part.id] = { text: `✕ ${errors}`, bad: true, title: said(errors, 'problem') };
        else if (warnings) out[part.id] = { text: `! ${warnings}`, bad: false, title: said(warnings, 'warning') };
        else out[part.id] = { text: String(part.count ?? 0), bad: false, title: null };
    }
    return out;
}
