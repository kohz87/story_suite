// The reader's Edit of a piece they added by hand: kind, slot, rarity and stats (its soak follows the slot's cap).

import { slotWordOf, handDef, statsFor, statsOf, soakCap } from '../../gear.js';
import { fill } from '../../../strings.js';
import { gearOn, KINDS, RARITIES, MAX_UNSTACKED } from '../state.js';
import { baseSlot } from '../validate.js';
import { E, refuseBound, addStack } from '../stacks.js';
import { kitOpen, holdBudget, handSlot, handStats } from './kit.js';

// The reader's Edit of a piece they added by hand (gear on): `kind`, `slot` (a place, or '' for none), `rarity` and `stats`. Only a def with `hand: true` and no
// story-given stack; a pack's or the story's keeps its words. Rarity and Bonus are the starting kit's: changing them is refused once the reader has sent a message.
// A piece made Equipment later is Common; one made something else gives up its slot (and is taken off).
export function handEdit(ctx, env, inv, stack, payload) {
    if (!gearOn(ctx)) ctx.fail('REFUSED', E.gearOff);
    const def = inv.defs[stack.def];
    refuseBound(ctx, inv, stack);
    if (def.id.startsWith('pack.')) ctx.fail('REFUSED', E.kitPack);
    if (!handDef(inv, def)) ctx.fail('REFUSED', E.kitStory);
    const kind = payload.kind ?? def.kind;
    if (!KINDS.includes(kind)) ctx.fail('INVALID', fill(E.itemKind, { kinds: KINDS.join(', ') }));
    if (payload.rarity !== undefined && payload.rarity !== null && !RARITIES.includes(payload.rarity)) ctx.fail('INVALID', fill(E.itemRarity, { rarities: RARITIES.join(', ') }));
    const becomes = kind === 'equipment' && def.kind !== 'equipment';
    const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
    const stats = payload.stats === undefined ? null : handStats(ctx, payload.stats);
    const rarityAsked = payload.rarity !== undefined && payload.rarity !== null && (becomes ? payload.rarity !== 'common' : payload.rarity !== def.rarity);
    const statsAsked = stats !== null && (becomes ? Object.keys(stats).length > 0 : !same(stats, statsFor(def)));
    if ((rarityAsked || statsAsked) && !kitOpen(env)) ctx.fail('REFUSED', E.kitClosed);
    if (kind !== 'equipment' && (payload.slot || (stats && Object.keys(stats).length))) ctx.fail('INVALID', E.gearNeedsEquipment);
    const open = kitOpen(env);
    const rarity = becomes ? (open ? payload.rarity ?? 'common' : 'common') : kind === 'equipment' ? payload.rarity ?? def.rarity : def.rarity;
    const nextStats = kind !== 'equipment' ? {} : becomes ? (open && stats ? stats : {}) : stats ?? statsOf(def.stats);
    if (kind === 'equipment') holdBudget(ctx, rarity, nextStats);
    const slot = kind !== 'equipment' ? null : payload.slot === undefined ? slotWordOf(def.slot) : handSlot(ctx, payload.slot);
    const pieces = Object.values(inv.stacks).filter(item => item.def === def.id);
    if (becomes) {
        const extra = pieces.reduce((sum, item) => sum + item.qty - 1, 0);
        if (pieces.length + extra > MAX_UNSTACKED) ctx.fail('INVALID', fill(E.kitMany, { max: MAX_UNSTACKED }));
        for (const item of pieces) {
            for (let n = 1; n < item.qty; n += 1) addStack(ctx, inv, def.id, 1, item.owner, item.note, item.key === true, false);
            item.qty = 1;
        }
    }
    // A piece that no longer fits where it is worn is taken off.
    for (const item of pieces) {
        if (item.equipped !== null && (kind !== 'equipment' || !slot || baseSlot(item.equipped) !== baseSlot(slot))) item.equipped = null;
    }
    def.kind = kind;
    def.rarity = rarity;
    def.slot = slot ? baseSlot(slot) : null;
    def.stats = nextStats;
    def.stack = kind !== 'equipment';
    // (a new kind or slot holds the soak the piece had to the new slot's cap: none off equipment or without a slot; the Edit's own soak is numberEdit's)
    const soak = kind !== 'equipment' || !slot ? 0 : Math.min(def.soak ?? 0, soakCap(slot));
    if (soak > 0) def.soak = soak;
    else delete def.soak;
    // (the def's own stats now speak for every piece: a re-pointing made before is dropped)
    for (const item of pieces) delete item.stats;
}
