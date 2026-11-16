// The dice rule of Combat Rules v1 fights: the dice are KEYED FOR THE INTERACTION PORT (interaction/dice.js), the kind does not own them.
// A fight's seed is the port's seed for the opening attempt; the fight's step is the port's step number, so exchange N's dice are the port's
// `dice(seed)(step)` stream, where step = N * SLOT_SPAN + slot (exchange 0 is the initiative; N counts on across reply segments, so a fight
// split into segments draws exactly the dice of the same fight played whole). The kind picks the lane (act 1, foe 2, check 3, init 4,
// open 5, flee 6: the board's lane numbers) and always asks position 0, because every slot already has a stream of its own.
// No other randomness is allowed: not Math.random, not a seed the kind keeps.

import { dice } from '../../interaction/dice.js';

/** The port step numbers of one exchange are this far apart (larger than any slot the engine uses). */
export const SLOT_SPAN = 2 ** 21;
const LANES = Object.freeze({ act: 1, foe: 2, check: 3, init: 4, open: 5, flee: 6 });

/** `fightDice(seed, exchange)(kind, slot)` returns a function giving that stream's d20; the same inputs give the same die. */
export function fightDice(seed, exchange) {
    const source = dice(seed);
    return (kind, slot) => {
        if (!Object.hasOwn(LANES, kind)) throw new RangeError(`Unknown dice kind: ${kind}`);
        return source(exchange * SLOT_SPAN + slot)(LANES[kind], 0);
    };
}
