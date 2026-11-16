// Story Director: change-line record kinds, aliases and quest categories.
export const KINDS = ['agenda', 'event', 'hook', 'quest', 'clock', 'beat', 'secret', 'arc'];

// The old World_State list names and Megumin's blueprint names, so a model that writes the
// list it remembers still lands on the right kind.
export const KIND_ALIASES = Object.freeze({
    offscreen: 'agenda',
    'off-screen': 'agenda',
    npc: 'agenda',
    world: 'event',
    thread: 'hook',
    hooks: 'hook',
    timer: 'clock',
    clocks: 'clock',
    plan: 'beat',
    'off-limits': 'secret',
    'story arc': 'arc',
    quests: 'quest',
    bounty: 'quest',
    bounties: 'quest',
    contract: 'quest',
    contracts: 'quest',
    mission: 'quest',
    favour: 'quest',
    favor: 'quest',
});

// `+ bounty Wolf pelts — …` is a quest of type bounty: the word written is its category.
export const QUEST_TYPE_WORDS = Object.freeze({
    bounty: 'bounty', bounties: 'bounty', contract: 'contract', contracts: 'contract',
    mission: 'mission', favour: 'favour', favor: 'favour',
});

// A quest's own parts: its category (main, side, bounty, contract…), who gave it, what it
// asks, what it pays, the step it is at, and (v0.8.2) how hard it is.
export const QUEST_FIELDS = ['type', 'giver', 'goal', 'reward', 'step', 'difficulty', 'target'];
