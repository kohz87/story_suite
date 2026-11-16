// The inventory's stacks joined with their defs as one sorted list.

import { valueByCond, handDef, statsFor } from '../gear.js';
import { KIND_ORDER, condOf, COND_MAX, packCarry } from '../state.js';
import { defCarry } from './carry.js';

// One collator for the list's name order (what `a.localeCompare(b, 'en', { numeric: true })` gives, without building one per comparison).
const byName = new Intl.Collator('en', { numeric: true });

const ownerRank = owner => (owner === 'party' ? 0 : 1);
const kindRank = kind => (KIND_ORDER.includes(kind) ? KIND_ORDER.indexOf(kind) : KIND_ORDER.length);

/** Stacks joined with their defs, the party's first, then by kind, name and ID. */

export function listItems(inventory, owner = null, carry = null, gear = false, nameOf = null) {
    const defs = inventory?.defs ?? {};
    return Object.values(inventory?.stacks ?? {})
        .filter(stack => defs[stack.def] && (owner === null || stack.owner === owner))
        .map(stack => {
            const def = defs[stack.def];
            return {
                stack: stack.id, def: def.id, name: def.name, kind: def.kind, rarity: def.rarity,
                // With gear on a price is the value by condition (gear.js valueByCond); `baseValue` is the def's own.
                value: gear ? valueByCond(def.value, condOf(stack, inventory)) : def.value, ...(gear ? { baseValue: def.value } : {}),
                slot: def.slot, qty: stack.qty, owner: stack.owner, equipped: stack.equipped, ...(gear && stack.equipped !== null ? { equippedBy: stack.owner } : {}), note: stack.note, from: stack.from,
                ...(condOf(stack, inventory) < COND_MAX ? { cond: condOf(stack, inventory) } : {}),
                ...(stack.key === true ? { key: true } : {}),
                ...(stack.story === true ? { story: true } : {}),
                // (gear on, a piece the reader made by hand: marked, with its own bonus, so a saved character keeps it exactly)
                ...((gear || def.hand === true) && handDef(inventory, def) ? { hand: true, ...(def.kind === 'equipment' ? { stats: statsFor(def, stack) } : {}) } : {}),
                // (a cast member's signature piece, with gear on: whose it is, for the screens' chip)
                ...(gear && typeof stack.bound === 'string' && stack.bound ? { bound: { who: nameOf?.(stack.bound) ?? stack.bound } } : {}),
                // (what the reader set an item to add to carry capacity, `inventory.carry`: a pack's own is never theirs, so a saved character carries only this)
                ...(!def.id.startsWith('pack.') && defCarry(def) ? { readerCarry: defCarry(def) } : {}),
                ...(carryOfStack(stack, def, carry) ? { carry: carryOfStack(stack, def, carry) } : {}),
            };
        })
        .sort((a, b) => ownerRank(a.owner) - ownerRank(b.owner) || (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : 0)
            || kindRank(a.kind) - kindRank(b.kind) || byName.compare(a.name, b.name)
            || (a.stack < b.stack ? -1 : a.stack > b.stack ? 1 : 0));
}

// What a stack adds to carrying: the carry module's word for it when one answers, else its pack def's `carry`.
const carryOfStack = (stack, def, carry) => (carry ? carry[stack.id] ?? null : packCarry(def.id, def.carry));
