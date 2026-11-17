// Contract: the host's sdk carries the frozen settings defaults and schema, so the Settings view of a real host has Start/Look/Tools rows
// whose values equal the host settings (an sdk without the two fields gives no rows).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { HOST_SETTINGS_DEFAULTS, HOST_SETTINGS_SCHEMA } from '../../core/sdk.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../ui/contract/settings.js';

const rowsOf = vm => vm.sections.flatMap(s => s.rows);
const viewOf = sdk => createSbPort({ sdk, selectors: buildSelectors(() => null, sdk) }).view('settings');

test('the sdk settings carry the host defaults and schema, frozen, and still read the host settings', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  const { settings } = host.sdk;
  assert.deepEqual(settings.defaults, HOST_SETTINGS_DEFAULTS);
  assert.deepEqual(settings.schema, HOST_SETTINGS_SCHEMA);
  assert.equal(Object.isFrozen(settings.defaults) && Object.isFrozen(settings.schema), true);
  assert.equal(typeof settings(), 'object');
});

test('the Settings view of a real host has rows with the host values and fits SETTINGS_SHAPE', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  const vm = viewOf(host.sdk);
  assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  const rows = rowsOf(vm);
  const budget = rows.find(r => r.key === 'host.tailBudget');
  const look = rows.find(r => r.key === 'host.panelStyle');
  assert.ok(budget && look, 'Look and Tools rows exist');
  assert.equal(budget.value, host.sdk.settings().tailBudget);
  assert.equal(look.default, 'Glass');
  assert.ok(rows.some(r => r.key === 'host.font'));
});

test('an sdk without the two fields gives no host rows', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost();
  t.after(() => host.close());
  const bare = { ...host.sdk, settings: id => host.sdk.settings(id) };
  assert.equal(rowsOf(viewOf(bare)).some(r => r.key.startsWith('host.')), false);
});
