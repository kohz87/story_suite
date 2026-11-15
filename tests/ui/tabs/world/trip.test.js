import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { timeWords, tripSummary, tripCard } from '../../../../ui/tabs/world/trip.js';

test('timeWords: hours and minutes inside a travel day', () => {
  assert.equal(timeWords(30), '30 minutes');
  assert.equal(timeWords(60), '1 hour');
  assert.equal(timeWords(72), '1 hour 12 minutes');
  assert.equal(timeWords(8 * 60), '8 hours');
  assert.equal(timeWords(0), '0 minutes');
  assert.equal(timeWords(undefined), '0 minutes');
});

test('timeWords: 8-hour travel days, no half-day rounding, nights on the road', () => {
  assert.equal(timeWords(8 * 60 + 1), '1 day · night on the road');
  assert.equal(timeWords(16 * 60), '2 days · night on the road');
  assert.equal(timeWords(20 * 60), '2 days and 4 hours · 2 nights on the road');
  assert.equal(timeWords(24 * 60), '3 days · 2 nights on the road');
});

test('trip card: planned trip lists legs, clock arrivals and 0 of N km', () => {
  installFakeDom();
  const card = tripCard(worldFor().trip);
  assert.equal(card.dataset.card, 'trip');
  assert.equal(card.querySelector('.th b').textContent, 'Trip to Auvoth');
  assert.equal(card.querySelector('.th small').textContent, 'planned · not set out');
  assert.equal(card.querySelector('.last').textContent, 'Leave about 10:00 am, when the guild business is done · on foot, 20 km a day · arrive Auvoth, Goldwane 13, 3:18 pm');
  assert.equal(card.querySelector('.tbar small').textContent, '0 of 12 km');
  const legs = card.querySelectorAll('.leg');
  assert.equal(legs.length, 3);
  assert.deepEqual(legs.map(l => l.querySelector('.eta').textContent), ['10:30 am', '11:42 am', '3:18 pm']);
  assert.equal(legs[1].querySelector('small').textContent, '3 km · 1 hour 12 minutes · road');
  assert.equal(legs[2].querySelector('small').textContent, '9 km · 3 hours 36 minutes · road, risky');
  assert.equal(legs[0].querySelector('small').textContent, '30 minutes · a short walk in town');
  assert.equal(card.querySelector('.cur'), null);
});

test('trip card: on the road marks done and current legs and shows progress', () => {
  installFakeDom();
  const card = tripCard(worldFor('fightOpen').trip, { side: true });
  assert.ok(card.className.includes('side'));
  assert.equal(card.querySelector('.th small').textContent, 'on the road · leg 3 of 3');
  assert.equal(card.querySelectorAll('.leg.done').length, 2);
  assert.equal(card.querySelector('.leg.cur .eta').textContent, 'now');
  assert.equal(card.querySelector('.leg.done .eta').textContent, 'done');
  assert.equal(card.querySelector('.last').textContent.startsWith('Set out about 10:00 am'), true);
  const pct = card.querySelector('.tbar').getAttribute('aria-label');
  assert.match(pct, /^Trip progress \d+%$/);
  assert.match(card.querySelector('.tbar small').textContent, /% done$/);
});

test('trip card: arrived trip is all done; an unparseable leave falls back to elapsed words', () => {
  installFakeDom();
  const trip = { ...worldFor().trip, state: 'arrived' };
  const done = tripCard(trip);
  assert.equal(done.querySelectorAll('.leg.done').length, 3);
  assert.equal(done.querySelector('.th small').textContent, 'arrived');
  assert.equal(done.querySelector('.last').textContent, 'Arrived about 3:18 pm');
  assert.equal(done.querySelector('.tbar small').textContent, '100% done');
  const vague = tripCard({ ...worldFor().trip, leave: 'soon', arrive: null, mode: null, pace: null, leaveNote: null });
  assert.equal(vague.querySelectorAll('.leg .eta')[1].textContent, 'after 1 hour 42 minutes');
  assert.equal(vague.querySelector('.last').textContent, 'Leave soon');
});

test('trip card and summary are null without a trip or legs', () => {
  installFakeDom();
  for (const t of [null, undefined, { state: 'planned', legs: [] }, { state: 'planned' }]) {
    assert.equal(tripCard(t), null);
    assert.equal(tripSummary(t), null);
  }
});

test('trip summary: one line with state, leg count and arrival', () => {
  installFakeDom();
  const planned = tripSummary(worldFor().trip);
  assert.equal(planned.querySelector('b').textContent, 'Trip to Auvoth · planned');
  assert.equal(planned.querySelector('span').textContent, '3 legs · on foot · arrive 3:18 pm');
  assert.equal(tripSummary(worldFor('fightOpen').trip).querySelector('b').textContent, 'Trip to Auvoth · on the road');
  const one = tripSummary({ state: 'arrived', legs: [{ from: 'A', to: 'B', minutes: 5 }] });
  assert.equal(one.querySelector('span').textContent, '1 leg');
});
