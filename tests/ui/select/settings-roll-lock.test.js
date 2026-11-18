// "Roll checks before the reply" is drawn locked, with its reason, while the RPG has a Character (the pre-roll steps aside then); open otherwise.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { renderModuleCard } from '../../../ui/settings/modules.js';
import { installFakeDom } from '../helpers/dom.js';

const FEATURES = [{ id: 'story-block.preroll', moduleId: 'story-block', moduleName: 'Story Block', label: 'Roll checks before the reply', describe: 'One small extra model call per message', default: false, available: true, on: true }];
const subOf = vm => vm.modules.defs.flatMap(def => def.subs).find(sub => sub.key === 'story-block.preroll');

describe('the pre-roll row with an RPG Character', () => {
  it('is locked with the reason only when the RPG has a Character, and still fits the contract', () => {
    const held = selectSettings({ features: FEATURES, rollsHeld: true });
    assert.deepEqual(checkShape(held, SETTINGS_SHAPE), []);
    assert.equal(subOf(held).locked, true);
    assert.match(subOf(held).lockWhy, /fight board rolls the checks/);
    assert.equal(subOf(selectSettings({ features: FEATURES })).locked, undefined);
  });

  it('draws the switch disabled, with the reason beside the hint', () => {
    const doc = installFakeDom();
    const vm = selectSettings({ features: FEATURES, rollsHeld: true });
    const def = vm.modules.defs[0];
    const node = renderModuleCard(def, { set: vm.modules.chat, defs: vm.modules.defs, change: () => {}, openMods: {} }, false);
    const row = node.querySelector('.srow');
    assert.ok(row.className.includes('dis'));
    assert.match(row.textContent, /fight board rolls the checks/);
    assert.ok(doc);
  });
});
