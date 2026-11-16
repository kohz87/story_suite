// Contract: the World answers of a real host (Story Block + Story Director + a stand-in NPC State Delta), read through the world selector, fit WORLD_SHAPE
// with heard stamps, faction members and place quests; the fake-port fixture fits the same shape; with nothing known the links are empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import { delta, LINES } from '../../packages/story-director/tests/v2/world/links-helpers.js';
import { said, worldHost } from '../../packages/story-director/tests/v2/world/helpers.js';
import { selectWorld } from '../../ui/select/world.js';
import { checkShape } from '../../ui/contract/shapes.js';
import { WORLD_SHAPE } from '../../ui/contract/world.js';
import { worldFor } from '../../ui/fixtures/world.js';

test('a real host\'s World answers fit WORLD_SHAPE with heard stamps, members and place quests', async t => {
    const host = await worldHost({ extra: [delta()] });
    t.after(() => host.close());
    await host.send('Begin.', said('The harbour.', LINES));
    await host.send('Then.', said('Still there.'));
    // Places the story names have no coordinates until the reader places them (Tidy the map or an edit): place the harbour.
    assert.equal((await host.sdk.command('atlas.edit', { place: 'Harbour', x: 120, y: 80 })).ok, true);
    const world = selectWorld({ atlasView: host.sdk.query('atlas.view'), worldView: host.sdk.query('director.world') });
    assert.deepEqual(checkShape(world, WORLD_SHAPE), []);
    const harbour = world.places.find(p => p.name === 'Harbour');
    assert.deepEqual(harbour.quests, ['Rat Cellar']);
    assert.equal(world.news.find(n => n.title === 'Red Plague').factionId, world.factions[0].id);
    assert.deepEqual(world.factions[0].members.map(m => m.name).sort(), ['Brecht', 'Mira']);
    assert.equal(world.news.find(n => n.title === 'Red Plague').heard[0].where, 'Harbour');
});

test('the fake-port fixture fits the same shape and shows the same fields', () => {
  const fixture = worldFor();
  assert.deepEqual(checkShape(fixture, WORLD_SHAPE), []);
  assert.ok(fixture.news.some(n => n.heard.length) && fixture.factions.some(f => f.members.length) && fixture.places.some(p => p.quests.length));
});

test('with nothing known the world is empty and still fits the shape', async t => {
  const host = await worldHost();
  t.after(() => host.close());
  await host.send('Begin.', said('Quiet.'));
  const world = selectWorld({ atlasView: host.sdk.query('atlas.view'), worldView: host.sdk.query('director.world') });
  assert.deepEqual(checkShape(world, WORLD_SHAPE), []);
  assert.deepEqual([world.news, world.factions], [[], []]);
});
