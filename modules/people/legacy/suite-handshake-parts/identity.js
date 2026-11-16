// Delta's suite identity: its id, its name, the four areas it owns and the source-of-truth choices.

export const SUITE_ID = 'npc-state-delta';
export const SUITE_NAME = 'NPC State Delta';

// Calendar, scene and stats are fallbacks: the suite's AREAS order lets their specialists win.
export const SUITE_AREAS = Object.freeze(['npc', 'calendar', 'scene', 'stats']);
export const SOURCE_OF_TRUTH_CHOICES = Object.freeze(['auto', 'mine', 'theirs']);
