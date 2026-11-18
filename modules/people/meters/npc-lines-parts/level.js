// The Level a `~ npc` line may state outright (`~ npc Mira | level: 5`), only while the RPG feature is on and lines mode is on (labels.js reads the label then).
// It is stored on the person's built-in `level` (people.fields writes it, in the reply's change set). A line never lowers a level.
// Reads the dossier the reply sees (reply-pinned), so a swipe, a Re-read and a replay agree.
import { clean } from '../npc-meters-config.js';
import { normalizeLevel } from '../../core/core-record-parts/built-in-fields.js';
import { storedLevel } from '../../core/core-record-parts/stored-level.js';

const WHOLE = /^\d{1,3}$/;

/** → { set: { level? }, problems }; `held`: the dossier record; the number is 1 to 99, as the RPG reader takes a stated Level. */
export function levelField(fields, held) {
    if (fields.level === undefined) return { set: {}, problems: [] };
    const text = clean(fields.level, 40);
    const value = WHOLE.test(text) ? normalizeLevel(text) : null;
    if (value === null) return { set: {}, problems: [`level: "${text}" is not a whole number from 1 to 99; not used.`] };
    const now = storedLevel(held);
    if (now === null || value > now) return { set: { level: String(value) }, problems: [] };
    return { set: {}, problems: value < now ? [`level is already ${now}; a line never lowers it.`] : [] };
}
