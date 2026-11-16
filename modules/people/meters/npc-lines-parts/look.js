// A `~ npc Name | look: …` line: the person's full current look in one sentence, replacing the stored look whole.
import { clean } from '../npc-meters-config.js';
import { unknownWord } from './facts.js';

export const LOOK_MAX = 300;

/** → { set: { appearance }, problems } (a look that says nothing, or "Unknown", is a problem and writes nothing). */
export function lookField(fields) {
    if (fields.look === undefined) return { set: {}, problems: [] };
    const text = clean(fields.look, LOOK_MAX);
    if (!text || unknownWord(text)) return { set: {}, problems: [`look: "${clean(fields.look, 40)}" says nothing; not used.`] };
    return { set: { appearance: text }, problems: [] };
}
