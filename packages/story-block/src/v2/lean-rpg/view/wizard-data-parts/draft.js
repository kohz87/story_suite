// The draft itself: a fresh one, one read whole from the dialog, and the stats a Reset returns to.

import { LEVEL, CREATION, STATS, USES } from '../../names.js';
import { UTILITY_SLOTS, skillSlots } from '../../../../../../../core/runtime/skill-slots.js';
import { levelOfClass } from '../../formula.js';
import { FILE_LIMITS } from '../../charfile.js';
import { creationOf, draftCreation, readCreation } from './creation.js';
import { keptSkills } from './slots.js';
import { statBounds } from './stats.js';
import { isRecord, oneLine, clamp } from './shared-helpers.js';

/** The draft a wizard opens with: the persona's name and You, every stat at its start. When the story already has a You it starts as a companion with no name (the persona's is taken). */
export function newDraft({ persona = '', hasYou = false, rules = null } = {}) {
    const creation = creationOf(rules);
    return { name: hasYou ? '' : oneLine(persona, CREATION.name), kind: hasYou ? 'companion' : 'you', about: '', stats: startStats(creation ? { creation } : null), skills: [], set: '', ...(creation ? { creation } : {}) };
}

/** What an import brought: the file's stats and unspent points, or null (anything else is not an import). */
function readFrom(raw) {
    if (!isRecord(raw) || !isRecord(raw.stats) || !Number.isSafeInteger(raw.points)) return null;
    const stats = {};
    for (const stat of STATS) {
        if (!Number.isSafeInteger(raw.stats[stat])) return null;
        stats[stat] = clamp(raw.stats[stat], ...FILE_LIMITS.stat);
    }
    return { stats, points: clamp(raw.points, 0, FILE_LIMITS.points) };
}

/** A draft as the dialog holds it, made whole: every field in range, at most one Adept, at most five skills. */
export function readDraft(raw) {
    const given = isRecord(raw) ? raw : {};
    const from = readFrom(given.from);
    const creation = readCreation(given.creation);
    const stats = Object.fromEntries(STATS.map(stat => {
        const value = Number.isSafeInteger(given.stats?.[stat]) ? given.stats[stat] : (from?.stats[stat] ?? draftCreation({ creation }).start);
        return [stat, clamp(value, ...statBounds({ from, creation }, stat))];
    }));
    // (`level` is the starting level; a draft from a companion's `+ party` line or an older file says `soul`, the class, which stands for the level 10n - 5.)
    const startLevel = Number.isSafeInteger(given.level) && given.level > 1 ? clamp(given.level, 1, LEVEL.max) : Number.isSafeInteger(given.soul) && given.soul >= 1 ? clamp(levelOfClass(clamp(given.soul, 1, 9)), 1, LEVEL.max) : 1;
    let adept = 0;
    // (a signature skill, which a pack's cast member brought, and the skills of a file are kept whatever the level says: draftSlots)
    const wanted = Array.isArray(given.skills) ? given.skills : [];
    const room = Math.max(skillSlots(startLevel), keptSkills(wanted, from));
    let utility = 0, combat = 0;
    const skills = wanted.filter(entry => {
        const isUtility = isRecord(entry) && entry.type === 'utility';
        return isUtility ? ++utility <= UTILITY_SLOTS : ++combat <= room;
    }).map(entry => {
        const skill = isRecord(entry) ? entry : {};
        // A rank the file gave: kept as it is, and it is not the one Adept a new skill may start at.
        const ranked = (from || skill.sig === true) && Number.isSafeInteger(skill.rank);
        const wantsAdept = !ranked && skill.start === 1 && adept < CREATION.adept;
        if (wantsAdept) adept += 1;
        return {
            name: oneLine(skill.name, CREATION.skillName), about: oneLine(skill.about, CREATION.skillAbout),
            // An imported skill may have no stat (''): the reader picks one, and Create waits for it.
            stat: STATS.includes(skill.stat) ? skill.stat : (ranked ? '' : STATS[0]), uses: USES.includes(skill.uses) ? skill.uses : USES[0], start: wantsAdept ? 1 : 0,
            ...(ranked ? { rank: clamp(skill.rank, 0, FILE_LIMITS.rank) } : {}), ...(skill.sig === true ? { sig: true } : {}),
            // (a utility skill is for the story only: three of them, a signature one too; a fourth is left out, as a ninth combat skill is)
            ...(skill.type === 'utility' ? { type: 'utility' } : {}),
        };
    });
    return { name: oneLine(given.name, CREATION.name), kind: given.kind === 'companion' ? 'companion' : 'you',
        about: oneLine(given.about, CREATION.about), stats, skills, set: typeof given.set === 'string' ? given.set : '',
        ...(startLevel > 1 ? { level: startLevel } : {}), ...(from ? { from } : {}), ...(creation ? { creation } : {}) };
}

/** The stats every Reset goes back to: the file's after an import, else all at the start. */
export const startStats = draft => Object.fromEntries(STATS.map(stat => [stat, draft?.from ? draft.from.stats[stat] : draftCreation(draft).start]));
