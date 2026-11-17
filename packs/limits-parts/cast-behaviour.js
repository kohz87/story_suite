// The skill rank words and the behaviour levers and levels of a cast member.

import { SKILL_RANKS_V1 } from './skill-words.js';

// The seven ranks of Combat Rules v1 (Novice to Legend), written in lower case.
export const CAST_SKILL_RANK_WORDS = SKILL_RANKS_V1;
// The behaviour levers (NPC State's own, core-prompts.js BEHAVIOR_LEVER_LABELS) and the levels a `behaviour` line may carry.
export const CAST_BEHAVIOUR_LEVERS = Object.freeze(['Disposition', 'Care', 'Expression', 'Independence', 'Conflict', 'Threat', 'Analytical', 'Presentation', 'Mercy', 'Loyalty', 'Drive', 'Honesty']);
export const CAST_BEHAVIOUR_LEVELS = Object.freeze(['low', 'medium', 'high']);
