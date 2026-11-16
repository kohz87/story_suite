// What a played v1 fight pays, as pure numbers from its record: the XP of a won fight (tier XP, owner Q12), the skills each hero used (practice per use) and whether the win earned a legendary find.
// Code sets every number here; nothing reads state, settings or dice (the XP rate and the practice per use are the setup's, applied by the caller).
import { FIGHT_XP } from '../names-parts/fight-xp.js';
import { TIERS } from './numbers.js';
import { skillCost } from './skills.js';

// How many levels above the party's highest a foe group must stand for a win to earn a legendary find (the old rule's gap).
const LEGEND_GAP = 10;

/** The foe groups of a record's `foes`: `[{ slot, count, level, tier }]`, by slot (a member's id is `<slot>.<n>`). */
export function foeGroupsOf(record) {
    const groups = new Map();
    for (const foe of record?.foes ?? []) {
        const slot = Number.parseInt(String(foe.id).split('.')[0], 10), kept = groups.get(slot);
        if (kept) kept.count += 1;
        else groups.set(slot, { slot, count: 1, level: Number(foe.level) || 1, tier: Object.hasOwn(TIERS, foe.tier) ? foe.tier : 'standard' });
    }
    return [...groups.values()].sort((a, b) => a.slot - b.slot);
}

/** One hero's XP for a won fight: per group (15 + 2 per foe after the first) × max(1, ceil(level / 10)) × the level gap per cent (10 a level, 0..200) × the tier's factor; summed, rounded down, held to 1..60. */
export function winXp(groups, level) {
    const total = groups.reduce((sum, group) => {
        const gap = Math.max(0, Math.min(FIGHT_XP.maxPercent, 100 + FIGHT_XP.gapPercent * (group.level - level)));
        return sum + (FIGHT_XP.markedFirst + FIGHT_XP.markedMore * (group.count - 1)) * Math.max(1, Math.ceil(group.level / FIGHT_XP.perLevels)) * gap * TIERS[group.tier].mult;
    }, 0), xp = Math.floor(total / 100);
    return xp > 0 ? Math.max(FIGHT_XP.min, Math.min(FIGHT_XP.max, xp)) : 0;
}

/** Whether a won fight earned a legendary find: some foe group stands 10 or more levels above the party's highest. */
export const legendOf = (record, groups) => record?.result === 'win' && Math.max(0, ...(record.party ?? []).map(hero => Number(hero.level) || 0)) > 0
    && Math.max(0, ...groups.map(group => group.level)) >= Math.max(0, ...(record.party ?? []).map(hero => Number(hero.level) || 0)) + LEGEND_GAP;

// The skill a hero's row stands for: the first skill of the type (the engine's own pick, combat/profile.js profileOf).
const firstOf = (hero, match) => (hero.skills ?? []).find(match)?.name ?? '';

/**
 * The skills the heroes used in THIS record's exchanges: `[{ who, skill, n }]`, sorted. A blow made with a skill, an area blow (once an exchange, whatever the foes hit), a heal and a stance held at an
 * exchange each count one use; a normal blow, a flee and a hero with no such skill count none.
 */
export function usesOfV1(record) {
    const heroes = new Map((record?.party ?? []).map(hero => [hero.label, hero])), count = new Map();
    const note = (who, skill) => { if (skill) count.set(`${who}\u0000${skill}`, { who, skill, n: (count.get(`${who}\u0000${skill}`)?.n ?? 0) + 1 }); };
    for (const round of record?.rounds ?? []) {
        const areas = new Set();
        for (const line of round) {
            const hero = heroes.get(line[1]);
            if (!hero) continue;
            if (line[0] === 'attack' && line[2] === 'skill') note(hero.label, firstOf(hero, skill => skill.type === 'attack'));
            else if (line[0] === 'attack' && line[2] === 'area' && !areas.has(hero.label)) { areas.add(hero.label); note(hero.label, firstOf(hero, skill => skill.type === 'area')); }
            else if (line[0] === 'heal') note(hero.label, firstOf(hero, skill => skill.type === 'heal'));
            else if (line[0] === 'stance' && line[2]?.length) note(hero.label, firstOf(hero, skill => skillCost(skill).kind === 'stance'));
        }
    }
    return [...count.values()].sort((a, b) => a.who.localeCompare(b.who) || a.skill.localeCompare(b.skill));
}
