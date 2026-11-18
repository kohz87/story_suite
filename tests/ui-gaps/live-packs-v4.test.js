// Pack format 4, job S1: with a world and a game installed, the live port draws the format 4 Packs page and the Start rows, and answers every key they send
// (the pickers' `packs.on.<id>`, Rank label, Starting money, Starting items): none falls through to UNKNOWN_COMMAND, and each reaches the store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { BUILTIN_MODULES } from '../../core/modules-list.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';

const REQ = { suite: '^0.1' };
const months = n => Array.from({ length: n }, (_, i) => ({ name: `M${i + 1}`, days: 30 }));
const world = { id: 'w1', format: 4, kind: 'world', version: '1.0.0', name: 'Ersveil', requires: REQ, recommends: { game: { id: 'g2', version: '^1.0' } }, content: { start: { date: { year: 5, month: 10, day: 1 } }, places: [{ id: 'dock', name: 'The Dock', x: 1, y: 1 }] } };
const game = (id, name, n) => ({ id, format: 4, kind: 'game', version: '1.0.0', name, requires: REQ, content: { calendar: { months: months(n) } } });

test('the format 4 page and the Start rows on the live port: every key is answered and reaches the store', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost({ core: true, modules: BUILTIN_MODULES });
  t.after(() => host.close());
  for (const pack of [world, game('g1', 'Eight months', 8), game('g2', 'Twelve months', 12)]) assert.equal((await host.packs.packs.install(pack)).ok, true);
  assert.equal(await host.packs.packs.select('game', 'g1'), true);
  const writes = { settings: { set: (id, key, value) => host.settings.set(id, key, value) }, features: { set: (id, on) => host.features.set(id, on) } };
  const port = createSbPort({ sdk: host.sdk, writes, selectors: buildSelectors(() => null, host.sdk), packs: { packs: host.packs.packs, readLorebook: async () => ({ character: '', entries: [], problem: '' }) }, rpgValues: () => host.sdk.settings('story-block') });
  const view = port.view('settings');
  assert.deepEqual(view.packs.v4.installed.map(p => p.id), ['w1', 'g1', 'g2']);
  assert.equal(view.packs.v4.suggest.id, 'g2', 'the world suggests the game that is not in use');
  assert.match(view.packs.v4.lines[0].text, /^Start date: Eight months has no month 10, so Ersveil starts on day 1 of month 1, 5\.$/);
  const rows = view.sections.find(section => section.id === 'start').rows;
  assert.deepEqual(rows.map(row => row.key), ['packs.you.rankLabel', 'packs.start.money', 'packs.start.items']);
  const send = async (type, payload) => { const answer = await port.command(type, payload); assert.notEqual(answer?.code, 'UNKNOWN_COMMAND', `${type} ${payload.key}`); return answer; };
  // Use it, then the pickers' None and Built-in
  assert.equal((await send('settings.set', { key: 'packs.on.g2', value: true })).ok, true);
  assert.equal(host.packs.packs.selected().game, 'g2');
  assert.equal(port.view('settings').packs.v4.suggest, null, 'the suggested game is in use: no card');
  assert.deepEqual(port.view('settings').packs.v4.lines, [], 'and the pair fits');
  assert.equal((await send('settings.set', { key: 'packs.on.g2', value: false })).ok, true);
  assert.equal(host.packs.packs.selected().game, null);
  assert.equal((await send('settings.set', { key: 'packs.on.w1', value: false })).ok, true);
  assert.equal(host.packs.packs.selected().world, null);
  // the three Start rows
  assert.equal((await send('settings.set', { key: 'packs.you.rankLabel', value: 'Standing' })).ok, true);
  assert.equal((await send('settings.set', { key: 'packs.start.money', value: 12 })).ok, true);
  assert.equal((await send('settings.set', { key: 'packs.start.items', value: 'Rope x2' })).ok, true);
  assert.deepEqual(host.packs.packs.own.read(), { rankLabel: 'Standing', money: 12, items: [{ name: 'Rope', qty: 2 }] });
  const again = port.view('settings').sections.find(section => section.id === 'start').rows;
  assert.deepEqual(again.map(row => row.value), ['Standing', 12, 'Rope x2']);
  assert.equal((await send('settings.set', { key: 'packs.start.money', value: 'lots' })).ok, false);
  assert.equal(host.packs.packs.own.read().money, 12);
});
