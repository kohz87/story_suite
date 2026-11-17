// The fight goes to the Fight tab and the Now card, any other interaction to the activity tab; a sent fight no longer needs you.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSelectors } from '../../../ui/select/build.js';
import { selectFightScene, fightNeeds } from '../../../ui/select/interaction.js';
import { sceneAnswer } from '../../../ui/fixtures/interaction.js';

const FIGHT = sceneAnswer('open', { fight: 'choose' });
const FERRY = sceneAnswer('open');
const selectorsFor = answer => tab => buildSelectors(() => null, null)[tab](name => (name === 'interaction.view' ? answer : null));

describe('the Fight tab selector', () => {
  it('takes the open fight only; the activity tab takes everything else', () => {
    const fight = selectorsFor(FIGHT), ferry = selectorsFor(FERRY);
    assert.equal(fight('fight').kindId, 'story-block/fight');
    assert.equal(fight('scene'), null);
    assert.equal(ferry('fight'), null);
    assert.equal(ferry('scene').kindId, 'probe/ferry');
    assert.equal(selectorsFor(null)('fight'), null);
  });
  it('tells the inline chip and the Now card about it', () => {
    assert.equal(selectorsFor(FIGHT)('chat').inlineRow.fightOpen, true);
    assert.equal(selectorsFor(FERRY)('chat').inlineRow.fightOpen, false);
    assert.deepEqual(selectorsFor(FIGHT)('now').needsYou.map(row => [row.kind, row.go]), [['fight', 'fight']]);
    assert.deepEqual(selectorsFor(FERRY)('now').needsYou, []);
  });
  it('a sent or taken-back fight keeps its tab but no longer needs you', () => {
    for (const state of ['sent', 'invalidated']) {
      const answer = { ...FIGHT, state };
      assert.ok(selectFightScene(answer));
      assert.equal(fightNeeds(selectFightScene(answer)).state, 'end');
      assert.deepEqual(selectorsFor(answer)('now').needsYou, []);
    }
  });
});
