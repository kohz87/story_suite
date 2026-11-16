import assert from 'node:assert/strict';
import { MODULE_ID } from '../src/storysuite-v2.js';
import { eventSummary, readEvent } from '../src/npc-meters-pacing.js';
import { FEATURE_GATE, readLeaf } from '../src/npc-meters-config.js';
import { diff } from './vendor/story-block/src/v2/ops/diff.js';
import { DAY, dossiers, suite } from './helpers/pacing-suite.js';

export const noCue = lines => lines.filter(line => !/^Whenever anything changed, write the <Changes> block/.test(line)); // the flash-rare-lines cue: pinned in npc-notes-kinds.test.js

// [reply, story day at the start of the reply, tier, asks] for each `~ npc Sister Temiwa` line of the owner's story.
export const TEMIWA = [
    [3, 1, 'ordinary', { tension: 1 }], [5, 1, 'ordinary', { trust: 1 }], [7, 1, 'ordinary', { affection: 1, trust: 1 }],
    [9, 1, 'meaningful', { trust: 2, affection: 2, desire: 1 }], [11, 1, 'meaningful', { trust: 1, affection: 1, desire: 1 }],
    [19, 1, 'major', { trust: 5, affection: 2, desire: 1 }], [21, 1, 'meaningful', { trust: 2, affection: 2, desire: 2 }],
    [23, 1, 'meaningful', { trust: 5, affection: 4, desire: 6 }], [25, 1, 'meaningful', { trust: 1, affection: 1, desire: 2 }],
    [27, 1, 'ordinary', { trust: 1, affection: 1, desire: 2 }], [29, 1, 'major', { trust: 5, affection: 5, desire: 10 }],
    [31, 1, 'major', { trust: 5, affection: 10, desire: 10 }], [33, 1, 'meaningful', { trust: 2, affection: 3, desire: 2 }],
    [35, 1, 'meaningful', { trust: 2, affection: 2, desire: 2 }], [41, 2, 'ordinary', { trust: 1, affection: 1 }],
    [43, 2, 'meaningful', { affection: 2, desire: 2 }], [45, 2, 'ordinary', { trust: 1 }],
    [47, 2, 'major', { trust: 5, affection: 3, tension: 5 }], [49, 2, 'major', { trust: 5, affection: 5, desire: 2, tension: -2 }],
    [51, 2, 'meaningful', { trust: 2, affection: 2, desire: 2 }], [53, 2, 'meaningful', { affection: 2, desire: 5 }],
    [55, 2, 'meaningful', { desire: 3, affection: 2 }], [57, 2, 'meaningful', { affection: 2, desire: 4 }],
    [59, 2, 'meaningful', { trust: 1, affection: 2, desire: 1 }],
];

export function prng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), chance: p => next() < p, pick: list => list[Math.floor(next() * list.length)] };
}

// FUZZ_SEEDS="1-200" (or "3,11,29") runs those seeds; the default is the three below. FUZZ_STEPS sets the steps (default 16).
export const fuzzSeeds = (spec, fallback) => (spec ? spec.split(',').flatMap(part => { const [a, b] = part.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; }) : fallback);
export const PEOPLE = ['Astra', 'Sister Temiwa', 'Brann', 'Cole', 'Dova', 'Esk', 'Finn', 'Gale', 'Hobb', 'Ines', 'Jory', 'Kess', 'Lund', 'Mave'];   // 14: past the bond limit (8) and the ties limit (12)
// One random line of the notes kinds (lie, know, taste, tie), a gate `via:` meter line, or a plain meter line: every change-line kind NSD owns.
export function fuzzLine(r, who) {
    const other = r.pick(PEOPLE);
    switch (r.int(0, 9)) {
        case 0: return `~ lie ${who} | to: ${other} | said: it was not me ${r.int(0, 3)}`;
        case 1: return `~ lie ${who} | to: ${other} | caught: yes`;
        case 2: return `~ know ${who} | about: ${other} | fact: keeps a ledger ${r.int(0, 3)} | how: ${r.pick(['saw', 'heard'])}${r.chance(0.4) ? ' | secret: yes' : ''}`;
        case 3: return `~ know ${who} | about: ${other} | fact: keeps a ledger ${r.int(0, 3)} | told: yes`;
        case 4: return `~ taste ${who} | ${r.pick(['likes', 'dislikes'])}: ${r.pick(['tea', 'toffee', 'rain', 'paperwork'])}${r.chance(0.3) ? ' | why: a change of heart' : ''}`;
        case 5: return `~ tie ${who} | with: ${other} | tag: ${r.pick(['+', '-'])}${r.pick(['ally', 'rival', 'owes'])}${r.chance(0.3) ? `, ${r.pick(['+', '-'])}${r.pick(['ally', 'rival', 'owes'])}` : ''}`;
        case 6: case 7: return `~ npc ${who} | affection: +${r.int(1, 9)} | trust: ${r.pick(['+', '-'])}${r.int(0, 6)} | via: ${r.pick(['praise', 'gift', 'help', 'flirt', 'threat', 'shared-danger'])} | impact: ${r.pick(['ordinary', 'meaningful', 'major', 'extreme'])}`;
        default: return `~ npc ${who} | trust: +${r.int(1, 9)} | affection: ${r.pick(['+', '-'])}${r.int(0, 6)} | impact: ${r.pick(['ordinary', 'meaningful', 'major', 'extreme'])}`;
    }
}

