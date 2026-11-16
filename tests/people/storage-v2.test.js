import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    NPC_STATE_FILE_FORMAT_VERSION,
    cancelPendingNpcStateWrite,
    decodeStateFileHead,
    decodeStateFilePayload,
    encodeStateFilePayload,
    makeNpcStateDataFileName,
    readNpcStateDataFile,
    undurableNpcStateSnapshot,
    writeNpcStateDataFile,
} from '../../modules/people/storage/storage.js';
import { createNpcRecord } from '../../modules/people/core/core.js';
import { reconcileBranchState, recordBranchCheckpoint } from '../../modules/people/legacy/branch.js';
import {
    atClock,
    buildChat,
    legacyDecode,
    legacyEncodeV1,
    msgA,
    msgU,
    portraitState,
    same,
    viaV1,
    viaV2,
} from './storage.helpers.js';

test('v2: encode writes formatVersion 2 with the packing header before state; checkpoints round-trip stringify-identical', () => {
    const { state } = buildChat(30);
    const text = encodeStateFilePayload('chat:v2', state, 't');
    const raw = JSON.parse(text);
    assert.equal(raw.formatVersion, 2);
    assert.equal(NPC_STATE_FILE_FORMAT_VERSION, 2);
    assert.ok(text.indexOf('"packing"') < text.indexOf(',"state":{'));
    assert.ok(raw.state.checkpoints.some(entry => entry.packed), 'a 30-reply chat has packed entries');
    const decoded = decodeStateFilePayload(text);
    assert.equal('packing' in decoded, false);
    same(decoded.state, viaV1(state), 'v2 load == v1 load');
    same(decoded.state, state);
    assert.equal(decodeStateFileHead(text).formatVersion, 2);
    assert.equal(decodeStateFileHead(text).revision, 0);
});

// The corpus is 9 synthetic states built here (not the states every other test file builds; those now all round-trip through v2
// inside the full suite). Portrait and journal states are compared v2-load against v1-load, because both compact the portrait.
test('v2 migration: every state shape is read from v1, saved as v2, and read back equal (v1 -> v2 -> back)', () => {
    const journalState = buildChat(20).state;
    assert.ok(Array.isArray(journalState.rollbackJournal) ? journalState.rollbackJournal.length > 0 : Object.keys(journalState.rollbackJournal || {}).length > 0, 'the built state carries a rollback journal');
    const states = [
        buildChat(0).state, buildChat(1).state, buildChat(7).state, buildChat(26).state, buildChat(60, { limit: 20 }).state,
        journalState, portraitState(),
        { npcs: [createNpcRecord('Wiz')], portraitAssets: {}, formPortraitAssets: {} },
        { npcs: [], portraitAssets: {}, formPortraitAssets: {}, checkpoints: [{ messageId: 9 }, { messageId: 10, pad: 'x' }, { messageId: 11, base: 0, patch: [] }] },
    ];
    for (const state of states) {
        const v1Text = legacyEncodeV1('chat:v2', state);
        const loaded = decodeStateFilePayload(v1Text);
        assert.equal(loaded.formatVersion, 1);
        const v2Text = encodeStateFilePayload('chat:v2', loaded.state, 't');
        const again = decodeStateFilePayload(v2Text);
        assert.equal(JSON.parse(v2Text).formatVersion, 2);
        same(again.state, loaded.state);   // v1 -> v2 -> back equals what the v1 file held
        same(decodeStateFilePayload(encodeStateFilePayload('chat:v2', state, 't')).state, loaded.state);   // saving the live state as v2 loads as the v1 save would
        same(JSON.parse(v2Text).state.checkpoints?.length, loaded.state.checkpoints?.length);
    }
    assert.equal(decodeStateFilePayload(encodeStateFilePayload('chat:v2', portraitState(), 't')).state.portraitAssets[portraitState().npcs[0].id].dataUrl, 'data:image/png;base64,AAAA');
});

