// J11 step 5: sdk.panels, the hub modules mark dirty through (flag suite.redrawScheduler).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdk } from '../../../core/sdk.js';
import { createPanels } from '../../../core/sdk/panels.js';
import { wireRedraw } from '../../../ui/legacy/ui-host/redraw-wiring.js';

// The hub bound to a real wiring (the host's), with frames the test runs by hand.
function bound({ flag = { on: true } } = {}) {
    const frames = [];
    const hub = createPanels({ on: () => flag.on });
    const wiring = wireRedraw({
        on: () => flag.on, mounts: { tab: { register() {} } }, getPanel: () => ({ hidden: false }), getTabHost: () => ({ active: () => 'now', refresh() {} }),
        getOverlay: () => null, schedule: fn => frames.push(fn),
    });
    hub.bind(wiring);
    return { ...hub, wiring, flag, runFrame: () => frames.splice(0).forEach(fn => fn()) };
}
// (a section is registered already on screen, as the modules do: `drawn: true`)
const section = (log, name = 's', extra = {}) => ({ keys: ['people'], isVisible: () => true, read: () => 'v', draw: () => log.push(name), drawn: true, ...extra });

test('while the flag is off sdk.panels is inert: on is false, register gives a no-op off, changed and hold do nothing', () => {
    const log = [];
    const { panels, runFrame, flag } = bound({ flag: { on: false } });
    assert.equal(panels.on, false);
    const off = panels.register('a', section(log));
    assert.equal(typeof off, 'function');
    panels.changed(['people']);
    panels.hold()();
    runFrame();
    off();
    flag.on = true;
    runFrame();
    assert.deepEqual(log, []);
    const sdk = createSdk({ store: {}, bus: {}, registry: { features: () => [] }, settings: () => ({}) }).sdk;
    assert.equal(sdk.panels.on, false);
    assert.doesNotThrow(() => sdk.panels.changed(['people']));
});

test('the sdk gives modules panels that follow suite.redrawScheduler at each call', () => {
    let on = false;
    const made = createSdk({ store: {}, bus: {}, registry: { features: () => [] }, settings: () => ({}), flag: name => on && name === 'suite.redrawScheduler' });
    assert.equal(made.sdk.panels.on, false);
    on = true;
    assert.equal(made.sdk.panels.on, true);
    assert.equal(typeof made.bindPanels, 'function');
    assert.equal(Object.keys(made.sdk.panels).includes('bind'), false, 'the binding is the host\'s, not a module\'s');
});

test('while on: changed marks the sections of its keys, and a burst is one draw in the next frame', () => {
    const log = [];
    const { panels, runFrame } = bound();
    panels.register('people', section(log, 'people'));
    panels.register('other', section(log, 'other', { keys: ['bag'] }));
    runFrame();
    log.length = 0;
    panels.changed(['people']);
    panels.changed(['people']);
    panels.changed(['people']);
    runFrame();
    assert.deepEqual(log, ['people']);
});

test('a section registered before the host binds is registered when it binds, and off removes it', () => {
    const log = [];
    const flag = { on: true };
    const hub = createPanels({ on: () => flag.on });
    const off = hub.panels.register('people', section(log));
    hub.panels.changed(['people']);   // nobody is drawing yet: nothing to mark, and the section was drawn after it
    const frames = [];
    hub.bind(wireRedraw({ on: () => true, mounts: { tab: { register() {} } }, getPanel: () => ({ hidden: false }), getTabHost: () => null, getOverlay: () => null, schedule: fn => frames.push(fn) }));
    hub.panels.changed(['people']);
    frames.splice(0).forEach(fn => fn());
    assert.deepEqual(log, ['s'], 'registered at the bind, then drawn once for the change');
    off();
    hub.panels.changed(['people']);
    frames.splice(0).forEach(fn => fn());
    assert.deepEqual(log, ['s']);
});

test('hold keeps the draw until it is released; a released hold is released once', () => {
    const log = [];
    const { panels, runFrame } = bound();
    panels.register('people', section(log, 'p', { drawn: true }));
    runFrame();
    const release = panels.hold();
    panels.changed(['people']);
    runFrame();
    assert.deepEqual(log, []);
    release();
    release();
    runFrame();
    assert.deepEqual(log, ['p']);
});

test('a drawn section is not drawn twice: one made by a draw in the same frame as the change is already current', () => {
    const log = [];
    const { panels, runFrame } = bound();
    let off = panels.register('w', section(log, 'old', { drawn: true }));
    runFrame();
    panels.changed(['people']);
    // the frame's own draw replaces the widget: the new one registers `drawn` at the newest count
    off();
    off = panels.register('w', section(log, 'new', { drawn: true }));
    runFrame();
    assert.deepEqual(log, [], 'neither draws: the replacement already shows the newest state');
    panels.changed(['people']);
    runFrame();
    assert.deepEqual(log, ['new']);
});
