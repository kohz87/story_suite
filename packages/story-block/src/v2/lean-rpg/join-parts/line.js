// Join: the narrator's party line (grammar, class words) read and checked.

import { oneLine } from '../../../../../../core/text.js';
import { CLASS_NAMES, CREATION, JOINS, STATS } from '../names.js';
import { RPG_STRINGS, fill } from '../strings.js';
import { newSoul } from '../view/wizard-data.js';
import { isRecord } from './shared-record.js';

const J = RPG_STRINGS.join;

/** The narrator's grammar line for party lines (one line, as every kind's is). */
export const joinGrammar = () => J.grammar;
/** The same line in the words of this story's own class field (`naming`, soulNaming): the classes it runs from and to; the template's gives joinGrammar's text. */
export const joinGrammarOwn = naming => { const own = soulWords(naming); return fill(J.grammarOwn, { first: oneLine(own.first), last: oneLine(own.last) }); };

/**
 * A Soul Class written as I to IX or 1 to 9 → 1..9, or 0 when it is not one. `soul` (soul.js soulReading): the field's own names are
 * understood too, when a pack renamed them ("Level" 1–9, or words).
 */
export function soulOf(text, soul = null) {
    const word = oneLine(text).toUpperCase();
    if (/^[1-9]$/.test(word)) return Number(word);
    const at = CLASS_NAMES.indexOf(word);
    if (at >= 0) return at + 1;
    const own = typeof soul?.word === 'function' ? CLASS_NAMES.findIndex((_, n) => oneLine(soul.word(n + 1)).toUpperCase() === word) : -1;
    return own >= 0 ? own + 1 : 0;
}

/**
 * A party line read: `{ op: '+' | '-', name, about, soul, best }` or `{ error }` (plain words). `about` is cut at 240 characters (whole
 * characters), `soul` is 1 when the line has no class, `best` is one of the seven stats or '' when the line names none.
 */
export function readJoin(line, naming = null) {
    const op = line?.op;
    if (op !== '+' && op !== '-') return { error: fill(J.wrongOp, { op: op ?? '' }) };
    const name = oneLine(line?.name);
    if (!name) return { error: J.noPerson };
    if ([...name].length > CREATION.name) return { error: fill(J.nameLong, { max: CREATION.name }) };
    if (op === '-') return { op, name };
    const labels = isRecord(line?.labels) ? line.labels : {};
    const about = [...oneLine(labels.about ?? line?.text)].slice(0, CREATION.about).join('');
    let soul = 1;
    if (oneLine(labels.class)) {
        soul = soulOf(labels.class, naming);
        if (!soul) return { error: fill(J.badClass, soulWords(naming)) };
    }
    let best = '';
    if (oneLine(labels.best)) {
        best = oneLine(labels.best).toLowerCase();
        if (!STATS.includes(best)) return { error: fill(J.badBest, { stats: STATS.join(', ') }) };
    }
    return { op, name, about, soul, best };
}

/** What the Soul Class is called, as the refusal and the card say it: { label, first, last, word } (soul.js). The default is the template's. */
const soulWords = naming => {
    const own = naming ?? newSoul();
    return { label: own.label, first: own.word(1), last: own.word(CLASS_NAMES.length), word: own.word };
};