test('v2 migration: a checkpoint that already carries a reserved key falls back to a whole v1 file; it still loads', () => {
    const { state } = buildChat(8);
    state.checkpoints[3].packed = { owner: 'hand-edit' };
    const text = encodeStateFilePayload('chat:v2', state, 't');
    assert.equal(JSON.parse(text).formatVersion, 1);
    same(decodeStateFilePayload(text).state, state);
});

test('v2: a v1 file is read without any write; reading never converts it', async () => {
    const { state } = buildChat(6);
    const text = legacyEncodeV1('chat:v2', state);
    let uploads = 0;
    const fetchFn = async (url, options = {}) => {
        if (url === '/api/files/upload') { uploads += 1; return { ok: true, status: 200, json: async () => ({}), text: async () => '' }; }
        return { ok: true, status: 200, text: async () => text };
    };
    const loaded = await readNpcStateDataFile({ path: '/user/files/x.json', revision: 1 }, { fetchFn });
    same(loaded.state, state);
    assert.equal(uploads, 0);
});

test('v2 rollback: rolling back to every reply gives byte-identical results from the v1 and the v2 file', () => {
    const { state, chat } = buildChat(60);
    const a = viaV1(state);
    const b = viaV2(state);
    for (let k = 1; k <= 60; k += 1) {
        const cut = chat.slice(0, k * 2);
        const ra = atClock(() => reconcileBranchState(structuredClone(a), cut, { explicitDivergence: cut.length }));
        const rb = atClock(() => reconcileBranchState(structuredClone(b), cut, { explicitDivergence: cut.length }));
        same(rb, ra, `reply ${k}`);
        const da = atClock(() => reconcileBranchState(structuredClone(a), cut, { explicitDivergence: cut.length - 1, operation: 'delete', rewindMidDelete: true }));
        const db = atClock(() => reconcileBranchState(structuredClone(b), cut, { explicitDivergence: cut.length - 1, operation: 'delete', rewindMidDelete: true }));
        same(db, da, `delete to ${k}`);
    }
});

test('v2 reconcile: swipe, regenerate, edit and mid-chat delete give the same result on the v1 and v2 files', () => {
    const { state, chat } = buildChat(30);
    const a = viaV1(state);
    const b = viaV2(state);
    const swipe = chat.slice(0, 41).concat(msgA('reply 20 swiped', 1)).concat(chat.slice(42));
    const edited = chat.map((m, i) => (i === 30 ? { ...m, mes: `${m.mes} (edited)` } : m));
    const cases = [
        [swipe, { explicitDivergence: 41, operation: 'swipe' }],
        [chat.slice(0, 41), { explicitDivergence: 41, operation: 'regenerate' }],
        [edited, { explicitDivergence: 30, operation: 'edit' }],
        [chat.filter((_, i) => i !== 20), { explicitDivergence: 20, operation: 'delete', rewindMidDelete: true }],
        [chat.filter((_, i) => i !== 20), { explicitDivergence: 20, operation: 'delete' }],
    ];
    for (const [live, options] of cases) {
        const ra = atClock(() => reconcileBranchState(structuredClone(a), live, options));
        const rb = atClock(() => reconcileBranchState(structuredClone(b), live, options));
        same(rb, ra, options.operation);
        // and back again: the re-saved result of one case reads back equal
        same(viaV2(rb.state), viaV1(ra.state));
    }
});

