// Restores a character's pool on the data domain and lists the bag's consumables and the allies they can go to.
import { charId, rosterOf } from '../../standard/roster.js';
import { recoverBar, recoveryOf } from './recovery.js';

/** The most a block's own field holds (a block of an older definition holds at most 5): `maxOf(domain)(module, field)`, Infinity when the pins do not say. */
export const maxOf = domain => (module, field) => {
    const max = domain?.pins?.[domain?.active?.[module]?.hash]?.definition?.state?.[field]?.max;
    return Number.isSafeInteger(max) ? max : Infinity;
};

/**
 * Restores a pool of `character` (a sheet character) on `domain` (the dataModules domain, written in place): up to `blocks`, capped at the bar's size.
 * → the bar's move as the board records it: { id, kind, name, module, field, from, to, size, blocks: -gained, pool, gained }.
 */
export function recoverPool(domain, sheet, character, pool, blocks) {
    const bars = rosterOf(sheet, maxOf(domain)), id = pool === 'health' ? charId(character) : `${charId(character)}:${pool}`;
    const bar = (pool === 'health' ? bars.characters : bars.resources).find(entry => entry.id === id);
    const moved = recoverBar(bar, pool, blocks), fields = domain?.instances?.[character.module]?.chat?.fields;
    if (moved.gained > 0 && fields && Object.hasOwn(fields, pool)) fields[pool] = moved.to;
    return { id, kind: 'char', name: character.who, module: character.module, field: pool, from: moved.from, to: moved.to, size: moved.size, blocks: -moved.gained, pool, gained: moved.gained };
}

/** The consumables a fight may offer from the bag: [{ stack, name, qty, pool, blocks }] by name, minus the units `taken` (stack ids already chosen this exchange); bound pieces are left out. */
export function consumablesIn(inventory, taken = []) {
    const out = [];
    for (const stack of Object.values(inventory?.stacks ?? {})) {
        const def = inventory.defs?.[stack.def], qty = stack.qty - taken.filter(id => id === stack.id).length;
        if (def?.kind !== 'consumable' || qty < 1 || (typeof stack.bound === 'string' && stack.bound)) continue;
        out.push({ stack: stack.id, name: def.name, qty, ...recoveryOf(def) });
    }
    return out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.stack < b.stack ? -1 : 1));
}

/** The allies an item may go to, with the pool it would fill: [{ who, value, size }] for the characters not gone from the party (a Down one too). */
export function allyBars(sheet, domain, pool) {
    const bars = rosterOf(sheet, maxOf(domain)), list = pool === 'health' ? bars.characters : bars.resources.filter(bar => bar.field === pool);
    return list.filter(bar => (bar.character ?? sheet.characters.find(entry => entry.who === bar.name))?.alive !== false).map(bar => ({ who: bar.name, value: bar.value, size: bar.size }));
}
