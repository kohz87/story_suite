// Tells whether the reader is the subject before an attack word, and whether their own weapon is.
import { WEAPON } from './attack-words.js';
import { namesCreature } from './phrasal.js';

// The reader as the subject just before an attack word: at clause start, after a comma or colon, or after as/when/while/once/then/so/and;
// up to two adverbs and will / try to / attempt to may sit between subject and verb. Also the reader's own weapon or body part ("my cane",
// "our bare fists"), a short prepositional lead-in with no comma ("Without a word I", "With the boar distracted I"), and a motion
// followed by a purpose ("I slip in from the shadows to"). A third party ("the boar", "my sister") is never the subject.

const ADVERB = String.raw`(?:\s+(?:\w+ly|then|quickly|finally|just|also))`;
const OWN = String.raw`(?:my|our)(?:\s+[\p{L}-]+)?\s+(?:${[...WEAPON].join('|')})s?`;
const SUBJECT = String.raw`(?:i|we|${OWN})${ADVERB}{0,2}(?:\s+(?:will|try to|attempt to)${ADVERB}{0,2})?`;
const LEAD = String.raw`^(?:without|with|after|before|upon|during|under|behind|through|using|keeping|holding|drawing|seeing)\b[^,:;]*?\s(?:i|we)${ADVERB}{0,2}`;
const PURPOSE = String.raw`^(?:i|we)\s+(?:slip|creep|sneak|move|step|dash|run|rush|head|go|ride|walk|crawl|stalk|circle|duck|edge|spring)\w*\b[^,;:]*?\s(?:in order )?to`;
export const READER_SUBJECT = new RegExp(String.raw`(?:(?:^|[,:]\s*|\b(?:as|when|while|once|then|so|and)\s+)${SUBJECT}|${LEAD}|${PURPOSE})$`, 'iu');

const OWN_END = new RegExp(String.raw`(?:^|\W)${OWN}${ADVERB}{0,2}$`, 'iu');
/** The reader's own weapon as the subject needs a creature (or a body part of one) after the verb, or an intransitive "lashes out". */
export function ownSubjectOk(before, clause, action) {
    if (!OWN_END.test(before)) return true;
    const rest = clause.slice(action.index);
    return /^lash/iu.test(rest) || namesCreature(rest.slice(action.length));
}
