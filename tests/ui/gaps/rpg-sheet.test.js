// G5a contract: a real RPG host (Combat Rules v1) fills the Party tab's cards, the Card's level/class/bars/exp/soak and the Now tab's "points to spend" through the port; with the RPG off none of them shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { PARTY_SHAPE } from '../../../ui/contract/party.js';
import { NOW_SHAPE } from '../../../ui/contract/now.js';
import { CARD_SHAPE } from '../../../ui/contract/card.js';
import { v1Blocks } from '../../modules/rpg/board/v1.helpers.js';
import { setup } from '../../modules/rpg/helpers.js';

const portOf = host => createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) });
async function world(t, options = {}) {
  const { host } = await setup({ blocks: v1Blocks({ hero: { points: 2, xp: 30, level: 5, vit: 12 } }), planner: false, ...options });
  t.after(() => host.close());
  return host;
}

test('RPG on: Party members are filled (level, bars, xp, points, soak, WIS stats, skills) and only the per-item soak is a gap', async t => {
  const party = portOf(await world(t)).view('party');
  const [astra] = party.members;
  assert.deepEqual([astra.name, astra.line, astra.level, astra.xpPct, astra.points, astra.soakPct], ['Astra', 'Lv 5', 5, 30, 2, 12]);
  assert.deepEqual(astra.bars.map(bar => bar.kind), ['hp', 'mp', 'sp']);
  assert.equal(astra.stats.WIS, 8);
  assert.equal(astra.skills[0].name, 'Cut');
  assert.ok(checkShape(party, PARTY_SHAPE).every(error => /soak: expected number, got null/.test(error)));
});

test('RPG on: the Card shows the level word, bars, exp and soak; Now says the points to spend', async t => {
  const port = portOf(await world(t));
  const card = port.view('card');
  assert.deepEqual(checkShape(card, CARD_SHAPE), []);
  assert.equal(card.you.levelText, 'Lv 5');
  assert.deepEqual([card.bars.length, card.exp, card.chips.soakPct], [3, { value: 30, max: 100 }, 12]);
  const now = port.view('now');
  assert.deepEqual(checkShape(now, NOW_SHAPE), []);
  assert.deepEqual(now.needsYou.filter(row => row.kind === 'points'), [{ kind: 'points', title: '2 points to spend', detail: 'Astra', go: 'party' }]);
});

test('RPG off: rpg.sheet is null, so no sheet field is filled (this host still answers the roster itself: party.actors is not feature-gated here)', async t => {
  const port = portOf(await world(t, { feature: false }));
  const [astra] = port.view('party').members;
  assert.deepEqual([astra.bars, astra.points, astra.xpPct, astra.soakPct, astra.stats, astra.skills, astra.line], [[], null, null, null, null, [], '']);
  const card = port.view('card');
  assert.deepEqual([card.you.className, card.bars, card.exp, card.chips.soakPct], [null, null, null, null]);
  assert.equal(port.view('now').needsYou.some(row => row.kind === 'points'), false);
});
