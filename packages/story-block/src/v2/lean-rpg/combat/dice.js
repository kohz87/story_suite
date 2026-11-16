// Seeded dice for a whole fight: a fixed seed, exchange number, slot and kind select one independent d20 stream.
// The board's key scheme only separates kinds by 64 positions, and the engine's slots run far past that, so every slot
// opens its own stream (slot folded into the exchange key) and the kind picks the position inside it.

import { boardDice } from '../board/dice.js';

/** `fightDice(seed, exchange)(kind, slot)` returns a function giving that stream's d20; the same inputs give the same die. */
export function fightDice(seed, exchange) {
    return (kind, slot) => boardDice(seed, `${exchange}:${slot}`)(kind, 0);
}
