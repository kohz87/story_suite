// Contract: the World answers of a real host (Story Block + Story Director + a stand-in NPC State Delta), read through createSbPort and the
// world selector, fit WORLD_SHAPE with heard stamps, faction members and place quests; the fake-port fixture fits the same shape; with the
// feature off or nothing known the card hides or is empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { delta, LINES } from '../../packages/story-director/tests/v2/world/links-helpers.js';
import { said, worldHost } from '../../packages/story-director/tests/v2/world/helpers.js';
import { FEATURE } from '../../packages/story-director/src/v2/world/index.js';
import { checkPort } from '../../ui/port/contract.js';
import { createSbPort } from '../../ui/port/sb-port.js';
import { buildSelectors } from '../../ui/select/build.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { WORLD_SHAPE } from '../../ui/contract/world.js';
import { worldFor } from '../../ui/fixtures/world.js';

const portOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => null, host.sdk) });

test('a real host gives a World view that fits WORLD_SHAPE with heard stamps, members and place quests', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await worldHost({ extra: [delta()] });
  t.after(() => host.close());
  await host.send('Begin.', said('The harbour.', LINES));
  await host.send('Then.', said('Still there.'));
  // Places the story names have no coordinates until the reader places them: place the harbour.
  assert.equal((await host.sdk.command('atlas.edit', { place: 'Harbour', x: 120, y: 80 })).ok, true);
  const port = portOf(host);
  assert.equal(checkPort(port).ok, true);
  const world = port.view('world');
  assert.notEqual(world, null);
  assert.deepEqual(checkShape(world, WORLD_SHAPE), []);
  assert.deepEqual(world.places.find(p => p.name === 'Harbour').quests, ['Rat Cellar']);
  const plague = world.news.find(n => n.title === 'Red Plague');
  assert.equal(plague.factionId, world.factions[0].id);
  assert.deepEqual(plague.heard, [{ where: 'in Harbour', when: 'June 3, 1200', from: null }]);
  assert.deepEqual(world.factions[0].members.map(m => m.name).sort(), ['Brecht', 'Mira']);
});

test('the fake-port fixture fits the same shape and shows the same fields', () => {
  const fixture = worldFor();
  assert.deepEqual(checkShape(fixture, WORLD_SHAPE), []);
  assert.ok(fixture.news.some(n => n.heard.length) && fixture.factions.some(f => f.members.length) && fixture.places.some(p => p.quests.length));
});

test('feature off: the World answer is null so the card hides; with nothing known the lists are empty', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await worldHost();
  t.after(() => host.close());
  await host.send('Begin.', said('Quiet.'));
  const empty = portOf(host).view('world');
  assert.deepEqual([empty?.news, empty?.factions], [[], []]);
  host.features.set(FEATURE, false);
  const off = portOf(host).view('world');
  assert.ok(off === null || (off.news.length === 0 && off.factions.length === 0));
});
