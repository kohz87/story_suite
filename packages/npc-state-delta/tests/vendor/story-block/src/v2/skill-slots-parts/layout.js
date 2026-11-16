// The typed-skills layout: the utility slots, the most fields, the skill types and the slot-number pattern.
import { SKILL_SLOTS_MAX } from './counts.js';
// A Skills block made with the types (templates-skills.js) has three more slots, 9 to 11, and a `type<n>` field on every slot: a skill is `combat` (the slots above) or
// `utility` (three of their own, for the story only). A block with no `type1` field is read as all combat and keeps its slots as they were.
export const UTILITY_SLOTS = 3;
export const SKILL_FIELDS_MAX = SKILL_SLOTS_MAX + UTILITY_SLOTS;
export const SKILL_TYPES = Object.freeze(['combat', 'utility']);
export const SLOT_NUMBER = '(?:[1-9]|1[01])';