test('v2 crash mid-save: a failed or cut-off upload leaves the previous bytes; a truncated v2 file is refused, never half-read', async () => {
    const chatKey = 'chat:v2:crash';
    const name = makeNpcStateDataFileName(chatKey);
    const path = `/user/files/${name}`;
    const { state } = buildChat(20);
    let server = encodeStateFilePayload(chatKey, state, 't', { revision: 1, writerId: 'w0' });
    const before = server;
    const failing = async (url) => (url === path ? { ok: true, status: 200, text: async () => server } : { ok: false, status: 413, text: async () => 'too large' });
    await assert.rejects(writeNpcStateDataFile({ chatKey, state, appVersion: 't', pointer: { name, path, revision: 1, writerId: 'w0' }, fetchFn: failing, continuousRetry: false }), error => error.status === 413);
    assert.equal(server, before);
    cancelPendingNpcStateWrite(chatKey);
    for (let i = 1; i < 16; i += 1) {
        const cut = before.slice(0, Math.floor(before.length * i / 16));
        assert.throws(() => decodeStateFilePayload(cut), /invalid JSON/, `cut at ${i}/16`);
    }
    assert.equal(decodeStateFileHead(before.slice(0, Math.floor(before.length / 2))), null, 'a cut-off file is decoded in full (and refused there)');
});

test('v2 refusal: tampered packed entries and a missing packing header are refused with no partial state', () => {
    const { state } = buildChat(30);
    const good = JSON.parse(encodeStateFilePayload('chat:v2', state, 't'));
    const at = good.state.checkpoints.findIndex(entry => entry.packed);
    const mutate = fn => { const copy = structuredClone(good); fn(copy); return JSON.stringify(copy); };
    const bad = [
        mutate(p => { delete p.packing; }),
        mutate(p => { p.state.checkpoints[at].packed.base = at; }),
        mutate(p => { p.state.checkpoints[at].packed.base = -1; }),
        mutate(p => { p.state.checkpoints[at].packed.base = 0.5; }),
        mutate(p => { p.state.checkpoints[at].packed.patch[0].op = 'move'; }),
        mutate(p => { p.state.checkpoints[at].packed.patch[0].path = '/nope/nope'; }),
        mutate(p => { p.state.checkpoints[at].snapshot = {}; }),
    ];
    for (const text of bad) assert.throws(() => decodeStateFilePayload(text), /could not be rebuilt|packing header/);
});

test('v2 older build: a v1 decoder refuses a v2 file and the file bytes are untouched; the newest build refuses format 3 without retrying', async () => {
    const { state } = buildChat(12);
    const v2 = encodeStateFilePayload('chat:v2', state, 't');
    assert.throws(() => legacyDecode(v2), /Unsupported NPC State Delta data file version: 2/);
    // frozen old-build write path: the unsupported-version error carries no code, so an old build retries it (measured in review);
    // the file stays unchanged either way. The new build marks the error, so a future format 3 is not retried.
    const chatKey = 'chat:v2:future';
    const name = makeNpcStateDataFileName(chatKey);
    const path = `/user/files/${name}`;
    const server = JSON.stringify({ ...JSON.parse(v2), formatVersion: 3 });
    let gets = 0; let uploads = 0; let sleeps = 0;
    const fetchFn = async (url) => {
        if (url === path) { gets += 1; return { ok: true, status: 200, text: async () => server }; }
        if (url === '/api/files/upload') uploads += 1;
        return { ok: false, status: 404, text: async () => '' };
    };
    await assert.rejects(
        writeNpcStateDataFile({ chatKey, state, appVersion: 't', pointer: { name, path, revision: 1 }, fetchFn, sleepFn: (fn) => { sleeps += 1; fn(); } }),
        error => error.code === 'NPC_STATE_UNSUPPORTED_FORMAT' && /newer NPC State Delta; update the extension/.test(error.message),
    );
    assert.equal(uploads, 0);
    assert.equal(sleeps, 0, 'no retry');
    assert.ok(gets >= 1);
    assert.equal(undurableNpcStateSnapshot(chatKey)?.state?.turn, state.turn, 'the unsaved copy is kept in memory');
    assert.equal(cancelPendingNpcStateWrite(chatKey), true);
});

