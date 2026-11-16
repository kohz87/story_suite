// J11 step 4: the tab host's swap draw (flag suite.redrawScheduler): no blank pane, scroll kept, a field being typed in is not lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTabHost } from '../../src/v2/host-ui.js';
import { doc, setup } from './host-ui.helpers.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

function build({ swap }) {
    const tab = { id: 'w1', title: 'World', render(el, view) { const box = doc.createElement('input'); box.value = `v${view.n}`; el.appendChild(box); return { destroy() { state.destroyed += 1; } }; } };
    const state = { n: 1, destroyed: 0 };
    const { registry } = setup({ id: 'alpha', tabs: [tab] });
    const root = doc.createElement('div');
    const host = createTabHost(root, { registry, view: () => ({ n: state.n }), doc, swap });
    return { host, root, state };
}

test('swap on: the old pane stays shown until the new one is complete; no empty pane is ever on the page', () => {
    const { host, root, state } = build({ swap: () => true });
    const first = root.querySelector('.story-suite-pane');
    const states = [];
    const origRemove = first.remove.bind(first);
    first.remove = () => { states.push(root.querySelectorAll('.story-suite-pane').length); origRemove(); };
    state.n = 2;
    host.refresh();
    const second = root.querySelector('.story-suite-pane');
    assert.notEqual(second, first);
    assert.equal(root.querySelectorAll('.story-suite-pane').length, 1);
    assert.equal(second.querySelector('input').value, 'v2', 'the new pane was complete when it appeared');
    assert.deepEqual(states, [2], 'the new pane was in place before the old one left (never zero panes)');
    assert.equal(state.destroyed, 1, 'the old tab was taken down');
});

test('swap off: today\'s draw exactly: the same pane is emptied and drawn again in place', () => {
    const { host, root, state } = build({ swap: () => false });
    const first = root.querySelector('.story-suite-pane');
    state.n = 2;
    host.refresh();
    assert.equal(root.querySelector('.story-suite-pane'), first, 'the same node');
    assert.equal(first.querySelector('input').value, 'v2');
    const plain = build({ swap: null });
    const kept = plain.root.querySelector('.story-suite-pane');
    plain.host.refresh();
    assert.equal(plain.root.querySelector('.story-suite-pane'), kept, 'no option: the same node too');
});

test('swap on: the panel scroll is kept across a draw', () => {
    const { host, root } = build({ swap: () => true });
    root.scrollTop = 120;
    host.refresh();
    assert.equal(root.scrollTop, 120);
});

test('swap on: a host redraw never replaces the pane while a field in it is focused; it runs once after the field loses focus', async () => {
    const { host, root, state } = build({ swap: () => true });
    const first = root.querySelector('.story-suite-pane');
    first.querySelector('input').focus();
    state.n = 2;
    host.refresh({ guard: true });
    host.refresh({ guard: true });
    assert.equal(root.querySelector('.story-suite-pane'), first, 'the pane being typed in stays');
    assert.equal(state.destroyed, 0);
    doc.activeElement = null;
    first.dispatch('focusout');
    await tick();
    const after = root.querySelector('.story-suite-pane');
    assert.notEqual(after, first);
    assert.equal(after.querySelector('input').value, 'v2', 'drawn once from the newest state');
    assert.equal(state.destroyed, 1);
    // an explicit redraw (a tab chosen) still draws at once
    after.querySelector('input').focus();
    host.refresh();
    assert.notEqual(root.querySelector('.story-suite-pane'), after);
    host.destroy();
});

test('swap off: the field guard does nothing (the flag-off draw is untouched)', () => {
    const { host, root, state } = build({ swap: () => false });
    const first = root.querySelector('.story-suite-pane');
    first.querySelector('input').focus();
    state.n = 2;
    host.refresh({ guard: true });
    assert.equal(first.querySelector('input').value, 'v2', 'drawn at once, as before');
});

test('swap on: a bar that shares the root is not removed by the swap', () => {
    const { host, root } = build({ swap: () => true });
    const before = root.querySelectorAll('.story-suite-tab').length;
    host.refresh();
    assert.equal(root.querySelectorAll('.story-suite-tab').length, before);
    assert.ok(before > 0);
});
