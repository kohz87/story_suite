// Features in the page (MODULES §F100): the page following a switch: a module's
// screens, tabs and widgets hidden, Story Block's status strip and cards under replies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { featuresFoldOf } from '../../ui/legacy/host-ui.js';
import { CORE_FEATURE } from '../../core/features.js';
import { hudOn } from '../../ui/legacy/ui-host.js';
import { THIS_REPLY_ID } from '../../ui/legacy/reply-cards.js';
import { hudRow, hudTile, loot, page, plain, texts } from './features-ui.helpers.js';

test('the page: a feature\'s screens, tabs and widgets go when it is turned off and come back when it is on', async () => {
    const { doc, host, ui } = await page();
    ui.openPanel();
    const panel = doc.querySelector('#story_suite_v2_panel');
    const labels = () => texts(panel, '.story-suite-tab .ss-screenbar-label');
    assert.ok(labels().includes('Picker') && labels().includes('Loot code') && labels().includes('Bag'), labels().join(', '));
    assert.ok(doc.querySelector('.ss-hud .picker'), 'the picker in the status strip');
    assert.ok(ui.screens.resolve('loot/picker'));

    host.features.set('loot.picker', false);
    assert.ok(!labels().includes('Picker') && !labels().includes('Loot code') && labels().includes('Bag'), labels().join(', '));
    assert.equal(doc.querySelector('.ss-hud .picker'), null);
    assert.equal(ui.screens.resolve('loot/picker'), null);
    assert.deepEqual(ui.screens.list('tab').map(entry => entry.id).filter(id => id.startsWith('loot/')), ['loot/bag']);
    // A pack's or the reader's version of an off screen is hidden all the same.
    ui.screens.choose('loot/picker', { id: 'loot/picker', title: 'Mine', mounts: ['tab'], template: '<p>mine</p>' });
    ui.refresh();
    assert.ok(!labels().includes('Mine'));

    host.features.set('loot.picker', true);
    assert.ok(labels().includes('Mine') && labels().includes('Loot code'), labels().join(', '));
    host.close();
});

test('the page: a widget whose feature is off draws nothing, not a "no widget" error', async () => {
    const bag = { id: 'loot/bag', title: 'Bag', mounts: ['tab'], template: '<p class="bag"><ss-widget name="loot.gem"></ss-widget></p>' };
    const { doc, host, ui } = await page({ modules: [{ ...loot(), screens: [bag] }] });
    ui.openPanel();
    const pane = () => {
        doc.querySelectorAll('.story-suite-tab').find(node => node.dataset.tabId === 'loot/bag').click();
        return doc.querySelector('.story-suite-pane');
    };
    assert.ok(pane().textContent.includes('gem'), 'drawn while on');
    host.features.set('loot.picker', false);
    const off = pane();
    assert.ok(off.querySelector('.bag'));
    assert.ok(!/no widget/i.test(off.textContent), off.textContent);
    assert.ok(!off.textContent.includes('gem'));
    host.features.set('loot.picker', true);
    assert.ok(pane().textContent.includes('gem'), 'back on');
    host.close();
});

test('the page: the status strip is Story Block\'s feature; the drawer switch and the feature are one choice', async () => {
    const { doc, host, ui } = await page();
    assert.ok(doc.querySelector('.ss-hud'));
    host.features.set(CORE_FEATURE.hud, false);
    assert.equal(doc.querySelector('.ss-hud'), null, 'the feature hides it');
    assert.equal(doc.querySelector('.story-suite-hud-toggle input').checked, false, 'the drawer switch follows');
    assert.equal(ui.hudOn(), false);
    ui.setHud(true);
    assert.ok(doc.querySelector('.ss-hud'));
    assert.equal(host.sdk.feature(CORE_FEATURE.hud), true);
    assert.equal(host.ctx.extensionSettings.storySuite.features[CORE_FEATURE.hud], undefined, 'on is the default: the stored choice is cleared, not written');
    assert.equal(host.ctx.extensionSettings.storySuite.hud, true, 'the old switch kept in step');
    // The feature's choice wins over the old switch; without one the old switch counts.
    assert.equal(hudOn({ storySuite: { hud: false, features: { [CORE_FEATURE.hud]: true } } }), true);
    assert.equal(hudOn({ storySuite: { hud: false } }), false);
    host.close();
});

test('the page: with the cards feature off no card is drawn under a reply; on again they come back', async () => {
    const { doc, host, ui, draw } = await page();
    await host.send('hi', 'You find a rope.\n<Changes>\n+ item Rope | qty: 1\n</Changes>');
    draw();
    ui.mounts.card.refresh(2, { force: true });
    const card = () => doc.querySelector(`.mes[mesid="2"] [data-ss-card="${THIS_REPLY_ID}"]`);
    assert.ok(card(), 'on by default');
    host.features.set(CORE_FEATURE.cards, false);
    assert.equal(card(), null);
    ui.mounts.card.refresh(2, { force: true });
    assert.equal(card(), null, 'stays off');
    host.features.set(CORE_FEATURE.cards, true);
    ui.mounts.card.refresh(2, { force: true });
    assert.ok(card());
    host.close();
});

test('the page: the settings window opened from the bar has the Features, as switch tiles', async () => {
    const { doc, host } = await page();
    doc.querySelector('.story-suite-bar-settings').click();
    const overlayRoot = doc.querySelector('#story_suite_v2_overlay');
    assert.ok(overlayRoot.querySelectorAll('.ss-features-group').some(node => node.dataset.fold === featuresFoldOf('loot')));
    assert.equal(overlayRoot.querySelector('details[data-fold="story-suite-features"]'), null, 'no Features fold any more');
    host.close();
});

