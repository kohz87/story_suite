// The passing look note and the lasting outfit of {{user}} (gear on, rule mark `youLook`): read, cut, cleared on a move. Pure.

import { cutPoints } from '../../extras.js';
import { YOU_SHORT, YOU_SHORT_CHARS } from './constants.js';

export const WEARING_REFUSED = 'What you wear comes from your equipped gear; write outfit: for clothes that are not gear and look: for how you look now.';

/**
 * The parts of a `~ you` line as the look rules take them: `outfit` and `look` are cut to YOU_SHORT_CHARS code points (a cut one is told),
 * and with `story` (a story line under the mark with gear on) `wearing` is dropped with one plain Problem. -> { parts, problems }.
 */
export function lookOf(parts, { story = false } = {}) {
    const kept = { ...parts };
    const problems = [];
    if (story && kept.wearing !== undefined) {
        delete kept.wearing;
        problems.push(WEARING_REFUSED);
    }
    for (const part of YOU_SHORT) {
        if (typeof kept[part] === 'string' && Array.from(kept[part]).length > YOU_SHORT_CHARS) {
            kept[part] = cutPoints(kept[part], YOU_SHORT_CHARS);
            problems.push(`Your ${part} was cut to ${YOU_SHORT_CHARS} characters.`);
        }
    }
    return { parts: kept, problems };
}

/** A move leaves the passing look behind: the scene's `you` without its look (the same object when there is none to clear). */
export function clearLook(you) {
    return typeof you?.look === 'string' && you.look ? { ...you, look: '' } : you;
}
