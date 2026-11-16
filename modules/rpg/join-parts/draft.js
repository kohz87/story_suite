// Join: the wizard draft, definitions and scale of a joining companion.

import { activeDefinition } from '../../../packages/story-block/src/v2/data-modules/adapters.js';
import { STATS } from '../names.js';
import { buildDefinitions, creationOf, readDraft } from '../view/wizard-data.js';
import { companionStats, levelOfClass } from '../formula.js';
import { STANDARD_FORMULA, isStandard } from '../rules.js';

/** The wizard's draft for a joining companion (the card's Edit first opens it): name, about, class, the best stat raised to 14 (under the Standard formula `rules`: formula.js companionStats). */
export function joinDraft({ name = '', about = '', soul = 1, best = '', skills = [] } = {}, rules = null) {
    // (a cast member's signature skills, as the pack wrote them: they fill the slots in order, at the rank written, marked `sig` so the story never renames or replaces them; a `utility` one keeps its type and counts against the three utility slots)
    const signed = (Array.isArray(skills) ? skills : []).map(skill => ({ name: skill.name, about: skill.about, stat: skill.stat, uses: skill.uses, start: 0, rank: skill.rank, sig: true, ...(skill.type === 'utility' ? { type: 'utility' } : {}) }));
    // Every stat 5 and the best 9, then a point for every third level the class stands for (formula.js companionStats); the draft's budget is
    // exactly what they cost, so "Edit first" can move points around but is not handed more. (Without rules: the Standard preset's.)
    const standard = isStandard(rules) ? rules : STANDARD_FORMULA;
    const stats = companionStats(best, levelOfClass(soul), standard), creation = creationOf(standard);
    const spent = STATS.reduce((sum, stat) => sum + stats[stat] - creation.start, 0);
    return readDraft({ name, about, soul, stats, kind: 'companion', skills: signed, set: '', creation: { ...creation, budget: spent, max: creation.statMax } });
}

/**
 * The two definitions a joining companion is made of (`used`: the ids of the story's blocks, so the slugs are free). The Character
 * starts with no unspent points: the named stat is raised and the rest left as it was, as the line said.
 */
export const joinDefinitions = (request, { used = [], soul = request.soul, rules = null, cap = null, legacy = false, scale = 2, typed = true } = {}) =>
    buildDefinitions(joinDraft({ ...request, soul }, rules), { used, points: 0, cap, legacy, scale, typed });

/**
 * A Re-read takes the joined character's scale from that reply's pin. Otherwise choose 1 when all existing character pins are old, else 2.
 * Inspect pins even when a character has left or has no readable name; those old pins still identify the story's existing scale.
 */
export const joinScale = (state, standing = null, module = null) => {
    const joined = module && standing ? activeDefinition(standing, module) : null;
    if (joined?.role === 'character') return joined.state?.health?.scale === 2 ? 2 : 1;
    const pins = Object.keys(state?.domains?.dataModules?.active ?? {}).map(id => activeDefinition(state, id)).filter(definition => definition?.role === 'character');
    return pins.length && !pins.some(definition => definition.state?.health?.scale === 2) ? 1 : 2;
};
