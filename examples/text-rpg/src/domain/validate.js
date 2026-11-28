// Validates a text RPG domain slice and reports every damaged field by path.
import { LIMITS } from './shape.js';
import { checkFoes } from './validate-foes.js';

const STAT_KEYS = ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha'];
const SKILL_TYPES = ['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility'];
const POOL_KEYS = ['mp', 'sp'];
const ID_PATTERN = /^(?:[a-z0-9][a-z0-9-]{0,39}|[a-z][a-z0-9]*_[0-9a-z]{8})$/;
const MEMBER_KEYS = [
    'id', 'name', 'pc', 'xp', 'bought', 'wounds', 'down', 'stats', 'pools', 'skills', 'practice',
    'injuries', 'conditions', 'companion', 'fallen',
];
const SKILL_KEYS = ['name', 'about', 'stat', 'type', 'cost'];
const BOUGHT_KEYS = ['stat', 'n', 'seq'];
const INJURY_KEYS = ['name', 'hampers', 'heals', 'grave'];
const CONDITION_KEYS = ['name', 'until'];

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
// The largest size a save can hold: the older 10 + two stats at 30.
const POOL_STORED_MAX = 70;
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

function checkPools(pools, where, problems) {
    if (!checkShape(pools, where, POOL_KEYS, problems)) return;
    for (const key of POOL_KEYS) {
        const poolWhere = at(where, key);
        const pool = pools[key];
        if (!checkShape(pool, poolWhere, ['now', 'max'], problems)) continue;
        // `max` is the size recorded at creation (a save from before the RPG's formula holds the older, larger one): the size that counts is read in module-parts/effective.js.
        if (!isInt(pool.max, 0, POOL_STORED_MAX)) {
            problems.push(`${poolWhere}.max must be a whole number from 0 to ${POOL_STORED_MAX}.`);
        }
        // `now` may pass `max`: points bought later grow the pool (the effective size is read in module-parts/effective.js).
        if (!isInt(pool.now, 0, POOL_STORED_MAX)) {
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
    if (skills.length > LIMITS.skillsStored) problems.push(`${where} may hold at most ${LIMITS.skillsStored} skills.`);
    skills.forEach((skill, index) => {
        const skillWhere = `${where}.${index}`;
        if (!checkShape(skill, skillWhere, has(skill ?? {}, 'learned') ? [...SKILL_KEYS, 'learned'] : SKILL_KEYS, problems)) return;
        if (has(skill, 'learned') && !isInt(skill.learned, 0)) problems.push(`${skillWhere}.learned must be a whole number of at least 0.`);
        if (typeof skill.name !== 'string' || skill.name.length > LIMITS.name) {
            problems.push(`${skillWhere}.name must be a string of at most ${LIMITS.name} characters.`);
        }
        if (typeof skill.about !== 'string' || skill.about.length > LIMITS.about) {
            problems.push(`${skillWhere}.about must be a string of at most ${LIMITS.about} characters.`);
        }
        if (!STAT_KEYS.includes(skill.stat)) problems.push(`${skillWhere}.stat is not a known stat.`);
        if (!SKILL_TYPES.includes(skill.type)) problems.push(`${skillWhere}.type is not a known skill type.`);
        checkCost(skill.cost, `${skillWhere}.cost`, problems);
    });
}

function checkBought(bought, where, problems) {
    if (!isObject(bought)) {
        problems.push(`${where} must be an object.`);
        return;
    }
    for (const [id, item] of Object.entries(bought)) {
        const itemWhere = at(where, id.slice(0, 40));
        if (!checkShape(item, itemWhere, BOUGHT_KEYS, problems)) continue;
        if (!STAT_KEYS.includes(item.stat)) problems.push(`${itemWhere}.stat is not a known stat.`);
        if (!isInt(item.n, 1, LIMITS.statMax)) problems.push(`${itemWhere}.n must be a positive whole number.`);
        if (!isInt(item.seq, 0)) problems.push(`${itemWhere}.seq must be a whole number of at least 0.`);
    }
}

function checkPractice(practice, where, problems) {
    if (!isObject(practice)) {
        problems.push(`${where} must be an object.`);
        return;
    }
    const keys = Object.keys(practice);
    if (keys.length > LIMITS.practiceStored) problems.push(`${where} holds too many skills.`);
    for (const key of keys) {
        if (key.length > LIMITS.name) problems.push(`${where}.${key.slice(0, 20)} has a key longer than ${LIMITS.name} characters.`);
        else if (!isInt(practice[key], 0, LIMITS.practiceMax)) problems.push(`${where}.${key} must be a whole number from 0 to ${LIMITS.practiceMax}.`);
    }
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
        if (injury.heals !== null && !isInt(injury.heals, 0)) problems.push(`${injuryWhere}.heals must be null (no clock yet) or a whole number of minutes.`);
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
    // (`granted` is optional: a member made before it, or at level 1, has none)
    const { granted, ...shape } = member ?? {};
    if (!checkShape(shape, where, MEMBER_KEYS, problems)) return;
    if (granted !== undefined && !isInt(granted, 1, LIMITS.levelMax - 1)) problems.push(`${where}.granted must be a whole number from 1 to ${LIMITS.levelMax - 1}.`);
    if (typeof member.id !== 'string' || !ID_PATTERN.test(member.id)) problems.push(`${where}.id is not a valid id.`);
    if (member.id !== key) problems.push(`${where}.id must equal its member key.`);
    if (typeof member.name !== 'string' || member.name.length > LIMITS.name) {
        problems.push(`${where}.name must be a string of at most ${LIMITS.name} characters.`);
    }
    if (typeof member.pc !== 'boolean') problems.push(`${where}.pc must be a boolean.`);
    if (!isInt(member.xp, 0)) problems.push(`${where}.xp must be a whole number of at least 0.`);
    checkBought(member.bought, `${where}.bought`, problems);
    // Any whole number: a replay after a deleted reply can add a change past 0 or 5; every read clamps it (standing.js woundsOf); Down is the separate `down` mark.
    if (!Number.isInteger(member.wounds)) problems.push(`${where}.wounds must be a whole number.`);
    if (member.down !== undefined && typeof member.down !== 'boolean') problems.push(`${where}.down must be a boolean.`);
    checkStats(member.stats, `${where}.stats`, problems);
    checkPools(member.pools, `${where}.pools`, problems);
    checkSkills(member.skills, `${where}.skills`, problems);
    checkPractice(member.practice, `${where}.practice`, problems);
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
        if (!isObject(record)) {
            problems.push(`${where} must be an object.`);
            continue;
        }
        // used (dice taken so far), hardest (difficulty index) and threat (word index) are kept by the reply's `? try` lines.
        const base = {};
        for (const key of Object.keys(record)) if (!['used', 'hardest', 'threat', 'rules', 'clock', 'matchup', 'won', 'aimed'].includes(key)) base[key] = record[key];
        if (!checkShape(base, where, ['list', 'floor'], problems)) continue;
        if (has(record, 'used') && !isInt(record.used, 0, 3)) problems.push(`${where}.used must be a whole number from 0 to 3.`);
        if (has(record, 'hardest') && !isInt(record.hardest, 0, 5)) problems.push(`${where}.hardest must be a whole number from 0 to 5.`);
        if (has(record, 'threat') && !isInt(record.threat, 0, 5)) problems.push(`${where}.threat must be a whole number from 0 to 5.`);
        if (has(record, 'won') && typeof record.won !== 'boolean') problems.push(`${where}.won must be true or false.`);
        // aimed: the groups the reply's tries named (rule mark `xpAimedFirst`).
        if (has(record, 'aimed') && !(Array.isArray(record.aimed) && record.aimed.length <= 3 && record.aimed.every(id => typeof id === 'string' && id.length <= 40))) problems.push(`${where}.aimed must list at most three group ids.`);
        // clock: the story minute the reply's dice step was made at (training sessions are capped by the days since).
        if (has(record, 'clock') && !isInt(record.clock, 0, Number.MAX_SAFE_INTEGER)) problems.push(`${where}.clock must be a whole number of minutes.`);
        // rules: the level cap and XP rate the reply was written under (only when not the defaults).
        if (has(record, 'rules') && !(isObject(record.rules) && isInt(record.rules.cap, 1, LIMITS.levelMax) && isInt(record.rules.rate, 50, 300))) problems.push(`${where}.rules must hold a cap and a rate.`);
        if (!Array.isArray(record.list) || record.list.length !== 3) {
            problems.push(`${where}.list must hold exactly three dice.`);
        } else {
            record.list.forEach((die, index) => {
                if (!isInt(die, 1, 20)) problems.push(`${where}.list.${index} must be a whole number from 1 to 20.`);
            });
        }
        if (!isInt(record.floor, 0, 5)) problems.push(`${where}.floor must be a whole number from 0 to 5.`);
        if (has(record, 'matchup') && !(isObject(record.matchup) && ['favoured', 'even', 'outmatched', 'hopeless'].includes(record.matchup.band) && typeof record.matchup.why === 'string')) problems.push(`${where}.matchup must hold a band and a text.`);
    }
}

function checkSpent(spent, problems) {
    if (spent === undefined) return;
    if (!isObject(spent) || Object.keys(spent).length > LIMITS.diceReplies) problems.push(`spent must be an object of at most ${LIMITS.diceReplies} replies.`);
    else for (const [reply, marks] of Object.entries(spent)) {
        if (!isObject(marks) || Object.keys(marks).length > LIMITS.practiceStored || !Object.values(marks).every(value => isInt(value, 0, LIMITS.practiceMax))) problems.push(`spent.${reply.slice(0, 80)} must map skills to whole numbers.`);
    }
}

function validateSlice(slice) {
    const problems = [];
    // `spent` (reply → skill → the practice a `~ spend` gave there) is kept once a reply has one: a slice saved before it has none.
    const { spent, foes, ...base } = isObject(slice) ? slice : {};
    if (!checkShape(isObject(slice) ? base : slice, 'slice', ['v', 'members', 'dice'], problems)) return problems;
    if (slice.v !== 1) problems.push('slice.v must be 1.');
    checkDice(slice.dice, problems);
    checkSpent(spent, problems);
    checkFoes(foes, problems);

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
