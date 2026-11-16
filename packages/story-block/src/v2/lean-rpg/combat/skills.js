// Skill types, costs, stance ownership and ranks for Combat Rules v1. The type and rank tables
// live in numbers.js; this file only reads them, derives the SP / MP pool and applies the gates.

import { RANKS, V1 } from './numbers.js';

const SKILL = V1.skill;

const rawType = skill => (typeof skill === 'string' ? skill : skill?.type ?? skill?.typeN ?? '');
const typeOf = skill => {
    const raw = String(rawType(skill)).trim().toLowerCase();
    if (raw === SKILL.normalType) return raw;
    for (const [type, entry] of Object.entries(SKILL.types)) {
        if (raw === type || raw === entry.label.toLowerCase() || entry.aliases.includes(raw)) return type;
    }
    return SKILL.defaultType;
};
const definitionOf = type => SKILL.types[type];
const isStance = type => definitionOf(type)?.kind === 'stance';

const poolOf = (skill, entry) => {
    if (entry.pool === SKILL.pools.magic) return SKILL.pools.magic;
    if (entry.pool !== 'stat') return entry.pool;
    const stat = String((typeof skill === 'object' ? skill?.stat ?? skill?.statN : '') ?? '').trim().toLowerCase();
    return SKILL.magicStats.includes(stat) ? SKILL.pools.magic : SKILL.pools.physical;
};

const normalPrice = fallback => ({
    type: SKILL.normalType, kind: SKILL.normal.kind, pool: SKILL.normal.pool,
    cost: V1.cost[SKILL.normal.cost], affordable: true, fallback,
});

/**
 * The price of one use: { type, kind, pool, cost, affordable, fallback }. A skill record or a type
 * name may be passed. Attack, area and stance skills draw SP unless their stat is INT or WIS; heal
 * always draws MP; utility is free and story-only. With `resources` ({ sp, mp }), an unaffordable
 * attack or area becomes the free normal attack (the 0 SP fallback).
 */
export function skillCost(skill, resources) {
    const type = typeOf(skill);
    if (type === SKILL.normalType) return normalPrice(false);
    const entry = definitionOf(type), pool = poolOf(skill, entry), cost = V1.cost[entry.cost];
    const hasResources = resources !== null && typeof resources === 'object';
    const affordable = !hasResources || pool === null || Number(resources[pool]) >= cost;
    if (hasResources && !affordable && SKILL.fallbackTypes.includes(type)) return normalPrice(true);
    return { type, kind: entry.kind, pool, cost, affordable, fallback: false };
}

/**
 * The stance to run for an exchange, or null when it is off. `skill` may be the owned stance skill,
 * its type, or the list of skills the character owns; the list must hold exactly one stance type.
 * Support counts as a stance. With `resources`, a stance that cannot pay its per-exchange cost is off.
 */
export function stanceOf(skill, on = true, resources) {
    if (!on) return null;
    const owned = Array.isArray(skill) ? skill : [skill];
    const stances = owned.filter(item => item !== null && item !== undefined && isStance(typeOf(item)));
    const types = new Set(stances.map(typeOf));
    if (types.size !== 1) return null;
    const price = skillCost(stances[0], resources);
    return price.affordable ? price.type : null;
}

/** Whether one more skill may be owned: true unless it is a stance and another stance is already owned. */
export function canOwn(owned, candidate) {
    if (candidate === null || candidate === undefined) return false;
    const type = typeOf(candidate);
    if (type === SKILL.normalType) return false;
    if (!isStance(type)) return true;
    const list = Array.isArray(owned) ? owned : owned === null || owned === undefined ? [] : [owned];
    const same = item => item === candidate || (candidate?.name && item?.name === candidate.name);
    return list.filter(item => item !== null && item !== undefined && isStance(typeOf(item))).every(same);
}

/**
 * The highest rank whose practice threshold and minimum level are both met. Accepts
 * `rankOf(practice, level)` or `rankOf({ practice, level })`; returns the frozen RANKS entry.
 */
export function rankOf(practice, level = V1.level.min) {
    if (practice !== null && typeof practice === 'object') ({ practice, level } = practice);
    const unused = RANKS[0].practice;
    const points = Math.max(unused, Math.floor(Number(practice) || unused));
    const lv = Math.min(V1.level.max, Math.max(V1.level.min, Math.floor(Number(level) || V1.level.min)));
    for (let index = RANKS.length - 1; index >= 0; index -= 1) {
        const rank = RANKS[index];
        if (points >= rank.practice && lv >= rank.minLevel) return rank;
    }
    return RANKS[0];
}
