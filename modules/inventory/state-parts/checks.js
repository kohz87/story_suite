// The shape checks for an item definition and for a member's kept gear.

import { isPlainObject, OWNER_RE } from '../../scene/domains/common.js';
import { DEF_ID } from '../../../core/registry/check.js';
import { GEAR } from '../gear.js';
import { KINDS, RARITIES } from './kinds.js';
import { MAX_NAME } from './limits.js';
import { isCount, nonBlank } from './shape.js';
import { CARRY_MAX } from './carry.js';
import { COND_MAX } from './shared-cond.js';

export function defErrors(key, def) {
    if (!isPlainObject(def)) return [`Item definition ${key} is not a record.`];
    const label = nonBlank(def.name) ? def.name : key;
    const errors = [];
    if (def.id !== key) errors.push(`Item definition ${key} is filed under the wrong ID.`);
    if (!DEF_ID.test(key)) errors.push(`"${key}" is not a well-formed item definition ID (namespace/slug).`);
    if (!nonBlank(def.name) || def.name.length > MAX_NAME) errors.push(`Item definition ${key} needs a name of 1 to ${MAX_NAME} characters.`);
    if (!KINDS.includes(def.kind)) errors.push(`${label} has an unknown kind "${def.kind}".`);
    if (!RARITIES.includes(def.rarity)) errors.push(`${label} has an unknown rarity "${def.rarity}".`);
    if (!isCount(def.value, 0)) errors.push(`${label} has a value that is not a whole number of at least 0.`);
    if (typeof def.stack !== 'boolean') errors.push(`${label} must say whether it stacks (true or false).`);
    else if (def.kind === 'equipment' && def.stack) errors.push(`${label} is equipment, which never stacks.`);
    if (def.slot !== null && !nonBlank(def.slot)) errors.push(`${label} has a slot that is neither empty nor a name.`);
    if (!isPlainObject(def.stats)) errors.push(`${label} has stats that are not a record.`);
    if (!isPlainObject(def.effect)) errors.push(`${label} has an effect that is not a record.`);
    if (!Array.isArray(def.tags) || def.tags.some(tag => typeof tag !== 'string')) errors.push(`${label} has tags that are not a list of words.`);
    if (typeof def.note !== 'string') errors.push(`${label} has a note that is not text.`);
    if (def.carry !== undefined && !(isCount(def.carry, 1) && def.carry <= CARRY_MAX)) errors.push(`${label} adds a carry capacity of ${def.carry}; it is a whole number from 1 to ${CARRY_MAX}.`);
    if (def.bonus !== undefined && !(isCount(def.bonus, 0) && def.bonus <= GEAR.bonusMax)) errors.push(`${label} has a gear bonus of ${def.bonus}; it is a whole number from 0 to ${GEAR.bonusMax}.`);
    if (def.soak !== undefined && !(isCount(def.soak, 0) && def.soak <= GEAR.soak.capMax)) errors.push(`${label} has a soak of ${def.soak}; it is a whole number from 0 to ${GEAR.soak.capMax}.`);
    return errors;
}

/** §2.5 validator for the inventory slice: [] when fine, else plain sentences. */
// `kept[<member>]`: the bound pieces of a member who left the party, set aside until they come back (`inventory.stow` / `inventory.restore`):
// [{ def, qty, equipped, note, cond?, key?, story? }].
export function keptErrors(kept) {
    if (!isPlainObject(kept)) return ['The kept gear is not a record.'];
    const errors = [];
    for (const [owner, list] of Object.entries(kept)) {
        if (!OWNER_RE.test(owner) || owner === 'party') errors.push(`Kept gear belongs to "${owner}", who is not a party member's ID.`);
        if (!Array.isArray(list)) { errors.push(`The gear kept for ${owner} is not a list.`); continue; }
        for (const entry of list) {
            if (!isPlainObject(entry) || typeof entry.def !== 'string' || !isCount(entry.qty, 1) || !(entry.equipped === null || nonBlank(entry.equipped)) || typeof entry.note !== 'string'
                || (entry.by !== undefined && typeof entry.by !== 'string') || (entry.cond !== undefined && !(Number.isSafeInteger(entry.cond) && entry.cond >= 0 && entry.cond <= COND_MAX))) errors.push(`A piece kept for ${owner} is damaged.`);
        }
    }
    return errors;
}
