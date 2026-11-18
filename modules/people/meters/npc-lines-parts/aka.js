// The `aka:` label of a `~ npc` line (SOAKPEOPLE F3; lines mode only): another name the story uses for a listed person ("Old Wen"), kept as one of their aliases
// so a later line that uses it finds them (./names.js). Refused when the name says nothing, is already theirs, is someone else's name or alias, or they have
// ALIASES_MAX names already. Read from the people as this reply sees them (reply-pinned), so a swipe, a Re-read and a replay decide the same way.
import { labelKey } from '../../cast/key-people.js';
import { clean } from '../npc-meters-config.js';
import { unknownWord } from './facts.js';

export const AKA_MAX = 60;
export const ALIASES_MAX = 8;

const labelsOf = record => [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])].map(labelKey).filter(Boolean);

/** → { set: { aka? }, problems }. `key`: the person's id; `people`: the people records ({ [id]: record }) as the reply sees them. */
export function akaField(fields, { key, people }) {
    if (fields.aka === undefined) return { set: {}, problems: [] };
    const text = clean(fields.aka, AKA_MAX);
    const asked = labelKey(text);
    const own = people?.[key];
    const no = problem => ({ set: {}, problems: [`aka: ${problem}; not used.`] });
    if (!asked || unknownWord(text)) return no(`"${clean(fields.aka, 40)}" says nothing`);
    if (labelsOf(own).includes(asked)) return no(`${text} is already a name of theirs`);
    const other = Object.entries(people ?? {}).find(([id, record]) => id !== key && labelsOf(record).includes(asked));
    if (other) return no(`${text} is already ${clean(other[1]?.name, 40)}`);
    if ((Array.isArray(own?.aliases) ? own.aliases.length : 0) >= ALIASES_MAX) return no(`they have ${ALIASES_MAX} names already`);
    return { set: { aka: text }, problems: [] };
}
