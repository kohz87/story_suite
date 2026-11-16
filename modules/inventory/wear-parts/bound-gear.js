// Sets a member's bound gear aside when they leave, brings it back, or releases it to the party's bag.

import { isPlainObject } from '../../scene/domains/common.js';
import { COND_MAX, condOf, RPG_MODULE } from '../state.js';
import { ownerArg, boundName, addStack } from '../stacks.js';

// `inventory.stow { owner }` (`story-block.gear`, a module's call: the party module's leave): the pieces bound to `owner` leave the inventory with
// them. They are set aside in `kept[owner]` (def, quantity, the slot they were worn in, note, condition as it stands: the events folded into one
// number, so what wear they took stays), and their condition events go with them. Nothing is lost: `inventory.restore` brings them back.
export function stow(ctx, payload) {
    // (only Story Block's own leave: a pack event, another module, a button or a change line is refused)
    if (ctx.caller !== RPG_MODULE) ctx.fail('REFUSED', 'Gear leaves with a member when they leave the party, not from a button, an event or another module.');
    const owner = ownerArg(ctx, payload.owner, undefined);
    if (owner === 'party') ctx.fail('INVALID', 'Only a party member\'s gear is bound to them.');
    // `module`: the member's block, kept with the pieces so they find their way back if the member is renamed while away
    const by = typeof payload.module === 'string' && payload.module && payload.module.length <= 120 ? payload.module : '';
    const inv = ctx.draft('inventory');
    const pieces = Object.values(inv.stacks).filter(stack => stack.owner === owner && stack.bound === owner)
        .sort((a, b) => (inv.defs[a.def]?.name ?? a.def).localeCompare(inv.defs[b.def]?.name ?? b.def, 'en') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (!pieces.length) return { summary: `${boundName(ctx, owner)} has no bound gear.`, data: { owner, items: [], stacks: [] }, narrate: false };
    if (!isPlainObject(inv.kept)) inv.kept = {};
    const list = Array.isArray(inv.kept[owner]) ? inv.kept[owner] : [];
    const names = [];
    for (const stack of pieces) {
        const cond = condOf(stack, inv);
        list.push({ def: stack.def, qty: stack.qty, equipped: stack.equipped, note: stack.note, ...(by ? { by } : {}), ...(cond < COND_MAX ? { cond } : {}),
            ...(stack.key === true ? { key: true } : {}), ...(stack.story === true ? { story: true } : {}) });
        names.push(inv.defs[stack.def]?.name ?? stack.def);
        if (isPlainObject(inv.condLog)) delete inv.condLog[stack.id];
        delete inv.stacks[stack.id];
    }
    inv.kept[owner] = list;
    return { summary: `${boundName(ctx, owner)}'s gear leaves with them: ${names.join(', ')}.`, data: { owner, items: names, stacks: pieces.map(stack => stack.id) }, narrate: false };
}

// `inventory.restore { owner }` (`story-block.gear`, a module's call: the party module's return): what `inventory.stow` set aside comes back, once
// (the record is emptied), bound again, in the condition it left in, worn in the slot it was worn in when that slot is free (else carried).
export function restore(ctx, payload) {
    if (ctx.caller !== RPG_MODULE) ctx.fail('REFUSED', 'Gear comes back with a member when they return to the party, not from a button, an event or another module.');
    const owner = ownerArg(ctx, payload.owner, undefined);
    if (owner === 'party') ctx.fail('INVALID', 'Only a party member\'s gear is bound to them.');
    const inv = ctx.draft('inventory');
    const list = isPlainObject(inv.kept) && Array.isArray(inv.kept[owner]) ? inv.kept[owner] : [];
    const items = [];
    for (const entry of list) {
        const def = inv.defs[entry.def];
        if (!def) continue;
        const free = entry.equipped !== null && !Object.values(inv.stacks).some(other => other.owner === owner && other.equipped === entry.equipped);
        const id = addStack(ctx, inv, def.id, entry.qty, owner, entry.note, entry.key === true, entry.story === true);
        const stack = inv.stacks[id];
        stack.bound = owner;
        if (free) stack.equipped = entry.equipped;
        if (Number.isSafeInteger(entry.cond)) stack.cond = entry.cond;
        items.push({ def: def.id, name: def.name, stack: id, equipped: stack.equipped });
    }
    if (isPlainObject(inv.kept)) {
        delete inv.kept[owner];
        if (!Object.keys(inv.kept).length) delete inv.kept;
    }
    return { summary: items.length ? `${boundName(ctx, owner)}'s gear comes back: ${items.map(item => item.name).join(', ')}.` : `${boundName(ctx, owner)} has no gear to bring back.`,
        data: { owner, items: items.map(item => item.name), pieces: items }, narrate: false };
}

// `inventory.release { owner }` (a module's call: the party module's removal of a Character block): the member is gone, so nothing may stay filed under their actor (a block made
// later under the same name would inherit it). Their pieces go to the party's bag, taken off and no longer bound (plain items now, their condition kept), and what was set
// aside for them (`kept`) is given back to the bag the same way. Nothing is lost. No feature on it: it runs whatever the gear switch says.
export function release(ctx, payload) {
    if (ctx.caller !== RPG_MODULE) ctx.fail('REFUSED', 'A member\'s things go to the party\'s bag when their block is removed, not from a button, an event or another module.');
    const owner = ownerArg(ctx, payload.owner, undefined);
    if (owner === 'party') ctx.fail('INVALID', 'Only a party member\'s things can be released.');
    const inv = ctx.draft('inventory');
    const names = [];
    for (const stack of Object.values(inv.stacks).filter(item => item.owner === owner).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
        stack.owner = 'party';
        stack.equipped = null;
        delete stack.bound;
        names.push(inv.defs[stack.def]?.name ?? stack.def);
    }
    const list = isPlainObject(inv.kept) && Array.isArray(inv.kept[owner]) ? inv.kept[owner] : [];
    for (const entry of list) {
        const def = inv.defs[entry.def];
        if (!def) continue;
        const id = addStack(ctx, inv, def.id, entry.qty, 'party', entry.note, entry.key === true, entry.story === true);
        if (Number.isSafeInteger(entry.cond)) inv.stacks[id].cond = entry.cond;
        names.push(def.name);
    }
    if (isPlainObject(inv.kept)) {
        delete inv.kept[owner];
        if (!Object.keys(inv.kept).length) delete inv.kept;
    }
    return { summary: names.length ? `${boundName(ctx, owner)}'s things go to the party's bag: ${names.join(', ')}.` : `${boundName(ctx, owner)} has nothing to release.`, data: { owner, items: names }, narrate: false };
}
