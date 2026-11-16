// Taking a pack's def for a name the inventory does not know yet.

import { isPlainObject, clone } from '../../common.js';
import { cleanName, aliasKey } from '../../names.js';
import { DEF_ID } from '../../../check.js';
import { packBonus, packSoak } from '../../gear.js';
import { packCarry, defaultDef } from '../state.js';
import { registerNew } from './def-build.js';

// The `item.resolve(name)` hooks (packs, MODULES §E): a pack's def for a name the inventory does
// not know yet, taken as the pack wrote it (its numbers are the rules; item.define does not run),
// with the written name kept as an alias. The first hook that answers wins.
export function peekPackDef(env, name) {
    for (const hook of env.hooks('item.resolve')) {
        let found;
        try { found = hook(name); } catch { found = null; }
        if (isPlainObject(found) && typeof found.id === 'string' && DEF_ID.test(found.id) && cleanName(found.name)) return found;
    }
    return null;
}

export function packDef(ctx, inv, name, env, route = true) {
    for (const hook of env.hooks('item.resolve')) {
        let found;
        try { found = hook(name); } catch { found = null; }
        if (!isPlainObject(found) || typeof found.id !== 'string' || !DEF_ID.test(found.id) || !cleanName(found.name)) continue;
        const known = inv.defs[found.id];
        const def = known ?? defaultDef(found.id, cleanName(found.name));
        if (!known) {
            for (const field of Object.keys(def)) if (field !== 'id' && found[field] !== undefined && found[field] !== null) def[field] = clone(found[field]);
            const carry = packCarry(def.id, found.carry);
            if (carry !== null) def.carry = carry;
            const bonus = packBonus(def.id, found.bonus);
            if (bonus !== null) def.bonus = bonus;
            const soak = packSoak(def.id, found.soak);
            if (soak !== null) def.soak = soak;
            if (def.kind === 'equipment') def.stack = false;   // MODULES.md F6
            registerNew(ctx, inv, def, env, {}, { route, hooks: false, template: def.id });
        }
        inv.aliases[aliasKey(name)] ??= def.id;
        return { def: inv.defs[def.id], created: !known };
    }
    return null;
}