// T9b: the real pre-format-2 build (origin/main at the time of format 2) meets a v2 file on its write path. Its decoder refuses
// (no error code, so it retries a bounded number of times); it must never upload, and the server bytes stay unchanged.
// Skipped when git or the base ref is not available (a source tarball). Uses the real old storage.js, not a copy kept here.
test('v2 older build (T9b): the real previous build, writing over a v2 file, uploads nothing and leaves the bytes unchanged', async t => {
    const dir = mkdtempSync(join(tmpdir(), 'nsd-old-build-'));
    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const packed = spawnSync('sh', ['-c', 'git archive "$0" | tar -x -C "$1"', 'origin/main', dir], { cwd: join(here, '..') });
        if (packed.status !== 0 || !existsSync(join(dir, 'storage.js'))) { t.skip('no git history for origin/main'); return; }
        const old = await import(pathToFileURL(join(dir, 'storage.js')).href);
        if (old.NPC_STATE_FILE_FORMAT_VERSION !== 1) { t.skip('origin/main already writes format 2'); return; }
        const { state } = buildChat(30);
        const chatKey = 'chat:old-tab';
        const v2 = encodeStateFilePayload(chatKey, state, 'new', { revision: 5, writerId: 'newtab' });
        assert.equal(JSON.parse(v2).formatVersion, 2);
        assert.throws(() => old.decodeStateFilePayload(v2), /Unsupported NPC State Delta data file version: 2/);
        const name = old.makeNpcStateDataFileName(chatKey);
        const path = `/user/files/${name}`;
        let gets = 0; let uploads = 0;
        const fetchFn = async (url) => {
            if (String(url).startsWith(path)) { gets += 1; return { ok: true, status: 200, headers: { get: () => null }, text: async () => v2 }; }
            if (url === '/api/files/upload') { uploads += 1; return { ok: true, status: 200, json: async () => ({ path }), text: async () => '' }; }
            return { ok: false, status: 404, headers: { get: () => null }, text: async () => '' };
        };
        await assert.rejects(old.writeNpcStateDataFile({ chatKey, state: { turn: 1, npcs: [] }, appVersion: 'old', pointer: { name, path, revision: 4, writerId: 'oldtab' }, fetchFn, sleepFn: (fn) => fn(), continuousRetry: false }), /Unsupported/);
        assert.equal(uploads, 0, 'the old build uploads nothing over a v2 file');
        assert.ok(gets >= 1);
        old.cancelPendingNpcStateWrite?.(chatKey);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('v2 size and cost: 28 / 100 / 500 replies, measured against the v1 text of the same state (numbers are printed)', () => {
    const rows = [];
    for (const replies of [28, 100, 500]) {
        const { state } = buildChat(replies, { npcCount: 24, noteChars: 5000 });
        const v1 = legacyEncodeV1('chat:v2', state);
        // Interleaved rounds so a busy machine slows both sides alike; the best round of each is kept.
        let v2 = '';
        let back;
        let encodeMs = Infinity; let decodeMs = Infinity; let v1EncodeMs = Infinity;
        const timed = fn => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
        encodeStateFilePayload('chat:v2', state, 't');   // warm up the JIT
        for (let round = 0; round < 9; round += 1) {
            v1EncodeMs = Math.min(v1EncodeMs, timed(() => JSON.stringify(structuredClone(state))));   // today's encode: one clone + one stringify
            encodeMs = Math.min(encodeMs, timed(() => { v2 = encodeStateFilePayload('chat:v2', state, 't'); }));
            decodeMs = Math.min(decodeMs, timed(() => { back = decodeStateFilePayload(v2); }));
        }
        same(back.state, state);
        rows.push({ replies, checkpoints: state.checkpoints.length, snapshotKB: Math.round(JSON.stringify(state.checkpoints[0].snapshot).length / 1024), v1KB: Math.round(v1.length / 1024), v2KB: Math.round(v2.length / 1024), ratio: +(v2.length / v1.length).toFixed(3), encodeMs, decodeMs, v1EncodeMs, encodeRatio: +(encodeMs / v1EncodeMs).toFixed(2) });
        assert.ok(v2.length < v1.length * 0.5, `${replies} replies: ${v2.length} vs ${v1.length}`);
        // Review bound: 2.0x of today's encode. Measured 1.6-2.0x on a quiet machine (printed below); the assertion is a 3x guard so a busy machine does not fail the suite.
        assert.ok(encodeMs <= 3 * v1EncodeMs, `v2 encode ${encodeMs} ms vs today's ${v1EncodeMs} ms (guard 3x)`);
    }
    console.log('V2-SIZE', JSON.stringify(rows));
});

// Seeded fuzz at the file boundary: random replies, swipes, regenerates, edits, middle/tail deletes and rewinds. After every step the
// state is saved and loaded once as v1 and once as v2; the reconcile of both must match exactly and the v2 file must read back equal.
// FUZZ_SEEDS="1-200" (or "5,17") picks the seeds (default 5, 17, 41); FUZZ_STEPS the steps (default 18).
const fuzzSeeds = (spec, fallback) => (spec ? spec.split(',').flatMap(part => { const [a, b] = part.split('-').map(Number); return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a]; }) : fallback);
function seededRandom(seed) {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), chance: p => next() < p };
}
for (const seed of fuzzSeeds(process.env.FUZZ_SEEDS, [5, 17, 41])) {
    test(`v2 file fuzz seed ${seed}: delete/swipe/edit/rewind replay is identical through the v1 and the v2 file`, () => {
        const r = seededRandom(seed);
        let { state, chat } = buildChat(r.int(2, 34), { npcCount: 3, noteChars: 200 });
        for (let step = 0; step < (Number(process.env.FUZZ_STEPS) || 18); step += 1) {
            const a = viaV1(state);
            const b = viaV2(state);
            same(b, a, `seed ${seed} step ${step}: load`);
            const kind = r.int(0, 7);
            let live = chat;
            let options = {};
            if (kind <= 1 || chat.length < 4) {
                live = chat.concat(msgU(`u${step}`), msgA(`a${step}`));
                options = {};
            } else if (kind === 2) {
                const at = r.int(1, Math.floor(chat.length / 2)) * 2 - 1;
                live = chat.map((m, i) => (i === at ? msgA(`swiped ${step}`, r.int(1, 3)) : m));
                options = { explicitDivergence: at, operation: 'swipe' };
            } else if (kind === 3) {
                const at = r.int(0, chat.length - 1);
                live = chat.map((m, i) => (i === at ? { ...m, mes: `${m.mes} edit${step}` } : m));
                options = { explicitDivergence: at, operation: 'edit' };
            } else if (kind === 4) {
                const at = r.int(0, chat.length - 1);
                live = chat.filter((_, i) => i !== at);
                options = { explicitDivergence: at, operation: 'delete', rewindMidDelete: r.chance(0.5) };
            } else {
                const keep = r.int(1, chat.length - 1);
                live = chat.slice(0, keep);
                options = { explicitDivergence: keep, operation: kind === 5 ? 'delete' : 'regenerate', rewindMidDelete: kind === 5 };
            }
            const ra = atClock(() => reconcileBranchState(structuredClone(a), live, options));
            const rb = atClock(() => reconcileBranchState(structuredClone(b), live, options));
            same(rb, ra, `seed ${seed} step ${step}: reconcile ${options.operation || 'extend'}`);
            state = rb.state;
            chat = live;
            if (chat.length >= 2 && chat.at(-1).is_user === false) {
                state.turn += 1;
                state.npcs[step % state.npcs.length].relationship.trust = (state.npcs[step % state.npcs.length].relationship.trust + 3) % 100;
                recordBranchCheckpoint(state, chat, chat.length - 1, 'scan');
            }
        }
        same(viaV2(state), viaV1(state), `seed ${seed}: final`);
    });
}
