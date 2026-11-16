// The settings overlay host and the tab host (docs/v2/SPEC.md §6): module folds, values, lists, sections, tabs, field helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../src/v2/registry.js';
import { OPEN_CLASS, createTabHost, emptyValue, readInt, renderSettingsHost } from '../../src/v2/host-ui.js';
import { openSettingsWindow as openSettingsOverlay } from '../../src/v2/view/settings/window.js';
import { change, doc, foldAt, row, rpg, setup } from './host-ui.helpers.js';

test('a fold per module with settings, after the host\'s own; fields render with their stored values', () => {
    const { registry, settings } = setup(rpg(), { id: 'quiet-mod' }, { id: 'aaa', name: 'AAA', settings: { schema: { on: 'bool' } } });
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    assert.deepEqual(root.querySelectorAll('details.story-suite-fold').map(fold => fold.dataset.fold), ['aaa', 'rpg-battle', 'story-suite-versions'], 'Versions last');
    assert.deepEqual(root.querySelectorAll('details.story-suite-fold > summary b').map(node => node.textContent), ['AAA', 'RPG Battle', 'Versions']);
    const hard = row(root, 'rpg-battle', 'hardMode');
    assert.equal(hard.querySelector('b').textContent, 'Hard mode');
    assert.equal(hard.querySelector('small').textContent, 'Foes hit harder.');
    assert.equal(hard.querySelector('input').type, 'checkbox');
    assert.equal(hard.querySelector('input').checked, false);
    assert.equal(row(root, 'rpg-battle', 'level').querySelector('b').textContent, 'Level');
    assert.equal(row(root, 'rpg-battle', 'level').querySelector('input').value, '5');
    assert.equal(row(root, 'rpg-battle', 'level').querySelector('input').min, '1');
    const pace = row(root, 'rpg-battle', 'pace').querySelector('select');
    assert.deepEqual(pace.querySelectorAll('option').map(node => [node.value, node.textContent]), [['slow', 'slow'], ['normal', 'normal'], ['fast', 'Fast!']]);
    assert.equal(pace.value, 'normal');
    assert.equal(row(root, 'rpg-battle', 'title').querySelector('input').value, 'Hero');
    assert.equal(foldAt(root, 'story-suite'), undefined, 'Story Suite\'s own fold is gone: the Tabs & Packs page draws its budgets');
});

test('changes are stored under extension_settings.storySuite.modules[id], ints kept whole and in range', () => {
    const { registry, settings, es, saves } = setup(rpg());
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    const hard = row(root, 'rpg-battle', 'hardMode').querySelector('input');
    hard.checked = true;
    change(hard);
    const level = row(root, 'rpg-battle', 'level').querySelector('input');
    level.value = '99';
    change(level);
    assert.equal(level.value, '30', 'kept inside max');
    level.value = 'many';
    change(level);
    assert.equal(level.value, '30', 'not a number: the stored value is shown again');
    const pace = row(root, 'rpg-battle', 'pace').querySelector('select');
    pace.value = 'fast';
    change(pace);
    const title = row(root, 'rpg-battle', 'title').querySelector('input');
    title.value = 'Wanderer';
    change(title);
    assert.deepEqual(es.storySuite.modules['rpg-battle'], { hardMode: true, level: 30, pace: 'fast', title: 'Wanderer' });
    assert.deepEqual(es.storySuite.host ?? {}, {}, 'the host\'s own settings are not drawn here');
    assert.equal(saves(), 4);
});

test('a list of {…}: a row per item, Add and Remove', () => {
    const { registry, settings, es } = setup(rpg());
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    const list = row(root, 'rpg-battle', 'coins');
    const items = () => list.querySelectorAll('.story-suite-list-item');
    assert.equal(items().length, 1);
    assert.equal(items()[0].querySelector('[data-field="name"] input').value, 'silver');
    list.querySelector('.story-suite-list-add').click();
    assert.equal(items().length, 2);
    assert.deepEqual(es.storySuite.modules['rpg-battle'].coins, [{ name: 'silver', rate: 10 }, { name: '', rate: 1 }]);
    const name = items()[1].querySelector('[data-field="name"] input');
    name.value = 'gold';
    change(name);
    assert.deepEqual(es.storySuite.modules['rpg-battle'].coins[1], { name: 'gold', rate: 1 });
    items()[0].querySelector('.story-suite-list-remove').click();
    assert.deepEqual(es.storySuite.modules['rpg-battle'].coins, [{ name: 'gold', rate: 1 }]);
    assert.equal(items().length, 1);
});

test('a module\'s custom section gets its element and a settings api; one that throws shows a line instead', () => {
    let api = null;
    const { registry, settings, es } = setup(
        { id: 'custom', name: 'Custom', settings: { defaults: { colour: 'blue' }, section(el, given) { api = given; el.textContent = `Colour: ${given.get('colour')}`; } } },
        { id: 'broken', name: 'Broken', settings: { section() { throw new Error('no panel'); } } },
    );
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc, sdk: { marker: true } });
    const section = root.querySelectorAll('.story-suite-section');
    assert.equal(section[1].textContent, 'Colour: blue');
    assert.equal(section[0].textContent, 'This part of Broken\'s settings could not be shown: no panel');
    api.set('colour', 'red');
    assert.equal(es.storySuite.modules.custom.colour, 'red');
    assert.deepEqual(api.values(), { colour: 'red' });
    assert.deepEqual(api.sdk, { marker: true });
});

