import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, worldFor } from '../../../ui/fixtures/world.js';
import { PEOPLE } from '../../../ui/fixtures/people.js';

test('default world: Bluewatch is here, the trip is planned, 9 places, 6 news, 5 factions', () => {
  const w = worldFor();
  assert.equal(w.places.length, 9);
  assert.deepEqual(w.places.filter(p => p.here).map(p => p.id), ['bluewatch']);
  assert.equal(w.trip.state, 'planned');
  assert.equal(w.news.length, 6);
  assert.equal(w.factions.length, 5);
});

test('trip legs add up to the 3:18 pm arrival (30 + 72 + 216 minutes)', () => {
  const w = worldFor();
  assert.equal(w.trip.legs.reduce((s, l) => s + l.minutes, 0), 318);
  assert.equal(w.trip.arrive, 'about 3:18 pm');
});

test('fightOpen: on the road, standing at the Auvoth bridge, nobody listed at Bluewatch', () => {
  const w = worldFor('fightOpen');
  assert.equal(w.trip.state, 'road');
  assert.deepEqual(w.places.filter(p => p.here).map(p => p.id), ['auvoth-bridge']);
  assert.deepEqual(w.places.find(p => p.id === 'bluewatch').people, []);
});

test('empty world has nothing and no trip', () => {
  const w = worldFor('empty');
  assert.deepEqual(w, { places: [], routes: [], trip: null, news: [], factions: [] });
});

test('every id link resolves: routes, trip, news places, factions, area ids', () => {
  const w = worldFor('fightOpen');
  const places = new Set(w.places.map(p => p.id));
  const factions = new Set(w.factions.map(f => f.id));
  for (const r of w.routes) assert.ok(places.has(r.a) && places.has(r.b));
  for (const id of w.trip.placeIds) assert.ok(places.has(id));
  for (const n of w.news) {
    if (n.placeId) assert.ok(places.has(n.placeId));
    if (n.factionId) assert.ok(factions.has(n.factionId));
  }
  for (const f of w.factions) for (const id of f.areaPlaceIds) assert.ok(places.has(id));
});

test('people at a place and faction members exist in the cast', () => {
  const ids = new Set(PEOPLE.cast.map(p => p.personId));
  const w = worldFor();
  for (const p of w.places) for (const id of p.people) assert.ok(ids.has(id));
  for (const f of w.factions) for (const m of f.members) if (m.personId) assert.ok(ids.has(m.personId));
});

test('a news item can carry several heard stamps; the last is the latest', () => {
  const raids = worldFor().news.find(n => n.id === 'frontier-raids');
  assert.equal(raids.heard.length, 2);
  assert.equal(raids.heard[1].from, 'Oyla, at the guild desk');
});

test('worldFor returns fresh copies and the source table is frozen', () => {
  const a = worldFor();
  a.places[0].name = 'X';
  assert.equal(worldFor().places[0].name, 'Bluewatch');
  assert.ok(Object.isFrozen(WORLD));
});
