// The v1 settled note, pure: the narrator's account of a fight from the v1 envelope (envelope.js), told exchange by exchange in numbers. Not wired (C7 wires it).
// The fixed instructions and the closing lines are the old note's words (board/note-parts/settled-note.js), and the fight-length line is the old one (fight-length.js) with the old rule unchanged: any actor going to 0, a foe included, makes the fight intense (250 words).

import { BATTLE_MARKER } from '../names.js';
import { fightLength } from '../board/note-parts/fight-length.js';
import { noteLine, stanceLine } from './note-lines.js';
import { hpBefores, lineOf } from './record.js';

const END = { won: 'The fight is won. Code gives the party its XP.', lost: 'The fight is lost.', fled: 'The party fled.', open: 'The fight is still open.' };
const AFTER = {
    open: 'The fight is still in progress; do not tell a post-fight aftermath yet.', won: 'Then follow the reader’s requested aftermath as the outcome permits.',
    other: 'Then follow the reader’s requested aftermath only as the outcome permits; do not assume the foes or their possessions are accessible or looting succeeds.',
};

// fightLength reads the old result shape: its turn order as entries, a list of rounds (only their count is used here) and `hurts` rows. The v1 rows are arrays it would misread,
// so it gets empty rounds, and "someone went to 0" (a hero or a foe, the old rule) is derived from the HP moves and passed as `hurts` rows.
const wentDown = moves => moves.filter(move => move?.bar === 'hp' && Number(move.from) > 0 && Number(move.to) <= 0).map(move => ({ id: String(move.id ?? ''), from: move.from, to: move.to }));
function lengthOf(envelope) {
    const order = envelope.order ?? {};
    return fightLength({
        stop: envelope.stop, rounds: (envelope.rounds ?? []).map(() => ({ lines: [] })), hurts: wentDown(envelope.moves ?? []),
        order: [...(order.party ?? []).map(() => ({ party: true })), ...(order.foes ?? []).map(() => ({ party: false }))],
    });
}

/** The exchanges of the record as `{ n, parts }`, the parts being the told rows in order (stance changes first as the engine writes them); `opening` is the order line of a first segment. */
function exchangesOf(envelope) {
    const lines = envelope.lines ?? [], before = hpBefores(lines, envelope.moves ?? []), stances = new Map(), out = [];
    let opening = '';
    lines.forEach((line, at) => {
        if (line[0] === 'order') opening = lineOf(line).replace(/\.$/u, '');
        else if (line[0] === 'exchange') out.push({ n: line[1], parts: [] });
        else if (out.length) {
            const text = line[0] === 'stance' ? stanceLine(line, stances) : noteLine(line, before[at], stances);
            if (text) out[out.length - 1].parts.push(text);
        }
    });
    return { opening, out };
}

/** The settled note for a v1 envelope: the fixed instructions, the fight-length line, then `Exchange n: …` per exchange, then the end and aftermath lines. */
export function settledNoteV1(envelope, { fightLen = true } = {}) {
    const lines = ['Tell the settled fight results in order; do not reroll them.', `Write ${BATTLE_MARKER} on its own line where the fight is told.`, 'Code has already moved the bars for these results; never set those yourself.'];
    const { opening, out } = exchangesOf(envelope ?? {});
    if (fightLen && out.length) lines.push(lengthOf(envelope));
    if (opening) lines.push(`${opening}.`);
    for (const round of out) lines.push(`Exchange ${round.n}: ${round.parts.join(' | ') || 'No one acted'}.`);
    const stop = envelope?.stop in END ? envelope.stop : 'open';
    lines.push(END[stop], AFTER[stop === 'open' || stop === 'won' ? stop : 'other']);
    return lines.join(' | ');
}
