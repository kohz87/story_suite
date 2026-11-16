// Builds the interaction seed and independent positional dice streams, keeping the board's numbers byte-identical.

import { hash } from '../persist.js';
import { rng } from '../rng.js';

const BOARD_KIND = 'story-block/fight';
const BOARD_LANES = Object.freeze({ act: 1, foe: 2, check: 3, init: 4, open: 5, flee: 6 });
const UINT32 = 0xFFFFFFFF;

const whole = (value, fallback = 0) => (Number.isSafeInteger(value) && value >= 0 ? value : fallback);
const stream = (seed, number) => Number.parseInt(hash(`exchange:${seed >>> 0}:${number}`), 16) >>> 0;

function positional(base) {
    const source = (lane, at, sides = 20) => {
        if (!Number.isSafeInteger(lane) || lane < 0 || lane > 63) throw new RangeError('An interaction lane is a whole number from 0 to 63.');
        if (!Number.isSafeInteger(at) || at < 0) throw new RangeError('A dice position is a whole number from 0.');
        if (!Number.isSafeInteger(sides) || sides < 1 || sides > 1000) throw new RangeError('A die has 1 to 1000 sides.');
        const random = rng((base ^ Math.imul(lane * 64 + at + 1, 0x9E3779B1)) >>> 0);
        return () => 1 + Math.floor(random() * sides);
    };
    source.positional = true;
    return source;
}

/** A deterministic uint32 seed for one opening attempt of a kind. */
export function interactionSeed(originSid, attempt = 0, kindId = '') {
    const sid = String(originSid ?? '');
    const tries = whole(attempt);
    const text = kindId === BOARD_KIND ? `fight:${sid}:${tries}` : `interaction:${String(kindId ?? '')}:${sid}:${tries}`;
    return Number.parseInt(hash(text), 16) >>> 0;
}

/** The board's former seed, kept as the one board-compatible spelling of `interactionSeed`. */
export function fightSeed(sid, attempt = 0) {
    return interactionSeed(sid, attempt, BOARD_KIND);
}

/** The board's positional stream for one exchange, with its named lanes. */
export function boardDice(seed, number) {
    const base = stream(seed, number);
    const source = (kind, at, sides = 20) => {
        const lane = BOARD_LANES[kind];
        if (!lane) throw new RangeError(`Unknown board lane: ${String(kind)}.`);
        return positional(base)(lane, at, sides);
    };
    source.positional = true;
    return source;
}

/** `dice(seed, offset)(i)(lane, at, sides)` is step `i`'s independent positional stream. */
export function dice(seed, offset = 0) {
    const first = whole(offset);
    const value = Number.isSafeInteger(seed) && seed >= 0 && seed <= UINT32 ? seed : 0;
    return i => {
        if (!Number.isSafeInteger(i) || i < 0) throw new RangeError('A step number is a whole number from 0.');
        return positional(stream(value, first + i + 1));
    };
}
