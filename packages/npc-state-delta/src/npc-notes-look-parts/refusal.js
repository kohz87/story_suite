// The refused-look wording: the drift text, the one-reply cue and the Problem key that dedupes it.
import { LOOK_TEXT_MAX, isObject, clean, lookText } from './shared-text.js';

const NAME_MAX = 40;
const REPLY_MAX = 80;
const FLAG_TEXT_MAX = 300;

const comparable = value => clean(value, LOOK_TEXT_MAX).toLocaleLowerCase().replace(/[.;,\s]+$/g, '');
const possessive = name => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/**
 * The drift the scan refused: `before` is the locked look, `rejected` the incoming durable text (a string, or { incoming }).
 * → '' when there is no lock, nothing incoming, or the same look (case, spacing and a closing full stop ignored).
 * Otherwise: `Look drift refused: "<rejected>" does not match the fixed look "<before>".`
 * (card traits win) With `rejected.swaps` ([{ trait, said, kept }], the traits a refine swapped and the record kept) and `name`:
 * `Look drift refused: the story called Temiwa's eyes pale; the record keeps brown.` (one clause pair per trait).
 */
export function lookDrift(before, rejected) {
    const locked = lookText(before);
    const incoming = lookText(isObject(rejected) ? rejected.incoming : rejected);
    const swaps = isObject(rejected) && Array.isArray(rejected.swaps) ? rejected.swaps.filter(swap => isObject(swap) && clean(swap.trait, 20) && clean(swap.said, 40) && clean(swap.kept, 40)) : [];
    if (!locked || !incoming || (!swaps.length && comparable(locked) === comparable(incoming))) return '';
    // A kept swap may sit past the capped text both looks share, so it is named whatever their first words.
    if (swaps.length) {
        const who = possessive(clean(rejected.name, NAME_MAX) || 'The NPC');
        return `Look drift refused: ${swaps.map((swap, index) => `${index ? 'The' : 'the'} story called ${who} ${clean(swap.trait, 20)} ${clean(swap.said, 40)}; the record keeps ${clean(swap.kept, 40)}`).join('. ')}.`;
    }
    return `Look drift refused: "${incoming}" does not match the fixed look "${locked}".`;
}

/**
 * The next-reply cue for a refused look (npc.flag, narrate: true), e.g. `Rika's look is fixed: white hair, yellow-green eyes.
 * Keep it unless the story shows why it changed.` → '' without a locked look. A missing name reads as "The NPC".
 */
export function lookFlagWording(name, before) {
    const locked = lookText(before);
    if (!locked) return '';
    const who = clean(name, NAME_MAX) || 'The NPC';
    return `${possessive(who)} look is fixed: ${locked.replace(/[.;,\s]+$/, '')}. Keep it unless the story shows why it changed.`;
}

/**
 * The key note() dedupes a look flag by: the same reply with the same text is one Problem, so a re-scan of that reply adds
 * nothing new. → 'reply|text' (both cleaned and capped).
 */
export function lookFlagKey(reply, text) {
    return `${clean(reply, REPLY_MAX)}|${clean(text, FLAG_TEXT_MAX)}`;
}
