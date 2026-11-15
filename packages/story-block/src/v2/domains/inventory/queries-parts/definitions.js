// The answer of `inventory.definitions` from an inventory slice.

import { isPlainObject, clone } from '../../common.js';
import { DEF_ID } from '../../../check.js';

// The most definitions one `inventory.definitions` call may ask for by ID.
export const DEFINITIONS_MAX_IDS = 1000;

/** `inventory.definitions`' answer from an inventory slice (see the query). */
export function definitionsOf(inventory, args) {
    if (args !== undefined && args !== null && !isPlainObject(args)) return [];
    const ids = args?.ids;
    const defs = isPlainObject(inventory?.defs) ? inventory.defs : {};
    let list;
    if (ids === undefined || ids === null) list = Object.keys(defs);
    else if (!Array.isArray(ids) || ids.length > DEFINITIONS_MAX_IDS || ids.some(id => typeof id !== 'string' || !DEF_ID.test(id))) return [];
    else list = [...new Set(ids)].filter(id => Object.hasOwn(defs, id));
    return list.sort().filter(id => isPlainObject(defs[id])).map(id => clone(defs[id]));
}
