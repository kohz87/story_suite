// The Pairing row's count in the nav, cheaply: the pair check reads both packs in full (about 400 ms for a big pair), so it is never run in an edit's redraw.
// `pairBadge` answers at once with the last answer; once the packs have stopped changing for a moment it hashes them, runs the check only for a pair it has not
// seen (the answer is kept per pack hash, so an undo or a revert costs nothing) and calls `onReady` when the answer changed.

import { pairPacks } from './pairing.js';

export const WAIT = 600; // ms the packs must stand still before the pair is looked at
const KEPT = 8;
const answers = new Map();
let shown = null, seen = [undefined, undefined], timer = null;

const hashOf = text => { let hash = 5381; for (let at = 0; at < text.length; at += 1) hash = ((hash * 33) ^ text.charCodeAt(at)) >>> 0; return `${hash.toString(36)}:${text.length}`; };
const text = doc => (doc ? JSON.stringify(doc) : '');

/** `pairBadge(world, game, onReady)` → `{ errors, warnings }` of the pair (the world with the game, or the Built-in game when `game` is null), or null before the first answer. Never runs the check itself. */
export function pairBadge(world, game, onReady) {
    if (world === seen[0] && game === seen[1]) return shown;
    clearTimeout(timer);
    timer = setTimeout(() => {
        seen = [world, game];
        const [w, g] = [text(world), text(game)];
        const key = `${hashOf(w)}|${hashOf(g)}`;
        let answer = answers.get(key);
        if (!answer) {
            const found = pairPacks(w, g || null);
            answer = { errors: found.errors.length, warnings: found.warnings.length };
            answers.set(key, answer);
            if (answers.size > KEPT) answers.delete(answers.keys().next().value);
        }
        const changed = !shown || shown.errors !== answer.errors || shown.warnings !== answer.warnings;
        shown = answer;
        if (changed) onReady?.();
    }, WAIT);
    timer.unref?.();
    return shown;
}
