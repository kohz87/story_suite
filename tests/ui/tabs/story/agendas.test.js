import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { buildStory } from '../../../../ui/fixtures/story.js';
import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { agendasCard } from '../../../../ui/tabs/story/agendas.js';
import { makeCtx } from './helpers.js';

test('agendas hidden: count only, no names', () => {
  installFakeDom();
  const card = agendasCard(buildStory().agendas, false, makeCtx());
  assert.match(card.textContent, /7 agendas · closest to you first/);
  assert.match(card.textContent, /7 agendas are hidden/);
  assert.equal(card.textContent.includes('Torka'), false);
});

test('shown: five rows in the given order, then Show all, remembered on the device', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = agendasCard(buildStory({ planShown: true }).agendas, true, ctx);
  const rows = () => card.querySelectorAll('.it2');
  assert.deepEqual(rows().map(r => r.dataset.agenda).slice(0, 2), ['The hunt for Torka', 'Torka’s deed-hunt']);
  assert.equal(rows().length, 5);
  assert.equal(card.querySelector('.more-btn').textContent, 'Show all (7)');
  card.querySelector('.more-btn').click();
  assert.equal(card.querySelector('.more-btn').textContent, 'Show fewer');
  assert.equal(rows().length, 7);
  assert.equal(ctx.prefs.getFold('story.agendas.all'), true);
  assert.equal(agendasCard(buildStory({ planShown: true }).agendas, true, ctx).querySelectorAll('.it2').length, 7);
});

test('row shows told tag, step, progress bar, why, place and next; a named person links to People', () => {
  installFakeDom();
  const ctx = makeCtx();
  const card = agendasCard(buildStory({ planShown: true }).agendas, true, ctx);
  const rows = card.querySelectorAll('.it2');
  assert.match(rows[0].textContent, /told this reply/);
  assert.match(rows[0].textContent, /step 1 of 3/);
  assert.match(rows[0].textContent, /heading your way/);
  assert.match(rows[0].textContent, /next: reach Bluewatch/);
  assert.equal(rows[0].querySelector('a'), null);
  assert.equal(rows[1].querySelector('.agbar b').style.getPropertyValue('width'), '50%');
  rows[1].querySelector('a').click();
  assert.deepEqual(ctx.calls.go, [['people', { personId: 'torka' }]]);
});

test('no agendas gives no card; a bad step total gives a zero bar', () => {
  installFakeDom();
  assert.equal(agendasCard({ count: 0, items: [] }, true), null);
  assert.equal(agendasCard(undefined, true), null);
  const one = { count: 1, items: [{ title: 'x', who: 'w', whoId: null, text: 't', step: 1, of: 0, since: 's', place: 'p', next: 'n', why: 'y', toldThisReply: false }] };
  const card = agendasCard(one, true);
  assert.match(card.textContent, /1 agenda ·/);
  assert.equal(card.querySelector('.agbar b').style.getPropertyValue('width'), '0%');
  assert.equal(card.querySelector('.told'), null);
});
