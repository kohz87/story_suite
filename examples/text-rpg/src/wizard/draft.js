// The wizard's draft of the character (a plain object, changed only through these functions) and its checks: the points, the problems that hold Create back, the `textRpg.create` payload.
import { STAT_KEYS } from '../words/stats.js';
import { RULES, SKILL_TYPES } from './rules.js';
import { W, fill } from './words.js';

const int = value => (Number.isFinite(value) ? Math.trunc(value) : 0);
const blankSkill = () => ({ name: '', about: '', stat: 'str', type: SKILL_TYPES[0].value, pool: '', n: 1 });

/** A fresh draft: no name, the start stats, no skills; `skill()` is a new blank skill. */
export function newDraft() {
  return { name: '', stats: { ...RULES.start }, skills: [], skill: blankSkill };
}

/** The points still to place: the pool less what the stats add up to (below 0 when over). */
export const pointsLeft = draft => RULES.total - STAT_KEYS.reduce((sum, key) => sum + int(draft.stats[key]), 0);

/** The sentences that hold Create back, in step order; [] when the draft can be sent. */
export function problemsOf(draft) {
  const out = [];
  if (!draft.name.trim()) out.push(W.needName);
  const left = pointsLeft(draft);
  if (left > 0) out.push(fill(W.needPoints, { n: RULES.total, left }));
  if (left < 0) out.push(fill(W.tooMany, { n: -left, total: RULES.total }));
  if (draft.skills.some(skill => !skill.name.trim())) out.push(W.needSkillName);
  return out;
}

/** The `textRpg.create` payload for the draft: { name, stats, skills: [{ name, about, stat, type, cost? }] }. */
export function payloadOf(draft) {
  return {
    name: draft.name.trim(),
    stats: Object.fromEntries(STAT_KEYS.map(key => [key, int(draft.stats[key])])),
    skills: draft.skills.map(skill => ({
      name: skill.name.trim(), about: skill.about.trim(), stat: skill.stat, type: skill.type,
      ...(skill.pool ? { cost: { pool: skill.pool, n: Math.max(1, Math.min(RULES.costMax, int(skill.n) || 1)) } } : {}),
    })),
  };
}
