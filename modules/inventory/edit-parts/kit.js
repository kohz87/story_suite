// The starting kit: whether it is open, and the stats, budget and slot a reader sets by hand.

import { isPlainObject } from '../../scene/domains/common.js';
import { GEAR, slotWordOf, placeOf } from '../gear.js';
import { fill } from '../../../core/strings.js';
import { E } from '../stacks.js';

// ---------- hand-set gear: the starting kit (docs/v2/GEAR.md "Your own gear") ----------
//
// With Gear in fights on, the reader's "+ Add item" and the Edit of a piece they added can set Kind, Slot, Rarity and a Bonus. The full
// setup (Rarity, Bonus) is the starting kit's: allowed only while the chat has no message from the reader yet (a swipe of the greeting keeps it
// open; `env.readers()` counts the reader's messages on the line of history and `env.greetingOnly()` is false once anything but the greeting is there, so only a rewind back to the greeting opens it again). After that Rarity
// stays Common (+1). A def the reader made is marked `hand: true`; the story's, a pack's and a bound piece's are not theirs to change.
/** Whether the starting kit is open: the chat is at its first message (only the opening greeting: no message from the reader and no reply after it). Unknown counts as closed. */
export function kitOpen(env) {
    try { return env?.readers?.() === 0 && env?.greetingOnly?.() !== false; } catch { return false; }
}

const article = word => (/^[aeiou]/i.test(word) ? 'An' : 'A');

// The stats a reader typed: { STAT: n } for the seven stats, whole numbers of at least 1, at most GEAR.maxStats different ones. `{}` for none.
export function handStats(ctx, raw) {
    if (raw === undefined || raw === null) return {};
    if (!isPlainObject(raw)) ctx.fail('INVALID', fill(E.kitStats, { max: GEAR.maxStats }));
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        const stat = String(key).trim().toUpperCase();
        if (!GEAR.stats.includes(stat) || !Number.isSafeInteger(value) || value < 1 || Object.hasOwn(out, stat)) ctx.fail('INVALID', fill(E.kitStats, { max: GEAR.maxStats }));
        out[stat] = value;
    }
    if (Object.keys(out).length > GEAR.maxStats) ctx.fail('INVALID', fill(E.kitStats, { max: GEAR.maxStats }));
    return out;
}

// The points a rarity allows: the refusal is the sentence the form shows ("A rare piece gives at most 2 points.").
export function holdBudget(ctx, rarity, stats) {
    const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
    const max = GEAR.budget[rarity] ?? 0;
    if (total <= max) return;
    ctx.fail('REFUSED', max === 0 ? E.kitNoBonus : fill(E.kitBudget, { a: article(rarity), rarity, max, points: max === 1 ? 'point' : 'points' }));
}

// A slot the reader chose: one of the eight places (or its base word), → the place key; null for none.
export function handSlot(ctx, raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    const word = typeof raw === 'string' ? slotWordOf(raw) : null;
    if (!word || !GEAR.places.includes(placeOf(word))) ctx.fail('INVALID', fill(E.kitSlot, { slots: GEAR.places.join(', ') }));
    return word;
}
