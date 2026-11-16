// Wears the piece an owner has in a gear slot by condition steps (`gear.wear`).

import { OWNER_RE, capitalize, ownerNameIn } from '../../scene/domains/common.js';
import { stepDown } from '../gear.js';
import { condOf, condWrite, RPG_MODULE, gearOn } from '../state.js';

// `gear.wear { owner, slot, steps }` (`story-block.gear`): the system's or another module's call (a fight's rules), never a button or a
// story line. `slot`: weapon, body (armour), off-hand (shield), or defence (the body armour, else the off-hand: what a decisive hit
// taken wears). The piece worn there goes down `steps` (1…3, default 1) condition words (good → worn → torn → broken) through the same
// condition events as `inventory.wear`; at 0 it is broken and gives no bonus (gearAnswer). Part 2: a decisive hit TAKEN wears the
// defender's `defence`, a decisive miss of the attacker wears their `weapon`.
const WEAR_SLOTS = Object.freeze({ weapon: 'weapon', body: 'body', armour: 'body', 'off-hand': 'off-hand', shield: 'off-hand', defence: 'defence' });

export function gearWear(ctx, payload) {
    // (a roll that carries a gear mark wears by it even if the switch is off now: `recorded`, and only the RPG's own `rpg.resolve` may say so: its nested call has
    // the Story Block module as `ctx.caller`; a pack event step (`event:<id>`), another module or a top-level call is refused the flag, whatever the switch says)
    if (payload.recorded === true && !(ctx.cause === 'system' && ctx.caller === RPG_MODULE)) ctx.fail('REFUSED', 'Only the fight\'s own rolls wear gear by their record.');
    if (!gearOn(ctx) && payload.recorded !== true) ctx.fail('REFUSED', 'Gear is not switched on.');
    if (!(ctx.cause === 'system' || ctx.caller)) ctx.fail('REFUSED', 'Gear wears from the rules of a fight, not from a button or a change line.');
    const owner = typeof payload.owner === 'string' && payload.owner ? payload.owner : 'party';
    if (!OWNER_RE.test(owner)) ctx.fail('INVALID', 'The owner is the party or a member.');
    const asked = typeof payload.slot === 'string' ? payload.slot.trim().toLowerCase() : '';
    if (!Object.hasOwn(WEAR_SLOTS, asked)) ctx.fail('INVALID', 'The slot is weapon, body, off-hand or defence.');
    const steps = payload.steps === undefined ? 1 : payload.steps;
    if (!Number.isSafeInteger(steps) || steps < 1 || steps > 3) ctx.fail('INVALID', 'The steps are a whole number from 1 to 3.');
    const inv = ctx.draft('inventory');
    const wornIn = place => Object.values(inv.stacks)
        .filter(other => other.owner === owner && other.equipped === place)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    const slot = WEAR_SLOTS[asked] === 'defence' ? (wornIn('body') ? 'body' : 'off-hand') : WEAR_SLOTS[asked];
    const stack = wornIn(slot);
    if (!stack) ctx.fail('NOT_FOUND', `${capitalize(ownerNameIn(ctx, owner))} wears nothing in the ${slot} slot.`);
    const def = inv.defs[stack.def];
    const before = condOf(stack, inv);
    const target = stepDown(before, steps);
    const amount = before - target;
    const now = amount > 0 ? condWrite(ctx, inv, stack, -amount) : before;
    return {
        summary: before === 0 ? `${def.name} is already broken.` : now === 0 ? `${def.name} breaks.` : `${def.name} wears (${before} → ${now}).`,
        data: { owner, slot, stack: stack.id, def: def.id, steps, amount, before, now, broken: now === 0 },
        narrate: false,
    };
}
