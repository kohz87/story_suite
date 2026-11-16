// The optional mechanics the inventory domain owns and the module that rolls the dice.

// The optional mechanics this domain owns (MODULES §F100), declared by the core module. A host without
// the Features API ignores the list and every check below takes them as on.
export const FEATURE = Object.freeze({ loot: 'story-block.loot', encumbrance: 'story-block.encumbrance', gear: 'story-block.gear' });
export const INVENTORY_FEATURES = Object.freeze([
    Object.freeze({
        id: FEATURE.loot, label: 'Pick what you take', default: true, presets: Object.freeze({ lean: false }),
        describe: 'The story can lay out loot (? loot A, B, C — where); the reply\'s card shows it as chips and you take the ones you want.',
    }),
    Object.freeze({
        id: FEATURE.encumbrance, label: 'Encumbered', default: true, presets: false,
        describe: 'What the story gives past the carry limit is kept, and the party is encumbered (a check penalty) until something is put down. Your own buys and takes are still refused.',
    }),
    Object.freeze({
        id: FEATURE.gear, label: 'Gear in fights', default: false, presets: false,
        describe: 'Worn gear adds a few points to the stats by rarity and wears down; what a member can carry follows their strength (and the party is encumbered past it).',
    }),
]);

/** The module whose `rpg.resolve` rolls the dice: the only caller `gear.wear { recorded: true }` accepts. */
export const RPG_MODULE = 'story-block';
