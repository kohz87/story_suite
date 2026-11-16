// The cut of a reason at a word with an ellipsis.
import { WHY_MAX } from './shared-fields.js';

/**
 * A reason as the dossier keeps it (both sources: a line's own why and a scan's evidence): whole up to `max` characters (WHY_MAX), else cut at a
 * word with an ellipsis. Counted in UTF-16 units like the stored-event check (validEvent), so a cut never makes the event invalid.
 */
export function cutWords(text, max = WHY_MAX) {
    const whole = String(text ?? '');
    if (whole.length <= max) return whole;
    const head = [...whole].reduce((out, char) => (out.length + char.length <= max - 1 ? out + char : out), '');
    return `${head.replace(/\s+\S*$/, '')}…`;   // the same cut the one-pass evidence has had since it was added
}
