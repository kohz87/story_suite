// J11 step 3: the old UI's wiring onto the one scheduler (flag suite.redrawScheduler).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext } from '../../testkit/fake-st.js';
import { createRuntime } from '../../src/v2/runtime.js';
import { mountUi } from '../../src/v2/ui-host.js';
import { createHold } from '../../src/v2/ui-host/events.js';
import { wireRedraw } from '../../src/v2/ui-host/redraw-wiring.js';
import { setupDom } from './view/mounts/helpers.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

// A wiring over fakes: counts what the panel section does, with frames the test runs by hand.
function fakes({ flag = true, hidden = false } = {}) {
    const calls = { register: 0, refresh: 0, size: 0 };
    const frames = [];
    const guards = [];
    const panel = { hidden };
    const tabHost = { active: () => 'now', refresh: opts => { calls.refresh += 1; guards.push(opts?.guard === true); } };
    const wiring = wireRedraw({
        on: () => flag,
        mounts: { tab: { register: () => { calls.register += 1; } } },
        getPanel: () => panel, getTabHost: () => tabHost, getOverlay: () => ({ refreshSize: () => { calls.size += 1; } }),
        schedule: fn => frames.push(fn),
    });
    return { wiring, calls, guards, panel, frames, runFrames: () => frames.splice(0).forEach(fn => fn()) };
}

test('a burst of marks is one frame: one tab registration, one pane redraw, one overlay size', () => {
    const { wiring, calls, frames, runFrames } = fakes();
    for (let i = 0; i < 6; i += 1) wiring.mark();
    assert.deepEqual(calls, { register: 0, refresh: 0, size: 0 }, 'nothing is drawn until the frame');
    assert.equal(frames.length, 1, 'one frame asked for');
    runFrames();
    assert.deepEqual(calls, { register: 1, refresh: 1, size: 1 });
    wiring.mark();
    runFrames();
    assert.deepEqual(calls, { register: 2, refresh: 2, size: 2 }, 'every section has a read: the second burst is drawn again, not skipped');
});

test('the frame\'s pane redraw asks for the field guard (a typed-in field is not replaced)', () => {
    const { wiring, guards, runFrames } = fakes();
    wiring.mark();
    runFrames();
    assert.deepEqual(guards, [true]);
});

test('a hidden panel: its tabs are registered at once (as before), the pane is not drawn', () => {
    const { wiring, calls, runFrames } = fakes({ hidden: true });
    wiring.mark();
    assert.equal(calls.register, 1);
    runFrames();
    assert.deepEqual(calls, { register: 1, refresh: 0, size: 1 });
});

test('flushNow draws at once, even while a hold is open; the hold keeps holding after it', () => {
    const { wiring, calls, runFrames } = fakes();
    const release = wiring.hold();
    wiring.mark();
    runFrames();
    assert.equal(calls.refresh, 0, 'held');
    wiring.flushNow();
    assert.equal(calls.refresh, 1, 'a chat switch is drawn through the hold');
    wiring.mark();
    runFrames();
    assert.equal(calls.refresh, 1, 'still held');
    release();
    runFrames();
    assert.equal(calls.refresh, 2, 'drawn once after the release');
});

test('flag off: on() is false and hold() is a no-op', () => {
    const { wiring } = fakes({ flag: false });
    assert.equal(wiring.on(), false);
    assert.equal(typeof wiring.hold(), 'function');
});

test('createHold: the outer (scheduler) hold is taken and released with the form hold, after the held work ran', () => {
    const log = [];
    const hold = createHold(() => () => log.push('outer released'));
    const release = hold.hold();
    hold.run('k', () => log.push('ran'));
    assert.deepEqual(log, []);
    release();
    release();
    assert.deepEqual(log, ['ran', 'outer released']);
    assert.deepEqual(createHold().hold()(), undefined, 'no outer: as before');
});

// ---- the page, flag off and on ----

const TAB = { id: 'qa-wire', name: 'Wire', version: '2.0.0-alpha.1', commands: { 'qa-wire.bump': () => ({ summary: 'bumped' }) },
    tabs: [{ id: 'seen', title: 'Seen', icon: 'fa-eye', render(pane, api) { const p = pane.ownerDocument.createElement('p'); p.textContent = `rev=${api.view?.()?.meta?.rev ?? '?'}`; pane.appendChild(p); } }] };

