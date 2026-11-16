import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runScenario } from './history-replay-wiring.helpers.js';

test('parity: replaying a chat from an empty state gives the dossiers of the live run (fake model)', () => {
    runScenario('parity', async h => {
        for (let i = 1; i <= 5; i += 1) await h.turn('We walk on.', i % 2 ? `Yunyun speaks, mark-${i}.` : `The road goes on, mark-${i}.`);
        const live = h.stable(h.runtime.getState());
        const marksBefore = [...(h.runtime.getState().memoryFactMarks?.keys || [])];
        h.check(live.npcs.length >= 1, 'the live run made a dossier');
        const calls = h.scannerCalls().length;
        const catchUp = h.controller();
        const during = [];
        const quiet = () => { const copy = JSON.parse(JSON.stringify(h.runtime.getState())); delete copy.catchUp; return JSON.stringify(copy); };
        const before = quiet();
        catchUp.rebuild({ replies: null });
        while (catchUp.status().active) { during.push(quiet() === before); await h.sleep(5); }
        await catchUp.idle();
        h.check(during.every(Boolean) && during.length > 0, 'the live state is untouched until the install (the empty state is never installed first)');
        h.equal(catchUp.status().outcome, 'done', 'the rebuild finished');
        h.check(h.scannerCalls().length > calls, 'the replay made model calls');
        h.equal(h.stable(h.runtime.getState()), live, 'replay from empty == the live run');
        h.check(JSON.stringify([...(h.runtime.getState().memoryFactMarks?.keys || [])].sort()) === JSON.stringify([...marksBefore].sort()) && marksBefore.length > 0, 'the live-eligibility marks survive the rebuild');
        h.equal(h.published(), 1, 'one publication');
    });
});

test('order and view: windows in chat order, each ending at its own reply; turn once per reply; time is the reply send date', () => {
    runScenario('order', async h => {
        h.addReplies(7);
        const before = h.runtime.getState().turn;
        const sentLast = Date.parse(h.mockState.context.chat.at(-1).send_date);
        const catchUp = h.controller();
        catchUp.restored();
        h.check(catchUp.canGenerate().ok === false, 'sending is held at once');
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'done');
        const prompts = h.mockState.fakeCalls;
        h.equal(prompts.length, 7, 'one call per reply');
        const ends = prompts.map(prompt => Math.max(...[...prompt.matchAll(/mark-(\d+)/g)].map(match => Number(match[1]))));
        h.equal(ends, [1, 2, 3, 4, 5, 6, 7], 'each window ends at its own reply, oldest first');
        h.check(prompts.every((prompt, at) => !prompt.includes(`mark-${at + 2}`)), 'no window reads a later reply');
        h.equal(h.runtime.getState().turn, before + 7, 'turn advanced once per reply');
        h.equal(h.runtime.getState().lastScanAt, sentLast, 'time is the reply send date, not now');
        h.equal(h.runtime.getState().npcs.find(n => n.name === 'Yunyun')?.location, 'mile 7', 'the last reply decided the location');
        h.check(catchUp.canGenerate() === true, 'sending is back');
    });
});

test('no outward writes during a replay; exactly one publication at the end', () => {
    runScenario('outward', async h => {
        h.addReplies(4);
        const toasts = [];
        for (const kind of ['info', 'success', 'warning', 'error']) globalThis.toastr[kind] = text => toasts.push([kind, text]);
        const promptsBefore = h.mockState.prompts.length;
        const written = [];
        const quiet = () => { const copy = JSON.parse(JSON.stringify(h.runtime.getState())); delete copy.catchUp; return JSON.stringify(copy); };
        const state = quiet();
        const catchUp = h.controller();
        const seen = [];
        catchUp.restored();
        while (catchUp.status().active) { seen.push(h.mockState.prompts.length); written.push(quiet() === state); await h.sleep(5); }
        await catchUp.idle();
        h.check(written.every(Boolean), 'nothing of the live state moved before the install');
        h.check(seen.every(count => count === promptsBefore), 'no prompt injection during the replay');
        h.equal(toasts, [], 'no toast during the replay');
        h.equal(h.published(), 1, 'one publication');
        h.check(h.mockState.prompts.length > promptsBefore, 'the install updated the injection once it was done');
    });
});

