// J11 step 5 review fixes: one section per Cast view, the flag turned off at runtime, and a cast change reaching covered views after a rewind or an edited Re-read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCastPanels } from '../src/adapter/cast-ui/panels.js';
import { createCastViews } from '../src/adapter/cast-ui/cast-views.js';
import { createWatchers } from '../src/adapter/cast-ui/watchers.js';
import { createPanels } from '../../../core/sdk/panels.js';
import { wireRedraw } from '../../story-block/src/v2/ui-host/redraw-wiring.js';

// The real hub bound to the real scheduler (frames run by hand); the Cast views draw what `people.now` says.
function page({ flag = { on: true } } = {}) {
    const frames = [];
    const hub = createPanels({ on: () => flag.on });
    hub.bind(wireRedraw({ on: () => flag.on, mounts: { tab: { register() {} } }, getPanel: () => ({ hidden: false }), getTabHost: () => null, getOverlay: () => null, schedule: fn => frames.push(fn) }));
    const session = { hosted: true, sdkRef: { panels: hub.panels } };
    const castPanels = createCastPanels(session, { doc: { getElementById: () => null }, warn() {} });
    const people = { now: 'Mira' };
    const shown = [];   // what each Cast view last drew: [name, people]
    const views = createCastViews(session, {
        CAST_SCREEN_ID: 'x', CAST_SCREEN_ORDER: 1, CAST_TAB_ID: 'cast', CAST_WIDGET: 'w', DOSSIERS_ICON: '', DOSSIERS_TITLE: '', warn() {}, doc: {},
    }, { bindCastActions() {}, renderDossiers: box => shown.push([box.name, people.now]) }, castPanels);
    const mount = name => views.castWidget.render({ ownerDocument: { createElement: () => ({ name, isConnected: true, remove() {}, addEventListener() {} }) }, append() {} });
    const watchers = createWatchers({ warn() {}, delta: () => ({ generationActive: () => false }), touch: castPanels.touch });
    // What `rerender` does after any change (a rewind, an edited Re-read): the notice, then the old loop for the views the flag does not cover.
    const rerender = () => { watchers.notifyChange(); views.redrawCastViews(); };
    return { hub, castPanels, people, shown, mount, rerender, flag, runFrame: () => frames.splice(0).forEach(fn => fn()) };
}

test('two Cast views: one people change redraws both, and letting one go leaves the other a section', () => {
    const { hub, people, shown, mount, runFrame } = page();
    const first = mount('A');
    const second = mount('B');
    shown.length = 0;
    people.now = 'Mira, Tomas';
    hub.panels.changed(['people']);
    runFrame();
    assert.deepEqual(shown.map(item => item[0]).sort(), ['A', 'B']);
    first.destroy();
    shown.length = 0;
    hub.panels.changed(['people']);
    runFrame();
    assert.deepEqual(shown.map(item => item[0]), ['B']);
    second.destroy();
});

test('flag on: a cast change after a rewind or an edited Re-read (grown, then shrunk) reaches every covered view next frame, once', () => {
    const { people, shown, mount, rerender, runFrame } = page();
    mount('A');
    mount('B');
    for (const next of ['Mira, Tomas, Ines', 'Mira']) {   // grown, then shrunk
        shown.length = 0;
        people.now = next;
        rerender();
        assert.deepEqual(shown, [], 'nothing is drawn directly');
        runFrame();
        assert.deepEqual(shown.map(item => item[0]).sort(), ['A', 'B']);
        assert.ok(shown.every(item => item[1] === next), 'with the newest people');
    }
});

test('flag turned off while views are on screen: the old loop draws them again', () => {
    const { shown, mount, rerender, runFrame, flag, people } = page();
    mount('A');
    flag.on = false;
    shown.length = 0;
    people.now = 'Tomas';
    rerender();
    runFrame();
    assert.deepEqual(shown, [['A', 'Tomas']]);
});
