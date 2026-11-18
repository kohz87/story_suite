// Settings wording, through the real selectors and the real overlay: one term ("feelings") in the NPC State switches,
// the Chat extras description names no Trackers, and Start/section texts say the switches are the same in every chat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSettings } from '../../../../ui/select/settings.js';
import { CARD_TEXT } from '../../../../ui/select/module-text.js';
import { FEATURES as NPC_FEATURES } from '../../../../modules/people/meters/npc-meters-config-parts/features.js';
import { installFakeDom } from '../../../helpers/ui-fake-dom.js';
import { createSettingsOverlay } from '../../../../ui/settings/overlay.js';
import { renderSettingsSection } from '../../../../ui/settings/sections/index.js';

const features = NPC_FEATURES.map(f => ({ id: f.id, moduleId: 'npc-state-delta', moduleName: 'NPC State', label: f.label, describe: f.describe, default: f.default, presets: f.presets, available: true, on: f.default }));
const open = id => {
  const settings = selectSettings({ features });
  const ov = createSettingsOverlay({ doc: installFakeDom(), settings, subtitle: 'this chat: Ersveil · Astra', renderSection: renderSettingsSection, onChange() {}, onAction() {}, onView: () => null });
  ov.open(id);
  ov.show(id);
  return { settings, el: ov.el };
};

test('the NPC State switches say feelings, never meters', () => {
  const { settings, el } = open('start');
  const subs = settings.modules.defs.find(d => d.id === 'people' || d.id === 'npc-state-delta').subs.map(s => s.label);
  assert.ok(subs.includes('Feelings drift each story day'), subs.join(' | '));
  assert.ok(subs.includes('Feeling presets and rules'), subs.join(' | '));
  assert.ok(!subs.some(l => /meter/i.test(l)), subs.join(' | '));
  assert.ok(!/meter/i.test(CARD_TEXT['npc-state-delta'].desc + CARD_TEXT['npc-state-delta'].off));
  el.querySelector('.mod .lnk').click();
  assert.ok(el.textContent.includes('Feelings drift each story day'));
  assert.ok(!NPC_FEATURES.some(f => /meter/i.test(f.label + f.describe)), 'no feature text calls a feeling a meter');
});

test('the Chat extras description does not mention Trackers', () => {
  const sec = selectSettings({ features }).sections.find(s => s.id === 'extras');
  assert.equal(sec.desc ?? sec.description ?? sec.blurb, 'Choices, inner chatter and your look.');
});

test('with no New chats set, Start and a section page say the switches are the same in every chat', () => {
  const { el } = open('start');
  assert.match(el.textContent, /switches are the same in every chat/);
  assert.doesNotMatch(el.textContent, /apply to every chat/);
});
