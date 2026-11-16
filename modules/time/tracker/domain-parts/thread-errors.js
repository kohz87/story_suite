// Story Director v2, tracker part (domain): checks one thread of the `director` slice (cached for frozen threads).

import { closed, cursor, hash, map, minute, recordId, source } from '../thread-shape.js';
import { lineKey } from '../../../world/changes.js';
import { OUTCOMES, THREAD_KINDS } from '../convert.js';
import { isInt, isRecord } from './shared-guards.js';

const THREAD_ID = /^th_[0-9a-z]{8}$/;
const TARGET_KINDS = ['foes', 'items'];

// A thread that is frozen all the way down (a state's own) is checked once per object and id: the states of a replay share
// their unchanged threads, so a block that changed one thread no longer re-checks the others. Anything else is checked each time.
const checkedThreads = new WeakMap();
const frozenThreads = new WeakSet();
const frozenAll = value => {
    if (value === null || typeof value !== 'object' || frozenThreads.has(value)) return true;
    if (!Object.isFrozen(value) || !Reflect.ownKeys(value).every(key => frozenAll(value[key]))) return false;
    frozenThreads.add(value);
    return true;
};

export function threadErrors(id, thread) {
    if (thread === null || typeof thread !== 'object' || !frozenAll(thread)) return threadErrorsOf(id, thread);
    const known = checkedThreads.get(thread);
    if (known?.id === id) return known.errors;
    const errors = threadErrorsOf(id, thread);
    checkedThreads.set(thread, { id, errors });
    return errors;
}

function threadErrorsOf(id, thread) {
    const errors = [];
    const at = `director.threads.${id}`;
    if (!isRecord(thread)) return [`${at} is not a thread.`];
    if (!THREAD_ID.test(id) || thread.id !== id) errors.push(`${at} has a bad id.`);
    if (!THREAD_KINDS.includes(thread.kind)) errors.push(`${at} has an unknown kind "${thread.kind}".`);
    if (typeof thread.key !== 'string' || !lineKey(thread.key)) errors.push(`${at} has no key.`);
    if (typeof thread.summary !== 'string') errors.push(`${at}.summary is not text.`);
    if (!isRecord(thread.fields) || Object.values(thread.fields).some(value => typeof value !== 'string')) errors.push(`${at}.fields must hold text.`);
    if (!['active', 'resolved'].includes(thread.status)) errors.push(`${at}.status must be active or resolved.`);
    if (typeof thread.offer !== 'boolean') errors.push(`${at}.offer must be true or false.`);
    if (thread.taken !== null && !(isRecord(thread.taken) && isInt(thread.taken.rev))) errors.push(`${at}.taken must be null or { rev }.`);
    if (thread.ended !== null && !(isRecord(thread.ended) && isInt(thread.ended.rev) && typeof thread.ended.reason === 'string' && OUTCOMES.includes(thread.ended.outcome))) {
        errors.push(`${at}.ended must be null or { rev, reason, outcome }.`);
    }
    if ((thread.status === 'resolved') !== (thread.ended !== null)) errors.push(`${at} is ${thread.status} but ended is ${thread.ended ? 'set' : 'empty'}.`);
    const target = thread.target;
    if (target !== null && !(isRecord(target) && typeof target.noun === 'string' && isInt(target.count) && target.count >= 0 && TARGET_KINDS.includes(target.kind))) {
        errors.push(`${at}.target must be null or { noun, count, kind }.`);
    }
    const reward = thread.reward;
    if (reward !== null && !(isRecord(reward) && (reward.amount === null || (isInt(reward.amount) && reward.amount >= 0))
        && typeof reward.each === 'boolean' && typeof reward.unit === 'string' && typeof reward.text === 'string')) {
        errors.push(`${at}.reward must be null or { amount, each, unit, text }.`);
    }
    if (!isInt(thread.rev) || thread.rev < 0) errors.push(`${at}.rev must be a whole number.`);
    // F83: the story said the goal is met; F88 (older chats): the reply an offer was shown from.
    if (thread.ready !== undefined && thread.ready !== null && !(isRecord(thread.ready) && isInt(thread.ready.rev))) errors.push(`${at}.ready must be null or { rev }.`);
    if (thread.shown !== undefined && !(isRecord(thread.shown) && isInt(thread.shown.turn) && thread.shown.turn >= 0)) errors.push(`${at}.shown must be { turn }.`);
    if (thread.track !== undefined && !isRecord(thread.track)) errors.push(`${at}.track must be an object.`);
    // Legacy reward history: retained bytes, never an SD payout path.
    const owed = thread.owed;
    if (owed !== undefined) {
        const amount = value => value === undefined || (isInt(value) && value >= 0);
        if (!(isRecord(owed) && typeof owed.text === 'string' && isInt(owed.rev) && amount(owed.units) && amount(owed.credit) && amount(owed.total)
            && (owed.paid === undefined || (isRecord(owed.paid) && Object.values(owed.paid).every(value => isInt(value) && value >= 0))))) {
            errors.push(`${at}.owed must be { text, rev, units?, credit?, total?, paid? }.`);
        }
    }
    if (thread.acceptance !== undefined && thread.acceptance !== null) {
        const a = thread.acceptance;
        if (!closed(a, ['source', 'cursor', 'minute', 'proof']) || !source(a.source) || !cursor(a.cursor) || !minute(a.minute) || !recordId(a.proof)) errors.push(`${at}.acceptance is invalid.`);
    }
    // Unsupported old quest data is opaque and read-only; no battle schema is interpreted.
    if (thread.rpg !== undefined && !map(thread.rpg)) errors.push(`${at}.rpg must be an object.`);
    return errors;
}
