import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withCoinUnit } from '../../../ui/select/coin-unit.js';
import { selectNow } from '../../../ui/select/now.js';
import { ANSWERS } from './recorded.js';

const COINS = { name: 'gold', plural: 'gold', coins: [{ name: 'gold', plural: 'gold', value: 100 }, { name: 'copper', plural: 'coppers', value: 1 }, { name: 'silver', plural: 'silver', value: 10 }] };

describe('withCoinUnit', () => {
  it('names the smallest coin, singular for one', () => {
    assert.equal(withCoinUnit('−3', COINS), '−3 coppers');
    assert.equal(withCoinUnit('+1', COINS), '+1 copper');
  });
  it('falls back to the currency name and leaves a non-number alone', () => {
    assert.equal(withCoinUnit('+5', { name: 'mark', plural: 'marks' }), '+5 marks');
    assert.equal(withCoinUnit('+5', null), '+5');
    assert.equal(withCoinUnit('to market', COINS), 'to market');
  });
  it('reaches the Now change rows', () => {
    const rows = selectNow({ ...ANSWERS, 'inventory.currency': COINS, 'reply.changes': { lines: [{ glyph: 'coin', line: '−3', detail: null, applied: true }] } }).thisTurn.items;
    assert.equal(rows[0].line, '−3 coppers');
  });
});
