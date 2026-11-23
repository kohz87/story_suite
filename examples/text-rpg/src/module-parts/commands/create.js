// `textRpg.create`: the reader makes their character: a name, stats bought from a pool of points, up to five skills.
import { DOMAIN, LIMITS, newMember } from '../../domain/shape.js';
import { STAT_KEYS } from '../../words/stats.js';
import { requireActive } from '../active.js';
import { statKey } from '../line-read.js';

const STAT_TOTAL = 60;
const BUY_MIN = 5;
const BUY_MAX = 15;

function statsOf(ctx, given) {
    const stats = {};
    for (const [key, value] of Object.entries(given && typeof given === 'object' ? given : {})) {
        const stat = statKey(key);
        if (stat) stats[stat] = value;
    }
    for (const key of STAT_KEYS) {
        if (!Number.isInteger(stats[key]) || stats[key] < BUY_MIN || stats[key] > BUY_MAX) ctx.fail('INVALID', `Each stat is a whole number from ${BUY_MIN} to ${BUY_MAX}.`);
    }
    const total = STAT_KEYS.reduce((sum, key) => sum + stats[key], 0);
    if (total !== STAT_TOTAL) ctx.fail('INVALID', `The stats add up to ${total}; they must add up to ${STAT_TOTAL}.`);
    return stats;
}

function skillsOf(ctx, given) {
    const list = Array.isArray(given) ? given : [];
    if (list.length > 5) ctx.fail('INVALID', 'A new character has at most five skills.');
    return list.map(skill => {
        const name = String(skill?.name ?? '').replace(/\s+/g, ' ').trim();
        if (!name) ctx.fail('INVALID', 'Every skill needs a name.');
        if (!statKey(skill?.stat)) ctx.fail('INVALID', `${name} needs a stat.`);
        return { ...skill, name, stat: statKey(skill.stat) };
    });
}

/** Payload: { name, stats: { str…cha }, skills: [{ name, about?, stat, type?, cost?: { pool, n } }] }. */
export function create(ctx, payload = {}) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    if (Object.values(slice.members).some(member => member.pc)) ctx.fail('INVALID', 'There is a character already.');
    if (Object.keys(slice.members).length >= LIMITS.members) ctx.fail('LIMITED', 'The party is full.');
    const name = String(payload?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
    if (!name) ctx.fail('INVALID', 'Your character needs a name.');
    const member = newMember({ id: ctx.id('ac'), name, pc: true, stats: statsOf(ctx, payload.stats), skills: skillsOf(ctx, payload.skills) });
    slice.members[member.id] = member;
    return { summary: `${name} begins the story.`, narrate: false, data: { member: member.id } };
}
