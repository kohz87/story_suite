/* NPC State Delta dossier view-model part: small plain-word helpers: Her / His / Their and the gate receipt in the mockup's words. */
import { plain } from '../dossier-ui-model.js';

// "Her", "His" or "Their" (lower-case for a sentence) from the gender the dossier holds.
export function possessiveWord(gender = '', { lower = false } = {}) {
    const text = plain(gender).toLocaleLowerCase();
    const word = /^(?:f|she)|\b(?:female|woman|girl)\b/.test(text) ? 'Her' : (/^(?:m$|male|he\b)|\b(?:man|boy)\b/.test(text) ? 'His' : 'Their');
    return lower ? word.toLocaleLowerCase() : word;
}

// The gate's receipt ("via praise · 3rd in 2 days · backfired", built by npc-meters-gate.js and kept as it is) in the words the mockup uses:
// the board tile reads "praise, the 3rd time in 2 days, backfired", the Recent changes row "via praise: the 3rd time in 2 days, so it backfired".
// Text that does not parse is returned as it came.
const GATE_VERB = { backfired: 'it backfired', less: 'it landed less', suspicion: 'it read as pressure' };
export function gateWords(text, { row = false } = {}) {
    const match = /^via (.+?)(?: · (\d+(?:st|nd|rd|th)) in (\d+) (days?))? · (backfired|less|suspicion)$/.exec(plain(text));
    if (!match) return plain(text);
    const [, via, nth, span, unit, mode] = match;
    const times = nth ? `the ${nth} time in ${span} ${unit}` : '';
    if (row) return `via ${via}${times ? `: ${times}, so ${GATE_VERB[mode]}` : `: ${GATE_VERB[mode]}`}`;
    return [via, times, mode].filter(Boolean).join(', ');
}
