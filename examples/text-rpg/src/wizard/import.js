// Adapted from modules/rpg/view/wizard-data-parts/import.js (keep in step when that file changes). A saved character put into the draft, and taken out again.
import { RULES } from './rules.js';

const oneLine = (value, max) => [...String(value ?? '').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();

/**
 * A good file (charfile.js parseCharacterFile) put into the draft: its stats, its unspent points (the pool the stats are spent from), its level (held to `cap`) and its skills. The name stays the reader's.
 * → { draft, before }, `before` being what `withoutImport` puts back.
 */
export function withImport(draft, file, cap = 99) {
  const { level: _level, from: _from, ...rest } = draft;
  const before = { stats: structuredClone(draft.stats), skills: structuredClone(draft.skills), ...(draft.level > 1 ? { level: draft.level } : {}), ...(draft.from ? { from: structuredClone(draft.from) } : {}) };
  const level = Math.min(cap, file.level);
  const skills = file.skills.map(skill => ({ name: oneLine(skill.name, RULES.nameMax), about: oneLine(skill.about, 160), stat: skill.stat ?? 'str', type: skill.type, pool: skill.cost?.pool ?? '', n: skill.cost?.n ?? 1, rank: skill.rank }));
  return { draft: { ...rest, stats: { ...file.stats }, skills, from: { stats: { ...file.stats }, points: file.points, skills: skills.length, ...(file.xp !== undefined ? { xp: file.xp } : {}) }, ...(level > 1 ? { level } : {}) }, before };
}

/** The draft as it was before `withImport` (`before` is what that handed back); the name and whatever else was typed since stay. */
export function withoutImport(draft, before) {
  const { level: _level, from: _from, ...rest } = draft;
  const back = before ?? {};
  return { ...rest, stats: back.stats ?? { ...RULES.start }, skills: back.skills ?? [], ...(back.level > 1 ? { level: back.level } : {}), ...(back.from ? { from: back.from } : {}) };
}
