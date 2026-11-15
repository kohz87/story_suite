import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../packages/story-block/tests/ui-fake-dom.js';
import { characterCard } from '../../../ui/card/character-card.js';
import { fixture } from '../../../ui/fixtures/index.js';

test('the full card shows row, name, level, soak, party, pace, bars, EXP and statuses', () => {
  installFakeDom();
  const el = characterCard(fixture('default').card);
  assert.equal(el.tagName, 'SECTION');
  assert.ok(el.className.includes('hero'));
  assert.ok(!el.className.includes('story-only'));
  assert.equal(el.querySelector('.nm').textContent, 'Astra');
  assert.equal(el.querySelector('.lvl2').textContent, 'Lv 14 · Shadow Blade · Human');
  assert.equal(el.querySelector('.soak').textContent, '11%');
  assert.equal(el.querySelector('.party').textContent, '4/4');
  assert.equal(el.querySelector('.pace').textContent, '20 km/day');
  assert.equal(el.querySelectorAll('.bars3 > div').length, 3);
  assert.ok(el.querySelector('.xpbar'));
  assert.equal(el.querySelectorAll('.fx2 .f').length, 3);
  assert.match(el.querySelector('.fx2').textContent, /Shadow Step/);
});

test('statuses carry their tone and note', () => {
  installFakeDom();
  const el = characterCard(fixture('default').card);
  const flags = el.querySelectorAll('.fx2 .f');
  assert.ok(flags[0].className.includes('buff'));
  assert.ok(flags[1].className.includes('debuff'));
  assert.equal(flags[1].querySelector('small').textContent, '2 h');
  assert.equal(flags[1].dataset.status, 'bleeding');
});

test('the Story-only card has no level, soak, party, bars or EXP', () => {
  installFakeDom();
  const el = characterCard(fixture('rpg-off').card);
  assert.ok(el.className.includes('story-only'));
  assert.equal(el.querySelector('.lvl2'), null);
  assert.equal(el.querySelector('.soak'), null);
  assert.equal(el.querySelector('.party'), null);
  assert.equal(el.querySelector('.bars3'), null);
  assert.equal(el.querySelector('.xpbar'), null);
  assert.equal(el.querySelector('.nm').textContent, 'Astra');
  assert.ok(el.querySelector('.ctop'));
});

test('Story-only keeps pace and statuses when given, drops stats even if present', () => {
  installFakeDom();
  const card = { ...fixture('default').card, rpg: false };
  const el = characterCard(card);
  assert.equal(el.querySelector('.bars3'), null);
  assert.equal(el.querySelector('.soak'), null);
  assert.ok(el.querySelector('.pace'));
  assert.equal(el.querySelectorAll('.fx2 .f').length, 3);
});

test('a slowed pace chip is marked and its reason is the tooltip', () => {
  installFakeDom();
  const base = fixture('default').card;
  const card = { ...base, chips: { ...base.chips, pace: { kmDay: 15, by: 'foot', slowed: true, why: 'Over load' } } };
  const pace = characterCard(card).querySelector('.pace');
  assert.ok(pace.className.includes('slow'));
  assert.equal(pace.getAttribute('title'), 'Over load');
});

test('handlers reach the row and the pace chip', () => {
  installFakeDom();
  const seen = [];
  const el = characterCard(fixture('default').card, {
    onBack: () => seen.push('back'),
    onScene: () => seen.push('scene'),
    onSettings: () => seen.push('settings'),
    onPace: () => seen.push('pace'),
  });
  el.querySelector('.bk').click();
  el.querySelector('.meta').click();
  el.querySelector('.ibtn').click();
  el.querySelector('.pace').click();
  assert.deepEqual(seen, ['back', 'scene', 'settings', 'pace']);
});

test('the portrait falls back to the name initial and never loads from text', () => {
  installFakeDom();
  const card = { rpg: false, scene: {}, you: { portrait: null, name: 'zed' }, chips: {}, statuses: [] };
  const por = characterCard(card).querySelector('.por');
  assert.equal(por.textContent, 'Z');
  assert.equal(por.dataset.portrait, undefined);
  const named = characterCard(fixture('default').card).querySelector('.por');
  assert.equal(named.dataset.portrait, 'astra');
});

test('a card without chips or statuses draws no empty chip row or status row', () => {
  installFakeDom();
  const card = { rpg: false, scene: {}, you: { name: 'Ann' }, chips: {}, statuses: [] };
  const el = characterCard(card);
  assert.equal(el.querySelector('.chips'), null);
  assert.equal(el.querySelector('.fx2'), null);
});

test('the empty-chat variant still draws a card', () => {
  installFakeDom();
  const el = characterCard(fixture('empty').card);
  assert.ok(el.querySelector('.nm').textContent.length > 0);
});

test('names and notes are text, not markup', () => {
  installFakeDom();
  const card = {
    rpg: false, scene: {}, you: { name: '<b>Ann</b>' }, chips: {},
    statuses: [{ id: 'x', label: '<i>L</i>', note: '<u>n</u>', tone: 'buff' }],
  };
  const el = characterCard(card);
  assert.equal(el.querySelector('.nm').textContent, '<b>Ann</b>');
  assert.equal(el.querySelector('.fx2 .tx').textContent, '<i>L</i><u>n</u>');
});
