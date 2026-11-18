// The wizard's Skills and Review steps tell the truth about a skill: the pool it draws on, the rank that works at the level, and one stance only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { drawReview } from '../../../ui/wizard/review.js';
import { drawSkills } from '../../../ui/wizard/skills.js';
import { newDraft, problemsOf } from '../../../modules/rpg/view/wizard-data.js';

const skill = (name, stat, type, extra = {}) => ({ name, about: 'Does a thing.', stat, uses: 'stamina', start: 0, ...(type ? { type } : {}), ...extra });
const draftOf = (skills, level) => ({ ...newDraft({ persona: 'Wessel' }), name: 'Wessel', skills, ...(level ? { level } : {}) });
const world = { world: () => ({ extras: { add: [], skipped: [] }, room: true, persona: 'Wessel', names: [], hasYou: false }), query: () => [], chatId: () => 'c' };
const reviewLines = draft => drawReview({ run: { draft, busy: false, alive: true, message: '' }, world, command: async () => ({ ok: true }), redraw() {}, close() {} })
  .querySelectorAll('.wz-list li').map(li => li.textContent);

test('Review names the pool the way the Party sheet does: INT, WIS and a heal draw Mana, the rest Stamina', () => {
  installFakeDom();
  const lines = reviewLines(draftOf([skill('Bind wounds', 'wis', 'heal'), skill('Tracking', 'int', 'utility'), skill('Bolt', 'int'), skill('Slash', 'str'), skill('Mend', 'str', 'heal')]));
  assert.deepEqual(lines.map(line => line.split(' · ')[2]), ['Mana', 'Mana', 'Mana', 'Stamina', 'Mana']);
});

test('Review says an Adept start works from Lv 10 while the level is lower, and plainly once it is not', () => {
  installFakeDom();
  assert.match(reviewLines(draftOf([skill('Cleave', 'str', 'area', { start: 1 })], 2))[0], /starts at Adept \(works from Lv 10\)$/);
  assert.match(reviewLines(draftOf([skill('Cleave', 'str', 'area', { start: 1 })], 12))[0], /starts at Adept$/);
  assert.match(reviewLines(draftOf([skill('Cleave', 'str', 'area', { start: 0 })], 2))[0], /starts at Novice$/);
});

test('the Skills step offers Adept with the level it works from while the level is lower', () => {
  installFakeDom();
  const options = level => {
    const draft = draftOf([skill('Cleave', 'str', 'area')], level);
    const step = drawSkills({ run: { draft, pendingSet: null }, world, put() {}, summary() {}, redraw() {} });
    return step.querySelector('[data-field="start"]').querySelectorAll('option').map(o => o.textContent);
  };
  assert.deepEqual(options(2), ['Novice', 'Adept (works from Lv 10)']);
  assert.deepEqual(options(10), ['Novice', 'Adept']);
});

test('Create waits while two skills are stances (defence, evasion, movement, support), and names them', () => {
  const where = { persona: 'Wessel', names: [], room: true, hasYou: false };
  const one = problemsOf(draftOf([skill('Shield work', 'vit', 'defence'), skill('Cleave', 'str', 'area')]), where);
  assert.deepEqual(one, []);
  const two = problemsOf(draftOf([skill('Shield work', 'vit', 'defence'), skill('Dodge', 'agi', 'evasion')]), where);
  assert.deepEqual(two, ['Only one stance skill (defence, evasion, movement or support) may be kept, and Shield work, Dodge are all stances.']);
  assert.equal(problemsOf(draftOf([skill('Shield work', 'vit', 'defence'), skill('Guard', 'vit', 'defence')]), where).length, 1);
});
