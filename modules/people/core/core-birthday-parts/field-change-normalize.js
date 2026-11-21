/* NPC State normalizing the per-field change markers (turn, story day, reply index). */
import { migrateLegacyStoryDay, STORY_DAY_SCHEME } from '../../calendar/calendar.js';
import { CHANGE_TRACKED_FIELDS, DAY_TRACKED_FIELDS } from '../../fields/registry.js';

// Deterministic per-field "last changed at turn" markers for the dossier. They are presentation
// metadata on the canonical record (rolled back with it), never scanner input or prompt content.

export function normalizeFieldChanges(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = {};
    for (const field of CHANGE_TRACKED_FIELDS) {
        const turn = Number(source[field]);
        if (Number.isInteger(turn) && turn >= 0) out[field] = turn;
    }
    return out;
}

// Story-day counterparts of fieldChanges for the stable fields whose age Refresh checks; present
// only when the chat's World State carries a date.

export function normalizeFieldChangeDays(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const current = Number(source.scheme) === STORY_DAY_SCHEME;
    const out = {};
    for (const field of DAY_TRACKED_FIELDS) {
        const day = current ? Number(source[field]) : migrateLegacyStoryDay(source[field]);
        if (Number.isInteger(day)) out[field] = day;
    }
    if (Object.keys(out).length) out.scheme = STORY_DAY_SCHEME;
    return out;
}

// The fields only a story line stamps (DOSSFIX2 N2: domain/change-stamp.js): a reply index in fieldChangeMessages, so the dossier's last change moves, and
// no turn count or story day (fieldChanges and fieldChangeDays, which Refresh reads, stay as they were).
export const LINE_STAMPED_FIELDS = Object.freeze(['gender', 'level', 'abilities', 'keepsakes', 'aliases', 'knows']);

// Display-only counterpart of fieldChanges (1.2.3): the chat message index of the reply a change
// was recorded at, the numbering Story Block shows as "reply #N". fieldChanges keeps Delta's own
// turn counter, which recency and Refresh age rely on; a field without an entry predates 1.2.3.
export function normalizeFieldChangeMessages(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = {};
    for (const field of [...CHANGE_TRACKED_FIELDS, ...LINE_STAMPED_FIELDS]) {
        const message = Number(source[field]);
        if (Number.isInteger(message) && message >= 0) out[field] = message;
    }
    return out;
}
