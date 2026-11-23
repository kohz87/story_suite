// What a member has at their current level: stats (creation base plus the purchases the level pays for), pools and active skills.
import { poolMax } from '../rules/harm.js';
import { STAT_KEYS } from '../words/stats.js';
import { skillSlots } from './members.js';
import { countedPurchases } from './purchases.js';
import { earnedAt } from '../rules/level-gains.js';
import { levelOf } from './standing.js';

/** `{ str: 12, … }`: the creation stats plus each counted purchase (a stat is kept within 1..30 by `totalStats`). */
export function effectiveStats(member) {
    const stats = {};
    for (const key of STAT_KEYS) stats[key] = member?.stats?.[key];
    for (const item of countedPurchases(member, earnedAt(levelOf(member), member.granted))) {
        if (Object.hasOwn(stats, item.stat)) stats[item.stat] += item.n;
    }
    return stats;
}

/** The pool as it reads now: the full size from the effective stats and the level, and what is left never above it. */
export function poolOf(member, kind, stats = effectiveStats(member)) {
    const max = poolMax(kind, stats, levelOf(member));
    return { max, now: Math.min(member.pools[kind].now, max) };
}

function activeSet(member) {
    const skills = Array.isArray(member?.skills) ? member.skills : [];
    const learned = skills.filter(skill => Number.isInteger(skill.learned)).sort((a, b) => a.learned - b.learned);
    const free = Math.max(0, skillSlots(levelOf(member)) - (skills.length - learned.length));
    return new Set(learned.slice(0, free));
}

/** Whether the skill counts at this level: the creation skills always do; a later one only within the slots the level gives, the latest learned going first. */
export function skillActive(member, skill) {
    return !Number.isInteger(skill?.learned) || activeSet(member).has(skill);
}

/** The member's skills that count at this level, in sheet order. */
export function activeSkills(member) {
    const active = activeSet(member);
    return (member?.skills ?? []).filter(skill => !Number.isInteger(skill.learned) || active.has(skill));
}
