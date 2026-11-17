// The Skills block's row shape and slot count: how many skill slots a definition has and one skill's row.
import { SKILL_SLOTS_MAX, typeKey } from '../../../../core/runtime/skill-slots.js';

export const skillCapacity = definition => Math.min(SKILL_SLOTS_MAX, Object.keys(definition?.state ?? {}).filter(key => /^skill\d+$/u.test(key)).length);
export const skillRow = (fields, n) => ({ name: fields[`skill${n}`], about: typeof fields[`about${n}`] === 'string' ? fields[`about${n}`] : '', stat: fields[`stat${n}`], uses: fields[`uses${n}`] ?? 'stamina', rank: Number.isSafeInteger(fields[`rank${n}`]) ? fields[`rank${n}`] : 0, ...typeKey(fields[`type${n}`]) });
