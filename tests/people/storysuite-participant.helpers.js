import { createParticipant, memoryVault } from '../src/storysuite-participant/index.js';
import { buildCheckpoint } from '../src/storysuite-participant/index.js';
import { hashJson } from '../src/storysuite-participant/hash.js';

export const npc = (id, name, extra = {}) => ({ id, name, aliases: [], archived: false, present: true, lifeState: 'alive', trust: 3, ...extra });
export const freshState = () => ({
    npcs: [npc('npc_mira', 'Mira', { aliases: ['The Weaver'] }), npc('npc_tom', 'Old Tom')],
    socialGraph: { edges: [{ a: 'npc_mira', b: 'npc_tom', kind: 'friends' }] },
    checkpoints: [{ messageId: 3, snapshot: { npcs: [] } }], lineage: [{ id: 1 }], turn: 4,
});

export function setup({ state = freshState(), chatKey = 'chat:avatar.png:one', vault = memoryVault(), extra = {} } = {}) {
    const live = { state, installs: 0, writes: 0, chatKey };
    const port = {
        chatKey: () => live.chatKey,
        readState: () => structuredClone(live.state),
        installState: async next => { live.installs += 1; live.state = structuredClone(next); },
        writeTimeline: async block => { live.writes += 1; live.state = { ...live.state, timeline: structuredClone(block) }; },
        ...extra,
    };
    let tick = 1000;
    const made = createParticipant({ port, vault, now: () => (tick += 1), random: seededRandom(7 + (seeds += 1)), ...(extra.options ?? {}) });
    return { live, port, vault, ...made };
}
let seeds = 0;
/** A deterministic source of lineage ids (each participant its own). */
export function seededRandom(seed = 7) {
    let n = seed;
    return () => { n = (n * 48271) % 2147483647; return n / 2147483647; };
}

// ---- publishing a change Delta already made (the observer) ----

export function handleFor(calls, { source = { sid: 'sr_00000001', swipeKey: 'sw_00000001', evidence: 'ev_00000001', ordinal: 0 }, answers = [] } = {}) {
    let head = 0;
    return {
        head: async () => ({ ok: true, headHash: String(head).repeat(64).slice(0, 64), cursor: { sid: 'sr_00000001', swipeKey: 'sw_00000001', op: 0, rev: head }, epoch: 'ep_00000000', prefixHash: 'c'.repeat(64), ...(source ? { source } : {}) }),
        nativeMutation: async input => {
            const made = await input.prepare();
            calls.push({ input, made });
            head += 1;
            const answer = answers.shift();
            if (answer) return answer;
            return { ok: true, checkpoint: made.after.checkpoint, hash: made.after.hash };
        },
    };
}

// A head selection that would install a state far older than the change can reach (run 3: a swipe of the latest reply installed the first reply's
// state and the dossier progress of five replies was lost) keeps the dossiers, says so, and is answered as done; exact restores are not asked.
export const names = (count, from = 0) => Array.from({ length: count }, (_, at) => `m${from + at}`);
export async function behindSetup(extra = {}) {
    const told = [];
    const chat = [...names(12).slice(0, 11), 'swiped-12'];
    const made = setup({ extra: { warn: text => told.push(text), chatLineage: () => chat, ...extra } });
    await made.hydrate();
    const keep = async length => {
        made.live.state.lineage = names(length);
        await made.hydrate();
        return made.participant.checkpoint({ cursor: { sid: `sr_${length}` }, headHash: String(length % 10).repeat(64) });
    };
    const first = await keep(3);
    const parent = await keep(11);
    made.live.state.npcs.push(npc('npc_late', 'Late progress'));
    made.live.state.lineage = names(12);
    await made.hydrate();
    await keep(12);   // the dossiers as they are now are the published ones (a head selection never replaces unpublished work)
    return { ...made, told, first, parent };
}

// ---- checkpoint files: packed on disk, plain in memory; a save that is thrown away removes only what it made -------------------------------

/** A fake SillyTavern user-files server (upload / verify / delete / read) for the file vault. */
export function filesServer() {
    const files = new Map();
    const fetchFn = async (url, options = {}) => {
        const name = url.split('/').pop();
        if (url === '/api/files/upload') { const body = JSON.parse(options.body); files.set(body.name, Buffer.from(body.data, 'base64').toString()); return { ok: true, status: 200 }; }
        if (url === '/api/files/verify') { const body = JSON.parse(options.body); return { ok: true, status: 200, json: async () => Object.fromEntries(body.urls.map(u => [u, files.has(u.split('/').pop())])) }; }
        if (url === '/api/files/delete') { const had = files.delete(JSON.parse(options.body).path.split('/').pop()); return { ok: had, status: had ? 200 : 404, text: async () => '' }; }
        return files.has(name) ? { ok: true, status: 200, text: async () => files.get(name) } : { ok: false, status: 404, text: async () => '' };
    };
    return { files, fetchFn, checkpointNames: () => [...files.keys()].filter(name => name.startsWith('npc-state-delta-checkpoint-nk_')) };
}
export const bytesOf = (server, names) => names.reduce((sum, name) => sum + Buffer.byteLength(server.files.get(name)), 0);

/** A chat state after `turn` replies: Delta's own rollback history holds a full snapshot per reply (the part that made every file big). */
export function stateAt(turn) {
    const people = at => Array.from({ length: 6 }, (_, n) => npc(`npc_${n}`, `Person ${n}`, { trust: (at + n) % 10, memories: Array.from({ length: Math.min(at, 30) }, (_, m) => `memory ${m} of person ${n}, told on reply ${Math.min(at, m + 1)}`) }));
    const checkpoints = Array.from({ length: turn }, (_, i) => {
        const at = i + 1;
        return { messageId: at, fingerprint: `fp${at}`, lineageKey: `L${at}`, parentLineageKey: at > 1 ? `L${at - 1}` : null, reason: 'scan', createdAt: at, rollbackSeq: at, snapshot: { turn: at, npcs: people(at) } };
    });
    return { npcs: people(turn), socialGraph: { edges: [] }, checkpoints, lineage: [{ id: 1 }], turn };
}

export const lined = turn => ({ ...stateAt(turn), timeline: { v: 1, lineage: 'lg_aaaaaaaa' } });
export const fileOf = (server, id) => JSON.parse(server.files.get(`npc-state-delta-checkpoint-${id}.json`));
export async function saveRun(vault, from, to) {
    const out = [];
    for (let turn = from; turn <= to; turn += 1) {
        const built = buildCheckpoint({ lineage: 'lg_aaaaaaaa', state: lined(turn), cursor: { sid: `sr_${turn}` }, headHash: hashJson({ turn }) });
        await vault.put(built.id, built.doc);
        out.push(built);
    }
    return out;
}