test('all or nothing: a failed reply, a new message and a chat change leave the live state as it was; the field stays and resumes', () => {
    runScenario('atomic', async h => {
        h.addReplies(6);
        const snapshot = JSON.stringify(h.runtime.getState());
        h.mockState.failWhen = (prompt, count) => count === 3;
        let catchUp = h.controller();
        catchUp.restored();
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'failed', 'the failed reply stops the replay');
        h.check(catchUp.canGenerate() === true, 'sending is not held after a failure');
        const live = h.runtime.getState();
        h.equal(live.catchUp?.attempt, 1, 'the field stays, attempt 1');
        const without = JSON.parse(JSON.stringify(live));
        delete without.catchUp;
        h.equal(without, JSON.parse(snapshot), 'the live dossiers are byte-identical to before');
        // A reload: a new controller resumes and finishes (the model works now).
        h.mockState.failWhen = null;
        catchUp = h.controller();
        h.equal(catchUp.resume().started, true, 'resume on chat open');
        h.check(catchUp.canGenerate().ok === false, 'held again while it resumes');
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'resumed and done');
        h.check(h.runtime.getState().catchUp === undefined, 'the field is cleared after the publication');
        h.equal(h.published(), 1, 'one publication in all');
        // A new message mid-run: stale, nothing installed.
        h.addReplies(3);
        const mid = JSON.stringify(h.runtime.getState());
        h.mockState.holdWhen = async (prompt, count) => { if (count === h.mockState.fakeCalls.length && /mark-2\b/.test(prompt) && !h.mockState.moved) { h.mockState.moved = true; h.mockState.context.chat.push(h.reply('A late reply, mark-99.', 99)); } };
        catchUp = h.controller();
        catchUp.restored();
        await catchUp.idle();
        h.check(['stale', 'failed'].includes(catchUp.status().outcome), `the head changed: ${catchUp.status().outcome}`);
        const after = JSON.parse(JSON.stringify(h.runtime.getState()));
        delete after.catchUp;
        const midState = JSON.parse(mid);
        delete midState.catchUp;
        h.equal(after, midState, 'nothing installed after a head change');
    });
});

test('retry cap: three failed attempts across reloads, then no more', () => {
    runScenario('retry-cap', async h => {
        h.addReplies(3);
        h.mockState.failWhen = () => true;
        const attempts = [];
        for (let i = 0; i < 4; i += 1) {
            const catchUp = h.controller();
            const started = i === 0 ? catchUp.restored() : catchUp.resume();
            attempts.push(started.started);
            await catchUp.idle();
        }
        h.equal(attempts, [true, true, true, false], 'three tries, the fourth does not start');
        h.equal(h.runtime.getState().catchUp.attempt, 3, 'the field says 3 tries');
    });
});

test('Skip: stops after the current reply, keeps the dossiers, marks the replies read, releases sending', () => {
    runScenario('skip', async h => {
        h.addReplies(5);
        const before = JSON.stringify(h.runtime.getState().npcs);
        let release;
        h.mockState.holdWhen = async (prompt, count) => { if (count === 2) await new Promise(resolve => { release = resolve; }); };
        const catchUp = h.controller();
        catchUp.restored();
        for (let i = 0; i < 100 && !release; i += 1) await h.sleep(10);
        const held = catchUp.canGenerate();
        h.check(held.ok === false && /^Sending waits until the dossiers catch up \(reply 2 of 5\)\.$/.test(held.reason), `held with the progress: ${held.reason}`);
        catchUp.skip();
        release();
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'skipped', 'skipped');
        h.equal(h.mockState.fakeCalls.length, 2, 'it stopped after the current reply');
        h.equal(JSON.stringify(h.runtime.getState().npcs), before, 'the dossiers stay as installed');
        const state = h.runtime.getState();
        h.equal(state.lastScannedMessageId, h.mockState.context.chat.length - 1, 'the replies are marked read');
        h.check(state.catchUp === undefined, 'no field is left');
        h.check(catchUp.canGenerate() === true, 'sending is back');
        h.equal(h.published(), 0, 'nothing published');
    });
});

