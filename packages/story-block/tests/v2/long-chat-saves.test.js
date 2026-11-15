import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { FOLLOW_MS, IDLE_MAX_MS, IDLE_MS, LATE_MAX_MS, LATE_MS, createSaver } from '../../src/v2/persist.js';
import { settled, plain, present, headOf, filed, host, turn } from './long-chat.helpers.js';

test('turn save: a reply and the reader\'s actions after it are written once, IDLE_MS after the last', async t => {
    const { h, srv, saves, tick } = await filed(t);
    assert.equal(h.store.idleSaves(), true, 'a chat file: the turn\'s save is used');
    const base = saves();
    await h.send('I look around.', 'Gulls.\n<Changes>\n+ present Fenna\n+ item Rope\n</Changes>');
    assert.equal(saves(), base, 'nothing is written inside the reply\'s capture');
    assert.equal(h.store.dirty(), true);
    for (const name of ['Ann', 'Bo', 'Cy']) {
        assert.equal((await h.sdk.command('scene.present', { add: name })).ok, true);
        assert.equal(saves(), base, `${name}: the action's result comes back without a write`);
        await tick(IDLE_MS - 100);
    }
    assert.equal(saves(), base, 'nothing while the reader keeps acting');
    await tick(100);
    assert.equal(saves(), base + 1, 'one write for the reply and three actions');
    assert.equal(h.store.dirty(), false);
    assert.deepEqual(srv.messages('chat-1'), plain(h.ctx.chat), 'the file is the chat');
    assert.deepEqual(present(headOf(srv.messages('chat-1'))), ['Ann', 'Bo', 'Cy', 'Fenna'], 'rebuilt from the file == live');
    await tick(IDLE_MAX_MS);
    assert.equal(saves(), base + 1, 'nothing more afterwards');
});

test('turn save: a reader who keeps acting is saved IDLE_MAX_MS after the first unsaved change', async t => {
    const { h, saves, tick } = await filed(t);
    const base = saves();
    for (let i = 0; i < 12; i++) {
        assert.equal((await h.sdk.command('scene.present', { add: `Guard ${i}` })).ok, true);
        await tick(1000);
    }
    assert.equal(saves(), base + 1, 'once by the window\'s end, not once per action');
    assert.equal(h.store.dirty(), true, 'the actions after it wait for the next window');
    await tick(IDLE_MS);
    assert.equal(saves(), base + 2);
    assert.equal(h.store.dirty(), false);
});

test('turn save: a failed one stays unsaved, is told once and tried again until it is written', async t => {
    const { h, srv, saves, tick } = await filed(t);
    const base = saves();
    srv.failing = true;
    assert.equal((await h.sdk.command('scene.present', { add: 'Ann' })).ok, true, 'the action stands');
    await tick(IDLE_MS);
    assert.equal(saves(), base + 1, 'tried');
    assert.equal(h.store.dirty(), true, 'still unsaved');
    assert.equal(h.store.failing(), true);
    srv.failing = false;
    for (let i = 0; i < 4 && h.store.dirty(); i++) await tick(4000);
    assert.equal(h.store.dirty(), false, 'tried again until the server took it');
    assert.deepEqual(present(headOf(srv.messages('chat-1'))), ['Ann']);
});

test('turn save: a reply asked for before it takes it along; nothing is written while the reply is built', async t => {
    const { h, srv, saves, tick } = await filed(t);
    await h.send('One.', 'Fine.\n<Changes>\n+ present Fenna\n</Changes>');
    await tick(IDLE_MS);
    const base = saves();
    assert.equal((await h.sdk.command('scene.present', { add: 'Ann' })).ok, true);
    // The reader sends at once: the interceptor writes nothing (the action waits for the reply's save).
    let during = null;
    const interceptor = h.st.interceptor;
    h.st.interceptor = async (...args) => { await interceptor(...args); during = saves(); };
    await h.send('Two.', 'Rain.\n<Changes>\n+ present Bo\n</Changes>');
    assert.equal(during, base, 'nothing written while the reply was built');
    assert.equal(saves(), base, 'nor in its capture');
    await tick(IDLE_MS);
    assert.equal(saves(), base + 1, 'one write for the action and the reply');
    assert.deepEqual(present(headOf(srv.messages('chat-1'))), ['Ann', 'Bo', 'Fenna']);
});

