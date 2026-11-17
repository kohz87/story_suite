// registerIsolated: a module that cannot start is logged, listed in Problems and switched off; the rest start (B3-PLAN 5.2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { registerIsolated } from '../../../core/boot/register-isolated.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';

const quiet = t => t.mock.method(console, 'error', () => {});
const mod = (id, extra = {}) => ({ id, name: id.toUpperCase(), ...extra });

test('a module whose register hook throws is switched off and listed; the next one still starts', async t => {
  quiet(t);
  const host = await createHost({ modules: [] });
  const runtime = { sdk: host.sdk, turn: host.turn, registry: host.registry };
  const seen = [];
  assert.equal(await registerIsolated(runtime, mod('bad', { register() { throw new Error('torn start'); } })), false);
  assert.equal(await registerIsolated(runtime, mod('good', { register: sdk => seen.push(typeof sdk.query) })), true);
  assert.deepEqual(seen, ['function'], 'the hook gets the sdk');
  assert.equal(host.registry.lifecycle('bad').status, 'dormant', 'the failed module is off');
  assert.notEqual(host.registry.lifecycle('good').status, 'dormant');
  const problem = host.turn.problems().find(item => item.module === 'bad');
  assert.match(problem.message, /BAD could not start: torn start/);
  host.close();
});

test('a refused definition is reported, not thrown', async t => {
  quiet(t);
  const host = await createHost({ modules: [] });
  const runtime = { sdk: host.sdk, turn: host.turn, registry: host.registry };
  assert.equal(await registerIsolated(runtime, { id: 'Not Valid!' }), false);
  assert.equal(await registerIsolated(runtime, mod('twice')), true);
  assert.equal(await registerIsolated(runtime, mod('twice')), false, 'the same id again is refused');
  assert.notEqual(host.registry.lifecycle('twice').status, 'dormant', 'and the one already there keeps running');
  host.close();
});

test('an injected throw in each built-in module in turn leaves the others registered', async t => {
  quiet(t);
  for (const failing of BUILTIN_MODULES) {
    const host = await createHost({ modules: [] });
    const runtime = { sdk: host.sdk, turn: host.turn, registry: host.registry };
    for (const one of BUILTIN_MODULES) {
      await registerIsolated(runtime, one === failing ? { ...one, register() { throw new Error('torn'); } } : one);
    }
    for (const one of BUILTIN_MODULES) {
      const dormant = host.registry.lifecycle(one.id)?.status === 'dormant';
      assert.equal(dormant, one === failing, `${one.id} when ${failing.id} fails`);
    }
    host.close();
  }
});

test('the list is one fixed order: the Story Director module, then the people module, ids unique', () => {
  assert.deepEqual(BUILTIN_MODULES.map(one => one.id), ['story-director', 'people']);
  assert.equal(Object.isFrozen(BUILTIN_MODULES), true);
});