async function page(flag) {
    const doc = setupDom();
    const st = createFakeContext();
    if (flag) st.ctx.extensionSettings.storySuite = { ...st.ctx.extensionSettings.storySuite, flags: { 'suite.redrawScheduler': true } };
    let ui = null;
    const runtime = createRuntime({ ctx: st.ctx, onRegister: () => ui?.syncScreens() });
    ui = mountUi({ runtime, ctx: st.ctx, doc });
    runtime.markReady();
    await runtime.sdk.registerModule(TAB);
    await st.loadChat([{ name: 'Narrator', is_user: true, mes: 'Hi' }], 'chat-a');
    await runtime.turn.onChatChanged();
    ui.refresh();
    ui.openPanel();
    return { doc, st, ui, runtime };
}
const paneText = doc => doc.querySelector('#story_suite_v2_panel')?.textContent ?? doc.querySelector('.story-suite-sheet')?.textContent;

test('after a command and a head move the panel shows the same text with the flag on as with it off', async t => {
    t.mock.method(console, 'warn', () => {});
    const texts = [];
    for (const flag of [false, true]) {
        const { doc, runtime, ui } = await page(flag);
        await runtime.sdk.command('qa-wire.bump', {});
        await runtime.sdk.command('qa-wire.bump', {});
        // swipe, swipe back, middle delete, rewind, Re-read, a module change and a chat switch all end in a head move
        for (const reason of ['swipe', 'swipe', 'delete', 'rewind', 'reread', 'module', 'chat']) runtime.events.emit('head', { index: runtime.store.headIndex(), reason });
        runtime.events.emit('turn', { index: runtime.store.headIndex() });
        await tick();
        texts.push(paneText(doc));
        ui.destroy();
    }
    assert.ok(texts[0], 'the panel has text');
    assert.equal(texts[1], texts[0]);
});

// A page whose frames the test runs by hand; a counting tab is the open one.
async function countingPage() {
    const { doc, st, ui, runtime } = await page(true);
    const count = { draws: 0 };
    await runtime.sdk.registerModule({ id: 'qa-count', name: 'Count', version: '2.0.0-alpha.1',
        tabs: [{ id: 'n', title: 'N', icon: 'fa-hashtag', render(pane) { count.draws += 1; pane.textContent = String(count.draws); } }] });
    ui.refresh();
    doc.querySelectorAll('.story-suite-tab').find(node => node.getAttribute('data-tab-id') === 'n').click();
    return { doc, st, ui, runtime, count };
}

test('flag on: a committed event waits for the frame, a chat switch is drawn before its own event returns', async t => {
    t.mock.method(console, 'warn', () => {});
    let frames = [];
    globalThis.requestAnimationFrame = fn => frames.push(fn);   // a frame never comes unless the test runs it
    try {
        const { runtime, ui, st, count } = await countingPage();
        frames.splice(0).forEach(fn => fn());
        const base = count.draws;
        runtime.events.emit('committed', {});
        assert.equal(count.draws, base, 'a command marks and waits for the frame');
        frames.splice(0).forEach(fn => fn());
        assert.equal(count.draws, base + 1, 'one draw for the frame');
        frames = [];
        await st.loadChat([{ name: 'Narrator', is_user: true, mes: 'Other' }], 'chat-b');
        await runtime.turn.onChatChanged();
        assert.ok(count.draws >= base + 2, 'the chat switch drew without a frame');
        ui.destroy();
    } finally { delete globalThis.requestAnimationFrame; }
});

test('flag on: a form hold (the widget api\'s hold) keeps head, committed and turn redraws back until its release', async t => {
    t.mock.method(console, 'warn', () => {});
    let frames = [];
    globalThis.requestAnimationFrame = fn => frames.push(fn);
    try {
        const { doc, runtime, ui } = await page(true);
        const got = { draws: 0 };
        const probe = { render: (el, props, api) => { got.draws += 1; got.hold = api.hold; } };
        await runtime.sdk.registerModule({ id: 'qa-hold', name: 'Hold', version: '2.0.0-alpha.1', widgets: { 'qa-hold.probe': probe },
            screens: [{ id: 'qa-hold/f', title: 'F', mounts: ['tab'], template: '<p><ss-widget name="qa-hold.probe"></ss-widget></p>' }] });
        ui.refresh();
        doc.querySelectorAll('.story-suite-tab').find(node => node.dataset.tabId === 'qa-hold/f').click();
        frames.splice(0).forEach(fn => fn());
        const release = got.hold();
        const base = got.draws;
        runtime.events.emit('head', { index: 0 });
        runtime.events.emit('turn', { index: 0 });
        runtime.events.emit('committed', {});
        frames.splice(0).forEach(fn => fn());
        assert.equal(got.draws, base, 'nothing is redrawn while the form holds');
        release();
        frames.splice(0).forEach(fn => fn());
        assert.equal(got.draws, base + 1, 'one redraw after the release');
        ui.destroy();
    } finally { delete globalThis.requestAnimationFrame; }
});

