import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { buildJournal } from '../../../../ui/fixtures/journal.js';
import { comingUp } from '../../../../ui/tabs/journal/coming-up.js';

test('rows are grouped overdue first with date, kind and relative words', () => {
  installFakeDom();
  const card = comingUp(buildJournal());
  assert.equal(card.querySelector('h3').textContent, 'Coming up');
  assert.deepEqual(card.querySelectorAll('.ugrp').map(g => g.textContent), ['Overdue', 'Tomorrow', 'This week', 'Later this month']);
  const rows = card.querySelectorAll('.up');
  assert.equal(rows.length, 5);
  assert.equal(rows[0].querySelector('b').textContent, 'Brann’s smith bill');
  assert.match(rows[0].querySelector('small').textContent, /Goldwane 12 · quest due/);
  assert.equal(rows[0].querySelector('.rel').textContent, '1 day late');
  assert.equal(rows[0].querySelector('.rel').classList.contains('late'), true);
  assert.equal(/\d:\d\d/.test(card.textContent), false);
});

test('a later row in another month turns the group label into Later', () => {
  installFakeDom();
  const j = buildJournal();
  j.upcoming.at(-1).month = 7;
  assert.equal(comingUp(j).querySelectorAll('.ugrp').at(-1).textContent, 'Later');
});

test('tapping a row picks its day', () => {
  installFakeDom();
  const picked = [];
  const card = comingUp(buildJournal(), { onPick: (m, d) => picked.push([m, d]) });
  card.querySelectorAll('.up')[1].click();
  assert.deepEqual(picked, [[6, 14]]);
  comingUp(buildJournal()).querySelector('.up').click();
});

test('empty or missing upcoming gives no card', () => {
  installFakeDom();
  assert.equal(comingUp({ upcoming: [] }), null);
  assert.equal(comingUp(undefined), null);
  assert.equal(comingUp(buildJournal({ empty: true })), null);
});
