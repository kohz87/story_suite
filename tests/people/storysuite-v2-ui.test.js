import test from 'node:test';
import assert from 'node:assert/strict';
import { CAST_TAB_ID, createStorySuiteV2Adapter } from '../src/storysuite-v2.js';
import { drawerWithPanel, fakeDelta, fakeDocument, fakeSdk, fakeTimers, hosted, v2Host } from './storysuite-v2.helpers.js';

// ---- the drawer copy and the settings section ----

test('while hosted the drawer copy is hidden; the section moves the same panel into the overlay and back', async () => {
    const { def, dom, doc, timers } = await hosted();
    assert.equal(dom.panel.style.display, 'none', 'drawer copy hidden as soon as hosted');
    const el = doc.body.appendChild(doc.createElement('section'));
    const cleanup = def.settings.section(el, {});
    assert.equal(dom.panel.parentNode, el, 'the panel itself is moved (one copy, listeners kept)');
    assert.equal(dom.panel.style.display, 'block', 'shown inside the overlay');
    assert.equal(dom.inline.classList.contains('story-suite-drawer'), true);
    const placeholder = dom.drawer.children[1];
    assert.equal(placeholder.dataset.npcStateDeltaPlaceholder, '1');
    assert.equal(placeholder.hidden, true);
    assert.equal(doc.getElementById('npc_state_delta_settings'), dom.panel);

    cleanup();
    assert.deepEqual(dom.drawer.children, [dom.before, dom.panel, dom.after], 'back exactly where it was');
    assert.equal(dom.panel.style.display, 'none', 'still hosted: hidden again');
    assert.equal(dom.inline.classList.contains('story-suite-drawer'), false);

    // The overlay drops the section without calling back: the panel goes home at the next watch.
    const el2 = doc.body.appendChild(doc.createElement('section'));
    def.settings.section(el2, {});
    assert.equal(dom.panel.parentNode, el2);
    el2.remove();
    timers.runIntervals();
    assert.equal(dom.panel.parentNode, dom.drawer);
    assert.equal(dom.panel.isConnected, true);
    assert.equal(dom.panel.style.display, 'none');
    assert.equal(dom.drawer.children.length, 3, 'no placeholder left behind');
});

test('a second section element takes the panel from the first; the first one\'s cleanup then does nothing', async () => {
    const { def, dom, doc } = await hosted();
    const first = doc.body.appendChild(doc.createElement('section'));
    const second = doc.body.appendChild(doc.createElement('section'));
    const cleanupFirst = def.settings.section(first, {});
    def.settings.section(second, {});
    assert.equal(dom.panel.parentNode, second);
    cleanupFirst();
    assert.equal(dom.panel.parentNode, second);
    assert.equal(dom.drawer.children.filter(node => node.dataset.npcStateDeltaPlaceholder).length, 1);
});

test('when the host goes away the drawer copy comes back as it was, and the adapter looks again', async () => {
    const { adapter, def, dom, doc, box, timers } = await hosted();
    const el = doc.body.appendChild(doc.createElement('section'));
    def.settings.section(el, {});
    box.host = undefined;
    timers.runIntervals();
    assert.equal(adapter.hosted(), false);
    assert.deepEqual(dom.drawer.children, [dom.before, dom.panel, dom.after]);
    assert.equal(dom.panel.style.display, 'block', 'its own display value restored');
    assert.equal(dom.panel.dataset.npcStateDeltaHosted, undefined);
    assert.equal(timers.timeouts.size, 1, 'looking for a host again');

    const sdk2 = fakeSdk();
    box.host = v2Host(sdk2);
    timers.runTimeouts();
    assert.equal(await adapter.settled(), true);
    assert.equal(sdk2.registered.length, 1, 'a new host gets its own registration');
    assert.equal(dom.panel.style.display, 'none');
});

test('stop() gives everything back', async () => {
    const { adapter, dom, timers } = await hosted();
    adapter.stop();
    assert.equal(adapter.hosted(), false);
    assert.equal(dom.panel.style.display, 'block');
    assert.equal(timers.timeouts.size + timers.intervals.size, 0);
});

