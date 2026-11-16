// What the knows show: the redacted fact, the dossier rows and the prompt tail lines.
import { KNOWS_TAIL_PER_NPC, KNOWS_TAIL_MAX } from './shared-marks.js';
import { clean } from './shared-clean.js';
import { listOf } from './read.js';

const SECRET_TAIL_NOTE = 'never reveal it unless the story shows them telling.';

/**
 * The fact as the player sees it: a secret that is not opened reads "a secret about <who> · hidden"; `show` (the owner's
 * editor, or a caller that already decided the reader may see it) gives the fact itself.
 */
export function knowFact(entry, show = false) {
    if (!entry.secret || show) return entry.fact;
    return `a secret about ${entry.about} · hidden`;
}

/**
 * Dossier rows for a record's knows, newest first: { about, how, day, secret, hidden, text }. `hidden` is true for a secret that is
 * not shown, and then `text` is the redacted words (the fact itself is never in the row). `source` is the stored text or entries.
 */
export function knowsView(source, { show = false } = {}) {
    return listOf(source).reverse().map(entry => ({
        about: entry.about,
        how: entry.how,
        day: entry.day,
        secret: Boolean(entry.secret),
        hidden: Boolean(entry.secret) && !show,
        text: knowFact(entry, show),
    }));
}

/**
 * The tail lines for the people who are present (`people`: [{ name, knows }], the caller filters to present, and `knows` is the
 * stored text or entries of that person's own record). Per person at most KNOWS_TAIL_PER_NPC line, the newest secret first, else the
 * newest fact; at most KNOWS_TAIL_MAX lines in all, in the order given. A secret goes in as a hidden line (the knower is the only
 * carrier of it; it is never put in another person's line). The lines are optional for the host's budget. → string[].
 */
export function knowsTail(people) {
    const lines = [];
    for (const person of Array.isArray(people) ? people : []) {
        if (lines.length >= KNOWS_TAIL_MAX) break;
        const name = clean(person?.name, 60);
        if (!name) continue;
        const list = listOf(person.knows).reverse();
        const pick = list.find(entry => entry.secret) ?? list[0];
        if (!pick) continue;
        const about = `${pick.about}'s ${pick.fact}`;
        lines.push(pick.secret ? `${name} (hidden): knows ${about}; ${SECRET_TAIL_NOTE}` : `${name} knows: ${about}`);
    }
    return lines.slice(0, KNOWS_TAIL_MAX);
}
