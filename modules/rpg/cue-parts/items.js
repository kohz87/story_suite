// Words one item use as a sentence.

import { recoveryWords } from './words.js';

const EATEN = /\b(?:rations?|food|bread)\b/iu;
/** One item use as a sentence: "Astra drinks the Healing Draught (+3 health)", "Astra gives Ren the Healing Draught (+3 health)", "(already full)" when nothing moved. */
export function itemLineText({ who, target, item, pool, gained }) {
    const act = target === who ? `${EATEN.test(item) ? 'eats' : 'drinks'} the ${item}` : `gives ${target} the ${item}`;
    return `${who} ${act} (${gained > 0 ? recoveryWords(pool, gained) : 'already full'})`;
}
