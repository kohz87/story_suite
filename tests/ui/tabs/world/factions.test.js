import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { factionsCard, emblemFor } from '../../../../ui/tabs/world/factions.js';

function setup() {
  const w = worldFor();
  const log = { goto: [], views: [], people: [], edits: [] };
  const act = {
    placeName: id => w.places.find(p => p.id === id)?.name ?? null,
    gotoPlace: id => log.goto.push(id), setView: v => log.views.push(v),
    openPerson: id => log.people.push(id), edit: t => log.edits.push(t),
  };
  return { card: factionsCard(w.factions, w.news, act), log, w, act };
}

test('emblemFor: known ids keep their emblem, others take a stable fallback by position', () => {
  assert.deepEqual(emblemFor('guild'), ['guild', '#3d7be0']);
  assert.deepEqual(emblemFor('men-in-grey', 4), ['mask', '#6b7280']);
  assert.deepEqual(emblemFor('new-one', 1), emblemFor('other', 1));
  assert.deepEqual(emblemFor('new-one', 1), ['sail', '#2fa39a']);
  assert.deepEqual(emblemFor('x', 6), emblemFor('y', 1));
  assert.deepEqual(emblemFor('x', -1), emblemFor('y', 1));
  assert.equal(emblemFor('x').length, 2);
});

test('factions card lists five factions with stance words, summaries and an emblem tile each', () => {
  installFakeDom();
  const { card } = setup();
  assert.equal(card.dataset.card, 'factions');
  assert.equal(card.querySelector('.cnt').textContent, '5 known');
  const rows = card.querySelectorAll('.fac');
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(r => r.querySelector('.stn').textContent), ['friendly', 'warm', 'neutral', 'unfriendly', 'hostile']);
  assert.ok(rows[4].querySelector('.stn').classList.contains('hostile'));
  assert.equal(rows[0].querySelector('.fh b').textContent, 'Bluewatch Guild');
  assert.equal(rows[0].querySelector('p').textContent, 'The adventurers’ guild of the Salt Coast; holds your writ.');
  assert.ok(rows.every(r => r.querySelector('.emb svg')));
  assert.equal(rows[0].querySelector('.emb').style.getPropertyValue('background'), '#3d7be0');
});

test('area, members and latest event show as links; people without an id are plain initials or a group glyph', () => {
  installFakeDom();
  const { card } = setup();
  const guild = card.querySelector('[data-faction="guild"]');
  assert.match(guild.querySelector('.fl').textContent, /📍 Bluewatch/);
  assert.match(guild.querySelector('.fl').textContent, /Oyla, Brann/);
  assert.match(guild.querySelector('.fl').textContent, /✦ Raids on the frontier road/);
  const avs = guild.querySelectorAll('.avs .a');
  assert.equal(avs.length, 2);
  assert.equal(avs[0].tagName.toLowerCase(), 'span');
  assert.equal(avs[0].textContent, 'O');
  assert.equal(avs[1].tagName.toLowerCase(), 'button');
  const council = card.querySelector('[data-faction="council"]');
  assert.ok(council.querySelector('.avs .a svg'));
  const redCord = card.querySelector('[data-faction="red-cord"]');
  assert.equal(redCord.querySelector('.avs'), null);
  assert.equal(redCord.textContent.includes('✦'), false);
});

test('links call back: place, member, latest event and Edit', () => {
  installFakeDom();
  const { card, log } = setup();
  const guild = card.querySelector('[data-faction="guild"]');
  const e = guild.querySelector('[data-goto="bluewatch"]').dispatch('click');
  assert.equal(e.defaultPrevented, true);
  guild.querySelector('[data-person-id="brann"]').click();
  guild.querySelector('[data-wf="news"]').click();
  guild.querySelector('.ed').click();
  assert.deepEqual(log.goto, ['bluewatch']);
  assert.deepEqual(log.people, ['brann']);
  assert.deepEqual(log.views, ['news']);
  assert.deepEqual(log.edits, [{ kind: 'faction', id: 'guild' }]);
  assert.equal(guild.querySelector('.ed').getAttribute('aria-label'), 'Edit Bluewatch Guild');
});

test('an area place the map does not know is left out; no factions gives no card', () => {
  installFakeDom();
  const { w, act } = setup();
  const card = factionsCard([{ ...w.factions[0], areaPlaceIds: ['ghost'], members: [] }], [], act);
  assert.equal(card.textContent.includes('📍'), false);
  assert.equal(factionsCard([], [], act), null);
  assert.equal(factionsCard(undefined, undefined, act), null);
});
