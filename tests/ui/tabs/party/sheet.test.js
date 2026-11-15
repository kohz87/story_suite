import test from 'node:test';
import assert from 'node:assert/strict';
import { memberSheet, statSheet, moreSheet } from '../../../../ui/tabs/party/sheet.js';
import { makeCtx, flush, commands, sheetEl } from './helpers.js';

const member = (ctx, id) => ctx.party.members.find(m => m.id === id);

test('a companion sheet has name, ⋯, line, soak, bars, XP, doll, stats and skills in that order', () => {
  const ctx = makeCtx();
  const el = memberSheet(member(ctx, 'brann'), ctx);
  assert.equal(el.dataset.member, 'brann');
  assert.equal(el.querySelector('.shtop .nm').textContent, 'Brann');
  assert.equal(el.querySelector('.shtop .ibtn').getAttribute('aria-label'), 'More for Brann');
  assert.equal(el.querySelector('.lvl2').textContent, 'Lv 9 · Shield of the party · Half-orc');
  assert.equal(el.querySelector('.chip2').textContent, '17%');
  assert.equal(el.querySelector('.chip2').getAttribute('title'), 'VIT 12% + gear points');
  assert.deepEqual(el.querySelectorAll('.bars3 > div').map(d => d.dataset.kind), ['hp', 'mp', 'sp']);
  assert.equal(el.querySelector('.xp2').textContent, 'XP15/100');
  assert.equal(el.querySelector('.xp2 b').style.getPropertyValue('width'), '15%');
  assert.equal(el.querySelector('.fx2 .f.buff b').textContent, 'Shield wall');
  assert.equal(el.querySelectorAll('.slot').length, 10);
  assert.equal(el.querySelectorAll('.sv').length, 7);
  assert.equal(el.querySelectorAll('.sk').length, 3);
  assert.equal(el.querySelector('.awn'), null);
});

test('the player sheet skips name, bars and XP and starts at the equipment', () => {
  const ctx = makeCtx();
  const el = memberSheet(member(ctx, 'astra'), ctx, { pc: true });
  assert.equal(el.querySelector('.shead'), null);
  assert.equal(el.querySelector('.bars3'), null);
  assert.equal(el.querySelector('.xp2'), null);
  assert.equal(el.children[0].className, 'sgrid');
  assert.equal(el.querySelector('.secl .pts').textContent, '1 point to spend');
  assert.equal(el.querySelectorAll('.sv.can').length, 7);
});

test('an away companion shows where and when they were last seen; no points means plain tiles', () => {
  const ctx = makeCtx();
  const el = memberSheet(member(ctx, 'rika'), ctx);
  assert.match(el.querySelector('.awn').textContent, /^At the Bluewatch stables with the horses · last seen 8:00 am\. Still in the party/);
  assert.equal(el.querySelector('.pts'), null);
  assert.equal(el.querySelectorAll('.sv.can').length, 0);
  assert.equal(el.querySelector('.fx2'), null);
});

test('⋯ opens the menu and each entry sends one party command for that member', async () => {
  const ctx = makeCtx();
  const el = memberSheet(member(ctx, 'torka'), ctx);
  el.querySelector('[data-more]').click();
  assert.equal(sheetEl().querySelector('.ps-n').textContent, 'Torka');
  assert.deepEqual(sheetEl().querySelectorAll('.ps-menu .ps-b').map(b => b.textContent), ['Bench Torka', 'Export Torka', 'Torka leaves the party']);
  assert.equal(sheetEl().querySelector('.ps-b.bad').dataset.act, 'party.leave');
  sheetEl().querySelector('[data-act="party.bench"]').click();
  await flush();
  assert.equal(sheetEl(), null);
  moreSheet(member(ctx, 'torka'), ctx);
  sheetEl().querySelector('[data-act="party.export"]').click();
  await flush();
  moreSheet(member(ctx, 'torka'), ctx);
  sheetEl().querySelector('[data-act="party.leave"]').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [
    ['party.bench', { member: 'torka' }], ['party.export', { member: 'torka' }], ['party.leave', { member: 'torka' }],
  ]);
});

test('tapping a stat tile opens the stat sheet', () => {
  const ctx = makeCtx();
  memberSheet(member(ctx, 'astra'), ctx, { pc: true }).querySelector('[data-stat="DEX"]').click();
  assert.match(sheetEl().querySelector('.ps-n').textContent, /Astra · Stats/);
});

test('stat sheet stages points, previews pools from Combat Rules v1, then Save sends the spend', async () => {
  const ctx = makeCtx();
  const astra = { ...member(ctx, 'astra'), stats: { STR: 6, DEX: 12, AGI: 12, VIT: 11, INT: 5, WIS: 6, CHA: 5 } };
  statSheet(astra, ctx);
  const q = s => sheetEl().querySelector(s);
  const off = s => q(s).hasAttribute('disabled');
  assert.equal(q('.ps-s').textContent, '1 point to spend');
  assert.equal(off('[data-save]'), true);
  assert.equal(off('[data-reset]'), true);
  assert.equal(off('[data-minus="STR"]'), true);
  assert.equal(sheetEl().querySelectorAll('.ps-st').length, 7);
  assert.equal(q('.ps-pv').textContent, 'Health14Mana13Stamina15');
  q('[data-plus="VIT"]').click();
  assert.equal(q('[data-stat="VIT"] .v').textContent, '12');
  assert.equal(q('[data-stat="VIT"] .v').classList.contains('up'), true);
  assert.equal(q('.ps-s').textContent, 'All points placed');
  assert.equal(off('[data-plus="STR"]'), true);
  assert.equal(q('.ps-pv').textContent, 'Health14 → 15Mana13Stamina15');
  assert.equal(off('[data-save]'), false);
  q('[data-minus="VIT"]').click();
  assert.equal(q('.ps-s').textContent, '1 point to spend');
  q('[data-plus="INT"]').click();
  q('[data-reset]').click();
  assert.equal(q('[data-stat="INT"] .v').textContent, '5');
  q('[data-plus="INT"]').click();
  assert.equal(q('.ps-pv').textContent, 'Health14Mana13 → 14Stamina15');
  q('[data-save]').click();
  await flush();
  assert.deepEqual(commands(ctx.port), [['rpg.stats.spend', { member: 'astra', stats: { STR: 6, DEX: 12, AGI: 12, VIT: 11, INT: 6, WIS: 6, CHA: 5 } }]]);
  assert.equal(sheetEl(), null);
  assert.equal(astra.stats.INT, 5);
});

test('stat sheet with no points says so and keeps every button off', () => {
  const ctx = makeCtx();
  statSheet(member(ctx, 'brann'), ctx);
  assert.equal(sheetEl().querySelector('.ps-s').textContent, 'No points to spend');
  assert.equal(sheetEl().querySelectorAll('.ps-st .ps-b').filter(b => !b.hasAttribute('disabled')).length, 0);
});
