// Settings › People's list editors reach the engine in the open chat: a custom meter, a per-meter stage, a ladder rung and a preset stored
// through the page's port are what NPC State reads at the next reply, and swipe, swipe back, a Re-read and a cold reload replay the same state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../../modules/people/storysuite-v2.js';
import { FEATURE_STAGES } from '../../modules/people/meters/npc-meters.js';
import { peopleCommand } from '../../ui/port/people-settings.js';
import { OLD_DEFAULTS, suite } from './cast-dossier.helpers.js';

const page = s => (key, value) => peopleCommand('settings.set', { key: `people.${key}`, value }, { settings: { set: (id, k, v) => s.host.settings.set(id, k, v) } }, () => s.host.sdk.settings(MODULE_ID));

test('a meter, a stage, a rung and a preset set on the page apply to the open chat at the next reply', async () => {
  const s = await suite({ features: { [FEATURE_STAGES]: true, ...OLD_DEFAULTS } });
  const set = page(s);
  await s.say(['~ npc Mira | trust: +5']);
  assert.equal(s.meters('Mira').meters.fear, undefined, 'no Fear meter yet');
  assert.equal(set('customMeters', [{ name: 'Fear', min: 0, max: 10, start: 0 }]).ok, true);
  assert.equal(set('perMeterStages', [{ meter: 'Fear', at: 8, name: 'Uneasy' }]).ok, true);
  assert.equal(set('stageLadder', [{ name: 'Friend', needs: 'trust 15', milestone: '', track: '' }]).ok, true);
  assert.equal(set('presets', ['Rival']).ok, true);
  await s.say(['~ npc Mira | fear: +12', '~ npc Mira | trust: +12']);
  const mira = s.meters('Mira');
  assert.equal(mira.meters.fear, 10, 'held to the meter\'s new highest');
  assert.equal(mira.stages.fear, 'Uneasy');
  assert.equal(mira.rank, 'Friend', 'the reader\'s rung, reached on the numbers');
  assert.deepEqual([mira.meters.respect, mira.meters.rivalry], [10, 50], 'the Rival preset\'s meters, at their starts');
  assert.equal(s.host.sdk.settings(MODULE_ID).presets[0], 'rival');
});

test('after a settings change, swipe, swipe back, a Re-read and a cold reload give the live state', async () => {
  const s = await suite({ features: { [FEATURE_STAGES]: true, ...OLD_DEFAULTS } });
  const set = page(s);
  set('customMeters', [{ name: 'Fear', min: 0, max: 100, start: 0 }]);
  set('perMeterStages', [{ meter: 'Fear', at: 20, name: 'Scared' }]);
  await s.say(['~ npc Mira | fear: +10']);
  await s.say(['~ npc Mira | fear: +12']);
  const live = JSON.stringify(s.host.head());
  assert.equal(s.meters('Mira').stages.fear, 'Scared');
  await s.swipe(['~ npc Mira | fear: +5']);
  assert.equal(s.meters('Mira').stages.fear, undefined, 'the swipe has its own numbers');
  await s.host.st.swipeTo(s.host.store.headIndex(), 0);
  await s.adapter.ticked();
  assert.equal(JSON.stringify(s.host.head()), live, 'swipe back');
  s.host.store.rebuild();
  assert.equal(JSON.stringify(s.host.head()), live, 'replay');
  assert.equal((await s.host.sdk.reread(s.host.store.headIndex())).ok, true);
  assert.equal(s.meters('Mira').meters.fear, 22);
  await s.host.st.loadChat(s.host.ctx.chat);
  await s.adapter.ticked();
  assert.equal(s.meters('Mira').meters.fear, 22, 'cold reload');
  assert.equal(s.meters('Mira').stages.fear, 'Scared');
});

test('with page-set meters and stages: an edited Re-read (grown, shrunk), a middle delete and a chat change replay as live', async () => {
  const s = await suite({ features: { [FEATURE_STAGES]: true, ...OLD_DEFAULTS } });
  const set = page(s);
  set('customMeters', [{ name: 'Fear', min: 0, max: 100, start: 0 }]);
  set('perMeterStages', [{ meter: 'Fear', at: 20, name: 'Scared' }]);
  await s.say(['~ npc Mira | fear: +10']);
  const middle = s.host.store.headIndex();
  await s.say(['~ npc Mira | fear: +5']);
  await s.say(['~ npc Mira | fear: +1']);
  const head = s.host.store.headIndex();
  const same = label => { const live = JSON.stringify(s.host.head()); s.host.store.rebuild(); assert.equal(JSON.stringify(s.host.head()), live, label); };
  const edit = async (at, lines) => {
    await s.host.st.editMessage(at, `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`);
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    await s.adapter.ticked();
  };
  assert.deepEqual([s.meters('Mira').meters.fear, s.meters('Mira').stages.fear], [16, undefined]);
  await edit(head, ['~ npc Mira | fear: +6', '~ npc Mira | trust: +3']);
  assert.deepEqual([s.meters('Mira').meters.fear, s.meters('Mira').stages.fear], [21, 'Scared'], 'grown: 15 + 6 reaches the stage at 20');
  same('edited Re-read, grown');
  await edit(head, []);
  assert.deepEqual([s.meters('Mira').meters.fear, s.meters('Mira').stages.fear], [15, undefined], 'shrunk: back under 20, the stage is lost');
  same('edited Re-read, shrunk');
  await edit(middle, ['~ npc Mira | fear: +2']);
  same('edited Re-read of a middle reply');
  await s.host.st.deleteMessage(middle);
  await s.host.st.deleteMessage(middle - 1);
  await s.adapter.ticked();
  same('middle delete');
  const before = JSON.stringify(s.host.head());
  const chat = s.host.ctx.chat;
  await s.host.st.loadChat([], 'other-chat');
  await s.adapter.ticked();
  await s.host.st.loadChat(chat);
  await s.adapter.ticked();
  assert.equal(JSON.stringify(s.host.head()), before, 'chat change and back');
});
