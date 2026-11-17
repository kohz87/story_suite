// Join: the wizard draft, definitions and scale of a joining companion.

import { activeDefinition } from '../../data-modules/adapters.js';
import { STATS_EARLIER as STATS, STATS_V1 } from '../names.js';
import { buildDefinitions, creationOf, readDraft } from '../view/wizard-data.js';
import { companionStats, levelOfClass } from '../formula.js';
import { companionStatsV1 } from '../formula-parts/companion-v1.js';
import { STANDARD_FORMULA, isStandard } from '../rules.js';

/** The wizard's draft for a joining companion (the card's Edit first opens it): name, about, class, the best stat raised to 14 (under the Standard formula `rules`: formula.js companionStats). */
export function joinDraft({ name = '', about = '', soul = 1, best = '', skills = [] } = {}, rules = null, kind = 'v1') {
    // (a cast member's signature skills, as the pack wrote them: they fill the slots in order, at the rank written, marked `sig` so the story never renames or replaces them; a `utility` one keeps its type and counts against the three utility slots)
    const signed = (Array.isArray(skills) ? skills : []).map(skill => ({ name: skill.name, about: skill.about, stat: skill.stat, uses: skill.uses, start: 0, rank: skill.rank, sig: true, ...(skill.type === 'utility' ? { type: 'utility' } : {}) }));
    // Every stat 5 and the best 9, then a point for every third level the class stands for (formula.js companionStats); the draft's budget is
    // exactly what they cost, so "Edit first" can move points around but is not handed more. (Without rules: the Standard preset's.)
    const standard = isStandard(rules) ? rules : STANDARD_FORMULA;
    const v1 = kind !== 'standard', list = v1 ? STATS_V1 : STATS;
    const stats = v1 ? companionStatsV1(best, levelOfClass(soul)) : companionStats(best, levelOfClass(soul), standard), creation = creationOf(standard);
    const spent = list.reduce((sum, stat) => sum + stats[stat] - creation.start, 0);
    return readDraft({ name, about, soul, stats, kind: 'companion', skills: signed, set: '', creation: { ...creation, budget: spent, max: creation.statMax }, ...(v1 ? {} : { standard: true }) });
}

/**
 * The two definitions a joining companion is made of (`used`: the ids of the story's blocks, so the slugs are free). The Character
 * starts with no unspent points: the named stat is raised and the rest left as it was, as the line said.
 */
export const joinDefinitions = (request, { used = [], soul = request.soul, rules = null, cap = null, legacy = false, scale = 2, typed = true, kind = 'v1' } = {}) =>
    buildDefinitions(joinDraft({ ...request, soul }, rules, kind), { used, points: 0, cap, legacy, scale, typed, rules: kind });

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

/**
 * Which rules a join builds its blocks under: 'v1' (Combat Rules v1), except where the chat already holds a Character made under the earlier rules, whose own mark decides first on a Re-read
 * (a Character with no `hp` field is an earlier one). Such a chat keeps building the earlier blocks until the earlier rules are removed, so a Re-read of an old join and the engine's
 * refusal of a mixed sheet both stay as they were.
 */
export const joinRules = (state, standing = null, module = null) => {
    const earlier = definition => definition?.role === 'character' && !Object.hasOwn(definition.state ?? {}, 'hp');
    const joined = module && standing ? activeDefinition(standing, module) : null;
    if (joined?.role === 'character') return earlier(joined) ? 'standard' : 'v1';
    const pins = Object.keys(state?.domains?.dataModules?.active ?? {}).map(id => activeDefinition(state, id));
    return pins.some(earlier) ? 'standard' : 'v1';
};
