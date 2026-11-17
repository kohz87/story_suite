// The people module: its register hook is the start of the People part; a failing start is a Problem and the module is off; the rest still start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { registerIsolated } from '../../core/boot/register-isolated.js';
import { BUILTIN_MODULES } from '../../core/modules-list.js';
import { PEOPLE_MODULE_ID, createPeopleModule, peopleModule } from '../../modules/people/module.js';
import * as rows from '../../modules/people/dossier-rows.js';
import * as legacyRows from '../../modules/people/legacy/story-block-tabs.js';

const runtimeOf = host => ({ sdk: host.sdk, turn: host.turn, registry: host.registry });

test('the register hook starts the People part once', async () => {
  const host = await createHost({ modules: [] });
  let started = 0;
  assert.equal(await registerIsolated(runtimeOf(host), createPeopleModule({ start: async () => { started += 1; } })), true);
  assert.equal(started, 1);
  assert.notEqual(host.registry.lifecycle(PEOPLE_MODULE_ID).status, 'dormant');
  host.close();
});

test('a start that throws is a MODULE_START Problem, the module is off and the next one still starts', async t => {
  t.mock.method(console, 'error', () => {});
  const host = await createHost({ modules: [] });
  const runtime = runtimeOf(host);
  assert.equal(await registerIsolated(runtime, createPeopleModule({ start: async () => { throw new Error('torn start'); } })), false);
  assert.equal(host.registry.lifecycle(PEOPLE_MODULE_ID).status, 'dormant');
  const problem = host.turn.problems().find(item => item.module === PEOPLE_MODULE_ID);
  assert.equal(problem.code, 'MODULE_START');
  assert.match(problem.message, /NPC State could not start: torn start/);
  assert.equal(await registerIsolated(runtime, { id: 'next', name: 'Next' }), true);
  host.close();
});

test('the real start does nothing outside SillyTavern', async () => {
  assert.equal(globalThis.SillyTavern, undefined);
  const host = await createHost({ modules: [] });
  assert.equal(await registerIsolated(runtimeOf(host), peopleModule), true);
  host.close();
});

test('the people module is the last built-in module', () => {
  assert.equal(BUILTIN_MODULES.at(-1), peopleModule);
});

test('the dossier rows moved: the old path is the same code', () => {
  assert.equal(legacyRows.dossierRowNodes, rows.dossierRowNodes);
  assert.equal(legacyRows.emptyCastHtml, rows.emptyCastHtml);
  assert.equal(legacyRows.DOSSIER_BAR_MAX, rows.DOSSIER_BAR_MAX);
});
