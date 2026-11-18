// SA-RPGMOCK: the RPG and fights page shows only rows that have a real setting. The mock's Combat rules button, Odds on the fight board and Rolls had none (Combat Rules v1 is fixed, the fight board always shows its odds, and Rolls was the Story checks switch), so they are not on the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSettings } from '../../../ui/fixtures/settings.js';
import { realSettings } from './real-settings.js';

const KEYS = ['rpg.difficulty', 'rpg.levelCap', 'rpg.xpRate', 'rpg.practicePerSkillUse', 'rpg.companions', 'rpg.setUpAFightFromMyAttack', 'rpg.autoExchanges', 'rpg.overLoad', 'rpg.storyChecksUseYourStats', 'rpg.pickWhatYouTake', 'rpg.encumbered', 'rpg.gearInFights'];
const DROPPED = /combat rules|odds|^rolls$/i;
const rowsOf = (vm, id) => vm.sections.find(s => s.id === id).rows;

test('the real RPG page (real selectors) has no Combat rules, Odds or Rolls row', async () => {
  const rows = rowsOf(await realSettings(), 'rpg');
  assert.deepEqual(rows.map(r => r.key), KEYS);
  assert.deepEqual(rows.filter(r => DROPPED.test(r.label) || DROPPED.test(r.key)), []);
});

test('the harness page matches the real one: the same rows, none of the dropped three', () => {
  const rows = rowsOf(buildSettings(), 'rpg');
  assert.deepEqual(rows.map(r => r.key), KEYS);
  assert.deepEqual(rows.filter(r => DROPPED.test(r.label)), []);
});
