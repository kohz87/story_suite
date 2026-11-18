// NPC State holds a person still while they are away (Story Director's `director.away`, read only): no meter drift and no count toward
// losing a stage at the tick, and their stable profile fields held as if locked for one automatic scan's merge (nothing of that is stored).

import { storyMinuteText } from '../legacy/calendar.js';
import { labelKey } from '../dossier/cast-dossier-parts/shared-text.js';
import { entryLabels, findAwayEntry, isAwayEntry, normalizeAwayAnswer } from './away-read.js';

const AWAY_QUERY = 'director.away';
/** The stable profile fields and the custom fields a scan leaves alone while someone is away (as if locked). */
const HELD_FIELDS = Object.freeze(['personality', 'speech', 'appearance', 'mannerisms', 'behaviorProfile', 'background', 'customFields']);

/**
 * What the tick reads (`ctx`: a command's, with `query`): `{ people, awayDay, held }` — the cleaned answer (null without the query), the story day
 * a person (by their names) went away on (null when not away or not known), and whether any of a record's names is away now.
 */
export function awayAtTick(ctx) {
    let people = null;
    let raw = null;
    try {
        let calendar = null;
        try { calendar = ctx.query('director.calendar', {}); } catch { calendar = null; }
        raw = ctx.query(AWAY_QUERY, {});
        people = Array.isArray(raw) ? normalizeAwayAnswer(raw, minutes => storyMinuteText(minutes, calendar)) : null;
    } catch { people = null; }
    const awayKeys = new Set();
    for (const entry of people ?? []) if (isAwayEntry(entry)) for (const label of entryLabels(entry)) awayKeys.add(label);
    const awayDay = names => {
        const mine = new Set(names.map(labelKey).filter(Boolean));
        const gone = (Array.isArray(raw) ? raw : []).find(person => person?.away && typeof person.away === 'object' && !person.removed && [person.name, ...(Array.isArray(person.aliases) ? person.aliases : [])].some(name => mine.has(labelKey(name))));
        return Number.isSafeInteger(gone?.away?.since) ? Math.floor(gone.away.since / 1440) : null;
    };
    return { people, awayDay, held: names => awayKeys.size > 0 && names.some(name => awayKeys.has(labelKey(name))) };
}

/** The ids of the dossiers of people away now. */
export function awayDossierIds(list, npcs) {
    const ids = new Set();
    for (const npc of Array.isArray(npcs) ? npcs : []) if (npc?.id && isAwayEntry(findAwayEntry(list, npc))) ids.add(String(npc.id));
    return ids;
}

/**
 * The state with the away people's stable fields locked, for one scan's merge: { state, restore(npcs) } — `restore` puts each locked
 * dossier's own lock list back. Null when nobody is away (the merge then runs on the state itself).
 */
export function holdAwayDossiers(state, ids) {
    const away = new Set(Array.isArray(ids) ? ids.map(String) : ids instanceof Set ? ids : []);
    if (!away.size || !Array.isArray(state?.npcs)) return null;
    const saved = new Map();
    const npcs = state.npcs.map(npc => {
        const id = npc?.id ? String(npc.id) : '';
        if (!id || !away.has(id)) return npc;
        const own = Array.isArray(npc.manualProfileFields) ? [...npc.manualProfileFields] : [];
        saved.set(id, own);
        return { ...npc, manualProfileFields: [...new Set([...own, ...HELD_FIELDS])] };
    });
    if (!saved.size) return null;
    return {
        state: { ...state, npcs },
        restore: list => (Array.isArray(list) ? list : []).map(npc => {
            const own = saved.get(npc?.id ? String(npc.id) : '');
            return own ? { ...npc, manualProfileFields: [...own] } : npc;
        }),
    };
}