test('a panel that mounts after hosting is hidden; a section opened before it waits for it', async () => {
    const sdk = fakeSdk();
    const doc = fakeDocument();
    const timers = fakeTimers();
    const delta = fakeDelta();
    const sb = v2Host(sdk);
    const adapter = createStorySuiteV2Adapter({
        suiteApi: delta.suiteApi, delta: () => delta.api, host: () => sb, doc, timers, logger: { warn() {} },
    });
    adapter.start();
    await adapter.settled();
    const el = doc.body.appendChild(doc.createElement('section'));
    sdk.registered[0].settings.section(el, {});
    // The meter presets block shows at once; Delta's panel is still on its way.
    assert.match(el.children.map(child => child.textContent).join(' '), /still loading/);
    const { panel } = drawerWithPanel(doc);
    doc.dispatch('npc-state-delta:settings-mounted');
    assert.equal(panel.parentNode, el);
    assert.equal(panel.style.display, 'block');
    el.remove();
    timers.runIntervals();
    assert.equal(panel.style.display, 'none');
});

test('a panel that mounts after hosting, with no section waiting, is hidden at once', async () => {
    const sdk = fakeSdk();
    const doc = fakeDocument();
    const delta = fakeDelta();
    const sb = v2Host(sdk);
    const adapter = createStorySuiteV2Adapter({
        suiteApi: delta.suiteApi, delta: () => delta.api, host: () => sb, doc, timers: fakeTimers(), logger: { warn() {} },
    });
    adapter.start();
    await adapter.settled();
    const { panel } = drawerWithPanel(doc);
    assert.equal(panel.style.display, 'block');
    doc.dispatch('npc-state-delta:settings-mounted');
    assert.equal(panel.style.display, 'none');
});

// ---- the Cast tab ----

test('the Cast tab renders Delta\'s own present-cast markup and fills its text', async () => {
    const { def, delta, doc } = await hosted();
    const el = doc.body.appendChild(doc.createElement('div'));
    el.dataset.tabId = CAST_TAB_ID;   // Story Block's tab host marks its pane with the shown tab
    def.tabs[0].render(el, { state: {} }, {});
    // Without Story Director the present cast stays at the top of Dossiers, the dossier list under it.
    // The cards in one padded pane; the dossier list (DOM, its rows as text) in a second padded pane under them.
    assert.match(el.innerHTML, /^<div class="npc-state-delta-story-pane"><section class="npc-state-delta-present-roster">Mira<\/section><\/div><div class="npc-state-delta-story-pane"><div class="npc-state-delta-story-dossiers npc-state-delta-v2-dossiers">.*<\/div><\/div>$/);
    assert.deepEqual(delta.filled, [el]);
    def.tabs[0].render(el, { state: {} }, {});
    assert.equal(el.writes, 1, 'unchanged cast is not rewritten');
    delta.cast = '<section class="npc-state-delta-present-roster">Mira, Oren</section>';
    doc.dispatch('npc-state-delta:cast-rendered');
    assert.match(el.innerHTML, /Mira, Oren/);
    assert.equal(el.writes, 2, 'follows Delta\'s own redraws');
});

test('an empty Cast tab uses the v1 tab\'s empty line and Scan button; Delta off says so', async () => {
    const { def, delta, doc } = await hosted();
    delta.cast = '';
    const el = doc.body.appendChild(doc.createElement('div'));
    el.dataset.tabId = CAST_TAB_ID;
    def.tabs[0].render(el, {}, {});
    assert.match(el.innerHTML, /The latest scan found no NPC in the scene\./);
    assert.match(el.innerHTML, /data-npc-state-delta-action="scan"/, 'emptyCastHtml from story-block-tabs.js');
    const scan = { dataset: { npcStateDeltaAction: 'scan' } };
    el.listeners.click[0]({ target: { closest: () => scan } });
    assert.equal(delta.scans, 1);
    delta.enabled = false;
    doc.dispatch('npc-state-delta:enabled-changed');
    assert.match(el.innerHTML, /NPC State Delta is off\./);
});

