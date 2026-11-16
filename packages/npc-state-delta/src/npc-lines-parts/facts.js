// The facts a `~ npc` line may state outright: gender, age and birthday. Written once: a fact the dossier already holds is never replaced by a line.
import { clean } from '../npc-meters-config.js';
import { normalizeGender, normalizeAge } from '../../core-identity.js';
import { formatBirthDate, normalizeBirthDate } from '../../birthday.js';

// The dossier keys that already hold each fact (NPC State keeps a birthday as birthDate, an age as age or apparentAge).
const HELD = Object.freeze({ gender: ['gender'], age: ['age', 'apparentAge'], birthday: ['birthDate', 'birthDateDisplay', 'birthday'] });
const MAX = Object.freeze({ gender: 40, age: 40, birthday: 40 });
export const unknownWord = text => /^(unknown|none|n\/a|unspecified|not stated)\.?$/i.test(String(text ?? '').trim());

// Each fact is stored the way NPC State's own readers keep it: gender as male or female, age as a number (or the grounded wording a story gave; a look such as
// "young" is no story age), a birthday as the active calendar's date text when it reads one. What a reader cannot take is a problem and nothing is stored.
const READ = Object.freeze({
    gender: text => normalizeGender(text) || null,
    age: text => normalizeAge(text) || null,
    birthday: text => (normalizeBirthDate(text) ? formatBirthDate(text) : text) || null,   // (a date the active calendar cannot read stays as the story wrote it: Story Director's calendar is not this module's)
});
const NOT = Object.freeze({ gender: 'is not male or female', age: 'is not a story age', birthday: 'is not a date' });

/** → { set: { gender?, age?, birthday? }, problems }; `held`: the dossier record's own values; `read`: true (lines mode) reads each fact as above, off keeps the line's text as written (as on main). */
export function factFields(fields, held, read = true) {
    const set = {};
    const problems = [];
    for (const name of ['gender', 'age', 'birthday']) {
        if (fields[name] === undefined) continue;
        const text = clean(fields[name], MAX[name]);
        if (!text || unknownWord(text)) problems.push(`${name}: "${clean(fields[name], 40)}" says nothing; not used.`);
        else if (HELD[name].some(key => String(held?.[key] ?? '').trim())) problems.push(`${name} is already set for this person; a line does not change it.`);
        else if (!read) set[name] = text;
        else if (READ[name](text) === null) problems.push(`${name}: "${clean(fields[name], 40)}" ${NOT[name]}; not used${name === 'gender' ? ' (gender stays not stated)' : ''}.`);
        else set[name] = READ[name](text);
    }
    return { set, problems };
}
