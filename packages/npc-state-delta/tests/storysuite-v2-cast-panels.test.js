// J11 step 5: the Cast views, the Dossiers pane and the dossier panel as `people` sections of sdk.panels (flag suite.redrawScheduler).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCastPanels } from '../src/adapter/cast-ui/panels.js';
import { createCastViews } from '../src/adapter/cast-ui/cast-views.js';
import { createWatchers } from '../src/adapter/cast-ui/watchers.js';

// A fake sdk.panels that records what is registered and changed.
function fakePanels(on = true) {
    const sections = new Map();
    const log = { changed: [], offs: [] };
    return {
        sections, log,
        panels: {
            get on() { return on; },
            register: (id, section) => { sections.set(id, section); return () => { log.offs.push(id); if (sections.get(id) === section) sections.delete(id); }; },
            changed: keys => log.changed.push(keys),
            hold: () => () => {},
        },
    };
}
const setup = (on = true, hosted = true) => {
    const fake = fakePanels(on);
    const session = { hosted, sdkRef: { panels: fake.panels } };
    return { fake, session, castPanels: createCastPanels(session, { doc: { getElementById: () => null }, warn() {} }) };
};

test('flag off: nothing registers, touch marks nothing, and every view or pane stays on the old direct path', () => {
    const { fake, castPanels } = setup(false);
    const box = { isConnected: true };
    assert.equal(castPanels.view(box, () => {}), null);
    castPanels.pane({ isConnected: true }, () => {}, () => true);
    castPanels.touch();
    assert.equal(castPanels.viewCovered(box), false);
    assert.equal(fake.sections.size, 0);
    assert.deepEqual(fake.log.changed, []);
});

test('no host sdk or no sdk.panels (an older Story Block): inert too', () => {
    const none = createCastPanels({ hosted: true, sdkRef: {} }, { doc: {}, warn() {} });
    assert.equal(none.view({}, () => {}), null);
    assert.doesNotThrow(() => none.touch());
    const unhosted = setup(true, false).castPanels;
    assert.equal(unhosted.view({}, () => {}), null);
});

test('flag on: touch is changed([people]); a view and the pane register as people sections, drawn: true, and release on off', () => {
    const { fake, castPanels } = setup();
    const box = { isConnected: true };
    const drawn = [];
    const off = castPanels.view(box, () => drawn.push('view'));
    assert.equal(castPanels.viewCovered(box), true);
    const view = fake.sections.get('npc-state-delta.cast-view.1');
    assert.deepEqual([view.keys, view.drawn], [['people'], true]);
    const pane = { isConnected: true };
    let shown = true;
    castPanels.pane(pane, el => drawn.push(el === pane ? 'pane' : '?'), () => shown);
    assert.equal(castPanels.paneCovered(pane), true);
    assert.equal(castPanels.paneCovered({}), false);
    const section = fake.sections.get('npc-state-delta.dossiers-pane');
    assert.equal(section.isVisible(), true);
    shown = false;
    assert.equal(section.isVisible(), false, 'another tab shows: the pane is not drawn');
    shown = true;
    section.draw();
    view.draw();
    assert.deepEqual(drawn, ['pane', 'view']);
    assert.ok(fake.sections.has('npc-state-delta.dossier-panel'), 'the dossier panel is a people section too');
    castPanels.touch();
    assert.deepEqual(fake.log.changed, [['people']]);
    off();
    assert.equal(castPanels.viewCovered(box), false);
    assert.equal(fake.sections.has('npc-state-delta.cast-view.1'), false);
});

test('every change notice reaches panels.changed(["people"]), the busy end (the page API) included', () => {
    const { fake, castPanels } = setup();
    const direct = [];
    const part = createWatchers({ warn() {}, delta: () => ({ generationActive: () => false }), touch: castPanels.touch });
    part.watchers.add(() => direct.push('sub'));
    part.notifyChange();
    assert.deepEqual([direct.length, fake.log.changed.length], [1, 1], 'an immediate notice');
    part.notifyChange(true);
    assert.deepEqual([direct.length, fake.log.changed.length], [1, 1], 'a streaming notice inside the window waits for its trailing call: nothing yet');
    part.fire();
    assert.deepEqual([direct.length, fake.log.changed.length], [2, 2], 'the busy end calls fire');
});

test('redrawCastViews leaves a view a section draws to the section; a view drawn while the flag was off is still drawn directly', () => {
    const { castPanels } = setup();
    const drawn = [];
    const views = createCastViews({}, {
        CAST_SCREEN_ID: 'x', CAST_SCREEN_ORDER: 1, CAST_TAB_ID: 'cast', CAST_WIDGET: 'w', DOSSIERS_ICON: '', DOSSIERS_TITLE: '', warn() {},
        doc: { createElement: () => ({ isConnected: true, remove() {}, addEventListener() {}, append() {} }) },
    }, { bindCastActions() {}, renderDossiers: box => drawn.push(box.name) }, castPanels);
    const mount = name => {
        const el = { ownerDocument: { createElement: () => ({ name, isConnected: true, remove() {}, addEventListener() {} }) }, append() {} };
        return views.castWidget.render(el);
    };
    const covered = mount('on');          // flag on: registered
    assert.ok(covered);
    drawn.length = 0;
    views.redrawCastViews();
    assert.deepEqual(drawn, [], 'the section draws it, not the page event');
    const flagOff = setup(false).castPanels;
    const old = createCastViews({}, {
        CAST_SCREEN_ID: 'x', CAST_SCREEN_ORDER: 1, CAST_TAB_ID: 'cast', CAST_WIDGET: 'w', DOSSIERS_ICON: '', DOSSIERS_TITLE: '', warn() {}, doc: {},
    }, { bindCastActions() {}, renderDossiers: box => drawn.push(box.name) }, flagOff);
    old.castWidget.render({ ownerDocument: { createElement: () => ({ name: 'off', isConnected: true, remove() {}, addEventListener() {} }) }, append() {} });
    drawn.length = 0;
    old.redrawCastViews();
    assert.deepEqual(drawn, ['off']);
});
