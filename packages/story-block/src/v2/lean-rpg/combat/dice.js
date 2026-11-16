// The dice rule of Combat Rules v1 fights: the kind does not own the dice and keeps no seed. `playBoard` takes a DICE SOURCE in the interaction port's own shape
// (interaction/dice.js: `dice(seed, offset)`, then `(i)(lane, at, sides)`), and the envelope stores no seed of its own. In this segment step i is exchange i:
// exchange N (N counts on across reply segments; exchange 0 is the initiative, played only by a first segment) draws from `source(N - start.offset)`, so the caller
// hands `dice(seed, start.offset)` (offset 0 for a first segment) and the port's offset is the fight's offset. A fight split into segments therefore draws exactly the
// dice of the same fight played whole. Inside a step the kind asks lane 0 and position `slot * KINDS + kind`, one position per (slot, kind), so every die has a stream of its own.
// No other randomness is allowed: not Math.random, not a seed the kind keeps.

const KINDS = Object.freeze(['act', 'foe', 'check', 'init', 'open', 'flee']);
/** The largest die slot the engine may use (slots are at most about 10^6; the position `slot * 6 + kind` stays far under 2^31). */
export const MAX_SLOT = 2 ** 28;

/** `fightDice(source, exchange, offset)(kind, slot)` returns a function giving that stream's d20; the same inputs give the same die. */
export function fightDice(source, exchange, offset = 0) {
    if (typeof source !== 'function') throw new TypeError('A fight needs a dice source: the port\'s dice(seed, offset).');
    const step = exchange - offset;
    if (!Number.isSafeInteger(step) || step < 0) throw new RangeError('A fight exchange cannot come before the segment offset.');
    return (kind, slot) => {
        const at = KINDS.indexOf(kind);
        if (at < 0) throw new RangeError(`Unknown dice kind: ${kind}`);
        if (!Number.isSafeInteger(slot) || slot < 0 || slot > MAX_SLOT) throw new RangeError('A die slot is a whole number from 0 to the slot limit.');
        return source(step)(0, slot * KINDS.length + at);
    };
}