test('a section given as a title and render(el, api) is drawn right in its module fold, under that title as a heading', () => {
    const { registry, settings, es } = setup({ id: 'rb', name: 'RPG Battle', settings: { section: 'Combat', defaults: { speed: 2 }, render(el, api) { el.textContent = `Speed ${api.get('speed')}`; api.set('speed', 3); } } });
    const root = doc.createElement('div');
    renderSettingsHost(root, { registry, settings, doc });
    const fold = root.querySelectorAll('details.story-suite-fold')[0];
    assert.deepEqual(fold.querySelectorAll(':scope > summary > *').map(node => node.textContent), ['RPG Battle', 'Combat']);
    assert.equal(fold.querySelectorAll('.story-suite-subfold').length, 0, 'no sub-fold for the panel');
    assert.equal(fold.querySelector('.story-suite-section-title').textContent, 'Combat');
    assert.equal(fold.querySelector('.story-suite-section').textContent, 'Speed 2');
    assert.equal(es.storySuite.modules.rb.speed, 3);
});

test('refresh redraws and keeps the open folds open', () => {
    const { registry, settings } = setup(rpg());
    const root = doc.createElement('div');
    const host = renderSettingsHost(root, { registry, settings, doc });
    root.querySelectorAll('details.story-suite-fold')[0].open = true;
    settings.set('rpg-battle', 'title', 'Changed');
    host.refresh();
    const folds = root.querySelectorAll('details.story-suite-fold');
    assert.deepEqual(folds.map(fold => fold.open), [true, false]);
    assert.equal(row(root, 'rpg-battle', 'title').querySelector('input').value, 'Changed');
});

test('the overlay opens on the body, marks it, and closes', () => {
    const { registry, settings } = setup(rpg());
    const overlay = openSettingsOverlay({ registry, settings, doc });
    assert.ok(doc.body.classList.contains(OPEN_CLASS));
    assert.equal(doc.querySelectorAll('#story_suite_v2_overlay').length, 1);
    assert.equal(overlay.root.querySelectorAll('details.story-suite-fold').length, 0, 'the Modules page is the form engine\'s: a card per module and Versions, no fold');
    assert.equal(overlay.root.querySelectorAll('.ss-module-card').length, 1);
    const again = openSettingsOverlay({ registry, settings, doc });
    assert.equal(doc.querySelectorAll('#story_suite_v2_overlay').length, 1, 'opening again replaces it');
    again.root.querySelector('.story-suite-close').click();
    assert.equal(doc.querySelectorAll('#story_suite_v2_overlay').length, 0);
    assert.ok(!doc.body.classList.contains(OPEN_CLASS));
});

test('the tab host: a button per module tab in module-id order, the chosen one rendered from the view', () => {
    const calls = [];
    const tab = (id, title, icon) => ({ id, title, icon, render(el, view, api) { calls.push([id, view.state.n, api.name]); el.textContent = `${title}: ${view.state.n}`; } });
    const { registry } = setup(
        { id: 'zeta', tabs: [tab('z1', 'Zeta', 'fa-z')] },
        { id: 'alpha', tabs: [tab('a1', 'Alpha One', 'fa-a'), tab('a2', 'Alpha <b>Two</b>')] },
        { id: 'broken', tabs: [{ id: 'b1', title: 'Broken', render() { throw new Error('bad tab'); } }] },
    );
    let n = 1;
    const root = doc.createElement('div');
    const host = createTabHost(root, { registry, view: () => ({ state: { n } }), api: { name: 'sdk' }, doc });
    const buttons = () => root.querySelectorAll('.story-suite-tab');
    assert.deepEqual(buttons().map(node => node.dataset.tabId), ['a1', 'a2', 'b1', 'z1']);
    assert.deepEqual(buttons().map(node => node.textContent), ['Alpha One', 'Alpha <b>Two</b>', 'Broken', 'Zeta']);
    assert.equal(buttons()[0].querySelector('i').className, 'ss-screenbar-icon fa-solid fa-a');
    assert.equal(host.active(), 'a1');
    assert.equal(root.querySelector('.story-suite-pane').textContent, 'Alpha One: 1');
    assert.deepEqual(buttons().map(node => node.getAttribute('aria-current')), ['page', null, null, null]);
    buttons()[3].click();
    assert.equal(host.active(), 'z1');
    assert.equal(root.querySelector('.story-suite-pane').textContent, 'Zeta: 1');
    n = 2;
    host.refresh();
    assert.equal(root.querySelector('.story-suite-pane').textContent, 'Zeta: 2');
    assert.deepEqual(calls.at(-1), ['z1', 2, 'sdk']);
    host.select('b1');
    assert.equal(root.querySelector('.story-suite-pane').textContent, 'Broken could not be shown: bad tab');
    // No tabs at all: a quiet line.
    const empty = doc.createElement('div');
    createTabHost(empty, { registry: createRegistry(), view: () => ({}), doc });
    assert.equal(empty.querySelector('.story-suite-pane').textContent, 'No module has a tab yet.');
});

test('field helpers', () => {
    assert.equal(emptyValue('bool'), false);
    assert.equal(emptyValue({ type: 'int', min: 3 }), 3);
    assert.equal(emptyValue(['a', 'b']), 'a');
    assert.deepEqual(emptyValue({ type: 'list', of: { a: 'text' } }), []);
    assert.equal(emptyValue('text'), '');
    assert.equal(readInt(' 7 ', {}), 7);
    assert.equal(readInt('2.6', { max: 2 }), 2);
    assert.equal(readInt('-4', { min: 0 }), 0);
    assert.equal(readInt('', {}), null);
    assert.equal(readInt('x', {}), null);
});