test('Skip pressed before the engine starts (Story Block\'s barrier still up): nothing is read, the replies are marked read, sending is back', () => {
    runScenario('skip-early', async h => {
        h.addReplies(4);
        const before = JSON.stringify(h.runtime.getState().npcs);
        let lower;
        const catchUp = h.controller({ settled: () => (lower ? true : new Promise(resolve => { lower = () => resolve(true); })) });
        catchUp.restored();
        h.check(catchUp.canGenerate().ok === false, 'held while waiting for the barrier');
        await catchUp.skip();
        lower();
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'skipped', 'skipped');
        h.equal(h.mockState.fakeCalls.length, 0, 'no model call was made');
        h.equal(JSON.stringify(h.runtime.getState().npcs), before, 'the dossiers stay as installed');
        const state = h.runtime.getState();
        h.equal(state.lastScannedMessageId, h.mockState.context.chat.length - 1, 'the replies are marked read');
        h.check(state.catchUp === undefined, 'no field is left');
        h.check(catchUp.canGenerate() === true, 'sending is back');
        h.equal(h.published(), 0, 'nothing published');
        // A later catch-up is not born skipped.
        h.addReplies(2);
        catchUp.restored();
        await catchUp.idle();
        h.check(catchUp.status().outcome !== 'skipped', 'the next catch-up runs');
    });
});

test('cap: 60 missed replies read the last 40; the older 20 are marked read', () => {
    runScenario('cap', async h => {
        h.addReplies(60);
        const catchUp = h.controller();
        catchUp.restored();
        h.equal([catchUp.status().total, catchUp.status().older], [40, 20], 'the banner counts 40 of 60');
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'done');
        const prompts = h.mockState.fakeCalls;
        h.equal(prompts.length, 40, '40 calls');
        const first = [...prompts[0].matchAll(/mark-(\d+)/g)].map(match => Number(match[1]));
        h.check(Math.min(...first) >= 21 && Math.max(...first) === 21, `the first window is reply 21 alone (marked-read marker): ${first}`);
    });
});

test('rebuild with N replies reads the last N onto an empty state', () => {
    runScenario('rebuild-n', async h => {
        h.addReplies(8);
        const catchUp = h.controller();
        catchUp.rebuild({ replies: 3 });
        await catchUp.idle();
        h.equal(h.mockState.fakeCalls.length, 3, 'three calls');
        h.equal(catchUp.status().older, 5, 'five marked read');
    });
});

test('a disabled Delta or a chat with nothing missed holds nothing', () => {
    runScenario('nothing', async h => {
        const catchUp = h.controller();
        h.equal(catchUp.restored().started, false, 'no replies: nothing starts');
        h.check(catchUp.canGenerate() === true, 'not held');
    });
});

test('participant: restored is exposed to Story Block; an exact install never calls it', async () => {
    const { createParticipant } = await import('../../modules/people/legacy/storysuite-participant/participant.js');
    let live = 0;
    const port = { chatKey: () => 'chat', readState: () => ({ npcs: [] }), installState() {}, writeTimeline() {}, enabled: () => true, live: () => { live += 1; return null; } };
    const { participant } = createParticipant({ port, vault: { put() {}, get() {}, getIndex() {}, putIndex() {} } });
    assert.equal(typeof participant.restored, 'function');
    assert.equal(typeof participant.rebuild, 'function');
    assert.equal(live, 0, 'registering touches nothing');
    const handlers = fs.readFileSync(new URL('../../modules/people/legacy/storysuite-participant/participant/handlers.js', import.meta.url), 'utf8');
    assert.ok(!/port\.restored/.test(handlers), 'an install (an exact restore too) does not start a catch-up');
    const answer = await participant.prepare({ return: '', checkpoint: 'c', hash: 'h' });
    assert.equal(answer.ok, false, 'an empty return is refused before anything is adopted');
});

test('Story Block as a replay sees it: reads are asked as of the reply, writes go to the sink and are never sent', () => {
    runScenario('scoped-adapter', async h => {
        const { scopedAdapter } = await import(pathToFileURL(path.join(extRoot, 'runtime-scan-helpers.js')).href);
        const asked = [];
        const sent = [];
        const adapter = {
            at: (index, fn) => { asked.push(index); return fn(); },
            sliceView: npcs => npcs,
            adjust: () => { sent.push('adjust'); },
            openByEvent: () => { sent.push('open'); },
        };
        const writes = [];
        const view = scopedAdapter(adapter, 7, { hostedWrite: (name, args) => writes.push([name, args]) });
        h.equal(view.sliceView([1]), [1], 'a read answers');
        h.equal(asked, [7], 'a read is asked as of reply 7');
        await view.adjust({ name: 'A' });
        await view.openByEvent({ name: 'A', ids: ['n'] });
        h.equal(sent, [], 'nothing reaches Story Block');
        h.equal(writes.map(entry => entry[0]), ['adjust', 'openByEvent'], 'the writes are recorded in the sink');
    });
});
