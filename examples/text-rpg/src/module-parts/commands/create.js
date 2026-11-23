// `textRpg.create`: the reader makes their character: a name, stats bought from a pool of points (every stat starts at 5, 10 points to spend, a stat to 10), up to five skills, a starting level, or a saved character's stats and skills.
import { DOMAIN, LIMITS, newMember } from '../../domain/shape.js';
import { STAT_KEYS } from '../../words/stats.js';
import { requireActive } from '../active.js';
import { statKey } from '../line-read.js';
import { RULES } from '../../wizard/rules.js';
import { xpOfLevel } from '../../rules/levels.js';
import { levelFor } from '../../rules/growth.js';
import { skillSlots } from '../members.js';
import { practiceKey } from '../practice.js';
import { rulesOf } from '../rules-now.js';

// One set of numbers for the command and the wizard (src/wizard/rules.js).
const STAT_TOTAL = RULES.total;
const BUY_MIN = RULES.min;
const BUY_MAX = RULES.max;

function statsOf(ctx, given, imported, level, budget) {
    const stats = {};
    for (const [key, value] of Object.entries(given && typeof given === 'object' ? given : {})) {
        const stat = statKey(key);
        if (stat) stats[stat] = value;
    }
    // A saved character keeps its own stats up to 15 and its own points (the wizard holds Create until they are placed); a new one spends 10 points over 5s.
    // A starting level gives its points to place (one a level above 1, and a stat may rise that much higher): they are the member's `granted`, not left to spend.
    const extra = imported ? 0 : level - 1;
    const high = imported ? RULES.importMax : Math.min(LIMITS.statMax, BUY_MAX + extra);
    for (const key of STAT_KEYS) {
        if (!Number.isInteger(stats[key]) || stats[key] < BUY_MIN || stats[key] > high) ctx.fail('INVALID', `Each stat is a whole number from ${BUY_MIN} to ${high}.`);
    }
    const total = STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
    if (!imported && total !== STAT_TOTAL + extra) ctx.fail('INVALID', `The stats add up to ${total}; they must add up to ${STAT_TOTAL + extra}.`);
    // A saved character's stats add up to no more than its file allows: the file's own stats and unspent points (the wizard sends that as `budget`; a call with none gets what a level earns), never past 15 a stat.
    const room = Math.min(STAT_KEYS.length * RULES.importMax, budget);
    if (imported && total > room) ctx.fail('INVALID', `The stats add up to ${total}; this saved character allows at most ${room}.`);
    return stats;
}

function skillsOf(ctx, given, slots) {
    const list = Array.isArray(given) ? given : [];
    if (list.length > slots) ctx.fail('INVALID', `A character of this level has at most ${slots} skills.`);
    return list.map(skill => {
        const name = String(skill?.name ?? '').replace(/\s+/g, ' ').trim();
        if (!name) ctx.fail('INVALID', 'Every skill needs a name.');
        if (!statKey(skill?.stat)) ctx.fail('INVALID', `${name} needs a stat.`);
        return { ...skill, name, stat: statKey(skill.stat) };
    });
}

/** The starting level: 1 to the level cap the settings say (a whole number; none is 1). */
function levelOf(ctx, given) {
    if (given === undefined) return 1;
    const cap = rulesOf(ctx).cap;
    if (!Number.isInteger(given) || given < 1 || given > cap) ctx.fail('INVALID', `The starting level is a whole number from 1 to ${cap}.`);
    return given;
}

/**
 * Payload: { name, stats: { str…cha }, skills: [{ name, about?, stat, type?, cost?: { pool, n } }], level?, imported?, budget?, xp? }. `level` starts the character with the xp that level needs and its level points (one a level above 1) to place on the stats now: a character's points are derived from xp, so they are `granted` and not left to spend; `imported` (a saved character) lifts the stat limit to 15 and the skills to 8.
 */
export function create(ctx, payload = {}) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    // While the reader's character lives a second is refused; once they have fallen the new one becomes the reader's and the fallen keeps `pc` false.
    if (Object.values(slice.members).some(member => member.pc && !member.fallen)) ctx.fail('INVALID', 'There is a character already.');
    if (Object.keys(slice.members).length >= LIMITS.members) ctx.fail('LIMITED', 'The party is full.');
    const name = String(payload?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
    if (!name) ctx.fail('INVALID', 'Your character needs a name.');
    const level = levelOf(ctx, payload?.level);
    const imported = payload?.imported === true;
    const budget = Number.isInteger(payload?.budget) && payload.budget >= 0 ? payload.budget : STAT_TOTAL + level - 1;
    // The file's own xp counts when it fits the level (progress within the level); else the level's first xp.
    const xp = imported && Number.isInteger(payload?.xp) && levelFor(payload.xp).level === level ? payload.xp : xpOfLevel(level);
    const member = newMember({ id: ctx.id('ac'), name, pc: true, xp, granted: level - 1, stats: statsOf(ctx, payload.stats, imported, level, budget), skills: skillsOf(ctx, payload.skills, imported ? LIMITS.skills : skillSlots(level)) });
    // A saved character's skill ranks come back as practice (a hundred a rank).
    for (const skill of Array.isArray(payload.skills) ? payload.skills : []) {
        if (imported && Number.isInteger(skill?.rank) && skill.rank >= 1 && skill.rank <= 6) member.practice[practiceKey(skill.name)] = skill.rank * 100;
    }
    for (const old of Object.values(slice.members)) old.pc = false;
    slice.members[member.id] = member;
    return { summary: `${name} begins the story.`, narrate: false, data: { member: member.id } };
}
