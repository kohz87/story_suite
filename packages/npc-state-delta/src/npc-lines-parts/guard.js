// What a `~ npc` line may not write: a field the reader locked in the dossier, and, once the person has died, the fields a death freezes.
// Reads the dossier the reply sees (ctx.read('people'), reply-pinned), so a swipe, a Re-read and a replay decide the same way.
import { lockedFieldKeys } from '../dossier-edit.js';
import { TERMINAL_FROZEN_FIELDS } from '../fields/registry.js';
import { normalizeGender } from '../../core-identity.js';

const LINE_NAME = Object.freeze({ location: 'where', appearance: 'look' });
// P6: once a person has died a STATED gender no longer changes; one never stated may still be filled in once (the reader can always edit it by hand).

/** → { set, problems }: `set` without the dropped fields (keys are the dossier's own: goal, status, location, appearance, gender, age, birthday). */
export function guardFields(set, dossier, name) {
    const out = {};
    const problems = [];
    const locks = new Set((Array.isArray(dossier?.manualProfileFields) ? dossier.manualProfileFields : []).flatMap(field => [field, ...lockedFieldKeys(field)]));
    const dead = dossier?.lifeState === 'deceased';
    const stated = normalizeGender(dossier?.gender) !== '';
    const frozen = new Set(stated ? [...TERMINAL_FROZEN_FIELDS, 'gender'] : TERMINAL_FROZEN_FIELDS);
    for (const [key, value] of Object.entries(set)) {
        const label = LINE_NAME[key] ?? key;
        if (locks.has(key) || (key === 'birthday' && locks.has('birthDate')) || (key === 'age' && locks.has('apparentAge'))) problems.push(`${label} is locked by you; not changed.`);
        else if (dead && frozen.has(key)) problems.push(`${name} has died; ${label} is not changed.`);
        else out[key] = key === 'gender' ? normalizeGender(value) || value : value;   // (stored as male or female when the words read as one; facts.js keeps the line's text as on main when lines mode is off)
    }
    return { set: out, problems };
}
