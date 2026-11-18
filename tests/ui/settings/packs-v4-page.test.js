// Pack format 4, job S1: Settings › Packs (the World and Game pickers, the suggestion card, the pair's lines, the worlds and games, the add-ons) and the Start rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchRows } from '../../../ui/settings/search.js';
import { store, world, game, suggesting, months, mountPacks } from './packs-v4-helpers.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const ERS = game('ersveil-game', 'Ersveil rules', { you: { rank: { label: 'Guild rank' } }, currency: { name: 'copper', coins: [{ name: 'copper', value: 1 }] }, start: { money: 40 } });
const TIDE = game('tidewatch', 'Tidewatch rules', { calendar: { months: months(8) } });
const ADDON = { id: 'standing', format: 4, kind: 'game', version: '3.0.0', name: 'Faction standing', requires: { suite: '^0.1', capabilities: ['data-modules-v1'] }, content: { dataModules: [{ slug: 'standing', name: 'Standing', schema: 1, stateVersion: 1, scope: 'chat', kinds: {}, state: { a: { type: 'int', min: 0, max: 5, default: 0 } } }] } };

const groups = el => el.querySelectorAll('.sgrp').map(g => g.querySelector('.gt')?.textContent);
const texts = (el, sel) => el.querySelectorAll(sel).map(node => node.textContent);
const buttons = el => texts(el, 'button');

test('the page order: World and game, worlds and games, add-ons, data modules, trackers', async () => {
    const { page } = mountPacks(await store(world(), ERS, TIDE, ADDON));
    assert.deepEqual(groups(page('packs')), ['World and game', 'Worlds and games · 3 installed', 'Add-on packs · always on', 'Data modules in this chat', 'Trackers in this chat · 0 of 28']);
});

test('the Game picker offers Built-in and the game packs, never an add-on; the World picker offers None and the worlds', async () => {
    const { page } = mountPacks(await store(world(), ERS, ADDON));
    const el = page('packs');
    assert.deepEqual(texts(el.querySelector('#pk-game'), 'option'), ['Built-in', 'Ersveil rules · 1.0.0']);
    assert.deepEqual(texts(el.querySelector('#pk-world'), 'option'), ['None', 'Ersveil · 4.0.0']);
    assert.equal(el.querySelector('.srow .always').textContent, 'always on');
    assert.equal(el.querySelectorAll('.tg2').map(t => t.textContent).filter(t => t === 'add-on').length, 1);
});

test('no per-pack switch on a format 4 page', async () => {
    const { page } = mountPacks(await store(world(), ERS));
    const el = page('packs');
    const rows = el.querySelectorAll('.sgrp')[1];
    assert.equal(rows.querySelectorAll('[role="switch"]').length, 0);
    assert.deepEqual(texts(rows, '.tg2'), ['world', 'game']);
});

test('the suggestion card: installed (Use it / Keep mine), not installed (Keep mine only), none once the game is the suggested one', async () => {
    let el = mountPacks(await store(suggesting('ersveil-game'), ERS, TIDE)).page('packs');
    assert.equal(el.querySelector('.cfm.rec'), null, 'the first game installed is selected: Ersveil rules is in use, nothing to suggest');
    const installed = await store(suggesting('ersveil-game'), TIDE, ERS);
    await installed.select('game', 'tidewatch');
    const picked = mountPacks(installed);
    el = picked.page('packs');
    assert.equal(el.querySelector('.cfm.rec b').textContent, 'This world suggests Ersveil rules');
    assert.deepEqual(buttons(el.querySelector('.cfm.rec')), ['Use it', 'Keep mine']);
    const missing = mountPacks(await store(suggesting('ersveil-game'), TIDE));
    el = missing.page('packs');
    assert.match(el.querySelector('.cfm.rec small').textContent, /^It is not installed\. Import it to use it; Ersveil plays with any game\.$/);
    assert.deepEqual(buttons(el.querySelector('.cfm.rec')), ['Keep mine']);
});

