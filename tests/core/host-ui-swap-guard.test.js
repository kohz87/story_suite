// J11 step 4: the field guard survives focus moves, destroy and chat switches (flag suite.redrawScheduler on).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTabHost } from '../../packages/story-block/src/v2/host-ui.js';
import { wireRedraw } from '../../packages/story-block/src/v2/ui-host/redraw-wiring.js';
import { doc, setup } from './host-ui.helpers.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

function build() {
    const state = { n: 1, renders: 0 };
    const tab = { id: 'w1', title: 'World', render(el, view) {
        state.renders += 1;
        for (const name of ['a', 'b']) { const box = doc.createElement('input'); box.dataset.name = name; box.value = `${name}${view.n}`; el.appendChild(box); }
        const save = doc.createElement('button'); save.dataset.name = 'save'; el.appendChild(save);
    } };
    const { registry } = setup({ id: 'alpha', tabs: [tab] });
    const root = doc.createElement('div');
    const host = createTabHost(root, { registry, view: () => ({ n: state.n }), doc, swap: () => true });
    const pane = () => root.querySelector('.story-suite-pane');
    const at = name => pane().querySelector(`[data-name="${name}"]`);
    return { host, root, state, pane, at };
}

test('focus moving from field A to field B (Tab or click) keeps the pane while the reader types in B', async () => {
    const { host, pane, at, state } = build();
    const first = pane();
    at('a').focus();
    state.n = 2;
    host.refresh({ guard: true });
    at('b').focus();
    first.dispatch('focusout', { relatedTarget: at('b') });   // Tab / click in Chrome
    await tick();
    assert.equal(pane(), first, 'B was focused when the timer ran: no swap');
    at('a').focus();
    first.dispatch('focusout');                                 // no relatedTarget (Safari): the guard looks at activeElement
    at('b').focus();
    await tick();
    assert.equal(pane(), first, 'a field has the focus at the timer: the guard waits again');
    doc.activeElement = null;
    first.dispatch('focusout');
    await tick();
    assert.notEqual(pane(), first, 'drawn once the reader left every field');
    assert.equal(at('a').value, 'a2');
    host.destroy();
});

test('a tap on a Save button after a deferred redraw keeps the click (focus moved into the pane)', async () => {
    const { host, pane, at, state } = build();
    const first = pane();
    at('a').focus();
    state.n = 2;
    host.refresh({ guard: true });
    at('save').focus();
    first.dispatch('focusout', { relatedTarget: at('save') });
    await tick();
    assert.equal(pane(), first, 'the button the finger is on is still there for the click');
    host.destroy();
});

test('the phone app-switch case: focusout fires while the field stays the active element: no redraw', async () => {
    const { host, pane, at, state } = build();
    const first = pane();
    at('a').focus();
    state.n = 2;
    host.refresh({ guard: true });
    first.dispatch('focusout');
    await tick();
    assert.equal(pane(), first);
    assert.equal(state.renders, 1);
    host.destroy();
});

test('destroy: no render after it, the timer is cleared and the listener is gone', async () => {
    const { host, pane, at, state } = build();
    const first = pane();
    at('a').focus();
    host.refresh({ guard: true });
    doc.activeElement = null;
    first.dispatch('focusout');   // timer pending
    host.destroy();
    await tick();
    first.dispatch('focusout');
    host.refresh();
    await tick();
    assert.equal(state.renders, 1, 'nothing was drawn after destroy');
    assert.equal(first.listeners.filter(entry => entry.type === 'focusout').length, 0);
});

test('a deferred redraw does not draw a hidden panel', async () => {
    const state = { n: 1, renders: 0 };
    const { registry } = setup({ id: 'alpha', tabs: [{ id: 'w1', title: 'World', render(el) { state.renders += 1; el.appendChild(doc.createElement('input')); } }] });
    const root = doc.createElement('div');
    const host = createTabHost(root, { registry, view: () => ({}), doc, swap: () => true });
    const first = root.querySelector('.story-suite-pane');
    first.querySelector('input').focus();
    host.refresh({ guard: true });
    root.hidden = true;
    doc.activeElement = null;
    first.dispatch('focusout');
    await tick();
    assert.equal(state.renders, 1);
    host.destroy();
});

test('a chat switch draws the new chat\'s pane even with a field focused (real tab host + wiring)', () => {
    const { host, pane, at, state } = build();
    const first = pane();
    const frames = [];
    const wiring = wireRedraw({ on: () => true, mounts: { tab: { register() {} } }, getPanel: () => ({ hidden: false }), getTabHost: () => host,
        getOverlay: () => null, schedule: fn => frames.push(fn) });
    at('a').focus();
    state.n = 2;
    wiring.mark();
    frames.splice(0).forEach(fn => fn());
    assert.equal(pane(), first, 'an ordinary frame keeps the pane being typed in');
    state.n = 3;
    wiring.mark();
    wiring.flushNow({ guard: false });
    assert.notEqual(pane(), first, 'the chat switch replaced it');
    assert.equal(at('a').value, 'a3', 'with the new chat\'s state');
    wiring.destroy();
    host.destroy();
});