test('turn save: without a chat file this page can write, the reader\'s action is saved at once (as before)', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const h = await createHost();
    t.after(() => h.close());
    await h.send('One.', 'Fine.');
    assert.equal(h.store.idleSaves(), false);
    const before = h.st.saves.length;
    assert.equal((await h.sdk.command('scene.present', { add: 'Ann' })).ok, true);
    assert.equal(h.st.saves.length, before + 1, 'saved before sdk.command answers');
    assert.equal(h.store.dirty(), false);
});


test('late save: host changes seconds apart are written once, LATE_MS after the last', async t => {
    const { h, saves, tick } = await filed(t);
    await turn({ h, tick });
    const base = saves();
    for (const name of ['Ann', 'Bo', 'Cy', 'Di']) {
        assert.equal((await host(h, name)).ok, true);
        await tick(3000);
    }
    assert.equal(saves(), base, 'nothing while the changes keep coming (not one 400 ms save per change)');
    await tick(LATE_MS - 3000);
    assert.equal(saves(), base + 1, 'one write for all four, LATE_MS after the last');
    assert.equal(h.store.dirty(), false);
});

test('late save: a stream of host changes is written LATE_MAX_MS after the first, and the next ones start a new window', async t => {
    const { h, saves, tick } = await filed(t);
    await turn({ h, tick });
    const base = saves();
    for (let i = 0; i < 20; i++) {
        await host(h, `Guard ${i}`);
        await tick(2000);
    }
    assert.equal(saves(), base + 2, 'by the bound (15 s) and again at 30 s, not 20 saves');
    assert.equal(h.store.dirty(), true, 'the last changes wait for their window');
    await tick(LATE_MS);
    assert.equal(saves(), base + 3);
    assert.equal(h.store.dirty(), false);
    assert.ok(LATE_MAX_MS >= IDLE_MAX_MS);
});

test('late save: the next reply\'s capture takes over a late window (IDLE_MS, IDLE_MAX_MS)', async t => {
    const { h, saves, tick } = await filed(t);
    await turn({ h, tick });
    const base = saves();
    await host(h, 'Ann');
    await tick(1000);
    await h.send('Two.', 'Rain.');
    await tick(IDLE_MS);
    assert.equal(saves(), base + 1, 'the next reply\'s capture is the turn\'s save (IDLE_MS), not LATE_MS');
    assert.equal(h.store.dirty(), false);
});

test('late save: a host change inside the turn\'s window is one of its changes (IDLE_MS after it)', async t => {
    const { h, saves, tick } = await filed(t);
    const base = saves();
    await h.send('One.', 'Fine.\n<Changes>\n+ present Fenna\n</Changes>');
    await tick(IDLE_MS - 100);
    await host(h, 'Ann');
    await tick(IDLE_MS - 100);
    assert.equal(saves(), base, 'the window waits as for any action');
    await tick(100);
    assert.equal(saves(), base + 1, 'one write for the reply and the change');
    assert.equal(h.store.dirty(), false);
});

test('late save: flush, saveUrgent, page hide and a chat switch still write at once', async t => {
    const { h, srv, saves, tick } = await filed(t);
    await turn({ h, tick });
    let base = saves();
    await host(h, 'Ann');
    assert.equal(saves(), base);
    await h.store.flush();
    assert.equal(saves(), base + 1, 'flush');
    assert.equal(h.store.dirty(), false);
    await tick(LATE_MAX_MS);
    assert.equal(saves(), base + 1, 'no second write from the dropped window');
    base = saves();
    await host(h, 'Bo');
    await h.store.saveUrgent({ keepalive: true });
    await settled();
    assert.equal(saves(), base + 1, 'saveUrgent (page hide / unload)');
    assert.equal(h.store.dirty(), false);
    assert.deepEqual(present(headOf(srv.messages('chat-1'))), ['Ann', 'Bo', 'Fenna']);
});

