import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { worldFor } from '../../../../ui/fixtures/world.js';
import { placeSheet, fromYou } from '../../../../ui/tabs/world/place-sheet.js';

const place = (world, id) => world.places.find(p => p.id === id);
const rows = sheet => Object.fromEntries(sheet.querySelectorAll('dt').map((dt, i) => [dt.textContent, sheet.querySelectorAll('dd')[i].textContent]));

test('fromYou: here, along the trip with distance and time, off the trip', () => {
  const w = worldFor();
  assert.equal(fromYou(place(w, 'bluewatch'), w), 'You are here');
  assert.equal(fromYou(place(w, 'oldweir'), w), '3 km on foot · 1 hour 42 minutes');
  assert.equal(fromYou(place(w, 'auvoth'), w), '12 km on foot · 5 hours 18 minutes');
  assert.equal(fromYou(place(w, 'sails'), w), null);
  assert.equal(fromYou(place(w, 'sails'), {}), null);
  assert.equal(fromYou({ name: 'Bluewatch gate', here: false }, w), '30 minutes');
});

test('sheet for a busy place shows chips, news, quests, people and the Edit and close buttons', () => {
  installFakeDom();
  const w = worldFor();
  const sheet = placeSheet(place(w, 'auvoth'), w, { rpg: true }, () => {});
  assert.equal(sheet.dataset.sheet, 'place');
  assert.equal(sheet.querySelector('.dn').textContent, 'Auvoth');
  assert.deepEqual(sheet.querySelectorAll('.chips .lvl2').map(c => c.textContent), ['Market town', 'Auvoth Vale', 'Risky', 'not visited yet']);
  const r = rows(sheet);
  assert.equal(r['From you'], '12 km on foot · 5 hours 18 minutes');
  assert.match(r.News, /Bandit tolls on the Auvoth road/);
  assert.match(r.News, /Harvest fair at Auvoth/);
  assert.equal(r.Quests, 'Missing boatman');
  assert.equal(r.People, undefined);
  assert.equal(sheet.querySelector('.ed').getAttribute('aria-label'), 'Edit Auvoth');
  assert.equal(sheet.querySelector('.x').getAttribute('aria-label'), 'Close');
  assert.match(sheet.querySelector('.fine').textContent, /say so in the story/);
});

test('people names come from faction members, with a capitalised id as the fallback; tapping goes to People', () => {
  installFakeDom();
  const w = worldFor();
  const went = [];
  const sheet = placeSheet(place(w, 'bluewatch'), w, { go: (t, a) => went.push([t, a]) }, () => {});
  const names = sheet.querySelectorAll('.plink').map(b => b.textContent);
  assert.deepEqual(names, ['Sister Temiwa', 'Torka', 'Brann', 'Oyla']);
  sheet.querySelector('[data-person-id="temiwa"]').click();
  assert.deepEqual(went, [['people', { personId: 'temiwa' }]]);
  assert.equal(rows(sheet)['From you'], 'You are here');
});

test('danger shows only in RPG chats and is coloured by its level', () => {
  installFakeDom();
  const w = worldFor();
  const risky = placeSheet(place(w, 'wolfmere'), w, { rpg: true }, () => {});
  assert.ok(risky.querySelector('.dz-dangerous'));
  assert.equal(risky.querySelector('.dz').textContent, 'Dangerous');
  assert.equal(placeSheet(place(w, 'wolfmere'), w, { rpg: false }, () => {}).querySelector('.dz'), null);
  assert.ok(placeSheet(place(w, 'wolfmere'), w, {}, () => {}).querySelector('.dz'));
  const safe = placeSheet(place(w, 'hollin'), w, {}, () => {});
  assert.ok(safe.querySelector('.dz-safe'));
  assert.equal(safe.textContent.includes('not visited yet'), false);
});

test('a place with nothing to list shows no list; unknown danger is left out', () => {
  installFakeDom();
  const sheet = placeSheet({ id: 'x', name: 'Nowhere', kind: 'Ruin', region: null, danger: 'odd', visited: true, here: false }, {}, {}, () => {});
  assert.equal(sheet.querySelector('dl'), null);
  assert.equal(sheet.querySelector('.dz'), null);
  assert.equal(sheet.querySelectorAll('.chips .lvl2').length, 1);
});

test('closing: the × button and a tap on the scrim close; a tap inside the sheet does not; Edit hands over the place', () => {
  installFakeDom();
  const w = worldFor();
  let closed = 0;
  const edits = [];
  const sheet = placeSheet(place(w, 'oldweir'), w, { edit: t => edits.push(t) }, () => { closed += 1; });
  sheet.querySelector('.wsheet').click();
  assert.equal(closed, 0);
  sheet.querySelector('.x').click();
  assert.equal(closed, 1);
  sheet.click();
  assert.equal(closed, 2);
  sheet.querySelector('.ed').click();
  assert.deepEqual(edits, [{ kind: 'place', id: 'oldweir' }]);
  assert.equal(sheet.querySelector('.wsheet').getAttribute('role'), 'dialog');
});
