import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { bagFixture } from '../../../../ui/fixtures/bag.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { BAG_SHAPE } from '../../../../ui/contract/bag.js';
import { purseCard, loadBlock, moneySheet } from '../../../../ui/tabs/bag/purse-load.js';
import { makeCtx } from './helpers.js';

test('Purse shows three coin counts and this turn\'s changes with colour class', () => {
  installFakeDom();
  const card = purseCard(bagFixture(), makeCtx());
  assert.deepEqual(card.querySelectorAll('.coin').map(c => c.textContent), ['2gold', '14silver', '6copper']);
  assert.match(card.querySelector('.last').textContent, /^This turn: \+1 silver guild advance · earlier today −8 copper room at the Gull$/);
  assert.equal(card.querySelectorAll('.last b')[0].classList.contains('up'), true);
  assert.equal(card.querySelectorAll('.last b')[1].classList.contains('up'), false);
});

test('no changes this turn leaves the line out; Story-only has no load block', () => {
  installFakeDom();
  const bag = bagFixture({ rpg: false });
  const card = purseCard({ ...bag, purse: { ...bag.purse, thisTurn: [] } }, {});
  assert.equal(card.querySelector('.last'), null);
  assert.equal(card.querySelector('.load'), null);
  assert.equal(loadBlock(null), null);
});

test('light load: text, value, bar width, marker, no notes', () => {
  installFakeDom();
  const el = loadBlock(bagFixture().load);
  assert.equal(el.querySelector('.lr b').textContent, '149 / 192');
  assert.equal(el.querySelector('.lt').textContent, '43 left before you slow down');
  assert.equal(el.querySelector('.lbar b').style.getPropertyValue('width'), '77.60416666666666%');
  assert.ok(el.querySelector('.mk'));
  assert.equal(el.classList.contains('heavy'), false);
  assert.equal(el.querySelector('.hvy'), null);
  assert.equal(el.querySelectorAll('.src').length, 5);
  assert.equal(el.querySelector('.src').textContent, 'Members 10 + 2×STR each = 112');
});

test('heavy load shows the 80% note; over the limit shows the slow-down note', () => {
  installFakeDom();
  const base = bagFixture().load;
  const heavy = loadBlock({ ...base, value: 160, level: 'heavy' });
  assert.match(heavy.querySelector('.lt').textContent, /^Heavy · 32 left/);
  assert.match(heavy.querySelector('.hvy').textContent, /past 80% of the limit \(154\)/);
  const over = loadBlock(bagFixture({ over: true }).load);
  assert.equal(over.classList.contains('over'), true);
  assert.match(over.querySelector('.lt').textContent, /^Over the limit by 7$/);
  assert.equal(over.querySelector('.ovr').textContent, 'Over the limit by 7. The narrator treats everyone as slowed: −2 to AGI and DEX checks. Drop something to get back under.');
  assert.equal(loadBlock({ ...base, value: 400, level: 'over' }).querySelector('.lbar b').style.getPropertyValue('width'), '100%');
});

test('a line for each member\'s own load, marked heavy or over as the bar is; none without members', () => {
  installFakeDom();
  const base = bagFixture().load;
  assert.equal(loadBlock(base).querySelector('.mloads'), null);
  const people = [
    { id: 'a', name: 'Torka', value: 18, limit: 42, level: 'light' },
    { id: 'b', name: 'Ren', value: 25, limit: 30, level: 'heavy' },
    { id: 'c', name: 'Mara', value: 31, limit: 30, level: 'over' },
  ];
  const lines = loadBlock({ ...base, people }).querySelectorAll('.mload');
  assert.deepEqual(lines.map(line => [line.querySelector('span').textContent, line.querySelector('b').textContent]),
    [['Torka', '18 / 42'], ['Ren · Heavy', '25 / 30'], ['Mara · Over the limit', '31 / 30']]);
  assert.deepEqual(lines.map(line => [line.classList.contains('heavy'), line.classList.contains('over')]), [[false, false], [true, false], [false, true]]);
});

test('the notes say what the narrator is told: the members who are over, else everyone while the bar is over; none while Encumbered is off', () => {
  const base = bagFixture().load;
  const people = [{ id: 'c', name: 'Mara', value: 31, limit: 30, level: 'over' }, { id: 'd', name: 'Pell', value: 25, limit: 30, level: 'heavy' }];
  const notes = load => loadBlock(load).querySelectorAll('.ovr').map(note => note.textContent);
  const mara = 'The narrator treats Mara as slowed: −2 to AGI and DEX checks for them until they put something down.';
  assert.deepEqual(notes({ ...base, level: 'light', people }), [mara]);
  assert.equal(notes({ ...base, level: 'heavy', people }).length, 1);
  assert.deepEqual(notes({ ...base, value: base.limit + 7, level: 'over', people }), [mara], 'the tail names only who is over');
  assert.deepEqual(notes({ ...base, value: base.limit + 7, level: 'over', people, untold: true }), []);
  assert.deepEqual(notes({ ...base, level: 'light', people, untold: true }), []);
});

test('someone who left has their load and no limit; with no name known the line says only that', () => {
  installFakeDom();
  const people = [{ id: 'a', name: 'Torka', value: 21, limit: 0, level: 'light', left: true }, { id: 'b', name: 'Someone who left', value: 3, limit: 0, level: 'light', left: true, unnamed: true }];
  const load = { ...bagFixture().load, people };
  assert.deepEqual(checkShape({ ...bagFixture(), load }, BAG_SHAPE), []);
  assert.deepEqual(loadBlock(load).querySelectorAll('.mload').map(line => [line.querySelector('span').textContent, line.querySelector('b').textContent]),
    [['Torka (left)', '21'], ['Someone who left', '3']]);
});

test('Edit money opens a sheet; Save sends wallet.set with clean whole numbers', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = purseCard(bagFixture(), ctx);
  card.querySelector('.ch button').click();
  assert.equal(ctx.sheets[0][1], 'Edit money');
  const sheet = ctx.sheets[0][0];
  const inputs = sheet.querySelectorAll('input');
  assert.deepEqual(inputs.map(i => i.value), ['2', '14', '6']);
  inputs[0].value = '3.9';
  inputs[1].value = '-5';
  inputs[2].value = 'x';
  sheet.querySelector('.btn2').click();
  assert.deepEqual(ctx.sent, [['wallet.set', { gold: 3, silver: 0, copper: 0 }], ['close']]);
  assert.doesNotThrow(() => moneySheet({ gold: 0, silver: 0, copper: 0 }).querySelector('.btn2').click());
});

test('Prices here opens the rates sheet with one row per price', () => {
  installFakeDom();
  const opened = [];
  const card = purseCard(bagFixture(), { openSheet: (el, label) => opened.push([el, label]) });
  const btn = card.querySelectorAll('button').find(b => b.textContent.startsWith('Prices here'));
  btn.click();
  assert.equal(opened[0][1], 'Prices here');
  assert.equal(opened[0][0].querySelectorAll('.rt').length, 7);
});

test('a single wallet amount (no coin split) shows its words and no money editor', () => {
  installFakeDom();
  const bag = bagFixture({ rpg: false });
  const card = purseCard({ ...bag, purse: { coins: null, words: '40 gold', thisTurn: [], rates: null } }, {});
  assert.deepEqual(card.querySelectorAll('.coin').map(c => c.textContent), ['40 gold']);
  assert.equal(card.querySelector('[aria-label="Edit money"]'), null);
});