test('Use it picks the suggested game through the store; the card goes and the pair is read again', async () => {
    const installed = await store(suggesting('ersveil-game'), TIDE, ERS);
    await installed.select('game', 'tidewatch');
    const { page, sent, ov } = mountPacks(installed);
    page('packs').querySelector('.cfm.rec .pri').click();
    await tick();
    assert.deepEqual(sent.filter(s => s[0] === 'c'), [['c', 'packs.on.ersveil-game', true]]);
    assert.deepEqual(installed.selected(), { world: 'ersveil', game: 'ersveil-game' });
    const el = ov.el.querySelector('.spage');
    assert.equal(el.querySelector('.cfm.rec'), null);
    assert.equal(el.querySelector('#pk-game').querySelectorAll('option').find(o => o.getAttribute('selected') !== null)?.textContent, 'Ersveil rules · 1.0.0');
});

test('Keep mine hides the card and adds the muted "suggests" line; the problem lines stay; another world asks again', async () => {
    const installed = await store(suggesting('ersveil-game'), TIDE, ERS);
    await installed.select('game', 'tidewatch');
    const { page, ov } = mountPacks(installed);
    const lines = () => texts(ov.el.querySelector('.spage'), '.srow.wide small');
    page('packs');
    assert.ok(lines().some(t => t.startsWith('✕ Start date: Tidewatch rules has no month 10')));
    ov.el.querySelector('.spage .cfm.rec').querySelectorAll('button').find(b => b.textContent === 'Keep mine').click();
    const el = ov.el.querySelector('.spage');
    assert.equal(el.querySelector('.cfm.rec'), null);
    assert.ok(lines().includes('i Ersveil suggests Ersveil rules.'));
    assert.ok(lines().includes('Play goes on: only these parts are switched off. Each is also listed in Problems.'));
});

test('Keep mine is for that world: another world that suggests a game asks again', async () => {
    const other = { ...suggesting('ersveil-game'), id: 'tidewood', name: 'Tidewood' };
    const installed = await store(suggesting('ersveil-game'), other, TIDE, ERS);
    await installed.select('game', 'tidewatch');
    const { page, ov } = mountPacks(installed);
    page('packs');
    ov.el.querySelector('.spage .cfm.rec').querySelectorAll('button').find(b => b.textContent === 'Keep mine').click();
    assert.equal(ov.el.querySelector('.spage .cfm.rec'), null);
    const sel = ov.el.querySelector('#pk-world'); sel.value = 'tidewood'; sel.dispatch('change');
    await tick();
    assert.equal(ov.el.querySelector('.spage .cfm.rec b').textContent, 'This world suggests Ersveil rules');
});

test('World: None says so and shows no pairing lines; a pair that fits says nothing is switched off', async () => {
    const fits = mountPacks(await store(world(), ERS));
    assert.deepEqual(texts(fits.page('packs'), '.srow.wide small')[0], 'i Ersveil and Ersveil rules fit: nothing is switched off.');
    const installed = await store(world(), TIDE);
    await installed.select('world', null);
    const none = mountPacks(installed).page('packs');
    assert.deepEqual(texts(none, '.srow.wide small').filter(text => !text.startsWith('A tracker')), ['i No world: the story makes up places and people as it goes.'], 'the pairing lines (the trackers row has its own)');
    assert.equal(none.querySelector('.cfm.rec'), null);
});

test('the pickers are switches: a world or game picked is turned on, None and Built-in turn the one in use off', async () => {
    const installed = await store(world(), ERS, TIDE);
    const { page, sent, ov } = mountPacks(installed);
    const set = (id, value) => { const sel = ov.el.querySelector(`#${id}`); sel.value = value; sel.dispatch('change'); };
    page('packs');
    set('pk-game', 'tidewatch'); await tick();
    assert.equal(installed.selected().game, 'tidewatch');
    set('pk-game', ''); await tick();
    assert.equal(installed.selected().game, null, 'Built-in');
    set('pk-world', ''); await tick();
    assert.equal(installed.selected().world, null, 'None');
    set('pk-world', ''); await tick();
    assert.deepEqual(sent.filter(s => s[0] === 'c').map(s => [s[1], s[2]]), [['packs.on.tidewatch', true], ['packs.on.tidewatch', false], ['packs.on.ersveil', false]], 'nothing in use: nothing sent');
});

