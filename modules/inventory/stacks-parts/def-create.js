// Creating the def a name or a given definition means.

import { clone } from '../../scene/domains/common.js';
import { cleanName, resolveDef, slugify } from '../../scene/names.js';
import { DEF_ID } from '../../../core/registry/check.js';
import { packBonus, packSoak } from '../gear.js';
import { MAX_NAME, defaultDef, packCarry } from '../state.js';
import { ambiguous, freeId } from './lookup.js';
import { packDef } from './def-pack.js';
import { registerNew } from './def-build.js';

/**
 * The def a name means, created as `story/<slug>` with the §7 defaults when there is none. `keep` (a reader's add may give a kind and a
 * rarity) are fields a def made here keeps whatever the `item.define` hooks say; a def that already exists, or a pack's, is not changed by it.
 */
export function defineByName(ctx, inv, written, env, about = {}, route = true, keep = {}) {
    const name = cleanName(written);
    if (!name || name.length > MAX_NAME) ctx.fail('INVALID', `An item needs a name of 1 to ${MAX_NAME} characters.`);
    const found = resolveDef(inv, name);
    if (found.status === 'ambiguous') ctx.fail('INVALID', ambiguous(inv, name, found.ids));
    if (found.status === 'found') return { def: inv.defs[found.id], created: false };
    const packed = packDef(ctx, inv, name, env, route);
    if (packed) return packed;
    const def = defaultDef(freeId(inv, `story/${slugify(name)}`), name);
    return { def: registerNew(ctx, inv, def, env, about, { route, written: name, keep }), created: true };
}

/**
 * A full def handed to inventory.grant (MODULES.md F5): an existing def with that ID wins;
 * otherwise it is added (defaults for missing fields, `story/<slug>` when it has no ID) and passed
 * through the hooks, keeping the caller's own rarity and value.
 */
export function defineGiven(ctx, inv, given, env, about) {
    if (typeof given.id === 'string' && inv.defs[given.id]) {
        return { def: inv.defs[given.id], created: false };
    }
    const name = cleanName(given.name);
    if (!name || name.length > MAX_NAME) ctx.fail('INVALID', `An item needs a name of 1 to ${MAX_NAME} characters.`);
    if (given.id !== undefined && (typeof given.id !== 'string' || !DEF_ID.test(given.id))) {
        ctx.fail('INVALID', `"${given.id}" is not a well-formed item definition ID (namespace/slug).`);
    }
    const id = given.id ?? freeId(inv, `story/${slugify(name)}`);
    const def = defaultDef(id, name);
    for (const field of Object.keys(def)) if (field !== 'id' && field !== 'name' && given[field] !== undefined) def[field] = clone(given[field]);
    const keep = {};
    for (const field of ['rarity', 'value']) if (given[field] !== undefined) keep[field] = given[field];
    // A pack item's carry capacity comes with it (a pack shop's stock bought through a module).
    if (packCarry(id, given.carry) !== null) keep.carry = given.carry;
    if (packBonus(id, given.bonus) !== null) keep.bonus = given.bonus;
    if (packSoak(id, given.soak) !== null) keep.soak = given.soak;
    return { def: registerNew(ctx, inv, def, env, about, { keep, written: name }), created: true };
}
