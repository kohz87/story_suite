// Resolving a written name to an inventory def: exact alias, names, forms, then the tolerant keys. Pure.

import { aliasKey } from './clean.js';
import { nameForms } from './forms.js';
import { looseKey, portionless } from './loose.js';

// Exact alias, then the defs' own names, then singular/plural forms: a Set of def ids.
function strictIds(defs, aliases, name) {
    const key = aliasKey(name);
    if (!key) return new Set();
    if (aliases[key] && defs[aliases[key]]) return new Set([aliases[key]]);
    const named = form => Object.keys(defs).filter(id => aliasKey(defs[id]?.name) === form);
    const ids = new Set(named(key));
    if (!ids.size) {
        for (const form of nameForms(name)) {
            if (aliases[form] && defs[aliases[form]]) ids.add(aliases[form]);
            named(form).forEach(id => ids.add(id));
        }
    }
    return ids;
}

/**
 * The def a name means in an inventory slice:
 * { status: 'found', id, ids: [id] } | { status: 'ambiguous', ids } | { status: 'none', ids: [] }.
 * Exact alias first; then names and singular/plural forms; then (tolerant) the same without portion
 * words; then the word-order key against every alias and def name.
 */
export function resolveDef(inventory, name) {
    const defs = inventory?.defs ?? {};
    const aliases = inventory?.aliases ?? {};
    const key = aliasKey(name);
    if (!key) return { status: 'none', ids: [] };
    let ids = strictIds(defs, aliases, name);
    if (!ids.size) {
        const bare = portionless(name);
        if (bare && bare !== key) ids = strictIds(defs, aliases, bare);
    }
    if (!ids.size) {
        const loose = looseKey(name);
        if (loose) {
            for (const [alias, id] of Object.entries(aliases)) if (defs[id] && looseKey(alias) === loose) ids.add(id);
            for (const id of Object.keys(defs)) if (looseKey(defs[id]?.name) === loose) ids.add(id);
        }
    }
    const list = [...ids].sort();
    if (list.length === 1) return { status: 'found', id: list[0], ids: list };
    return list.length ? { status: 'ambiguous', ids: list } : { status: 'none', ids: [] };
}
