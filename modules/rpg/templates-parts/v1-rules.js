// The Combat rules block of Combat Rules v1 (data only): the narration rules in words, no numbers. Fights are played on the fight board (Standard + fight board only),
// so the text says the result is told as given and that code, not the story, moves HP, MP and SP.

/** The v1 Combat rules text (the block's prompt holds at most 1200 characters). */
export const COMBAT_PROMPT_V1 = [
    '[COMBAT SYSTEM]',
    'No Plot Armor: combat follows physical reality and the lore. Size, skill, numbers, reach, armor, terrain, preparation and Level all matter. Against a stronger foe, {{user}} loses unless a believable edge exists: ambush, terrain, numbers, poison, preparation.',
    'Exchanges: tell a fight exchange by exchange, each with clear cause, cost and consequence, in order. Most fights are short; never skip the moment that decides it.',
    'Weight & Risk: every strike, miss, wound and hesitation carries impact. Injury, fatigue, fear and pain carry into the next exchange and the next scene.',
    'Believable Outcomes: fights end when logic demands it: death, surrender, retreat, capture or collapse. Victory must be earned; survival must be justified.',
    'Rolls: tell the rolled result as given. Code moves HP, MP and SP for hits, heals and skill costs and gives the XP for a won fight: never set those.',
].join('\n');

export const rulesV1 = {
    slug: 'combat-rules', name: 'Combat rules', role: 'rules', schema: 1, stateVersion: 3, scope: 'chat',
    prompt: COMBAT_PROMPT_V1,
    state: {},
    kinds: {},
};
