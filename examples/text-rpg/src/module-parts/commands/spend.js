// `textRpg.spend` (stat points, as the Party tab sends them) and `textRpg.skillEdit` (add, change or drop a skill).
import { DOMAIN, LIMITS } from '../../domain/shape.js';
import { poolMax } from '../../rules/harm.js';
import { effectiveStats } from '../effective.js';
import { purchasesOf } from '../purchases.js';
import { STAT_KEYS } from '../../words/stats.js';
import { requireActive } from '../active.js';
import { nextLearned } from '../learned.js';
import { memberNamed, skillIndex, skillSlots } from '../members.js';
import { statKey } from '../line-read.js';
import { practiceKey } from '../practice.js';
import { levelOf, pointsOf } from '../standing.js';

const TYPES = ['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility'];

function sheetOf(ctx, payload) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const member = memberNamed(slice, payload?.member);
    if (!member || member.companion || member.fallen) ctx.fail('NOT_FOUND', 'No such character on the sheet.');
    return member;
}

/** Payload: { member (id or name), stats: { STR: 1, … } }; records each as a purchase and grows the mana and stamina pools. */
export function spend(ctx, payload = {}) {
    const member = sheetOf(ctx, payload);
    const asked = {};
    for (const [key, value] of Object.entries(payload.stats && typeof payload.stats === 'object' ? payload.stats : {})) {
        if (!statKey(key) || !Number.isInteger(value) || value < 0) ctx.fail('INVALID', 'Spend whole points on the seven stats.');
        asked[statKey(key)] = value;
    }
    const total = Object.values(asked).reduce((sum, n) => sum + n, 0);
    if (total < 1) ctx.fail('INVALID', 'Choose at least one point to spend.');
    const points = pointsOf(member);
    if (total > points) ctx.fail('NOT_ENOUGH', `${member.name} has ${points} points to spend.`);
    const before = effectiveStats(member);
    for (const key of STAT_KEYS) {
        if (before[key] + (asked[key] ?? 0) > LIMITS.statMax) ctx.fail('INVALID', `A stat goes no higher than ${LIMITS.statMax}.`);
    }
    // Each stat is its own purchase, kept in order: the level pays for the first ones, so a lost level takes the latest back by itself.
    let seq = purchasesOf(member).reduce((top, item) => Math.max(top, item.seq), -1);
    for (const key of STAT_KEYS) {
        if (asked[key]) member.bought[ctx.id('pt')] = { stat: key, n: asked[key], seq: seq += 1 };
    }
    const after = effectiveStats(member);
    for (const pool of ['mp', 'sp']) {
        const was = poolMax(pool, before);
        member.pools[pool].now = Math.min(member.pools[pool].now, was) + poolMax(pool, after) - was;
    }
    return { summary: `${member.name} spends ${total} stat point${total === 1 ? '' : 's'}.`, narrate: false, data: { member: member.id, stats: asked } };
}

function applySkillFields(ctx, skill, given) {
    if (typeof given.about === 'string') skill.about = given.about.slice(0, LIMITS.about);
    if (given.stat !== undefined) {
        if (!statKey(given.stat)) ctx.fail('INVALID', 'A skill needs one of the seven stats.');
        skill.stat = statKey(given.stat);
    }
    if (given.type !== undefined) skill.type = TYPES.includes(given.type) ? given.type : 'utility';
    if (given.cost !== undefined) {
        const cost = given.cost;
        skill.cost = cost && (cost.pool === 'mp' || cost.pool === 'sp') && Number.isInteger(cost.n) && cost.n >= 1 ? { pool: cost.pool, n: cost.n } : null;
    }
}

/** Payload: { member, name, remove?: true } or { member, name, about?, stat?, type?, cost? } (a new name adds the skill into a free slot). */
export function skillEdit(ctx, payload = {}) {
    const member = sheetOf(ctx, payload);
    const name = String(payload.name ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
    if (!name) ctx.fail('INVALID', 'A skill needs a name.');
    const at = skillIndex(member, name);
    if (payload.remove === true) {
        if (at < 0) ctx.fail('NOT_FOUND', `${member.name} has no skill called ${name}.`);
        member.skills.splice(at, 1);
        delete member.practice[practiceKey(name)];
        return { summary: `${member.name} sets ${name} aside.`, narrate: false, data: { member: member.id, skill: name, removed: true } };
    }
    let skill = member.skills[at];
    if (!skill) {
        if (member.skills.length >= skillSlots(levelOf(member))) ctx.fail('LIMITED', `${member.name} has no free skill slot.`);
        skill = { name, about: '', stat: 'str', type: 'utility', cost: null, learned: nextLearned(member) };
        if (!statKey(payload.stat)) ctx.fail('INVALID', 'A new skill needs a stat.');
        member.skills.push(skill);
    }
    applySkillFields(ctx, skill, payload);
    return { summary: `${member.name}'s ${name} is set.`, narrate: false, data: { member: member.id, skill: name } };
}
