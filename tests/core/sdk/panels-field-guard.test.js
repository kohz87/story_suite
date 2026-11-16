// J11 guard: a sdk.panels section that names its `root` is not drawn while a field in it has the focus (flag suite.redrawScheduler).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanels } from '../../../src/v2/sdk/panels.js';
import { wireRedraw } from '../../../src/v2/ui-host/redraw-wiring.js';
import { doc } from '../host-ui.helpers.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

function bound() {
    const frames = [];
    const hub = createPanels({ on: () => true });
    const wiring = wireRedraw({
        on: () => true, mounts: { tab: { register() {} } }, getPanel: () => ({ hidden: false }), getTabHost: () => ({ active: () => 'now', refresh() {} }),
        getOverlay: () => null, schedule: fn => frames.push(fn),
    });
    hub.bind(wiring);
    const root = doc.createElement('div');
    const field = doc.createElement('input');
    const button = doc.createElement('button');
    root.appendChild(field); root.appendChild(button);
    const log = [];
    hub.panels.register('s', { keys: ['people'], isVisible: () => true, read: () => 'v', draw: () => log.push('draw'), drawn: true, root: () => root });
    return { ...hub, wiring, root, field, button, log, frame: () => frames.splice(0).forEach(fn => fn()) };
}

test('a focused field keeps its value and focus: the redraw is held through every reply; the draw runs once after blur', async () => {
    const t = bound();
    t.field.focus();
    t.panels.changed(['people']); t.frame();
    t.panels.changed(['people']); t.frame();
    assert.deepEqual(t.log, [], 'no draw while the reader types');
    t.field.dispatch('focusout', { relatedTarget: null });
    t.field.blur?.();
    await tick(); t.frame();
    assert.deepEqual(t.log, ['draw'], 'one draw after blur');
});

test('a focus move inside the root is not a blur; a field focused again at the timer waits again', async () => {
    const t = bound();
    t.field.focus();
    t.panels.changed(['people']); t.frame();
    t.field.dispatch('focusout', { relatedTarget: t.button });
    await tick(); t.frame();
    assert.deepEqual(t.log, [], 'still held after a move inside the root');
    t.field.dispatch('focusout', { relatedTarget: null });   // no blur really (an app switch): the field still has the focus
    await tick(); t.frame();
    assert.deepEqual(t.log, [], 're-checked at the deferred draw: still typing, still held');
    t.field.blur?.(); t.field.dispatch('focusout', { relatedTarget: null });
    await tick(); t.frame();
    assert.deepEqual(t.log, ['draw']);
});

test('a chat switch draws even with a field focused; with nothing focused every change draws', () => {
    const t = bound();
    t.panels.changed(['people']); t.frame();
    assert.deepEqual(t.log, ['draw']);
    t.field.focus();
    t.panels.changed(['people']);
    t.wiring.flushNow({ guard: false });
    assert.deepEqual(t.log, ['draw', 'draw'], 'the chat switch draws');
});

test('a section without a root is not guarded', () => {
    const t = bound();
    const log = [];
    t.panels.register('plain', { keys: ['people'], isVisible: () => true, read: () => 'v', draw: () => log.push('plain'), drawn: true });
    t.field.focus();
    t.panels.changed(['people']); t.frame();
    assert.deepEqual(log, ['plain']);
});
