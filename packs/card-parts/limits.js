// The limits and the allow-list a card is held to: its portraits limits and the settings it may recommend.

export const CARD_LIMITS = Object.freeze({
    files: 24,                      // pictures in one portraits entry
    fileBytes: 200 * 1024,          // one picture, decoded
    totalBytes: 3 * 1024 * 1024,    // all pictures, decoded
});

/** The settings a card may recommend. The list grows only with a release. */
export const CARD_SETTING_KEYS = Object.freeze([
    'story-block.rpg', 'story-block.gear', 'story-block.rpgXpRate',
    'npc-state-delta.portraitPromptFormat', 'npc-state-delta.scanEvery',
]);
