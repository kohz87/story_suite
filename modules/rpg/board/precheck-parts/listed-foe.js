// A foe a pack lists in its bestiary (`content.foes`): the one a group's name means, by its name or an alias (whole words, plurals fine).
import { nameKey } from './shared-words.js';

/** The bestiary entry `{ name, tier, level? }` that `name` means, or null: the first one in pack order whose name or alias is the same words. */
export function listedFoe(bestiary, name) {
    const key = nameKey(name);
    if (!key || !Array.isArray(bestiary)) return null;
    return bestiary.find(foe => foe && [foe.name, ...(Array.isArray(foe.aliases) ? foe.aliases : [])].some(word => nameKey(word) === key)) ?? null;
}
