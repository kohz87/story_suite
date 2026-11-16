// J11 step 5 review fixes: changed(['*']) is everything, and Diagnostics → Redraw all draws every module section (not skipped by its digest).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanels } from '../../../core/sdk/panels.js';
import { wireRedraw } from '../../../packages/story-block/src/v2/ui-host/redraw-wiring.js';

function bound(flag = { on: true }) {
    const frames = [];
    const hub = createPanels({ on: () => flag.on });
    const log = { panel: 0 };
    const wiring = wireRedraw({
        on: () => flag.on, mounts: { tab: { register() {} } }, getPanel: () => ({ hidden: false }), getTabHost: () => ({ active: () => 'now', refresh() { log.panel += 1; } }),
        getOverlay: () => null, schedule: fn => frames.push(fn), panels: hub.panels,
    });
    hub.bind(wiring);
    return { ...hub, wiring, log, flag, runFrame: () => frames.splice(0).forEach(fn => fn()) };
}
const section = (drawn, name, keys = ['people']) => ({ keys, isVisible: () => true, read: () => 'v', draw: () => drawn.push(name), drawn: true });

test("changed(['*']) counts as everything: every section draws, whatever its keys", () => {
    const drawn = [];
    const { panels, runFrame } = bound();
    panels.register('people', section(drawn, 'people'));
    panels.register('bag', section(drawn, 'bag', ['bag']));
    runFrame();
    panels.changed(['*']);
    runFrame();
    assert.deepEqual(drawn.sort(), ['bag', 'people']);
});

test('Redraw all: every module section and the panel draw again; the digest does not skip them; off → false and nothing drawn', () => {
    const drawn = [];
    const { panels, wiring, log, runFrame, flag } = bound();
    panels.register('people', section(drawn, 'people'));
    panels.register('bag', section(drawn, 'bag', ['bag']));
    runFrame();
    wiring.mark();   // (what markDirty alone does: the sections are skipped, their digests did not move)
    runFrame();
    assert.deepEqual(drawn, []);
    assert.equal(wiring.redrawAll(), true);
    runFrame();
    assert.deepEqual(drawn.sort(), ['bag', 'people']);
    assert.ok(log.panel >= 2, 'the panel too');
    flag.on = false;
    drawn.length = 0;
    assert.equal(wiring.redrawAll(), false);
    runFrame();
    assert.deepEqual(drawn, []);
});
