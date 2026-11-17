// The Character and Skills definitions Create makes under Combat Rules v1: the templates with the wizard's values written as the fields' defaults, the bars full at the level the
// character starts at (and the hidden largest values with them, so the block's size rules find nothing to change on the first reply) and each skill's practice for its rank.

import { uniqueBlockSlug } from '../../../data-modules/block-builder.js';
import { STATS_V1 } from '../../names.js';
import { levelOfClass } from '../../formula.js';
import { barsOf } from '../../combat/bars.js';
import { RANKS, V1 } from '../../combat/numbers.js';
import { SKILL_TYPE_NAMES } from '../../templates-combat.js';
import { pointsLeft } from './stats.js';
import { template } from './shared-template.js';
import { blockNames } from './block-names.js';

const TOP = RANKS.length - 1;
/** The practice a skill starts with: the rank a file gave (0 to 6), else Adept (rank 2) for a skill chosen to start there, else none. */
const practiceOf = skill => RANKS[Math.min(TOP, Math.max(0, Number.isSafeInteger(skill.rank) ? skill.rank : skill.start === 1 ? 2 : 0))].practice;

/** The level a draft starts at, held to the story's cap (99 unset); a draft that still says only the Soul Class has the level it stands for. */
export function startLevelOf(draft, cap = null) {
    const top = Number.isSafeInteger(cap) ? Math.max(V1.level.min, Math.min(V1.level.max, cap)) : V1.level.max;
    const wanted = draft.level > 1 ? draft.level : draft.soul >= 1 ? levelOfClass(draft.soul) : 1;
    return { level: Math.min(top, wanted), cap: top };
}

/** → { character, skills } (definitions, the Character first). Options as buildDefinitions: `used` (the story's block ids), `points` (a joiner starts with none), `cap`. */
export function buildV1Definitions(draft, { used = [], points = null, cap = null } = {}) {
    const names = blockNames(draft.name);
    const character = template('character');
    character.slug = uniqueBlockSlug(names.character, used);
    character.name = names.character;
    const state = character.state, { level, cap: top } = startLevelOf(draft, cap);
    state.who.default = draft.name;
    state.about.default = draft.about;
    for (const stat of STATS_V1) state[stat].default = draft.stats[stat];
    state.points.default = Number.isSafeInteger(points) ? Math.max(0, points) : Math.max(0, pointsLeft(draft));
    state.level.default = level;
    state.cap.default = top;
    for (const [bar, value] of Object.entries(barsOf(draft.stats, level))) { state[bar].default = value; state[`${bar}-max`].default = value; }
    const skills = template('skills');
    skills.slug = uniqueBlockSlug(`${draft.name} skills`, [...used, character.slug]);
    skills.name = names.skills;
    skills.state.who.default = draft.name;
    draft.skills.forEach((skill, at) => {
        const n = at + 1, practice = practiceOf(skill);
        skills.state[`skill${n}`].default = skill.name;
        skills.state[`about${n}`].default = skill.about;
        skills.state[`stat${n}`].default = STATS_V1.includes(skill.stat) ? skill.stat : STATS_V1[0];
        skills.state[`type${n}`].default = SKILL_TYPE_NAMES.includes(skill.type) ? skill.type : V1.skill.defaultType;
        skills.state[`practice${n}`].default = practice;
        skills.state[`rank${n}`].default = Math.min(TOP, Math.floor(practice / (RANKS[1].practice - RANKS[0].practice)));
        // (a skill a pack's cast member brought: marked in the Skills block's `sig`, so the story never renames or replaces it)
        if (skill.sig === true) skills.state.sig.default += 2 ** (n - 1);
    });
    return { character, skills };
}
