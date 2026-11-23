// A hand-made ctx and slice for the deterministic tests of kinds and commands (no host, chosen dice).
import { initialState, newMember } from '../../src/domain/shape.js';

export class Refused extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/** A character: Astra, stats 12 across (bonus +1), one costed skill (Obscure, agi, 2 sp) and one free one (Lore, int). */
export function astra(extra = {}) {
    const member = newMember({
        id: 'ac_astra001', name: 'Astra', pc: true, stats: { str: 12, vit: 12, agi: 12, dex: 12, int: 12, wis: 12, cha: 12 },
        skills: [
            { name: 'Obscure', about: 'melts into shadow', stat: 'agi', type: 'movement', cost: { pool: 'sp', n: 2 } },
            { name: 'Lore', about: 'old stories', stat: 'int', type: 'utility' },
        ],
    });
    return Object.assign(member, extra);
}

export const SID = 'sw_reply0001';

/** The slice with the given members and the record of the reply being read, `{ list, floor, used?, … }` (if any), under the reply's sid. */
export function sliceOf(members = [astra()], live = { list: [10, 10, 10], floor: 0 }) {
    const slice = initialState();
    for (const member of members) slice.members[member.id] = member;
    if (live) slice.dice[SID] = { ...live };
    return slice;
}

/** A ctx over `slice`: the handlers draft the slice itself, so a test reads the result from it. */
export function fakeCtx(slice, options = {}) {
    const claimed = new Set();
    const { on = true, rpg = false, query = () => null, time = null, settings = {}, cause = 'ui', caller = null, random = 0.5, sid = SID, receipts = [], standingReceipts = null, call = undefined } = options;
    let made = 0;
    return {
        cause, caller, reply: { index: 2, sid }, standingReceipts, receipts: () => receipts,
        draft: () => slice, read: () => slice, ...(call ? { call } : {}),
        fail(code, message) { throw new Refused(code, message); },
        feature: id => (id === 'text-rpg.on' ? on : id === 'story-block.rpg' ? rpg : false),
        query: (name, args) => query(name, args), time: () => time, settings: () => settings,
        absolute() {},
        claim: key => (claimed.has(key) ? false : Boolean(claimed.add(key))),
        id: prefix => `${prefix}_${String(++made).padStart(8, '0')}`,
        rng: () => random,
    };
}

/** A change line as the parser reads it: `line('try', 'Astra', 'Obscure; hard', { threat: 'a fair match' })`. */
export function line(kind, name, text = '', labels = {}) {
    return { kind, name, text, labels: Object.assign(Object.create(null), labels) };
}

/** Runs a handler and returns `{ ok, result }` or `{ ok: false, code, message }`. */
export function run(handler, ctx, input) {
    try {
        return { ok: true, result: handler(ctx, input) };
    } catch (error) {
        if (error instanceof Refused) return { ok: false, code: error.code, message: error.message };
        throw error;
    }
}