test('if the v1 empty-state markup cannot load, the Cast tab still shows a plain, escaped line', async () => {
    const delta = fakeDelta();
    delta.cast = '';
    delta.api.castEmptyReason = () => ({ text: '<b>nobody</b>', scan: true });
    const { def, doc } = await hosted({ delta, loadEmptyCast: () => Promise.reject(new Error('missing')) });
    const el = doc.body.appendChild(doc.createElement('div'));
    def.tabs[0].render(el, {}, {});
    assert.match(el.innerHTML, /&lt;b&gt;nobody&lt;\/b&gt;/);
});

// ---- UI cleanup (1 Nov): the meter presets fold, the scan switch, the Expert note ----

test('the meter presets block goes into Delta\'s "Meter presets" fold, which shows only while it holds the block', async () => {
    const { def, dom, doc } = await hosted();
    const slot = doc.createElement('div');
    const group = doc.createElement('details');
    group.hidden = true;
    slot.closest = selector => (selector === '[data-delta-settings-group]' ? group : null);
    slot.replaceChildren = (...nodes) => { slot.held = nodes; };
    dom.panel.querySelector = selector => (selector === '[data-delta-settings-slot="meter-presets"]' ? slot : null);
    dom.panel.before = () => {};
    dom.panel.ownerDocument = doc;
    const el = doc.body.appendChild(doc.createElement('section'));
    const cleanup = def.settings.section(el, { values: () => ({}), set() {} });
    assert.equal(slot.held.length, 1, 'the presets block is in the fold');
    assert.equal(slot.held[0]._cls, 'npc-state-delta-v2-presets');
    assert.equal(group.hidden, false, 'the fold shows');
    assert.equal(el.children.length, 1, 'only the panel is in the section: no block above it');
    assert.equal(el.children[0], dom.panel);
    cleanup();
    assert.deepEqual(slot.held, [], 'the block leaves the fold when the panel goes home');
    assert.equal(group.hidden, true, 'the fold hides again');
});

test('the block names itself with a head the fold hides, and the drawer panel keeps the old top block when it has no fold', async () => {
    const { def, dom, doc } = await hosted();
    dom.panel.querySelector = () => null;
    dom.panel.before = () => {};
    const el = doc.body.appendChild(doc.createElement('section'));
    def.settings.section(el, { values: () => ({}), set() {} });
    assert.equal(el.children[0]._cls, 'npc-state-delta-v2-presets', 'a panel without the slot gets the block above it');
    assert.equal(el.children[0].children[0]._cls, 'npc-state-delta-v2-presets-head');
    assert.equal(el.children[0].children[0].textContent, 'Meter presets');
});

test('scanEveryReply follows the feature switch (on by default); calendarLink says where the calendar stands', async () => {
    const switches = {};
    const sdk = fakeSdk();
    let calendar;
    sdk.feature = id => switches[id];
    sdk.query = name => {
        if (name === 'director.calendar') {
            if (calendar === 'throw') throw new Error('unknown query');
            return calendar;
        }
        return undefined;
    };
    let own = false;
    const { adapter } = await hosted({ sdk, calendarOwn: () => own });
    assert.equal(adapter.scanEveryReply(), true, 'no answer from the host: the default (on)');
    switches['npc-state-delta.scan-every-reply'] = false;
    assert.equal(adapter.scanEveryReply(), false);
    switches['npc-state-delta.scan-every-reply'] = true;
    assert.equal(adapter.scanEveryReply(), true);

    calendar = 'throw';
    assert.equal(adapter.calendarLink(), 'none', 'no Story Director: its query is unknown');
    calendar = { months: [{ name: 'Redleaf', days: 30 }] };
    assert.equal(adapter.calendarLink(), 'story-director');
    own = true;
    assert.equal(adapter.calendarLink(), 'own', 'the reader keeps the calendar in Delta');
});
