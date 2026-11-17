import test from 'node:test';
import assert from 'node:assert/strict';
import { toolsCommand } from '../../../ui/port/tools.js';
import { createToolsHandle } from '../../../ui/port/tools-handle.js';

const SET = 'settings.action';

test('tools.report answers the text; tools.rebuild forwards only a module and one of the two reads', async () => {
  const seen = [];
  const tools = { report: async () => 'REPORT', rebuild: async (m, r) => { seen.push([m, r]); return { ok: true }; } };
  assert.deepEqual(await toolsCommand(tools, SET, { key: 'tools.report' }), { ok: true, text: 'REPORT' });
  assert.deepEqual(await toolsCommand(tools, SET, { key: 'tools.rebuild', value: { module: 'npc', read: 'all' } }), { ok: true });
  assert.equal((await toolsCommand(tools, SET, { key: 'tools.rebuild', value: { module: 'npc', read: 'everything' } })).ok, false);
  assert.equal((await toolsCommand(tools, SET, { key: 'tools.rebuild', value: { read: 'all' } })).ok, false);
  assert.deepEqual(seen, [['npc', 'all']]);
});

test('other commands are not the Tools page\'s, and a missing handle is a plain failure', async () => {
  assert.equal(await toolsCommand({}, 'settings.set', { key: 'tools.report' }), null);
  assert.equal(await toolsCommand({}, SET, { key: 'models.test' }), null);
  assert.equal((await toolsCommand(null, SET, { key: 'tools.report' })).ok, false);
});

function runtime(over = {}) {
  return { registry: { module: id => ({ name: `Mod ${id}` }) }, settings: () => ({ tailBudget: 700 }), turn: { problems: () => [{ code: 'A' }], preview: () => [{ module: 'm', place: 'tail', text: 'abcdefgh' }] }, timeline: { blocked: () => null, host: { rebuild: async (m, i) => ({ ok: true, m, i }) } }, ...over };
}

test('the handle reads the live engine on every call (swipe, delete, rewind, reload and an edited Re-read all change the answers)', () => {
  let list = [{ index: 4 }];
  let problems = [{ code: 'A' }];
  const rt = runtime({ turn: { problems: () => problems, preview: () => [{ module: 'm', place: 'tail', text: 'abcdefgh' }] } });
  const ui = { inspector: { replies: () => list, reply: i => ({ ok: true, index: i }) } };
  const handle = createToolsHandle({ runtime: rt, ui: () => ui });
  assert.deepEqual(handle.replies(), [{ index: 4 }]);
  list = [{ index: 4 }, { index: 7 }];
  assert.equal(handle.replies().length, 2);
  assert.equal(handle.problems().length, 1);
  problems = [];
  assert.equal(handle.problems().length, 0);
  assert.equal(handle.sent().budget, 700);
  assert.equal(handle.nameOf('x'), 'Mod x');
});

test('a throwing engine is a gap, never an error; rebuild goes to the timeline with the read', async () => {
  const bad = runtime({ turn: { problems: () => { throw new Error('x'); }, preview: () => { throw new Error('x'); } } });
  const handle = createToolsHandle({ runtime: bad, ui: () => null });
  assert.deepEqual([handle.sent(), handle.problems(), handle.replies(), handle.reply(1), handle.blocked()], [null, [], [], null, null]);
  assert.equal(await handle.report(), '');
  assert.deepEqual(await handle.rebuild('npc', 'all'), { ok: true, m: 'npc', i: { read: 'all' } });
});