test('late save: a failed one stays unsaved, is told and tried again', async t => {
    const { h, srv, saves, tick } = await filed(t);
    await turn({ h, tick });
    const base = saves();
    srv.failing = true;
    assert.equal((await host(h, 'Ann')).ok, true);
    await tick(LATE_MS);
    assert.equal(saves(), base + 1, 'tried');
    assert.equal(h.store.dirty(), true);
    assert.equal(h.store.failing(), true);
    srv.failing = false;
    for (let i = 0; i < 4 && h.store.dirty(); i++) await tick(4000);
    assert.equal(h.store.dirty(), false);
    assert.deepEqual(present(headOf(srv.messages('chat-1'))), ['Ann', 'Fenna']);
});

test('late save: without a chat file this page can write, a host change is saved as before (400 ms)', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const h = await createHost();
    t.after(() => h.close());
    await h.send('One.', 'Fine.');
    assert.equal(h.store.saveLate(), false);
    const before = h.st.saves.length;
    assert.equal((await host(h, 'Ann')).ok, true);
    t.mock.timers.tick(400);
    await settled();
    assert.equal(h.st.saves.length, before + 1);
});

test('late save: a reader\'s action outside the phase is the turn\'s save (IDLE_MS), before any reply and FOLLOW_MS after one', async t => {
    const { h, saves, tick } = await filed(t);
    let base = saves();
    await host(h, 'Ann');
    await tick(IDLE_MS);
    assert.equal(saves(), base + 1, 'no reply yet: IDLE_MS as before');
    await turn({ h, tick });
    await tick(FOLLOW_MS);
    base = saves();
    await host(h, 'Bo');
    await tick(IDLE_MS);
    assert.equal(saves(), base + 1, 'the phase is over: IDLE_MS as before');
});

test('round 2 (blocker 1): a 400 ms save (swipe/delete, chat change, generation end, rename, a command without background) stays 400 ms inside the phase', async t => {
    const { h, saves, tick } = await filed(t);
    await turn({ h, tick });
    const base = saves();
    h.store.touch();
    h.store.scheduleSave();
    await tick(400);
    assert.equal(saves(), base + 1, 'not LATE_MS later');
    assert.equal((await h.bus.command('scene.present', { add: 'Ann' }, { cause: 'system' })).ok, true);
    await tick(400);
    assert.equal(saves(), base + 2, 'a command stored without background: 400 ms');
});

test('round 2 (blocker 3): flush, saveSoon and urgent end the phase; defer drops a late window\'s bound', async t => {
    const { h, saves, tick } = await filed(t);
    for (const end of [() => h.store.flush(), () => h.store.saveSoon(), () => h.store.saveUrgent({ keepalive: true })]) {
        await turn({ h, tick });
        await tick(100);
        await end();
        await settled();
        const base = saves();
        h.store.touch();
        h.store.scheduleSave();
        await tick(400);
        assert.equal(saves(), base + 1, 'after the explicit save the 400 ms save is as before');
        await tick(FOLLOW_MS);
    }
    await turn({ h, tick });
    await host(h, 'Ann');                                      // a late window
    h.store.deferSave();                                       // a generation starts
    const base = saves();
    h.store.scheduleSave();
    await tick(400);
    assert.equal(saves(), base + 1, 'the late window\'s 15 s bound is gone with the generation');
});

