// The RPG's screens on the page (ui-host.js): nothing is imported or mounted while the feature is off; on, the Party
// tab shows while the story has a Character block, the Spend points sheet saves through the real host, the settings fold
// draws and the "Changed this reply" card carries the RPG lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { makeMessage } from '../../../helpers/ui-fake-dom.js';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { mountUi } from '../../../../ui/legacy/ui-host.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { THIS_REPLY_ID } from '../../../../ui/legacy/reply-cards.js';
import { RESOLVE } from '../../../../modules/rpg/index.js';
import { characterDefinition, defineAll, fieldsOf, foesDefinition, roleOf, setField, skillsDefinition } from './helpers.js';

const settle = async () => { for (let n = 0; n < 6; n += 1) await new Promise(resolve => setImmediate(resolve)); };

async function page(t, { feature = false } = {}) {
    const doc = setupDom();
    const form = doc.createElement('div'); form.id = 'send_form'; doc.body.appendChild(form);
    doc.defaultView = { confirm: () => true, localStorage: null };
    const host = await createHost();
    if (feature) host.features.set(CORE_FEATURE.leanRpg, true);
    const loads = [];
    // The real loader, with the block engine's `role` read from the slug while that key is not in the schema yet.
    const loadLeanRpg = () => { loads.push(1); return import('../../../../modules/rpg/view/index.js').then(view => ({ ...view, mountLeanRpg: deps => view.mountLeanRpg({ ...deps, roleOf }) })); };
    const runtime = { registry: host.registry, store: host.store, sdk: host.sdk, settings: host.settings, events: host.events, turn: host.turn, features: host.features };
    const ui = mountUi({ runtime, ctx: host.ctx, doc, loadLeanRpg });
    t.after(() => { ui.destroy(); host.close(); });
    const draw = () => { for (const old of doc.querySelectorAll('.mes')) old.remove(); host.ctx.chat.forEach((message, index) => makeMessage(doc, index)); };
    await settle();
    return { doc, host, ui, loads, draw };
}
const hasLink = doc => doc.querySelectorAll('link[data-ss-rpg]').length;
const navIds = doc => {
    const view = doc.querySelector('.ss-gameview');
    return view ? [...view.querySelectorAll('.ss-screenbar-item[data-id]'), ...view.querySelectorAll('.ss-screenbar-tile[data-id]')].map(node => node.getAttribute('data-id')) : [];
};
const PARTY = 'story-block/party';
const party = doc => doc.querySelector(`.ss-gameview [data-ss-screen="${PARTY}"]`);

test('feature off: nothing is imported, nothing is mounted, and the Party screen is not there', async t => {
    const { doc, host, ui, loads, draw } = await page(t);
    await host.send('Begin.', 'Opening.');
    await defineAll(host, [characterDefinition('wessel', 'Wessel')]);
    draw();
    await settle();
    assert.equal(loads.length, 0, 'the loader is never asked');
    assert.equal(ui.screens.resolve(PARTY), null);
    assert.equal(hasLink(doc), 0);
    assert.equal(doc.querySelectorAll('.rpg-battle').length, 0);
    ui.mounts.screen.open();
    assert.ok(!navIds(doc).includes(PARTY));
    ui.openSettings();
    assert.equal(doc.querySelector('[data-ss-section="rpg"]'), null, 'no RPG page in the settings window');
    assert.ok(!doc.querySelectorAll('.ss-tabs-label').some(node => node.textContent === 'RPG'), 'and no RPG entry in its rail');
});

test('turning the feature on mounts it once; turning it off takes it all away; on again mounts it again', async t => {
    const { doc, host, ui, loads } = await page(t);
    host.features.set(CORE_FEATURE.leanRpg, true);
    await settle();
    assert.equal(loads.length, 1);
    assert.ok(ui.screens.resolve(PARTY));
    assert.equal(hasLink(doc), 5, 'the five stylesheets are added');
    host.features.set(CORE_FEATURE.leanRpg, true);
    await settle();
    assert.equal(loads.length, 1, 'already mounted: not loaded twice');
    host.features.set(CORE_FEATURE.leanRpg, false);
    assert.equal(ui.screens.resolve(PARTY), null);
    assert.equal(hasLink(doc), 0);
    host.features.set(CORE_FEATURE.leanRpg, true);
    await settle();
    assert.equal(loads.length, 2);
    assert.ok(ui.screens.resolve(PARTY));
});

test('on at page load: it mounts when the page does', async t => {
    const { ui, loads } = await page(t, { feature: true });
    assert.equal(loads.length, 1);
    assert.ok(ui.screens.resolve(PARTY));
});

