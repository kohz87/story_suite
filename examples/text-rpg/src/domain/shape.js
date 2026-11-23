// Defines the text RPG domain's limits, empty state and member record builder.
import { memberId } from './member-id.js';

/** The registered domain name. */
export const DOMAIN = 'textRpg';

/** Frozen rules for every text RPG domain slice. */
export const LIMITS = Object.freeze({
    members: 6,
    skills: 38,
    injuries: 3,
    conditions: 4,
    name: 60,
    about: 160,
    strengths: 3,
    statMin: 1,
    statMax: 30,
    levelMax: 99,
    practiceMax: 600,
    diceReplies: 200,
});

const STAT_KEYS = ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha'];
const SKILL_TYPES = ['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility'];
const ID_PATTERN = /^(?:[a-z0-9][a-z0-9-]{0,39}|[a-z][a-z0-9]*_[0-9a-z]{8})$/;

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const clampStat = value => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 5;
    return Math.min(LIMITS.statMax, Math.max(LIMITS.statMin, Math.round(value)));
};

function normalSkill(value) {
    const skill = record(value);
    const cost = record(skill.cost);
    const validCost = (cost.pool === 'mp' || cost.pool === 'sp')
        && Number.isInteger(cost.n) && cost.n >= 1
        ? { pool: cost.pool, n: cost.n }
        : null;
    return {
        name: text(skill.name, LIMITS.name),
        about: text(skill.about, LIMITS.about),
        stat: STAT_KEYS.includes(skill.stat) ? skill.stat : 'str',
        type: SKILL_TYPES.includes(skill.type) ? skill.type : 'utility',
        cost: validCost,
    };
}

/** A new domain slice with no members and no recorded dice. */
export function initialState() {
    return { v: 1, members: {}, dice: {} };
}

/** Builds a complete member record, filling missing values and clamping supplied stats. */
export function newMember(input) {
    const source = record(input);
    const name = text(source.name, LIMITS.name);
    const id = typeof source.id === 'string' && ID_PATTERN.test(source.id)
        ? source.id
        : memberId(source.id || name || 'member');
    const suppliedStats = record(source.stats);
    const stats = {};
    for (const key of STAT_KEYS) stats[key] = clampStat(suppliedStats[key]);

    const mp = 10 + stats.int + stats.wis;
    const sp = 10 + stats.agi + stats.dex;
    const suppliedSkills = Array.isArray(source.skills)
        ? source.skills.filter(skill => record(skill) === skill).slice(0, 5)
        : [];

    return {
        id,
        name,
        pc: source.pc === true,
        xp: 0,
        bought: {},
        wounds: 0,
        down: false,
        stats,
        pools: {
            mp: { now: mp, max: mp },
            sp: { now: sp, max: sp },
        },
        skills: suppliedSkills.map(normalSkill),
        practice: {},
        injuries: [],
        conditions: [],
        companion: null,
        fallen: null,
    };
}
