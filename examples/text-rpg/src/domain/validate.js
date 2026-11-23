// Validates a text RPG domain slice and reports every damaged field by path.
import { LIMITS } from './shape.js';

const STAT_KEYS = ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha'];
const SKILL_TYPES = ['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility'];
const POOL_KEYS = ['hp', 'mp', 'sp'];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MEMBER_KEYS = [
    'id', 'name', 'pc', 'level', 'xp', 'points', 'stats', 'pools', 'skills',
    'injuries', 'conditions', 'companion', 'fallen',
];
const SKILL_KEYS = ['name', 'about', 'stat', 'type', 'cost', 'practice'];
const INJURY_KEYS = ['name', 'hampers', 'heals', 'grave'];
const CONDITION_KEYS = ['name', 'until'];

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isInt = (value, min, max = Infinity) => Number.isInteger(value) && value >= min && value <= max;
const at = (where, key) => where ? `${where}.${key}` : key;

function checkShape(value, where, keys, problems) {
    if (!isObject(value)) {
        problems.push(`${where} must be an object.`);
        return false;
    }
    for (const key of Object.keys(value)) {
        if (!keys.includes(key)) problems.push(`${at(where, key)} is not a known field.`);
    }
    for (const key of keys) {
        if (!has(value, key)) problems.push(`${at(where, key)} is missing.`);
    }
    return true;
}

function checkStats(stats, where, problems) {
    if (!checkShape(stats, where, STAT_KEYS, problems)) return;
    for (const key of STAT_KEYS) {
        if (!isInt(stats[key], LIMITS.statMin, LIMITS.statMax)) {
            problems.push(`${at(where, key)} must be a whole number from ${LIMITS.statMin} to ${LIMITS.statMax}.`);
        }
    }
}

function checkPools(pools, stats, where, problems) {
    if (!checkShape(pools, where, POOL_KEYS, problems)) return;
    const pairs = { hp: ['str', 'vit'], mp: ['int', 'wis'], sp: ['agi', 'dex'] };
    for (const key of POOL_KEYS) {
        const poolWhere = at(where, key);
        const pool = pools[key];
        if (!checkShape(pool, poolWhere, ['now', 'max'], problems)) continue;
        const expected = 10 + (Number(stats?.[pairs[key][0]]) || 0) + (Number(stats?.[pairs[key][1]]) || 0);
        if (!isInt(pool.max, 0) || pool.max !== expected) {
            problems.push(`${poolWhere}.max must equal 10 plus its two stats.`);
        }
        if (!isInt(pool.now, 0) || (isInt(pool.max, 0) && pool.now > pool.max)) {
            problems.push(`${poolWhere}.now must be a whole number from 0 to its max.`);
        }
    }
}

function checkCost(cost, where, problems) {
    if (cost === null) return;
    if (!checkShape(cost, where, ['pool', 'n'], problems)) return;
    if (cost.pool !== 'mp' && cost.pool !== 'sp') problems.push(`${where}.pool must be mp or sp.`);
    if (!isInt(cost.n, 1)) problems.push(`${where}.n must be a positive whole number.`);
}

function checkSkills(skills, where, problems) {
    if (!Array.isArray(skills)) {
        problems.push(`${where} must be a list.`);
        return;
    }
    if (skills.length > LIMITS.skills) problems.push(`${where} may hold at most ${LIMITS.skills} skills.`);
    skills.forEach((skill, index) => {
        const skillWhere = `${where}.${index}`;
        if (!checkShape(skill, skillWhere, SKILL_KEYS, problems)) return;
        if (typeof skill.name !== 'string' || skill.name.length > LIMITS.name) {
            problems.push(`${skillWhere}.name must be a string of at most ${LIMITS.name} characters.`);
        }
        if (typeof skill.about !== 'string' || skill.about.length > LIMITS.about) {
            problems.push(`${skillWhere}.about must be a string of at most ${LIMITS.about} characters.`);
        }
        if (!STAT_KEYS.includes(skill.stat)) problems.push(`${skillWhere}.stat is not a known stat.`);
        if (!SKILL_TYPES.includes(skill.type)) problems.push(`${skillWhere}.type is not a known skill type.`);
        checkCost(skill.cost, `${skillWhere}.cost`, problems);
        if (!isInt(skill.practice, 0, LIMITS.practiceMax)) {
            problems.push(`${skillWhere}.practice must be a whole number from 0 to ${LIMITS.practiceMax}.`);
        }
    });
}

function checkInjuries(injuries, where, problems) {
    if (!Array.isArray(injuries)) {
        problems.push(`${where} must be a list.`);
        return;
    }
    if (injuries.length > LIMITS.injuries) problems.push(`${where} may hold at most ${LIMITS.injuries} injuries.`);
    injuries.forEach((injury, index) => {
        const injuryWhere = `${where}.${index}`;
        if (!checkShape(injury, injuryWhere, INJURY_KEYS, problems)) return;
        if (typeof injury.name !== 'string' || injury.name.length > LIMITS.name) {
            problems.push(`${injuryWhere}.name must be a string of at most ${LIMITS.name} characters.`);
        }
        if (!Array.isArray(injury.hampers)) {
            problems.push(`${injuryWhere}.hampers must be a list of stats.`);
        } else {
            const seen = new Set();
            for (const stat of injury.hampers) {
                if (!STAT_KEYS.includes(stat) || seen.has(stat)) {
                    problems.push(`${injuryWhere}.hampers may hold each known stat only once.`);
                }
                seen.add(stat);
            }
        }
        if (!isInt(injury.heals, 0)) problems.push(`${injuryWhere}.heals must be a whole number of minutes.`);
        if (!['minor', 'serious', 'grave'].includes(injury.grave)) {
            problems.push(`${injuryWhere}.grave must be minor, serious or grave.`);
        }
    });
}

