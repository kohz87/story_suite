import test from 'node:test';
import assert from 'node:assert/strict';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { moneyCommand, MONEY_RESET } from '../../../ui/port/money.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createRuntime } from '../../../core/runtime.js';
import { createFakeContext } from '../../../testkit/fake-st.js';

function real() {
  const st = createFakeContext({ chat: [] });
  const runtime = createRuntime({ ctx: st.ctx });
  const stored = () => structuredClone(st.ctx.extensionSettings.storySuite?.modules?.['story-block'] ?? {});
  return { runtime, stored, port: createSbPort({ sdk: runtime.sdk, writes: runtime.writes, selectors: buildSelectors(() => st.ctx, runtime.sdk) }) };
}
const rowsOf = port => port.view('settings').sections.find(s => s.id === 'money').rows;
const set = (port, key, value) => port.command('settings.set', { key, value });

// What the old view's Money page does for a changed field: settings.set('story-block', key, value) (ui/legacy/view/form/form.js).
const OLD = { 'money.coins': ['coins', [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }]], 'money.show': ['coinDisplay', 'base'], 'money.moneyWord': ['currency', 'mark'], 'money.plural': ['currencyPlural', 'marks'], 'money.shortForm': ['currencyShort', 'mk'], 'money.priceScale': ['economyScale', '100'] };
const NEW = { 'money.coins': 'copper: 1, silver: 10', 'money.show': 'Smallest coin only', 'money.moneyWord': 'mark', 'money.plural': 'marks', 'money.shortForm': 'mk', 'money.priceScale': 100 };

test('every row writes the same stored value the old view writes for the same key', async () => {
  const a = real();
  const b = real();
  for (const key of Object.keys(OLD)) {
    assert.equal((await set(a.port, key, NEW[key])).ok, true, key);
    b.runtime.settings.set('story-block', OLD[key][0], OLD[key][1]);
  }
  assert.deepEqual(a.stored(), b.stored());
  assert.equal(a.stored().coinDisplay, 'base');
});

test('every row reads the live value back, in the mock\'s order, and a value set the old way shows', async () => {
  const { runtime, port } = real();
  assert.deepEqual(rowsOf(port).map(r => r.key), ['money.coins', 'money.show', 'money.moneyWord', 'money.plural', 'money.shortForm', 'money.priceScale']);
  runtime.settings.set('story-block', 'coins', [{ name: 'copper', value: 1 }, { name: 'gold', value: 100 }]);
  runtime.settings.set('story-block', 'coinDisplay', 'base');
  runtime.settings.set('story-block', 'economyScale', '0.5');
  const by = Object.fromEntries(rowsOf(port).map(r => [r.key, r.value]));
  assert.deepEqual([by['money.coins'], by['money.show'], by['money.priceScale']], ['copper: 1, gold: 100', 'Smallest coin only', 0.5]);
  await set(port, 'money.moneyWord', 'crown');
  assert.equal(rowsOf(port).find(r => r.key === 'money.moneyWord').value, 'crown');
});

test('coins that do not read are refused and the stored coins stay as they were', async () => {
  const { stored, port } = real();
  await set(port, 'money.coins', 'copper: 1');
  const bad = await set(port, 'money.coins', 'silver: ten');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Coin 1/);
  assert.deepEqual(stored().coins, [{ name: 'copper', value: 1 }]);
  assert.equal((await set(port, 'money.coins', '')).ok, true);
  assert.deepEqual(stored().coins, []);
});

test('Reset Money puts the six settings back to the defaults; another page\'s reset is not Money\'s', async () => {
  const { stored, port } = real();
  for (const key of Object.keys(NEW)) await set(port, key, NEW[key]);
  assert.equal(moneyCommand('settings.action', { key: 'settings.reset', value: 'Reset Look to defaults' }, {}), null);
  assert.equal((await port.command('settings.action', { key: 'settings.reset', value: MONEY_RESET })).ok, true);
  const s = stored();
  assert.deepEqual([s.coins, s.coinDisplay, s.currencyPlural, s.currencyShort, s.economyScale], [[], 'mixed', '', '', '0']);
});

test('keys that are not Money\'s are not answered', () => {
  assert.equal(moneyCommand('settings.set', { key: 'host.tailBudget', value: 1 }, {}), null);
  assert.equal(moneyCommand('suite.go', {}, {}), null);
});

test('without a store the write fails and says so', async () => {
  assert.equal((await moneyCommand('settings.set', { key: 'money.show', value: 'Each coin' }, null)).ok, false);
  assert.equal((await moneyCommand('settings.set', { key: 'money.show', value: 'nope' }, {})).ok, false);
});
