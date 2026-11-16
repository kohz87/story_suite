// A saved character file put into the draft, and taken out again.

import { CREATION } from '../../names.js';
import { SKILL_FIELDS_MAX } from '../../../../core/runtime/skill-slots.js';
import { fold } from '../../read.js';
import { startStats } from './draft.js';
import { oneLine } from './shared-helpers.js';

/**
 * A saved character put into the draft (a good file, ../charfile.js parseCharacterFile): its stats, unspent points (the pool the stats are spent
 * from), Soul Class and skills with their ranks. The name, You or a companion, who they are and the skill set choice are left alone (a set is
 * cleared: the skills now come from the file). → { draft, before }, `before` being what `withoutImport` puts back.
 */
export function withImport(draft, file) {
    const before = structuredClone({ stats: draft.stats, skills: draft.skills, set: draft.set, ...(draft.level > 1 ? { level: draft.level } : {}), ...(draft.from ? { from: draft.from } : {}) });
    const { level: _level, from: _from, ...rest } = draft;
    const next = {
        ...rest, stats: { ...file.stats }, set: '', from: { stats: { ...file.stats }, points: file.points },
        // (every skill the file holds is kept, whatever the file's level says: a level drop never takes a skill away; a signature skill already in the draft stays in front)
        skills: [...draft.skills.filter(skill => skill.sig === true), ...file.skills.filter(skill => !draft.skills.some(other => other.sig === true && fold(other.name) === fold(skill.name)))]
            .slice(0, SKILL_FIELDS_MAX).map(skill => (skill.sig === true ? skill : { name: oneLine(skill.name, CREATION.skillName), about: oneLine(skill.about, CREATION.skillAbout), stat: skill.stat ?? '', uses: skill.uses, start: 0, rank: skill.rank, ...(skill.type === 'utility' ? { type: 'utility' } : {}) })),
        ...(file.level > 1 ? { level: file.level } : {}),
    };
    return { draft: next, before };
}

/** The draft as it was before `withImport` (`before` is what that handed back): the stats, skills, Soul Class and skill set; nothing typed since is touched. */
export function withoutImport(draft, before) {
    const { level: _level, from: _from, ...rest } = draft;
    const back = structuredClone(before ?? {});
    return { ...rest, stats: back.stats ?? startStats(null), skills: back.skills ?? [], set: back.set ?? '', ...(back.level > 1 ? { level: back.level } : {}), ...(back.from ? { from: back.from } : {}) };
}
