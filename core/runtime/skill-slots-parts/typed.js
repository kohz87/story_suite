// Reading a Skills block's typed fields: whether it is typed, how many slots it has and the type of a slot.
import { SKILL_SLOTS_MAX } from './counts.js';
import { SKILL_FIELDS_MAX } from './layout.js';
export const isTypedSkills = fields => Boolean(fields) && Object.hasOwn(fields, 'type1');
export const skillFieldSlots = fields => (isTypedSkills(fields) ? SKILL_FIELDS_MAX : SKILL_SLOTS_MAX);
// A skill's type as a seed row carries it: the v1 types other than attack (the default) and a plain attack has no key. { type } or {}.
const SEED_TYPES = Object.freeze(['area', 'defence', 'evasion', 'movement', 'heal', 'support', 'utility']);
export const typeKey = type => (SEED_TYPES.includes(type) ? { type } : {});
export const skillTypeOf = (fields, slot) => (isTypedSkills(fields) && fields[`type${slot}`] === 'utility' ? 'utility' : 'combat');
