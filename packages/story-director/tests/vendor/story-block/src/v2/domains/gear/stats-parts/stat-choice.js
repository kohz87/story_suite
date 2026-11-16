// Picks the stats a worn piece gives: a name's default stat and the stats of a def or one piece of it.

import { isPlainObject } from '../../common.js';
import { GEAR } from './constants.js';
import { words, singular } from './shared-words.js';
import { statsOf, withinBudget, gearBudget } from './budget.js';

// The stat a kind of thing raises when nothing else says (the name's last matching noun), else the slot's own (GEAR.slotStat).
const STAT_BY_NAME = Object.freeze({
    blade: 'DEX', sword: 'DEX', dagger: 'DEX', bow: 'DEX',
    axe: 'STR', hammer: 'STR', club: 'STR', spear: 'STR',
    staff: 'INT', wand: 'INT', tome: 'INT',
    mail: 'VIT', leather: 'VIT', plate: 'VIT', cuirass: 'VIT', robe: 'VIT', shield: 'VIT', buckler: 'VIT', helmet: 'VIT', helm: 'VIT', cap: 'VIT', hood: 'VIT',
    boot: 'AGI', shoe: 'AGI', sandal: 'AGI', cloak: 'AGI', cape: 'AGI', mantle: 'AGI',
    ring: 'LUK', amulet: 'LUK', pendant: 'LUK',
});
// Quick, finesse weapons raise AGI (the `gearFinesse` rule mark: only items a reply defines after it; an older def keeps its stats). A finesse noun wins over
// the other weapon nouns of the same name ("Cane Sword", "Sword Cane"), not over armour ("Rapier Shield" is still a shield).
const FINESSE = Object.freeze(new Set(['cane', 'rapier', 'katana', 'sabre', 'saber', 'whip', 'estoc', 'scimitar']));
const WEAPON_NOUN = Object.freeze(new Set(['blade', 'sword', 'dagger', 'bow', 'axe', 'hammer', 'club', 'spear', 'staff', 'wand', 'tome']));

/** The stat a piece raises when nothing says: its name's last matching noun, else its slot's default (null: no slot). `finesse`: the quick weapons above count (new items only). */
export function defaultStat(name, slot, finesse = false) {
    const all = words(name).map(singular);
    if (finesse) {
        const last = all.filter(word => FINESSE.has(word) || Object.hasOwn(STAT_BY_NAME, word)).at(-1);
        if (all.some(word => FINESSE.has(word)) && (FINESSE.has(last) || WEAPON_NOUN.has(last))) return 'AGI';
    }
    const nouns = all.filter(word => Object.hasOwn(STAT_BY_NAME, word));
    if (nouns.length) return STAT_BY_NAME[nouns[nouns.length - 1]];
    return GEAR.slotStat[baseOf(slot)] ?? null;
}

/**
 * The stats a def (or one piece of it, `stack`) gives while worn and whole: the ones it lists (`stats: { DEX: 2 }`) held to its budget, else the budget on the stat
 * its name or slot suggests. Nothing without a slot, or with a budget of 0.
 */
export function statsFor(def, stack = null, finesse = false) {
    const budget = gearBudget(def);
    if (!def?.slot || budget <= 0) return {};
    // The reader's re-pointing of this one piece (`stack.stats`, inventory/edit.js repoint): kept to the budget; never on a def, so a pack's stays as it is.
    const own = isPlainObject(stack?.stats) ? withinBudget(statsOf(stack.stats), budget, true) : {};
    if (Object.keys(own).length) return own;
    const listed = withinBudget(statsOf(def.stats), budget);
    if (Object.keys(listed).length) return listed;
    const stat = defaultStat(def.name, def.slot, finesse);
    return stat ? { [stat]: budget } : {};
}

const baseOf = key => (typeof key === 'string' ? key.trim().replace(/-\d+$/, '') : null);
