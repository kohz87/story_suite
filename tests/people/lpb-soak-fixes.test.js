import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScanOperationRegistry } from '../../modules/people/calls/scan-operations.js';
import { createBackfillQueuePart, backfillBatchNote } from '../../modules/people/calls/runtime-backfill-queue.js';
import { readHow } from '../../modules/people/notes/npc-notes-knows.js';
import { suite } from './helpers/pacing-suite.js';
import { ON, oren } from './npc-notes-kinds.helpers.js';

// LPB (live-perf bug hunt 5, 6, 7): queued backfills overlap and tell the reader once, a refused know line is a Problem on its own line,
// and a toast says "NPC State", never "NPC State Delta".

const registry = () => createScanOperationRegistry({ setTimeoutFn: () => ({ unref() {} }), clearTimeoutFn: () => {} });

test('scan operations: operations begun parallel may overlap each other and nothing else; cancel takes them all', () => {
    const r = registry();
    const a = r.begin('chat', 'backfill a', { parallel: true });
    const b = r.begin('chat', 'backfill b', { parallel: true });
    assert.ok(a && b, 'two parallel operations hold the chat together');
    assert.equal(r.begin('chat', 'scan'), null, 'a scan waits for them');
    assert.equal(r.isBusy('chat'), true);
    assert.equal(r.isBusy('chat', { ignoreParallel: true }), false, 'a batch is no reason for a sibling to stand down');
    assert.equal(r.isCurrent('chat', a) && r.isCurrent('chat', b), true);
    assert.equal(r.end('chat', a), true);
    assert.equal(r.isCurrent('chat', b), true, 'ending one leaves the other');
    r.end('chat', b);
    const lone = r.begin('chat', 'scan');
    assert.equal(r.begin('chat', 'backfill', { parallel: true }), null, 'a parallel one does not join a scan');
    assert.deepEqual(r.cancel('chat', 'chat changed'), [lone]);
    assert.equal(r.isBusy('chat'), false);
    const c = r.begin('chat', 'a', { parallel: true }), d = r.begin('chat', 'b', { parallel: true });
    assert.deepEqual(r.cancel('chat'), [c, d]);
});

function queueHarness(count, { fail = [] } = {}) {
    const key = 'chat-1';
    const state = { pendingBackfills: [], npcs: [] };
    for (let i = 0; i < count; i += 1) {
        state.npcs.push({ id: `n${i}`, name: `Person ${i}`, aliases: [], present: true });
        state.pendingBackfills.push({ npcId: `n${i}`, label: `Person ${i}`, reason: 'new-admission', requestedAt: 1, requestedMessageId: null, attempts: 0 });
    }
    const live = { now: 0, max: 0, toasts: [], saved: 0 };
    const toasts = [];
    globalThis.toastr = { success: text => toasts.push(['success', text]), warning: text => toasts.push(['warning', text]), info() {}, error() {} };
    const part = createBackfillQueuePart({
        BACKFILL_MAX_ATTEMPTS: 3, getChatKey: () => key, getChatState: () => state, isHostSwipeActive: () => false,
        isScanBusy: (_key, { ignoreParallel = false } = {}) => (ignoreParallel ? false : live.now > 0),
        persist: () => { live.saved += 1; }, requireReadyChatMutation: () => true, replayLacksFill: () => false, stillRelevant: () => true,
        backfillNpcFromHistory: async (request, _id, { batch, parallel }) => {
            assert.equal(parallel, true);
            live.now += 1; live.max = Math.max(live.max, live.now);
            await new Promise(resolve => setTimeout(resolve, 15));
            live.now -= 1;
            if (fail.includes(request.npcId)) return false;
            batch.done.push(request.label);
            return true;
        },
    });
    return { part, state, live, toasts };
}

test('backfill queue: four queued backfills run three at a time and say "backfilled" once for the batch', async () => {
    const h = queueHarness(4);
    const processed = await h.part.processPendingBackfillsInner(null, {});
    assert.equal(processed, 4);
    assert.equal(h.live.max, 3, 'overlapped, bounded at three');
    assert.deepEqual(h.state.pendingBackfills, [], 'every finished one is off the queue');
    const successes = h.toasts.filter(([kind]) => kind === 'success');
    assert.equal(successes.length, 1, 'one toast for the batch');
    assert.match(successes[0][1], /^NPC State: backfilled 4 people \(Person 0, Person 1, Person 2, Person 3\)/);
});

test('backfill queue: a failed one stays queued, counted, and does not stop the rest; one finished says its own name', async () => {
    const h = queueHarness(2, { fail: ['n0'] });
    assert.equal(await h.part.processPendingBackfillsInner(null, {}), 1);
    assert.deepEqual(h.state.pendingBackfills.map(item => [item.npcId, item.attempts]), [['n0', 1]]);
    assert.deepEqual(h.toasts.filter(([kind]) => kind === 'success').map(([, text]) => text), ['NPC State: backfilled Person 1 from recent story context.']);
    assert.equal(backfillBatchNote([]), null);
});

test('toasts: no reader-facing toast or message says "NPC State Delta"', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'modules', 'people');
    const bad = [];
    const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.name.endsWith('.js')) {
                fs.readFileSync(file, 'utf8').split('\n').forEach((line, at) => {
                    if (/toastr|notify\(/.test(line) && /NPC State Delta/.test(line) && !/console\./.test(line)) bad.push(`${path.relative(root, file)}:${at + 1}`);
                });
            }
        }
    };
    walk(root);
    assert.deepEqual(bad, []);
});

test('know how: physical discovery counts as saw', () => {
    for (const how of ["pulled the folded parchment from Astra's coat", 'pinned Astra while Dask searched the coat', 'found it in her bag']) assert.equal(readHow(how), 'saw', how);
    assert.equal(readHow('guessed'), null);
});

test('know lines: a refused line is a Problem on that line; the reply\'s other know lines (and the same person\'s kept ones) stay', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ know Oren | about: Astra | fact: copies the gate-logs | how: saw']);
    await s.say([
        '~ know Oren | about: Temiwa | fact: is ill | how: guessed',
        '~ know Oren | about: Astra | fact: hides a key | how: pulled it from her coat',
        '~ know Sister Temiwa | about: Oren | fact: keeps a ledger | how: heard',
    ]);
    const knows = JSON.parse(oren(s).knows);
    assert.deepEqual(knows.map(item => item.fact).sort(), ['copies the gate-logs', 'hides a key']);
    const problems = (s.host.head().domains.people?.bonds?.problems ?? []).map(item => item?.text ?? String(item));
    assert.ok(problems.some(text => /Know line not used: know needs about, fact and how/.test(text)), `Problem shown: ${JSON.stringify(problems)}`);
    assert.ok(JSON.parse(s.host.head().domains.people.bonds.npcs.npc_temiwa.knows).length === 1, 'another person\'s line of the same reply is kept');
});