test('the Party tab shows while the feature is on, with or without a Character block, right after Home', async t => {
    const { doc, host, ui } = await page(t, { feature: true });
    await host.send('Begin.', 'Opening.');
    ui.mounts.screen.open();
    assert.equal(navIds(doc)[1], PARTY, 'no Character block yet: the tab is there, to make one');
    await defineAll(host, [characterDefinition('wessel', 'Wessel')]);
    await settle();
    ui.mounts.screen.update();
    assert.equal(navIds(doc)[1], PARTY, 'the second place, after Home');
    ui.openPanel();
    assert.ok(doc.querySelectorAll('.story-suite-tab').some(node => /Party/.test(node.textContent)), 'the Story panel has it too');
});

const railLabels = doc => doc.querySelectorAll('.ss-settings .ss-tabs-label').map(node => node.textContent);
const rpgPage = doc => doc.querySelector('[data-ss-section="rpg"]');

test('the settings window opened just before the feature was switched on gets the RPG page once it loads', async t => {
    const { doc, host, ui } = await page(t);
    const win = ui.openSettings();
    assert.ok(!railLabels(doc).includes('RPG'));
    host.features.set(CORE_FEATURE.leanRpg, true);
    await settle();
    assert.deepEqual(railLabels(doc).slice(0, 3), ['Look', 'Features', 'RPG']);
    assert.equal(ui.openSettings && doc.querySelectorAll('.ss-settings').length, 1, 'one window');
    void win;
});

test('with the feature off the card is as it always was', async t => {
    const { doc, host, ui, draw } = await page(t);
    await host.send('Begin.', 'Opening.');
    await host.send('Go.', 'The quay.');
    const head = host.store.headIndex();
    host.ctx.chat[head].extra.storySuite.receipts.push({ id: 'rc_rpg0001', type: RESOLVE, module: 'story-block', cause: 'system', summary: '', narrate: false, rev: 99, data: { v2: { result: { v: 1, summary: { exchanges: 3, acts: [], refused: 0 }, rounds: [] } } } });
    draw();
    ui.mounts.card.refresh(head, { force: true });
    assert.doesNotMatch(doc.querySelector(`.mes[mesid="${head}"] [data-ss-card="${THIS_REPLY_ID}"]`).textContent, /Rolled for you|exchanges/);
});

// ---- the tab bar: one Party tab, not one tab per RPG block ----------------------------------------------------------------
const TAB = { tab: true, card: false, icon: 'ph-star' };
const withRole = (definition, role, tabName) => ({ ...definition, ...(role ? { role } : {}), show: { ...TAB, tabName: tabName ?? definition.name.slice(0, 24) } });
const party3 = () => [
    withRole(characterDefinition('wessel', 'Wessel'), 'character'), withRole(characterDefinition('ren', 'Ren'), 'character'), withRole(characterDefinition('mira', 'Mira'), 'character'),
    withRole(skillsDefinition('wessel-skills', 'Wessel'), 'skills'), withRole(skillsDefinition('ren-skills', 'Ren'), 'skills'),
    withRole(foesDefinition('foes'), 'foes'), withRole(skillsDefinition('combat-rules', 'Combat rules'), 'rules', 'Combat rules'),
];
const BLOCK_TAB = slug => `story-block/block/${slug}`;
const tabsOf = (doc, ui) => {
    ui.mounts.screen.open();
    return navIds(doc);
};

