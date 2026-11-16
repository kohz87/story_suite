// J11 step 5: the World people widget is a `people` section of sdk.panels while suite.redrawScheduler is on (its onChange subscription stays idle).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE_WIDGET, createPeopleWidget } from '../../../../modules/world/world/index.js';
import { createPanels } from '../../../../core/sdk/panels.js';
import { wireRedraw } from '../../../../ui/legacy/ui-host/redraw-wiring.js';
import { drawWorld, said, squash, worldData, worldHost } from './helpers.js';

// NPC State Delta's page API as a stand-in (cards in its classes; onChange kept so a subscriber would be seen).
function fakeCast(people) {
    const listeners = new Set();
    const api = {
        renders: 0,
        available: () => true,
        render(el) {
            api.renders += 1;
            const doc = el.ownerDocument;
            const cards = Object.keys(people()).map(name => {
                const cell = doc.createElement('div');
                cell.className = 'npc-state-delta-present-cell';
                cell.dataset.npcId = `npc_${name}`;
                const label = doc.createElement('b');
                label.className = 'npc-state-delta-present-card-name';
                label.textContent = name;
                cell.append(label);
                return cell;
            });
            el.replaceChildren(...cards);
            return cards.length;
        },
        onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        listeners,
    };
    return api;
}

async function setup({ flag = true } = {}) {
    const host = await worldHost({ delta: { Mira: {} } });
    await host.send('Hello.', said('The harbour.', ['~ place Harbour | kind: settlement', '+ present Mira']));
    const data = worldData(host);
    const state = { on: flag };
    const frames = [];
    const hub = createPanels({ on: () => state.on });
    hub.bind(wireRedraw({ on: () => state.on, mounts: { tab: { register() {} } }, getPanel: () => ({ hidden: false }), getTabHost: () => null, getOverlay: () => null, schedule: fn => frames.push(fn) }));
    const people = { Mira: {} };
    const cast = fakeCast(() => people);
    const widget = createPeopleWidget({ open: () => () => {}, cast: () => cast });
    const api = { query: (name, args) => host.sdk.query(name, args), panels: hub.panels };
    const draw = () => drawWorld(data, { widgets: { [PEOPLE_WIDGET]: { ...widget, render: (node, props) => widget.render(node, props, api) } } });
    return { host, cast, draw, hub, state, runFrame: () => frames.splice(0).forEach(fn => fn()) };
}

test('flag on: NPC State changed([people]) is one people draw in the next frame; no onChange subscription is made', async () => {
    const { host, cast, draw, hub, runFrame } = await setup();
    const { el, view } = draw();
    assert.equal(cast.listeners.size, 1, 'the onChange subscription is idle while the section draws');
    assert.equal(cast.renders, 1, 'the first draw');
    hub.panels.changed(['people']);
    hub.panels.changed(['people']);
    assert.equal(cast.renders, 1, 'marked, not drawn');
    runFrame();
    assert.equal(cast.renders, 2, 'two notices, one draw');
    assert.deepEqual(el.querySelectorAll('.npc-state-delta-present-card-name').map(n => squash(n.textContent)), ['Mira']);
    runFrame();
    assert.equal(cast.renders, 2, 'nothing more without a change');
    view.destroy();
    hub.panels.changed(['people']);
    runFrame();
    assert.equal(cast.renders, 2, 'a destroyed widget is not drawn');
    host.close();
});

test('a widget built by a pane redraw in the same frame as the change is not redrawn in the next frame', async () => {
    const { host, cast, draw, hub, runFrame } = await setup();
    const first = draw();
    cast.renders = 0;
    hub.panels.changed(['people']);      // NPC State's change is waiting for the frame ...
    first.view.destroy();                // ... and the frame's pane redraw replaces the widget
    draw();
    assert.equal(cast.renders, 1, 'the new widget draws itself once');
    runFrame();
    assert.equal(cast.renders, 1, 'the frame does not draw it again');
    runFrame();
    assert.equal(cast.renders, 1);
    hub.panels.changed(['people']);
    runFrame();
    assert.equal(cast.renders, 2, 'a later change draws it');
    host.close();
});

test('flag off: the widget subscribes to onChange as before and sdk.panels does nothing', async () => {
    const { host, cast, draw, hub, runFrame } = await setup({ flag: false });
    const { view } = draw();
    assert.equal(cast.listeners.size, 1, 'subscribed');
    hub.panels.changed(['people']);
    runFrame();
    assert.equal(cast.renders, 1, 'the panels draw nothing');
    view.destroy();
    assert.equal(cast.listeners.size, 0);
    host.close();
});

test('two live widgets: one people change redraws both, and destroying one leaves the other registered', async () => {
    const { host, cast, draw, hub, runFrame } = await setup();
    const first = draw();
    const second = draw();
    assert.equal(cast.renders, 2);
    hub.panels.changed(['people']);
    runFrame();
    assert.equal(cast.renders, 4, 'both widgets drew');
    second.view.destroy();
    hub.panels.changed(['people']);
    runFrame();
    assert.equal(cast.renders, 5, 'the first is still a section');
    first.view.destroy();
    host.close();
});

test('the flag turned off while a widget is on screen: its onChange subscription draws it again', async () => {
    const { host, cast, draw, hub, state } = await setup();
    draw();
    const before = cast.renders;
    hub.panels.changed(['people']);
    for (const fn of cast.listeners) fn();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(cast.renders, before, 'flag on: the idle subscription draws nothing');
    state.on = false;
    for (const fn of cast.listeners) fn();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(cast.renders, before + 1, 'flag off: the subscription draws it');
    host.close();
});
