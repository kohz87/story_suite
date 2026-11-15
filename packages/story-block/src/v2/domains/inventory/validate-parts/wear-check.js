// Decides whether an actor can wear a piece of equipment in its slot.

import { isPlainObject, capitalize } from '../../common.js';
import { nonBlank } from '../state.js';
import { baseSlot, MANY_SLOTS } from './slots.js';
import { asking } from './shared-asking.js';

const wearerOf = (stack, pc) => (stack.owner === 'party' ? pc ?? 'party' : stack.owner);

/**
 * Can `actor` wear `def`? Equipment with a slot, a slot this chat's rules count (an accessory when
 * accessories count), and what a module answering `items.canWear({ actor, defId })` says
 * ({ ok: false, message } refuses). → { ok, message }
 */
export function canWear(query, def, actor, limits, who = actor) {
    if (def?.kind !== 'equipment') return { ok: false, message: `${def?.name ?? 'That'} is not equipment; it cannot be worn or wielded.` };
    if (!nonBlank(def.slot)) return { ok: false, message: `${def.name} has no slot to be worn in.` };
    const base = baseSlot(def.slot);
    if (Object.hasOwn(MANY_SLOTS, base) && limits[base] === 0) {
        return { ok: false, message: `In this chat's rules no ${base === 'accessory' ? 'accessories' : 'worn pieces'} count, so ${def.name} cannot be worn.` };
    }
    const said = asking(query, 'items.canWear', { actor, defId: def.id });
    if (isPlainObject(said) && said.ok === false) {
        return { ok: false, message: typeof said.message === 'string' && said.message ? said.message : `${capitalize(who)} cannot wear ${def.name}.` };
    }
    return { ok: true, message: '' };
}