function checkConditions(conditions, where, problems) {
    if (!Array.isArray(conditions)) {
        problems.push(`${where} must be a list.`);
        return;
    }
    if (conditions.length > LIMITS.conditions) {
        problems.push(`${where} may hold at most ${LIMITS.conditions} conditions.`);
    }
    conditions.forEach((condition, index) => {
        const conditionWhere = `${where}.${index}`;
        if (!checkShape(condition, conditionWhere, CONDITION_KEYS, problems)) return;
        if (typeof condition.name !== 'string' || condition.name.length > 40) {
            problems.push(`${conditionWhere}.name must be a string of at most 40 characters.`);
        }
        if (condition.until !== 'treated' && !isInt(condition.until, 0)) {
            problems.push(`${conditionWhere}.until must be treated or a whole number of minutes.`);
        }
    });
}

function checkCompanion(companion, where, problems) {
    if (companion === null) return;
    if (!checkShape(companion, where, ['level', 'strengths'], problems)) return;
    if (!isInt(companion.level, 1, LIMITS.levelMax)) {
        problems.push(`${where}.level must be a whole number from 1 to ${LIMITS.levelMax}.`);
    }
    if (!Array.isArray(companion.strengths)) {
        problems.push(`${where}.strengths must be a list.`);
        return;
    }
    if (companion.strengths.length > LIMITS.strengths) {
        problems.push(`${where}.strengths may hold at most ${LIMITS.strengths}.`);
    }
    companion.strengths.forEach((strength, index) => {
        if (typeof strength !== 'string' || strength.length > 40) {
            problems.push(`${where}.strengths.${index} must be a string of at most 40 characters.`);
        }
    });
}

function checkFallen(fallen, where, problems) {
    if (fallen === null) return;
    if (!checkShape(fallen, where, ['how'], problems)) return;
    if (typeof fallen.how !== 'string' || fallen.how.length > LIMITS.about) {
        problems.push(`${where}.how must be a string of at most ${LIMITS.about} characters.`);
    }
}

function checkMember(member, key, problems) {
    const where = `members.${key}`;
    if (!checkShape(member, where, MEMBER_KEYS, problems)) return;
    if (typeof member.id !== 'string' || !ID_PATTERN.test(member.id)) problems.push(`${where}.id is not a valid id.`);
    if (member.id !== key) problems.push(`${where}.id must equal its member key.`);
    if (typeof member.name !== 'string' || member.name.length > LIMITS.name) {
        problems.push(`${where}.name must be a string of at most ${LIMITS.name} characters.`);
    }
    if (typeof member.pc !== 'boolean') problems.push(`${where}.pc must be a boolean.`);
    if (!isInt(member.level, 1, LIMITS.levelMax)) {
        problems.push(`${where}.level must be a whole number from 1 to ${LIMITS.levelMax}.`);
    }
    if (!isInt(member.xp, 0)) problems.push(`${where}.xp must be a whole number of at least 0.`);
    if (!isInt(member.points, 0)) problems.push(`${where}.points must be a whole number of at least 0.`);
    checkStats(member.stats, `${where}.stats`, problems);
    checkPools(member.pools, member.stats, `${where}.pools`, problems);
    checkSkills(member.skills, `${where}.skills`, problems);
    checkInjuries(member.injuries, `${where}.injuries`, problems);
    checkConditions(member.conditions, `${where}.conditions`, problems);
    checkCompanion(member.companion, `${where}.companion`, problems);
    checkFallen(member.fallen, `${where}.fallen`, problems);
}

function checkDice(dice, problems) {
    if (!isObject(dice)) {
        problems.push('dice must be an object.');
        return;
    }
    const replies = Object.keys(dice);
    if (replies.length > LIMITS.diceReplies) problems.push(`dice may hold at most ${LIMITS.diceReplies} replies.`);
    for (const reply of replies) {
        const where = `dice.${reply}`;
        if (reply.length > 80) problems.push(`${where} has a reply key longer than 80 characters.`);
        const record = dice[reply];
        if (!checkShape(record, where, ['list', 'floor'], problems)) continue;
        if (!Array.isArray(record.list) || record.list.length !== 3) {
            problems.push(`${where}.list must hold exactly three dice.`);
        } else {
            record.list.forEach((die, index) => {
                if (!isInt(die, 1, 20)) problems.push(`${where}.list.${index} must be a whole number from 1 to 20.`);
            });
        }
        if (!isInt(record.floor, 0, 4)) problems.push(`${where}.floor must be a whole number from 0 to 4.`);
    }
}

function validateSlice(slice) {
    const problems = [];
    if (!checkShape(slice, 'slice', ['v', 'members', 'dice'], problems)) return problems;
    if (slice.v !== 1) problems.push('slice.v must be 1.');
    checkDice(slice.dice, problems);

    if (!isObject(slice.members)) {
        problems.push('members must be an object.');
        return problems;
    }
    const memberKeys = Object.keys(slice.members);
    if (memberKeys.length > LIMITS.members) problems.push(`members may hold at most ${LIMITS.members} records.`);
    let players = 0;
    for (const key of memberKeys) {
        checkMember(slice.members[key], key, problems);
        if (slice.members[key]?.pc === true) players += 1;
    }
    if (players > 1) problems.push('members may hold at most one player character.');
    return problems;
}

/** Returns a list of readable problems; an empty list means the slice is valid. */
export function validate(slice) {
    try {
        return validateSlice(slice);
    } catch {
        return ['slice could not be read.'];
    }
}