test('flag on: a pane last drawn by a frame (no chat switch at the end) shows the same text as with the flag off', async t => {
    t.mock.method(console, 'warn', () => {});
    const texts = [];
    for (const flag of [false, true]) {
        const { doc, runtime, ui } = await page(flag);
        let n = 0;
        await runtime.sdk.registerModule({ id: 'qa-n', name: 'N', version: '2.0.0-alpha.1',
            tabs: [{ id: 'n', title: 'N', icon: 'fa-hashtag', render(pane) { pane.textContent = `n=${n}`; } }] });
        ui.refresh();
        doc.querySelectorAll('.story-suite-tab').find(node => node.getAttribute('data-tab-id') === 'n').click();
        await tick();
        await runtime.sdk.command('qa-wire.bump', {});
        for (const reason of ['chat', 'swipe', 'delete', 'rewind', 'reread']) runtime.events.emit('head', { index: runtime.store.headIndex(), reason });
        await tick();
        const before = paneText(doc);
        n += 1;
        runtime.events.emit('committed', {});
        await tick();
        const after = paneText(doc);
        assert.match(after, /n=1/, 'the last state is drawn');
        assert.notEqual(after, before, 'the frame ran: the pane changed after the last mark');
        texts.push(after);
        ui.destroy();
    }
    assert.ok(texts[0], 'the panel has text');
    assert.equal(texts[1], texts[0]);
});

test('flag on: a chat switch while a form holds is drawn at once (exactly one pane draw, no frame); the release draws nothing more: the switch already drew the newest state', async t => {
    t.mock.method(console, 'warn', () => {});
    let frames = [];
    globalThis.requestAnimationFrame = fn => frames.push(fn);
    try {
        const { doc, st, runtime, ui } = await page(true);
        const got = { draws: 0 };
        const probe = { render: (el, props, api) => { got.draws += 1; got.hold = api.hold; } };
        await runtime.sdk.registerModule({ id: 'qa-hold2', name: 'Hold', version: '2.0.0-alpha.1', widgets: { 'qa-hold2.probe': probe },
            screens: [{ id: 'qa-hold2/f', title: 'F', mounts: ['tab'], template: '<p><ss-widget name="qa-hold2.probe"></ss-widget></p>' }] });
        ui.refresh();
        doc.querySelectorAll('.story-suite-tab').find(node => node.dataset.tabId === 'qa-hold2/f').click();
        frames.splice(0).forEach(fn => fn());
        const release = got.hold();
        frames = [];
        const base = got.draws;
        await st.loadChat([{ name: 'Narrator', is_user: true, mes: 'Other' }], 'chat-b');
        await runtime.turn.onChatChanged();
        assert.equal(got.draws, base + 1, 'the chat switch drew exactly once through the hold');
        assert.equal(frames.length, 0, 'and no frame was needed');
        release();
        frames.splice(0).forEach(fn => fn());
        assert.equal(frames.length, 0, 'the release draws nothing more: the switch already drew the newest state');
        assert.equal(got.draws, base + 1, 'the release draws nothing more: the switch already drew the newest state');
        ui.destroy();
    } finally { delete globalThis.requestAnimationFrame; }
});

test('a held function that throws still frees the scheduler hold', () => {
    let released = 0;
    const hold = createHold(() => () => { released += 1; });
    const release = hold.hold();
    hold.run('k', () => { throw new Error('boom'); });
    assert.throws(() => release(), /boom/);
    assert.equal(released, 1);
});

test('a redraw that throws is logged with console.warn (and the other section still draws)', t => {
    const warn = t.mock.method(console, 'warn', () => {});
    let size = 0;
    const bad = wireRedraw({
        on: () => true, mounts: { tab: { register: () => { throw new Error('nope'); } } }, getPanel: () => ({ hidden: false }),
        getTabHost: () => null, getOverlay: () => ({ refreshSize: () => { size += 1; } }), schedule: fn => fn(),
    });
    bad.mark();
    assert.ok(warn.mock.calls.some(c => /panel redraw failed/.test(String(c.arguments[0]))));
    assert.equal(size, 1, 'the overlay drew exactly once after the panel threw');
});
