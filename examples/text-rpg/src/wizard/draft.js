// The wizard's draft of the character (a plain object, changed only through these functions) and its checks: the points, the problems that hold Create back, the `textRpg.create` payload. `level` (only above 1) is the starting level; `from` ({ stats, points, skills }) is what a saved character brought.
import { STAT_KEYS } from '../words/stats.js';
import { levelOf, skillLimit } from './limits.js';
import { pointsLeft, poolOf } from './points.js';
import { RULES, SKILL_TYPES } from './rules.js';
import { W, fill } from './words.js';

const int = value => (Number.isFinite(value) ? Math.trunc(value) : 0);
const blankSkill = () => ({ name: '', about: '', stat: 'str', type: SKILL_TYPES[0].value, pool: '', n: 1 });

/** A fresh draft: the name given (the reader's persona), every stat at 5, no skills; `skill()` is a new blank skill. */
export function newDraft(name = '') {
  return { name, stats: { ...RULES.start }, skills: [], skill: blankSkill };
}

/** The sentences that hold Create back, in step order; [] when the draft can be sent. */
export function problemsOf(draft) {
  const out = [];
  if (!draft.name.trim()) out.push(W.needName);
  const left = pointsLeft(draft);
  if (left > 0) out.push(fill(W.needPoints, { n: poolOf(draft), left }));
  if (left < 0) out.push(fill(W.tooMany, { n: -left }));
  if (draft.skills.length > skillLimit(draft)) out.push(fill(W.tooManySkills, { n: draft.skills.length - skillLimit(draft), level: levelOf(draft), max: skillLimit(draft) }));
  if (draft.skills.some(skill => !skill.name.trim())) out.push(W.needSkillName);
  return out;
}

/** The `textRpg.create` payload for the draft: { name, stats, skills: [{ name, about, stat, type, cost?, rank? }], level?, imported?, budget?, xp? }. */
export function payloadOf(draft) {
  return {
    name: draft.name.trim(),
    ...(levelOf(draft) > 1 ? { level: levelOf(draft) } : {}),
    ...(draft.from ? { imported: true, budget: STAT_KEYS.reduce((sum, key) => sum + draft.from.stats[key], 0) + draft.from.points, ...(draft.from.xp !== undefined ? { xp: draft.from.xp } : {}) } : {}),
    stats: Object.fromEntries(STAT_KEYS.map(key => [key, int(draft.stats[key])])),
    skills: draft.skills.map(skill => ({
      name: skill.name.trim(), about: skill.about.trim(), stat: skill.stat, type: skill.type,
      ...(skill.rank > 0 ? { rank: skill.rank } : {}),
      ...(skill.pool ? { cost: { pool: skill.pool, n: Math.max(1, Math.min(RULES.costMax, int(skill.n) || 1)) } } : {}),
    })),
  };
}
