// Background refreshes respect the typing guard (flag suite.redrawScheduler on): the host's refresh, feature, pack and HUD paths never replace a pane
// while a field in it has the focus; a tab select and a chat switch draw at once; a forced draw of the same tab's pane carries the typed text (a chat switch carries nothing).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeContext } from '../../testkit/fake-st.js';
import { createRuntime } from '../../core/runtime.js';
import { mountUi } from '../../ui/legacy/ui-host.js';
import { createTabHost } from '../../ui/legacy/host-ui.js';
import { doc as fakeDoc, setup } from './host-ui.helpers.js';
import { setupDom } from '../ui/view/mounts/helpers.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

function build(swap = () => true) {
    const state = { n: 1 };
    const tabs = ['t1', 't2'].map(id => ({ id, title: id, render(el, view) {
        const box = fakeDoc.createElement('input'); box.dataset.name = 'search'; box.value = `${id}-${view.n}`; el.appendChild(box);
    } }));
    const { registry } = setup({ id: 'alpha', tabs });
    const root = fakeDoc.createElement('div');
    const host = createTabHost(root, { registry, view: () => ({ n: state.n }), doc: fakeDoc, swap });
    const pane = () => root.querySelector('.story-suite-pane');
    return { host, state, pane, box: () => pane().querySelector('input') };
}

test('a plain refresh() is a background one: a focused box keeps its pane, text and focus', async () => {
    const { host, state, pane, box } = build();
    const first = pane();
    box().focus();
    box().value = 'typed';
    state.n = 2;
    host.refresh();
    assert.equal(pane(), first, 'not replaced');
    assert.equal(box().value, 'typed');
    assert.equal(fakeDoc.activeElement, box());
    host.destroy();
});

test('an explicit guard:false refresh and a tab select draw at once', () => {
    const { host, state, pane, box } = build();
    const first = pane();
    box().focus();
    state.n = 2;
    host.refresh({ guard: false });
    assert.notEqual(pane(), first, 'drawn at once');
    box().focus();
    const second = pane();
    host.select('t2');
    assert.notEqual(pane(), second);
    assert.equal(pane().dataset.tabId, 't2');
    assert.equal(box().value, 't2-2', 'another tab: nothing is carried over');
    host.destroy();
});

test('a draw that replaces the same tab\'s pane under a focused box carries its text, caret and focus', () => {
    const { host, pane, box } = build();
    box().focus();
    box().value = 'hello';
    box().setSelectionRange(2, 4);
    host.refresh({ guard: false });
    assert.equal(box().value, 'hello');
    assert.equal(fakeDoc.activeElement, box());
    assert.deepEqual([box().selectionStart, box().selectionEnd], [2, 4]);
    assert.ok(pane());
    host.destroy();
});

test('nothing is carried without focus in a field; flag off draws plain as before', () => {
    const { host, state, box } = build();
    box().value = 'not focused';
    fakeDoc.activeElement = null;
    state.n = 3;
    host.refresh({ guard: false });
    assert.equal(box().value, 't1-3');
    host.destroy();
    const off = build(() => false);
    off.box().focus();
    off.state.n = 4;
    off.host.refresh();
    assert.equal(off.box().value, 't1-4', 'flag off: refreshed at once, as it always was');
    off.host.destroy();
});

test('the carried text reaches the tab: an input event fires, so a tab that keeps its draft from input events keeps it', () => {
    const { registry } = setup({ id: 'alpha', tabs: [{ id: 'find', title: 'Find', render(el) {
        const box = fakeDoc.createElement('input'); box.dataset.name = 'find';
        el.__draft = '';   // (the draft lives on the pane element, as NPC State's Dossiers search does)
        box.value = el.__draft;
        box.addEventListener('input', () => { el.__draft = box.value; });
        el.appendChild(box);
    } }] });
    const root = fakeDoc.createElement('div');
    const host = createTabHost(root, { registry, view: () => ({}), doc: fakeDoc, swap: () => true });
    const pane = () => root.querySelector('.story-suite-pane');
    pane().querySelector('input').focus();
    pane().querySelector('input').value = 'Ali';
    host.refresh({ guard: false });
    assert.equal(pane().querySelector('input').value, 'Ali');
    assert.equal(pane().__draft, 'Ali', 'the new pane\'s tab heard the carried text');
    host.destroy();
});

test('a carry only goes to the same-named field', () => {
    let named = 'a';
    const { registry } = setup({ id: 'alpha', tabs: [{ id: 't', title: 't', render(el) {
        const box = fakeDoc.createElement('input'); box.dataset.name = named; el.appendChild(box);
    } }] });
    const root = fakeDoc.createElement('div');
    const host = createTabHost(root, { registry, view: () => ({}), doc: fakeDoc, swap: () => true });
    const box = () => root.querySelector('input');
    box().focus();
    box().value = 'typed';
    named = 'b';
    host.refresh({ guard: false });
    assert.equal(box().value, '', 'a different field at that place gets nothing');
    host.destroy();
});

async function page() {
    const doc = setupDom();
    const st = createFakeContext();
    st.ctx.extensionSettings.storySuite = { ...st.ctx.extensionSettings.storySuite, flags: { 'suite.redrawScheduler': true } };
    let ui = null;
    const runtime = createRuntime({ ctx: st.ctx, onRegister: () => ui?.syncScreens() });
    ui = mountUi({ runtime, ctx: st.ctx, doc });
    runtime.markReady();
    let n = 0;
    await runtime.sdk.registerModule({ id: 'qa-type', name: 'Type', version: '2.0.0-alpha.1',
        tabs: [{ id: 'typebox', title: 'Type', icon: 'fa-keyboard', render(pane) { n += 1; const box = pane.ownerDocument.createElement('input'); box.dataset.name = 'q'; pane.appendChild(box); } }] });
    await st.loadChat([{ name: 'Narrator', is_user: true, mes: 'Hi' }], 'chat-a');
    await runtime.turn.onChatChanged();
    ui.refresh();
    ui.openPanel();
    doc.querySelectorAll('.story-suite-tab').find(node => node.getAttribute('data-tab-id') === 'typebox').click();
    await tick();
    return { doc, runtime, ui, draws: () => n };
}

test('the host\'s background callers (refresh, feature event, HUD, sync) leave a focused box alone', async t => {
    t.mock.method(console, 'warn', () => {});
    const { doc, runtime, ui, draws } = await page();
    const box = doc.querySelector('input[data-name="q"]');
    box.focus();
    box.value = 'typing';
    const base = draws();
    ui.refresh();
    runtime.events.emit('feature', {});
    ui.syncScreens();
    ui.setHud(true);
    assert.equal(draws(), base, 'no pane was drawn under the focused box');
    assert.equal(doc.querySelector('input[data-name="q"]'), box);
    assert.equal(box.value, 'typing');
    ui.destroy();
});
