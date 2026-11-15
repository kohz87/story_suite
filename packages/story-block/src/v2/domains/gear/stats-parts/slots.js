// Reads gear's slot from a `kind:` / `slot:` word or from the nouns of an item's name.

import { words, singular } from './shared-words.js';

// `kind:` words that name a slot, and the nouns of a name that do.
const SLOT_WORD = Object.freeze({
    weapon: 'weapon', armour: 'body', armor: 'body', body: 'body', shield: 'off-hand', offhand: 'off-hand',
    head: 'head', cloak: 'cloak', feet: 'feet', foot: 'feet', accessory: 'accessory',
});
const NAME_SLOT = Object.freeze({
    sword: 'weapon', blade: 'weapon', axe: 'weapon', hammer: 'weapon', club: 'weapon', bow: 'weapon', dagger: 'weapon', spear: 'weapon', staff: 'weapon', wand: 'weapon', tome: 'weapon',
    mail: 'body', leather: 'body', plate: 'body', cuirass: 'body', robe: 'body',
    shield: 'off-hand', buckler: 'off-hand',
    // A bag is no slot: a name that ends in one ("Leather Satchel") has none, whatever else it says.
    pack: null, satchel: null, bag: null, sack: null, backpack: null,
    helmet: 'head', helm: 'head', cap: 'head', hood: 'head',
    cloak: 'cloak', cape: 'cloak', mantle: 'cloak',
    boot: 'feet', shoe: 'feet', sandal: 'feet',
    ring: 'accessory', amulet: 'accessory', pendant: 'accessory', belt: 'accessory',
    gauntlet: 'accessory', glove: 'accessory', bracer: 'accessory', bracelet: 'accessory',
});
// Real compound gear words ("Longsword", "Warhammer", "Breastplate", "Longbow"), each matched as a whole word (a plural s is allowed, as for the nouns above).
// No word is read by its ending: "horseshoe", "reboot", "windshield", "crossword", "flagstaff" and "rainbow" are not gear.
const COMPOUND_SLOT = Object.freeze({
    longsword: 'weapon', shortsword: 'weapon', broadsword: 'weapon', greatsword: 'weapon', bastardsword: 'weapon', twohandedsword: 'weapon',
    warhammer: 'weapon', battleaxe: 'weapon', greataxe: 'weapon', handaxe: 'weapon', warstaff: 'weapon', quarterstaff: 'weapon',
    longbow: 'weapon', shortbow: 'weapon', crossbow: 'weapon', greatbow: 'weapon', warbow: 'weapon',
    breastplate: 'body', chainmail: 'body', platemail: 'body', ringmail: 'body',
});
const slotOfWord = word => {
    if (Object.hasOwn(NAME_SLOT, word)) return { slot: NAME_SLOT[word] };
    if (Object.hasOwn(COMPOUND_SLOT, word)) return { slot: COMPOUND_SLOT[word] };
    return null;
};
const foldHand = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/off[\s-]*hand/g, 'offhand');

/**
 * The slot a `kind:` / `slot:` / `equipped:` word names: weapon, body (armour), off-hand (shield), head, cloak, feet or accessory
 * (`accessory-1` / `accessory-2` keep their number), or null.
 */
export function slotWordOf(value) {
    const text = foldHand(value);
    const place = /accessory[\s-]*([12])/.exec(text);
    if (place) return `accessory-${place[1]}`;
    for (const word of words(text)) if (Object.hasOwn(SLOT_WORD, word)) return SLOT_WORD[word];
    return null;
}

/** A slot as the place a piece is filed under: `accessory` → `accessory-1`; the others as they are. */
export const placeOf = slot => (slot === 'accessory' ? 'accessory-1' : slot);

/** The slot of a line's `kind:` / `slot:` word, else of the name (its last noun that says so), or null. */
export function gearSlotOf(kindWord, name) {
    const said = slotWordOf(kindWord);
    if (said) return said;
    const found = words(name).map(singular).map(slotOfWord).filter(Boolean);
    return found.length ? found.at(-1).slot : null;
}
