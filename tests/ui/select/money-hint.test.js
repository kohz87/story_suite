// Settings › Money: the Coins hint names no pack (a chat with no pack, or another pack, must not read "Ersveil").
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMoneyRows } from '../../../ui/select/money-rows.js';

test('the Coins hint names no pack', () => {
  const hint = selectMoneyRows({}).find(row => row.key === 'money.coins').hint;
  assert.doesNotMatch(hint, /Ersveil/);
  assert.match(hint, /pack/);
});
