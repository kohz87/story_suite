// The Abilities and Keepsakes a `~ npc` line may write (always on, lines mode only): `learns: <ability> — <one line>`, `keepsake: + <name> — <one line>`, `keepsake: - <name>`.
// They become one `people.fields` write (`learns`, `keepsake` as short text; the people domain applies the list rules). Reads the dossier the reply sees, so a swipe,
// a Re-read and a replay agree. A name is cut at 60 characters and a description at 200; a full list refuses the new entry with a note.
import { clean } from '../npc-meters-config.js';
import { BUILT_IN_LIMITS, normalizeStoryList } from '../../core/core-record-parts/built-in-fields.js';

const pairOf = text => normalizeStoryList([clean(text, 400)], 1)[0] ?? null;
const has = (list, name) => (Array.isArray(list) ? list : []).some(entry => String(entry?.name ?? '').toLowerCase() === name.toLowerCase());

/** → { set: { learns?, keepsake? }, problems }; `held`: the dossier record. `learns` is "Name — description"; `keepsake` is "+ Name — description" or "- Name". */
export function abilityFields(fields, held) {
    const set = {};
    const problems = [];
    if (fields.learns !== undefined) {
        const pair = pairOf(fields.learns);
        if (!pair) problems.push(`learns: "${clean(fields.learns, 40)}" names no ability; not used.`);
        else if (has(held?.abilities, pair.name)) problems.push(`${pair.name} is already one of their abilities; not added again.`);
        else if ((Array.isArray(held?.abilities) ? held.abilities.length : 0) >= BUILT_IN_LIMITS.abilities) problems.push(`They already have ${BUILT_IN_LIMITS.abilities} abilities; "${pair.name}" not added.`);
        else set.learns = pair.description ? `${pair.name} — ${pair.description}` : pair.name;
    }
    if (fields.keepsake !== undefined) {
        const text = clean(fields.keepsake, 400);
        const sign = text[0];
        const pair = sign === '+' || sign === '-' ? pairOf(text.slice(1).trim()) : null;
        if (!pair) problems.push(`keepsake: "${clean(fields.keepsake, 40)}" is not "+ name — one line" or "- name"; not used.`);
        else if (sign === '+') {
            if (has(held?.keepsakes, pair.name)) problems.push(`${pair.name} is already one of their keepsakes; not added again.`);
            else if ((Array.isArray(held?.keepsakes) ? held.keepsakes.length : 0) >= BUILT_IN_LIMITS.keepsakes) problems.push(`They already have ${BUILT_IN_LIMITS.keepsakes} keepsakes; "${pair.name}" not added.`);
            else set.keepsake = pair.description ? `+ ${pair.name} — ${pair.description}` : `+ ${pair.name}`;
        } else if (!has(held?.keepsakes, pair.name)) problems.push(`${pair.name} is not one of their keepsakes; nothing removed.`);
        else set.keepsake = `- ${pair.name}`;
    }
    return { set, problems };
}
