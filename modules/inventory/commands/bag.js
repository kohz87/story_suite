// The Party paper-doll's Bag slot (`inventory.bag`): which carrying item a member has as their bag, filed under BAG_PLACE (the
// stack's `equipped`). Choosing one hands it to them (inventory.transfer: the taker's load is checked) and puts the bag they had
// back in the party's bag; `stack: null` frees the slot the same way. The main character's things are the party's (owner `party`),
// so their bag stays where it is and is only marked. A bound piece is not handed to anyone else. Someone who left can still have theirs put down.
import { capitalize } from '../../scene/domains/common.js';
import { BAG_PLACE } from '../state.js';
import { ownerArg, receiverArg, stackIn, refuseBound, told } from '../stacks.js';
import { ownerSaid } from '../validate.js';
import { defCarry } from '../queries-parts/carry.js';
import { notABag } from '../gear/carry-parts/bag-like.js';

// The one stack `id` names, split down to a single piece (a bag is one thing), its id returned.
function single(ctx, id) {
    const stack = ctx.draft('inventory').stacks[id];
    if (stack.qty > 1) ctx.call('inventory.split', { stack: id, qty: stack.qty - 1 });
    return id;
}

/** `inventory.bag { owner, stack | null }`. */
export function createBagCommands() {
    return {
        'inventory.bag'(ctx, payload = {}) {
            // Putting a bag down also frees one someone who left still has; only a bag is handed to someone who is in the party.
            const down = payload.stack === null || payload.stack === undefined;
            const owner = down ? ownerArg(ctx, payload.owner) : receiverArg(ctx, payload.owner);
            let inv = ctx.draft('inventory');
            const current = Object.values(inv.stacks).find(stack => stack.owner === owner && stack.equipped === BAG_PLACE) ?? null;
            if (down && !current) receiverArg(ctx, owner);
            const name = capitalize(ownerSaid(ctx, owner));
            const putBack = () => {
                if (!current) return;
                if (owner === 'party') ctx.draft('inventory').stacks[current.id].equipped = null;
                else ctx.call('inventory.transfer', { stack: current.id, to: 'party' });
            };
            if (down) {
                if (!current) ctx.fail('REFUSED', `${name} carries no bag.`);
                refuseBound(ctx, inv, current);
                const gone = inv.defs[current.def].name;
                putBack();
                return { summary: `${name} puts down ${gone}${owner === 'party' ? '' : ' (back in the party\'s bag)'}.`, data: { owner, stack: current.id, off: true }, narrate: told(ctx) };
            }
            const stack = stackIn(ctx, inv, payload.stack);
            const def = inv.defs[stack.def];
            const why = notABag(def, defCarry(def) ?? 0);
            if (why) ctx.fail('REFUSED', why);
            if (stack.id === current?.id) ctx.fail('REFUSED', `${def.name} is already ${ownerSaid(ctx, owner)}'s bag.`);
            if (stack.equipped !== null && stack.equipped !== BAG_PLACE) ctx.fail('REFUSED', `${def.name} is worn (${stack.equipped}).`);
            if (stack.owner !== owner) refuseBound(ctx, inv, stack);
            if (current && owner !== 'party') refuseBound(ctx, inv, current);
            // The new bag first (the taker's load is checked with the old one's room still there), then the old one back.
            let id = stack.id;
            if (stack.owner !== owner) id = ctx.call('inventory.transfer', { stack: stack.id, to: owner, qty: 1 })?.data?.stack ?? stack.id;
            putBack();
            id = single(ctx, id);
            inv = ctx.draft('inventory');
            inv.stacks[id].equipped = BAG_PLACE;
            const carry = defCarry(def) ?? 0;
            return {
                summary: `${name} carries ${def.name} as a bag${carry ? ` (+${carry} load)` : ''}${current ? `, putting down ${inv.defs[current.def].name}` : ''}.`,
                data: { owner, stack: id, def: def.id, carry, replaced: current?.id ?? null },
                narrate: told(ctx),
            };
        },
    };
}
