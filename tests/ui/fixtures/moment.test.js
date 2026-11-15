import test from 'node:test';
import assert from 'node:assert/strict';
import { MOMENT } from '../../../ui/fixtures/moment.js';

test('MOMENT captures 9:30 am Guild Office scene and 2:10 pm fight override', () => {
  assert.equal(MOMENT.scene.date, 'Goldwane 13');
  assert.equal(MOMENT.scene.weekday, 'Fourthday');
  assert.equal(MOMENT.scene.time, '9:30 am');
  assert.equal(MOMENT.scene.place, 'Guild Office, Bluewatch');
  assert.equal(MOMENT.fightScene.time, '2:10 pm');
  assert.equal(MOMENT.fightScene.shortPlace, 'Auvoth bridge');
});

test('MOMENT has 10 changes including Torka Affection +1 held back', () => {
  assert.equal(MOMENT.changes.length, 10);
  const held = MOMENT.changes.find(c => c.heldBack !== null);
  assert.ok(held);
  assert.equal(held.line, 'Torka: Affection +1');
  assert.equal(held.heldBack.asked, '+8');
});

test('MOMENT trip is planned (not started) and money has words and short form', () => {
  assert.equal(MOMENT.trip.state, 'planned');
  assert.equal(MOMENT.fightTrip.state, 'road');
  assert.equal(MOMENT.money.short, '2g 14s 6c');
  assert.equal(MOMENT.money.words, '2 gold 14 silver 6 copper');
});
