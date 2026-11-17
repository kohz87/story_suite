import test from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SETTINGS_SHAPE } from '../../../ui/contract/settings.js';
import { selectSettings } from '../../../ui/select/settings.js';
import { createHost } from '../../../testkit/index.js';

const F = (n, on, extra = {}) => ({ id: `story-block.${n}`, moduleId: 'story-block', moduleName: 'Story Block', label: n, describe: `${n} text`, default: false, available: true, on, ...extra });
const FEATURES = [F('hud', true), F('choices', true), F('chatter', false), F('you', true)];
const extrasOf = vm => vm.sections.find(s => s.id === 'extras');

test('the page has the two Inner chatter rows at the live values, and the module holds the three switches', () => {
  const vm = selectSettings({ features: FEATURES, extras: { chatterInPrompt: true, chatterMax: 5 } });
  assert.deepEqual(checkShape(vm, SETTINGS_SHAPE), []);
  const rows = extrasOf(vm).rows;
  assert.deepEqual(rows.map(r => [r.key, r.group, r.type, r.label, r.value, r.default]), [
    ['extras.sendBack', 'Inner chatter', 'sw', 'Send the last reply’s thoughts back to the story', true, false],
    ['extras.chatterLines', 'Inner chatter', 'num', 'Most chatter lines per reply', 5, 3],
  ]);
  const def = vm.modules.defs.find(d => d.section === 'extras');
  assert.deepEqual(def.subs.map(s => [s.key, s.on]), [['choices', true], ['chatter', false], ['you', true]]);
  assert.deepEqual(vm.modules.chat.extras, { on: true, subs: { choices: true, chatter: false, you: true } });
  assert.deepEqual(vm.modules.defs.find(d => d.id === 'story-block').subs.map(s => s.key), ['story-block.hud'], 'moved out of Story Block\'s module');
});

test('unset values show the defaults; a host with no features still gets the page', () => {
  const vm = selectSettings({ features: [], extras: {} });
  assert.deepEqual(extrasOf(vm).rows.map(r => r.value), [false, 3]);
  assert.equal(vm.modules.defs.some(d => d.id === 'extras'), false);
});

test('the rows read the live host (sdk.settings(story-block)), so a value set in the old view shows here', async t => {
  t.mock.method(console, 'warn', () => {});
  const host = await createHost(); t.after(() => host.close());
  host.settings.set('story-block', 'chatterMax', 8);
  const vm = selectSettings({ features: host.features.list(), extras: host.sdk.settings('story-block') });
  assert.equal(extrasOf(vm).rows[1].value, 8);
  assert.equal(vm.modules.defs.find(d => d.id === 'extras').subs.length, 3);
});
