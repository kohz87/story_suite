// The Conditions here card shows a condition's name in words.
import test from 'node:test';
import assert from 'node:assert/strict';

import { conditionsCard } from '../../../../ui/tabs/world/conditions.js';
import { installFakeDom } from '../../helpers/dom.js';

test('a condition\'s heading reads in words, its key stays for the row', () => {
  installFakeDom();
  const card = conditionsCard({ place: 'Highmark', rows: [{ key: 'tolls-raised@Highmark', name: 'tolls-raised', ref: 'Highmark' }] });
  assert.equal(card.querySelector('.eh b').textContent, 'tolls raised');
  assert.equal(card.querySelector('.ev').dataset.condition, 'tolls-raised@Highmark');
});
