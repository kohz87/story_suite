// Story Director v2, tracker part (scene): words the Elsewhere line: what {{user}} knows of, how many to list.

import { DEFAULT_ELSEWHERE, MAX_ELSEWHERE, NAME_POINTS } from './shared-limits.js';
import { cutPoints } from './shared-text.js';

// What {{user}} knows of a thread elsewhere (world/known.js): never what is behind the scenes.
const KNOWN_KINDS = new Set(['quest', 'hook', 'event']);

/** Whether {{user}} knows of a thread (world/known.js): a quest taken on, a hook or an event the story wrote. */
export function knownToUser(record) {
    return KNOWN_KINDS.has(record.kind) && !record.arc;
}

/** "Herb run (hook)", "Wolf Hunt (quest)": an elsewhere thread in a few words. */
export const elsewhereItem = record => `${cutPoints(record.key, NAME_POINTS)} (${record.kind})`;

/** The Elsewhere line for `items` ('' for none). */
export const elsewhereLine = items => (items.length ? `Elsewhere, not in this scene: ${items.join(' · ')}` : '');

/** The `elsewhere` setting: 0 to MAX_ELSEWHERE, else the default. */
export function elsewhereCap(settings) {
    const value = settings?.elsewhere;
    return Number.isSafeInteger(value) && value >= 0 ? Math.min(MAX_ELSEWHERE, value) : DEFAULT_ELSEWHERE;
}