export const shape = s => JSON.stringify(s.host.head());
export const gateOn = { [FEATURE_GATE]: true };
export const praise = (who = 'Oren', by = 3, via = 'praise') => `~ npc ${who} | affection: +${by} | via: ${via} | impact: major`;
export const record = (s, key = 'oren') => s.host.head().domains.people.bonds.npcs[`npc_${key}`];
export const gateOf = (s, key = 'oren') => eventSummary(readEvent(record(s, key).lastEvent))?.gate;
export const tailOf = s => s.host.registry.module(MODULE_ID).context.tail({ state: s.host.head(), chat: { length: s.host.ctx.chat.length } });
export const lowTrust = () => { const records = dossiers(); records.npc_oren.relationship.trust = -50; return records; };

export const MOOD_ON = { 'npc-state-delta.mood-pull': true };
// A stand-in for Story Director's threads and key people and Story Block's party: one domain, queries read it as of the reply.
export const worldModule = {
    id: 'zz-world', name: 'World',
    // One text leaf (the host checks every field called `id`): { party, threads, away } as JSON.
    domains: { world: { initial: () => ({ data: '{}' }) } },
    commands: { 'zz.world': (ctx, patch) => { const slice = ctx.draft('world'); slice.data = JSON.stringify({ ...JSON.parse(slice.data), ...patch }); return { summary: 'the world moves' }; } },
    queries: {
        'party.actors': state => JSON.parse(state?.domains?.world?.data ?? '{}').party ?? null,
        'director.threads': state => JSON.parse(state?.domains?.world?.data ?? '{}').threads ?? [],
        'director.keyPeople': state => JSON.parse(state?.domains?.world?.data ?? '{}').away ?? [],
    },
};
export const moodSuite = (extra = {}) => suite({ allowance: null, features: MOOD_ON, modules: [worldModule], ...extra });
export const world = async (s, patch) => { const out = await s.host.sdk.command('zz.world', patch); assert.equal(out.ok, true, JSON.stringify(out)); };
// The record as stored, with its text leaves (mood, inst, pull, track) read back as objects.
export const recordOf = (s, key = 'oren') => { const raw = s.host.head().domains.people.bonds.npcs[`npc_${key}`]; return raw && Object.fromEntries(Object.entries(raw).map(([field, value]) => [field, ['mood', 'inst', 'pull', 'track'].includes(field) ? readLeaf(value) : value])); };
export const plain = ({ v, a, d, day, cause }) => ({ v, a, d, day, cause });
export const clockTo = (s, minutes) => s.host.sdk.command('zz.clock', { minutes });
export const axes = s => { const m = recordOf(s).mood; return [m.v, m.a, m.d]; };

// A chat written under 1.16.0 stores mood, inst, pull and track as objects (per-field ops). Rewrite a chat's leaf ops that way.
export function toOld(chat) {
    const prev = new Map();
    const LEAF = /^\/domains\/people\/bonds\/npcs\/[^/]+\/(mood|inst|pull|track)$/;
    for (const message of chat) {
        const rec = message.extra?.storySuite;
        if (!rec?.ops) continue;
        const out = [];
        const blockOf = [];
        (rec.spans ?? []).forEach((span, b) => { for (let k = 0; k < span.n; k++) blockOf.push(b); });
        const grow = new Array((rec.spans ?? []).length).fill(0);
        for (const [i, op] of rec.ops.entries()) {
            const at = out.length;
            if (!LEAF.test(op.path ?? '')) { out.push(op); continue; }
            if (op.op === 'remove') { prev.delete(op.path); out.push(op); continue; }
            const obj = typeof op.value === 'string' ? JSON.parse(op.value) : op.value;
            const before = prev.get(op.path);
            if (before && typeof before === 'object') out.push(...diff(before, obj, op.path)); else out.push({ op: 'add', path: op.path, value: obj });
            prev.set(op.path, obj);
            if (blockOf[i] !== undefined) grow[blockOf[i]] += out.length - at - 1;
        }
        rec.ops = out;
        (rec.spans ?? []).forEach((span, b) => { span.n += grow[b]; });
        if (Array.isArray(message.swipe_info)) for (const info of message.swipe_info) if (info?.extra?.storySuite && info.extra.storySuite.sid === rec.sid) info.extra.storySuite = structuredClone(rec);
    }
}