test('round 2 (blocker 2): a failed save\'s retry is not replaced by the late wait', async t => {
    const { h, srv, saves, tick } = await filed(t);
    await turn({ h, tick });
    srv.failing = true;
    await host(h, 'Ann');
    await tick(LATE_MS);                                       // the late save fails
    const failedAt = saves();
    assert.equal(h.store.failing(), true);
    srv.failing = false;
    await host(h, 'Bo');                                       // another late change while the retry waits
    await tick(1000);
    assert.equal(saves(), failedAt + 1, 'the retry (1 s) wrote both');
    assert.equal(h.store.dirty(), false);
});

test('late save: a reader\'s action (no `background`) inside the phase is still saved IDLE_MS after it', async t => {
    const { h, saves, tick } = await filed(t);
    await turn({ h, tick });
    const base = saves();
    assert.equal((await h.sdk.command('scene.present', { add: 'Ann' })).ok, true);
    await tick(IDLE_MS);
    assert.equal(saves(), base + 1);
    assert.equal(h.store.dirty(), false);
});

test('createSaver late(): the turn\'s window stands; after it a late window opens that a change extends; defer() ends the phase', async () => {
    const pending = [];
    const timers = {
        setTimeout: (fn, ms) => { const job = { fn, ms }; pending.push(job); return job; },
        clearTimeout: job => { const at = pending.indexOf(job); if (at >= 0) pending.splice(at, 1); },
    };
    const saver = createSaver({ timers, timeout: 0, save: async () => {} });
    const ms = () => pending.map(job => job.ms).sort((a, b) => a - b);
    saver.touch();
    saver.late();
    assert.deepEqual(ms(), [IDLE_MS, IDLE_MAX_MS], 'no phase yet: a background change is the turn\'s window');
    pending.splice(pending.findIndex(job => job.ms === IDLE_MAX_MS), 1)[0].fn();   // the window\'s latest save goes out
    await settled();
    assert.deepEqual(ms(), [FOLLOW_MS], 'the phase runs');
    saver.touch();
    saver.late();
    assert.deepEqual(ms(), [LATE_MS, LATE_MAX_MS, FOLLOW_MS].sort((a, b) => a - b));
    saver.late();
    assert.deepEqual(ms(), [LATE_MS, LATE_MAX_MS, FOLLOW_MS].sort((a, b) => a - b), 'a later change joins: the same window');
    saver.idle();
    assert.deepEqual(ms(), [IDLE_MS, IDLE_MAX_MS, FOLLOW_MS].sort((a, b) => a - b), 'the turn\'s own save replaces it');
    saver.defer();
    assert.equal(ms().includes(FOLLOW_MS), false, 'a generation starting ends the phase');
});

test('createSaver idle(): a 400 ms schedule inside the window keeps the window; defer() keeps its latest save', async () => {
    const pending = [];
    const timers = {
        setTimeout: (fn, ms) => { const job = { fn, ms }; pending.push(job); return job; },
        clearTimeout: job => { const at = pending.indexOf(job); if (at >= 0) pending.splice(at, 1); },
    };
    const writes = [];
    const saver = createSaver({ timers, timeout: 0, save: async () => { writes.push(1); } });
    saver.touch();
    saver.idle();
    assert.deepEqual(pending.map(job => job.ms).sort((a, b) => a - b), [IDLE_MS, IDLE_MAX_MS]);
    saver.schedule(400);
    assert.deepEqual(pending.map(job => job.ms).sort((a, b) => a - b), [IDLE_MS, IDLE_MAX_MS], 'the window stands');
    saver.defer();
    assert.deepEqual(pending.map(job => job.ms), [IDLE_MAX_MS], 'only the window\'s latest save is left');
    assert.equal(saver.pending(), true);
    pending.shift().fn();
    await settled();
    assert.equal(writes.length, 1);
    assert.equal(saver.dirty(), false);
    assert.equal(pending.filter(job => job.ms !== FOLLOW_MS).length, 0, 'only the late phase\'s timer is left');
});