test('the page: a dialog for a screen whose feature is off does not open, and an open one closes when it goes off', async () => {
    const wizard = { ...loot(), screens: [{ id: 'loot/pick', title: 'Pick', mounts: ['dialog'], template: '<p class="pick">pick</p>', feature: 'loot.picker' }] };
    const { doc, host, ui } = await page({ modules: [wizard] });
    // sdk.dialog.open goes to this mount (ui-host's setDialog).
    const open = id => ui.mounts.dialog.open(id);
    const handle = open('loot/pick');
    assert.ok(handle && doc.querySelector('.ss-dialog .pick'));
    host.features.set('loot.picker', false);
    assert.equal(doc.querySelector('.ss-dialog'), null, 'closed with its feature');
    assert.equal(handle.isOpen(), false);
    assert.equal(open('loot/pick'), null, 'nothing opens');
    assert.equal(doc.querySelector('.ss-dialog'), null);
    assert.equal(open('nobody/has-this'), null, 'nor for an id no one has');
    host.features.set('loot.picker', true);
    assert.ok(open('loot/pick'));
    host.close();
});

// ---- The status strip's switch: there only while some screen asks for the strip ----

test('Settings → Features: the status strip\'s switch is hidden while no screen declares a hud mount, and its stored choice is kept', async () => {
    const { doc, host, ui } = await page({ modules: [plain()], settings: { features: { [CORE_FEATURE.hud]: false } } });
    assert.equal(ui.screens.list('hud').length, 0);
    assert.ok(host.features.list().some(feature => feature.id === CORE_FEATURE.hud), 'the store still knows the feature');
    assert.equal(host.features.stored(CORE_FEATURE.hud), false, 'its stored choice is untouched');
    doc.querySelector('.story-suite-bar-settings').click();
    assert.ok(doc.querySelector('#story_suite_v2_overlay').querySelectorAll('.ss-feature').length > 0, 'the page lists other features');
    assert.equal(hudTile(doc), null, 'no switch');
    assert.equal(hudRow(doc).hidden, true, 'nor the one in the extensions drawer');
    assert.equal(ui.hudOn(), false, 'and what was chosen still applies');
    host.close();
});

test('Settings → Features: the switch is there while a module\'s screen declares a hud mount, and a pack that adds one brings it back', async () => {
    const withHud = await page();
    assert.ok(withHud.ui.screens.list('hud').length > 0);
    withHud.doc.querySelector('.story-suite-bar-settings').click();
    assert.ok(hudTile(withHud.doc), 'a module\'s hud screen');
    assert.notEqual(hudRow(withHud.doc).hidden, true);
    withHud.host.close();

    const { doc, host, ui } = await page({ modules: [plain()] });
    doc.querySelector('.story-suite-bar-settings').click();
    assert.equal(hudTile(doc), null);
    ui.screens.setPack('strip-pack', [{ id: 'strip-pack/hp', title: 'HP', mounts: ['hud'], template: '<b>hp</b>' }]);
    ui.refresh();
    ui.openSettings();
    assert.ok(hudTile(doc), 'the pack\'s hud screen shows the switch');
    assert.notEqual(hudRow(doc).hidden, true);
    ui.screens.removePack('strip-pack');
    ui.refresh();
    ui.openSettings();
    assert.equal(hudTile(doc), null, 'and takes it away again');
    assert.equal(hudRow(doc).hidden, true);
    host.close();
});

test('the page: a widget\'s hold keeps the screen\'s `committed` redraw back until it is released, then runs it once', async () => {
    const seen = [], got = {};
    const probe = { render: (el, props, api) => { got.off?.(); got.off = api.on('committed', () => seen.push('redraw')); got.hold = api.hold; } };
    const bag = { id: 'loot/probe', title: 'Probe', mounts: ['tab'], template: '<p><ss-widget name="loot.probe"></ss-widget></p>' };
    const { doc, host, ui } = await page({ modules: [{ ...loot(), screens: [bag], widgets: { 'loot.probe': probe } }] });
    ui.openPanel();
    doc.querySelectorAll('.story-suite-tab').find(node => node.dataset.tabId === 'loot/probe').click();
    assert.equal(typeof got.hold, 'function', 'the widget is given hold');
    const release = got.hold(), again = got.hold();
    host.events.emit('committed', {});
    host.events.emit('committed', {});
    assert.deepEqual(seen, [], 'held');
    release();
    release();
    assert.deepEqual(seen, [], 'still held by the second hold');
    again();
    assert.deepEqual(seen, ['redraw'], 'one redraw after the last release');
    host.events.emit('committed', {});
    assert.deepEqual(seen, ['redraw', 'redraw'], 'not held any more');
    host.close();
});

test('the page: the game view\'s screen redraw from `committed` waits for a widget\'s hold too, then runs once', async () => {
    const draws = [], got = {};
    const probe = { render: (el, props, api) => { draws.push('draw'); got.hold = api.hold; } };
    const bag = { id: 'loot/field', title: 'Field', mounts: ['screen'], template: '<p><ss-widget name="loot.probe"></ss-widget></p>' };
    const { host, ui } = await page({ modules: [{ ...loot(), screens: [bag], widgets: { 'loot.probe': probe } }] });
    assert.equal(ui.mounts.screen.open('loot/field'), true);
    const release = got.hold();
    const before = draws.length;
    host.events.emit('committed', {});
    host.events.emit('committed', {});
    assert.equal(draws.length, before, 'the game view is not redrawn while held');
    release();
    assert.equal(draws.length, before + 1, "it redraws once after the release");
    const after = draws.length;
    host.events.emit('committed', {});
    assert.ok(draws.length > after, 'and not held any more');
    host.close();
});
