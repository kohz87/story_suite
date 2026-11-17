// plan §7: a host booted with every module in BUILTIN_MODULES registers them all, in order, with none off and no Problem.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { registerIsolated } from '../../../core/boot/register-isolated.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';

test('every built-in module registers on a fresh host: none dormant, no MODULE_START Problem', async () => {
  const host = await createHost({ modules: [] });
  const runtime = { sdk: host.sdk, turn: host.turn, registry: host.registry };
  for (const mod of BUILTIN_MODULES) assert.equal(await registerIsolated(runtime, mod), true, `${mod.id} started`);
  for (const mod of BUILTIN_MODULES) assert.notEqual(host.registry.lifecycle(mod.id)?.status, 'dormant', `${mod.id} is on`);
  assert.deepEqual(host.turn.problems().filter(item => item.code === 'MODULE_START'), []);
  assert.deepEqual(new Set(BUILTIN_MODULES.map(mod => mod.id)).size, BUILTIN_MODULES.length, 'ids are distinct');
  host.close();
});

test('createHost takes the whole list as its modules', async () => {
  const host = await createHost({ modules: [...BUILTIN_MODULES] });
  for (const mod of BUILTIN_MODULES) assert.ok(host.registry.lifecycle(mod.id), `${mod.id} is registered`);
  host.close();
});
