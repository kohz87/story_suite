// Combat Rules v1 tempo: whether a landed action's tempo roll earns one more action, and the chain's AGI-based cap
// (a Movement stance raises it by one). The caller supplies the already-rolled margin and the extra actions used.

import { TEMPO_CAPS, V1 } from './numbers.js';

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(value)) || lo));

/**
 * One link of a tempo chain. `margin` is the player's tempo total minus the foe's; `used` counts extra actions already
 * taken in this chain. Returns { cap, won, extra, chain }: `won` means the roll beat the foe by the tempo margin,
 * `extra` means another action is earned, and `chain` is the count to pass to the next link.
 */
export function tempoChain({ agility, stance = null, margin = null, used = 0 } = {}) {
    const agi = clamp(agility, V1.stat.min, V1.stat.max);
    const movement = typeof stance === 'string' && stance.toLowerCase() === 'movement' ? V1.tempoStanceBonus : 0;
    const cap = TEMPO_CAPS.find(entry => agi >= entry.minAgi).cap + movement;
    const already = Math.max(0, Math.floor(Number(used)) || 0);
    const won = Number.isFinite(Number(margin)) && Number(margin) >= V1.tempoMargin;
    const extra = won && already < cap;
    return { cap, won, extra, chain: extra ? already + 1 : already };
}
