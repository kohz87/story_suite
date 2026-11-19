import test from 'node:test';
import assert from 'node:assert/strict';
import { whereFrom } from '../../../../ui/tabs/world/place-sheet.js';

const town = { name: 'Auvoth', x: 100, y: 100 };

test('a district says how far and which way it lies from its town (north is up: smaller y)', () => {
  assert.equal(whereFrom({ x: 100.2, y: 99.8 }, town, 1), "About 300 m north-east of Auvoth's centre");
  assert.equal(whereFrom({ x: 100, y: 102 }, town, 1), "About 2 km south of Auvoth's centre");
  assert.equal(whereFrom({ x: 97, y: 100 }, town, 0.5), "About 1.5 km west of Auvoth's centre");
});

test('no scale: the direction only; the same point: at the centre; no coordinates: nothing', () => {
  assert.equal(whereFrom({ x: 101, y: 100 }, town, null), "East of Auvoth's centre");
  assert.equal(whereFrom({ x: 100, y: 100 }, town, 1), 'At the centre of Auvoth');
  assert.equal(whereFrom({}, town, 1), null);
});
