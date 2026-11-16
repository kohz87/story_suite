// The Combat rules template and its text, base and Standard.

const COMBAT_PROMPT = [
    '[COMBAT SYSTEM]',
    'No Plot Armor: combat follows physical reality and the lore. Size, skill, numbers, reach, armor, terrain, preparation and Level all matter. Against a stronger foe, {{user}} loses unless a believable edge exists: ambush, terrain, numbers, poison, preparation.',
    'Exchanges: a fight is told exchange by exchange, each with clear cause, cost and consequence, in the order things happen. Most fights are short; one exchange may be the whole fight. Never skip the moment that decides it.',
    'Weight & Risk: every strike, miss, wound and hesitation carries impact. Injury, fatigue, fear and pain carry into the next exchange and the next scene.',
    'Believable Outcomes: fights end when logic demands it: death, surrender, retreat, capture or collapse. NPCs take those exits when the fight turns against them. Victory must be earned; survival must be justified.',
    'XP guide: code gives XP for a won fight; write none for it. Other deeds 5 to 40. Practice a skill 5 to 20 per use.',
].join('\n');

const combat = {
    slug: 'combat-rules', name: 'Combat rules', role: 'rules', schema: 1, stateVersion: 1, scope: 'chat',
    prompt: COMBAT_PROMPT,
    state: {},
    kinds: {},
};

/**
 * The Combat rules text: the base one, a little shorter (the block's prompt holds at most 1200 characters), with the roll types and the
 * blocks in words. No numbers: the roll table, the odds and the foe's numbers are the rules' (Settings → RPG); the narrator follows the told result.
 */
export const COMBAT_PROMPT_STANDARD = [
    '[COMBAT SYSTEM]',
    'No Plot Armor: combat follows physical reality and the lore. Size, skill, numbers, reach, armor, terrain, preparation and Level all matter. Against a stronger foe, {{user}} loses unless a believable edge exists: ambush, terrain, numbers, poison, preparation.',
    'Exchanges: tell a fight exchange by exchange, each with clear cause, cost and consequence, in order. Most fights are short; never skip the moment that decides it.',
    'Weight & Risk: every strike, miss, wound and hesitation carries impact. Injury, fatigue, fear and pain carry into the next exchange and the next scene.',
    'Believable Outcomes: fights end when logic demands it: death, surrender, retreat, capture or collapse. Victory must be earned; survival must be justified.',
    'Rolls: tell the rolled result as given; code moves the bars for hits, heals, skill costs: never set those.',
].join('\n');

export const standardCombat = { ...combat, stateVersion: 2, prompt: COMBAT_PROMPT_STANDARD };
