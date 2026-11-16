import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { inlineRow } from '../../../ui/chat/inline-row.js';
import { fixture } from '../../../ui/fixtures/index.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';

test('renders time, place, weather and money from the fixture', () => {
  installFakeDom();
  const vm = fixture('default').chat.inlineRow;
  assert.deepEqual(checkShape(vm, CHAT_SHAPE.inlineRow), []);
  const row = inlineRow(vm);
  assert.match(row.textContent, /9:30 am/);
  assert.match(row.textContent, /Guild Office/);
  assert.match(row.textContent, /cold drizzle/);
  assert.match(row.textContent, /2g 14s 6c/);
  assert.equal(row.querySelectorAll('.ssl1').length, 1);
});

test('Suite button shows the count, a dot when not applied, and opens Now', () => {
  installFakeDom();
  let opened = null;
  const row = inlineRow({ date: 'D', time: 't', place: 'p', changes: 3, notApplied: 1 }, { onOpenSuite: tab => { opened = tab; } });
  const btn = row.querySelector('button.ssbtn');
  assert.match(btn.getAttribute('aria-label'), /3 changes.*1 not applied/);
  assert.equal(btn.querySelectorAll('.wd').length, 1);
  btn.click();
  assert.equal(opened, 'now');
  const quiet = inlineRow({ changes: 0, notApplied: 0 });
  assert.equal(quiet.querySelectorAll('.wd').length, 0);
  assert.equal(quiet.querySelectorAll('.n').length, 0);
});

test('Needs you chip appears only when n > 0 and fires its handler', () => {
  installFakeDom();
  let hit = 0;
  const row = inlineRow({ needsYou: { n: 2, title: 'Needs your action: x' } }, { onNeedsYou: () => { hit += 1; } });
  const need = row.querySelector('.need');
  assert.equal(need.getAttribute('title'), 'Needs your action: x');
  assert.match(need.textContent, /Needs you 2/);
  need.click();
  assert.equal(hit, 1);
  assert.equal(inlineRow({ needsYou: { n: 0, title: '' } }).querySelectorAll('.need').length, 0);
  assert.equal(inlineRow({ needsYou: null }).querySelectorAll('.need').length, 0);
});

test('fight chip shows only while a fight is open', () => {
  installFakeDom();
  let hit = 0;
  const open = inlineRow(fixture('fightOpen').chat.inlineRow, { onFight: () => { hit += 1; } });
  const fight = open.querySelector('.fight');
  assert.ok(fight);
  assert.ok(open.classList.contains('fo'));
  fight.click();
  assert.equal(hit, 1);
  assert.equal(inlineRow(fixture('default').chat.inlineRow).querySelectorAll('.fight').length, 0);
});

test('choices toggle open and send the picked text', () => {
  installFakeDom();
  const picked = [];
  const row = inlineRow({ choices: ['Ask Temiwa', 'Take the river path'] }, { onChoice: t => picked.push(t) });
  const chip = row.querySelector('[data-ch]');
  const list = row.querySelector('.chlist');
  assert.equal(list.hasAttribute('hidden'), true);
  chip.click();
  assert.equal(list.hasAttribute('hidden'), false);
  assert.equal(chip.getAttribute('aria-expanded'), 'true');
  list.children[1].click();
  assert.deepEqual(picked, ['Take the river path']);
  chip.click();
  assert.equal(list.hasAttribute('hidden'), true);
  assert.equal(inlineRow({ choices: [] }).querySelectorAll('[data-ch]').length, 0);
});

test('missing pieces are left out and markup is plain text', () => {
  installFakeDom();
  const row = inlineRow({ date: 'D', time: '<b>9</b>', place: '', weather: null, money: null });
  assert.equal(row.querySelectorAll('b').length, 0);
  assert.match(row.textContent, /<b>9<\/b>/);
  assert.equal(row.querySelectorAll('.ms').length, 0);
  assert.equal(inlineRow(undefined).querySelectorAll('.ssbtn').length, 1);
});