test('feature on: a three-character party shows the Party tab; character, skills, foes and rules blocks get no tab of their own', async t => {
    const { doc, host, ui } = await page(t, { feature: true });
    await host.send('Begin.', 'Opening.');
    await defineAll(host, party3());
    await host.send('Go.', 'The quay.');
    await settle();
    const ids = tabsOf(doc, ui);
    assert.ok(ids.includes(PARTY));
    for (const slug of ['wessel', 'ren', 'mira', 'wessel-skills', 'ren-skills', 'foes', 'combat-rules']) {
        assert.ok(!ids.includes(BLOCK_TAB(slug)), `${slug}: no tab of its own`);
        assert.equal(ui.screens.resolve(BLOCK_TAB(slug)), null, `${slug}: no screen either`);
    }
    // They stay in Settings → Blocks, each with its role and the RPG's own place (the Show as choice is locked while the RPG is on).
    const win = ui.openSettings();
    win.select('blocks');
    await settle();
    const rows = win.root.querySelectorAll('[data-ss-section="blocks"] .ss-blockrow');
    assert.deepEqual(rows.map(node => node.getAttribute('data-block-row')).sort(), ['combat-rules', 'foes', 'mira', 'ren', 'ren-skills', 'wessel', 'wessel-skills'].map(slug => `pack.chat/${slug}`).sort());
    const row = slug => rows.find(node => node.getAttribute('data-block-row') === `pack.chat/${slug}`);
    assert.equal(row('wessel').querySelector('.ss-blockrow-role').textContent, 'RPG · Character');
    assert.equal(row('wessel-skills').querySelector('.ss-blockrow-role').textContent, 'RPG · Skills');
    assert.equal(row('foes').querySelector('.ss-blockrow-role').textContent, 'RPG · Foes');
    assert.equal(row('foes').querySelector('.ss-blockrow-meta').textContent, 'Shown by the RPG in the Fight tab');
    assert.equal(row('wessel').querySelector('.ss-blockrow-meta').textContent, 'Shown by the RPG in the Party tab');
    assert.equal(row('wessel').querySelector('select').disabled, true);
    assert.equal(win.root.querySelector('[data-ss-section="blocks"] .ss-blocks-count').textContent, '7 blocks in this story · none shown', 'the RPG\'s blocks are not counted as tabs or cards');
});

test('feature off: a block with an RPG role gets no tab (it is only data until the RPG is on); a block with no role keeps its tab', async t => {
    const { doc, host, ui } = await page(t);
    await host.send('Begin.', 'Opening.');
    await defineAll(host, [...party3(), { ...skillsDefinition('notes', 'Notes'), show: { ...TAB, tabName: 'Notes' } }]);
    await host.send('Go.', 'The quay.');
    await settle();
    const ids = tabsOf(doc, ui);
    for (const slug of ['wessel', 'ren', 'mira', 'wessel-skills', 'ren-skills', 'foes', 'combat-rules']) {
        assert.ok(!ids.includes(BLOCK_TAB(slug)), `${slug}: no tab of its own`);
        assert.equal(ui.screens.resolve(BLOCK_TAB(slug)), null, `${slug}: no screen either`);
    }
    assert.ok(ids.includes(BLOCK_TAB('notes')), 'a block with no role keeps its tab');
    assert.ok(!ids.includes(PARTY));
});

test('the tabs follow the switch: the Party tab comes with the RPG, and the role blocks never have tabs of their own', async t => {
    const { doc, host, ui } = await page(t);
    await host.send('Begin.', 'Opening.');
    await defineAll(host, [...party3(), { ...skillsDefinition('notes', 'Notes'), show: { ...TAB, tabName: 'Notes' } }]);
    await host.send('Go.', 'The quay.');
    let ids = tabsOf(doc, ui);
    assert.ok(!ids.includes(BLOCK_TAB('wessel')) && !ids.includes(PARTY));
    host.features.set(CORE_FEATURE.leanRpg, true);
    await settle();
    ids = tabsOf(doc, ui);
    assert.ok(ids.includes(PARTY), 'the RPG on: the Party tab draws the characters');
    assert.ok(!ids.includes(BLOCK_TAB('wessel')) && !ids.includes(BLOCK_TAB('combat-rules')));
    assert.ok(ids.includes(BLOCK_TAB('notes')), 'a block with no role keeps its tab');
    assert.ok(!ids.includes(BLOCK_TAB('foes')), 'Foes: the Fight tab draws it');
    host.features.set(CORE_FEATURE.leanRpg, false);
    await settle();
    ids = tabsOf(doc, ui);
    assert.ok(!ids.includes(PARTY), 'the RPG off: no Party tab');
    for (const slug of ['wessel', 'ren', 'mira', 'wessel-skills', 'ren-skills', 'foes', 'combat-rules']) assert.ok(!ids.includes(BLOCK_TAB(slug)), `${slug}: still no tab`);
    assert.ok(ids.includes(BLOCK_TAB('notes')));
});

const FIGHT = 'story-block/fight';

test('feature off: no Fight tab, and the Foes block has no tab of its own either', async t => {
    const { doc, host, ui } = await page(t);
    await host.send('Begin.', 'Opening.');
    await defineAll(host, party3());
    await setField(host, 'foes', 'foe1', 'Sluice Rat A');
    await host.send('Go.', 'The quay.');
    await settle();
    const ids = tabsOf(doc, ui);
    assert.ok(!ids.includes(FIGHT));
    assert.equal(ui.screens.resolve(FIGHT), null);
    assert.ok(!ids.includes(BLOCK_TAB('foes')));
});
