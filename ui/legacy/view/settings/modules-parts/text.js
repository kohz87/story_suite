// The Modules page's wording, the fold threshold and the known descriptions of the suite's own modules.

/** A module with more settings than this and more than one group folds its groups. */
export const FOLD_ABOVE = 6;
export const MODULES_TEXT = Object.freeze({
    versionsTitle: 'Versions',
    inStep: 'all in step',
    outOfStep: '{n} out of step',
    noDescription: '',
    panelFailed: 'This part of {name}\'s settings could not be shown: {why}',
});

// A module that does not say what it does (its `description`) gets a line here when it is one of Story Suite's own.
export const KNOWN_DESCRIPTIONS = Object.freeze({
    'story-block': 'The story\'s memory: the scene, the inventory and money, packs, and the two optional helpers.',
    'story-director': 'The game master: story time, quests, the world and its map, the chronicle and the story\'s arcs.',
    'npc-state-delta': 'How each person in the story feels about you: meters, stages and dossiers.',
});