test('Remove asks first, for the one pack: the question names it, Keep it closes it, Remove takes it out and the list is read again', async () => {
    const installed = await store(world(), ERS, TIDE);
    const { page, ov } = mountPacks(installed);
    const rows = () => ov.el.querySelector('.spage').querySelectorAll('.sgrp')[1];
    page('packs');
    rows().querySelectorAll('.srow')[1].querySelector('.dng').click();
    assert.equal(rows().querySelectorAll('.cfm').length, 1);
    assert.equal(rows().querySelector('.cfm b').textContent, 'Remove Ersveil rules?');
    rows().querySelector('.cfm').querySelectorAll('button').find(b => b.textContent === 'Keep it').click();
    assert.equal(rows().querySelectorAll('.cfm').length, 0);
    rows().querySelectorAll('.srow')[2].querySelector('.dng').click();
    rows().querySelector('.cfm .dng').click();
    await tick(); await tick();
    assert.deepEqual(installed.list().map(p => p.id), ['ersveil', 'ersveil-game']);
    assert.equal(rows().querySelectorAll('.cfm').length, 0);
});

test('a page with no format 4 pack is the format 3 page: no pickers, the old Packs group', async () => {
    const { page } = mountPacks(await store());
    const el = page('packs');
    assert.deepEqual(groups(el), ['Packs', 'Data modules in this chat', 'Trackers in this chat · 0 of 28']);
    assert.equal(el.querySelector('#pk-game'), null);
});

test('Start: "You and your start" comes after Reset to Standard and before Gone (decided); Rank label is found by search; no group without a format 4 pack', async () => {
    const { page, settings } = mountPacks(await store(world(), ERS));
    assert.deepEqual(searchRows(settings.sections, 'rank').map(hit => [hit.section.id, hit.row.label]), [['start', 'Rank label']]);
    assert.deepEqual(searchRows(settings.sections, 'starting money').map(hit => hit.row.label), ['Starting money']);
    const el = page('start');
    const gs = groups(el).filter(Boolean);
    assert.deepEqual(gs.slice(-2), ['You and your start', 'Gone (decided)']);
    const order = el.childNodes.map(n => n.textContent.slice(0, 20));
    assert.ok(order.findIndex(t => t.startsWith('Reset to Standard')) < order.findIndex(t => t.startsWith('You and your start')));
    const rows = el.querySelectorAll('.srow').filter(r => ['Rank label', 'Starting money', 'Starting items'].includes(r.querySelector('b')?.textContent));
    assert.equal(rows.length, 3);
    assert.match(rows[0].querySelector('small').textContent, /Blank: the game pack’s \(Ersveil rules: Guild rank\)$/);
    assert.match(rows[1].querySelector('small').textContent, /^For new chats, in the smallest coin. Blank: the game pack’s \(Ersveil rules: 40 copper\)$/);
    assert.match(rows[2].querySelector('small').textContent, /your list replaces the game pack’s \(Ersveil rules: none\)$/);
    const plain = mountPacks(await store()).page('start');
    assert.ok(!groups(plain).includes('You and your start'));
});

test('the Start rows write through the store: label, money and the items list; a bad money is refused and the old one stays; the hints follow a new game', async () => {
    const installed = await store(world(), ERS, TIDE);
    const { page, ov } = mountPacks(installed);
    page('start');
    const mountedRead = () => ov.show('start');
    const row = name => ov.el.querySelector('.spage').querySelectorAll('.srow').find(r => r.querySelector('b')?.textContent === name);
    const type = (input, value) => { input.value = value; input.dispatch('change'); };
    type(row('Rank label').querySelector('input'), 'Standing'); await tick();
    type(row('Starting money').querySelector('input'), '12'); await tick();
    row('Starting items').querySelector('button').click();
    type(row('Starting items').querySelector('textarea'), 'Rope x2\nLantern'); await tick();
    assert.deepEqual(installed.own.read(), { rankLabel: 'Standing', money: 12, items: [{ name: 'Rope', qty: 2 }, { name: 'Lantern', qty: 1 }] });
    type(row('Starting money').querySelector('input'), '1.5'); await tick();
    assert.equal(installed.own.read().money, 12);
    ov.show('packs');
    const sel = ov.el.querySelector('#pk-game'); sel.value = 'tidewatch'; sel.dispatch('change');
    await tick(); mountedRead();
    assert.match(row('Rank label').querySelector('small').textContent, /Blank: the game pack’s \(Tidewatch rules: no rank\)$/);
});
