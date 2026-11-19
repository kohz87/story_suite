// The storage benchmark's fixed text (tests/bench/load.js): each reply's prose and change lines, the user turn and the UI commands every few replies.

import { ACTORS, PARTY_SIZE, STACKS, THREADS, actorId, itemName, threadId, threadTitle } from './load-module.js';

export const PROSE = 'The road bends past the old mill, where the water wheel has not turned in years. '
    + 'Lanterns sway in the wind as the party talks quietly about what the stranger said at the inn, '
    + 'and whether the map in Ren\'s pack can be trusted at all. ';

/** A reply of about 1,200 characters of prose, then its <Changes> block. */
export function replyText(n) {
    const prose = `Reply ${n}. ${PROSE.repeat(4)}`.trim();
    return `${prose}\n\n<Changes>\n${changeLines(n).join('\n')}\n</Changes>`;
}

/** The five change lines of reply `n`: an item, a coin, an HP change, a thread, the clock. */
export function changeLines(n) {
    const item = n % 2 ? `+ item ${itemName(n % STACKS)} | qty: 1` : `- item ${itemName((n - 1) % STACKS)} | qty: 1`;
    const coin = n % 3 === 0 ? '- coin 4 | to: the innkeeper' : '+ coin 7 | from: a grateful farmer';
    const hp = `~ hp ${ACTORS[n % PARTY_SIZE]} | delta: ${n % 2 ? -6 : 5}`;
    const thread = `~ thread ${threadTitle(n % THREADS)} | stage: ${1 + (n % 5)} | tension: ${n % 4}`;
    return [item, coin, hp, thread, '~ time Clock | minutes: 20'];
}

export const userText = n => `I look around and ask the others what they make of it (turn ${n}).`;

/** The three UI commands made after reply `n` (every UI_EVERY replies). */
export function uiCommands(n) {
    return [
        { type: 'party.heal', payload: { actor: actorId(n % PARTY_SIZE), amount: 4 } },
        { type: 'bench.tip', payload: { amount: 3, note: 'a tip' } },
        { type: 'director.pin', payload: { thread: threadId(n % THREADS) } },
    ];
}

// ---------- measuring a chat ----------
