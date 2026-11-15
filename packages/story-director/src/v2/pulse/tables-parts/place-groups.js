// Folds an atlas place kind into a place group.

export const PLACE_GROUPS = Object.freeze(['wild', 'town', 'indoors', 'road', 'water']);
export const DEFAULT_GROUP = 'town';

const GROUP_WORDS = Object.freeze({
    water: ['port', 'harbour', 'harbor', 'quay', 'dock', 'pier', 'lake', 'river', 'shore', 'ferry', 'coast', 'sea'],
    indoors: ['inn', 'tavern', 'temple', 'castle', 'tower', 'dungeon', 'cave', 'hall', 'house', 'shop', 'keep', 'cellar', 'chapel'],
    town: ['city', 'town', 'village', 'market', 'square', 'district', 'hamlet'],
    wild: ['forest', 'wood', 'woods', 'mountain', 'hill', 'moor', 'field', 'plain', 'marsh', 'camp', 'grove', 'valley'],
    road: ['road', 'bridge', 'crossroads', 'gate', 'pass', 'ford', 'landmark', 'ruin', 'ruins', 'trail', 'path'],
});
const GROUP_ORDER = Object.freeze(['water', 'indoors', 'town', 'wild', 'road']);

/** The place group of an atlas place kind (`'inn/tavern'`, `'Forest'`, `'river port'`): the first group whose words it has. */
export function placeGroupOf(kind) {
    const words = String(kind ?? '').toLowerCase().split(/[\s/,;|-]+/).filter(Boolean);
    for (const group of GROUP_ORDER) {
        if (words.some(word => GROUP_WORDS[group].includes(word))) return group;
    }
    return DEFAULT_GROUP;
}
