// Plays Auto exchanges on the open fight, one ordinary exchange at a time.
// Each pick set is staged by the interaction api like a reader's own choice, so replay, the log and XP see nothing special.
// It stops at the cap, a won or lost fight, or a hero badly hurt, and says why in one plain line.

import { autoStop, hurtHeroes } from './auto-stop.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The one-line note under the log for why Auto stopped; `waiting` says whether a reply is held for "Send with this fight". */
export function autoNote({ stop, done, who = [], waiting = false } = {}) {
    const played = `Auto played ${plural(done, 'exchange')}`;
    const next = waiting ? 'Send to tell them, or keep fighting.' : 'Your next message tells them, or keep fighting.';
    if (stop === 'won') return `${played} and the fight is won.`;
    if (stop === 'lost') return `${played} and the party is down.`;
    if (stop === 'hurt') return `${played}. ${who.length ? `${who.join(' and ')} ${who.length === 1 ? 'was' : 'were'}` : 'A hero was'} badly hurt. ${next}`;
    if (stop === 'cap') return `${played} (the cap). ${next}`;
    if (stop === 'none') return `Auto found nothing to do after ${plural(done, 'exchange')}. ${next}`;
    return `${played}.`;
}

/**
 * runAuto({ api, cap })
 * `api` is `sdk.interaction`; `cap` is the most exchanges this run may play (Infinity for "until the end").
 * → { done, stop, who, error? }. `stop` is 'won', 'lost', 'hurt', 'cap', 'none' (no pick to make) or 'error'.
 */
export function runAuto({ api, cap = 3 } = {}) {
    let done = 0;
    for (;;) {
        const now = api?.current?.();
        if (!now) return { done, stop: 'error', who: [], error: 'There is no fight to play.' };
        const before = now.view?.result;
        if (!before) return { done, stop: 'error', who: [], error: 'The fight could not be played.' };
        if (before.stop !== 'open') return { done, stop: before.stop, who: [] };
        if (done >= cap) return { done, stop: 'cap', who: [] };
        const staged = api.auto(now.id, 1);
        if (!staged.ok) return { done, stop: /nothing to do/iu.test(String(staged.message)) ? 'none' : 'error', who: [], ...(/nothing to do/iu.test(String(staged.message)) ? {} : { error: staged.message }) };
        done += 1;
        const last = staged.view?.result, stop = autoStop(last, { cap, done });
        if (stop === 'hurt') return { done, stop, who: hurtHeroes(last) };
        if (stop) return { done, stop, who: [] };
    }
}
