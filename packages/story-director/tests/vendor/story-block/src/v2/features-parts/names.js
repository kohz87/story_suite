// Features: the FEATURE_OFF code, the gear switch, Story Block's own feature ids and their legacy switches.

export const FEATURE_OFF = 'FEATURE_OFF';

// The gear switch (inventory.js FEATURE.gear): shown with the RPG settings, not in the Features list (ui-host.js hides it there).
export const GEAR_FEATURE = 'story-block.gear';

// Story Block's own features (src/v2/domains/index.js declares them).
export const CORE_FEATURE = Object.freeze({
    hud: 'story-block.hud',
    cards: 'story-block.cards',
    preroll: 'story-block.preroll',
    extractor: 'story-block.extractor',
    inspector: 'story-block.inspector',
    savepoints: 'story-block.savepoints',
    // Display-only lines a reply may carry for the reader (src/v2/extras.js, MODULES §F115).
    choices: 'story-block.choices',
    chatter: 'story-block.chatter',
    // The scene's weather line (`~ weather`, src/v2/domains/scene.js, MODULES §F120).
    weather: 'story-block.weather',
    // What {{user}} wears and how they are (`~ you`, src/v2/domains/scene.js, MODULES §F126).
    you: 'story-block.you',
    // The party's mounts (`+ mount`, src/v2/domains/mounts.js): the pace they travel at.
    mounts: 'story-block.mounts',
    // The RPG (src/v2/lean-rpg/, SPEC_RPG.md): automatic rolls, the Party tab, the battle log.
    leanRpg: 'story-block.rpg',
    fightBoard: 'story-block.fight-board',
});

// Where Story Block kept these switches before they were features: a reader who set one keeps that
// choice until they touch the feature itself. `storySuite` → true | false | undefined.
export const CORE_LEGACY = Object.freeze({
    [CORE_FEATURE.hud]: suite => (suite?.hud === false ? false : undefined),
    [CORE_FEATURE.preroll]: suite => (typeof suite?.modules?.['story-block']?.assistClassifier === 'boolean' ? suite.modules['story-block'].assistClassifier : undefined),
    [CORE_FEATURE.extractor]: suite => (typeof suite?.modules?.['story-block']?.assistExtractor === 'boolean' ? suite.modules['story-block'].assistExtractor : undefined),
});
