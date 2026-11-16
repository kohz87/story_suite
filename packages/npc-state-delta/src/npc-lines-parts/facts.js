// The facts a `~ npc` line may state outright: gender, age and birthday. Written once: a fact the dossier already holds is never replaced by a line.
import { clean } from '../npc-meters-config.js';

const MAX = Object.freeze({ gender: 40, age: 40, birthday: 40 });
export const unknownWord = text => /^(unknown|none|n\/a|unspecified|not stated)\.?$/i.test(String(text ?? '').trim());

/** → { set: { gender?, age?, birthday? }, problems }; `held`: the dossier record's own values. */
export function factFields(fields, held) {
    const set = {};
    const problems = [];
    for (const name of ['gender', 'age', 'birthday']) {
        if (fields[name] === undefined) continue;
        const text = clean(fields[name], MAX[name]);
        if (!text || unknownWord(text)) problems.push(`${name}: "${clean(fields[name], 40)}" says nothing; not used.`);
        else if (String(held?.[name] ?? '').trim()) problems.push(`${name} is already set for this person; a line does not change it.`);
        else set[name] = text;
    }
    return { set, problems };
}
