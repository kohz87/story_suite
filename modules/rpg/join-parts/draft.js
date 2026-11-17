// Join: the wizard draft and definitions of a joining companion.

import { STATS_V1 } from '../names.js';
import { typeKey } from '../../../core/runtime/skill-slots.js';
import { buildDefinitions, creationOf, readDraft } from '../view/wizard-data.js';
import { levelOfClass } from '../formula.js';
import { companionStatsV1 } from '../formula-parts/companion-v1.js';
import { STANDARD_FORMULA, isStandard } from '../rules.js';

/** The wizard's draft for a joining companion (the card's Edit first opens it): name, class, the best stat raised (formula-parts/companion-v1.js). */
export function joinDraft({ name = '', soul = 1, best = '', skills = [] } = {}, rules = null) {
    // (a cast member's signature skills, as the pack wrote them: they fill the slots in order, at the rank written, marked `sig` so the story never renames or replaces them; a `utility` one keeps its type and counts against the three utility slots)
    const signed = (Array.isArray(skills) ? skills : []).map(skill => ({ name: skill.name, about: skill.about, stat: skill.stat, uses: skill.uses, start: 0, rank: skill.rank, sig: true, ...typeKey(skill.type) }));
    // Every stat 5 and the best 9, then a point for every third level the class stands for (companionStatsV1); the draft's budget is
    // exactly what they cost, so "Edit first" can move points around but is not handed more. (Without rules: the Standard preset's creation numbers.)
    const standard = isStandard(rules) ? rules : STANDARD_FORMULA;
    const stats = companionStatsV1(best, levelOfClass(soul)), creation = creationOf(standard);
    const spent = STATS_V1.reduce((sum, stat) => sum + stats[stat] - creation.start, 0);
    return readDraft({ name, soul, stats, kind: 'companion', skills: signed, set: '', creation: { ...creation, budget: spent, max: creation.statMax } });
}

/**
 * The two definitions a joining companion is made of (`used`: the ids of the story's blocks, so the slugs are free). The Character
 * starts with no unspent points: the named stat is raised and the rest left as it was, as the line said.
 */
export const joinDefinitions = (request, { used = [], soul = request.soul, rules = null, cap = null } = {}) =>
    buildDefinitions(joinDraft({ ...request, soul }, rules), { used, points: 0, cap });
