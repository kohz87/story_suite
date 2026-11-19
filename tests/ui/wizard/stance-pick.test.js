// The Skills step stops a second stance skill as the reader chooses: the other skills' stance types are off and say why; Review still holds Create.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { drawSkills } from '../../../ui/wizard/skills.js';
import { drawReview } from '../../../ui/wizard/review.js';
import { newDraft } from '../../../modules/rpg/view/wizard-data.js';

const skill = (name, stat, type, extra = {}) => ({ name, about: 'Does a thing.', stat, uses: 'stamina', start: 0, type, ...extra });
const draftOf = skills => ({ ...newDraft({ persona: 'Wessel' }), name: 'Wessel', skills });
const world = { world: () => ({ extras: { add: [], skipped: [] }, room: true, persona: 'Wessel', names: [], hasYou: false }), query: () => [], chatId: () => 'c' };
const step = draft => drawSkills({ run: { draft, pendingSet: null }, world, put() {}, summary() {}, redraw() {} });
const typeOptions = (node, at) => node.querySelectorAll('[data-skill]')[at].querySelector('[data-field="type"]').querySelectorAll('option');
const stanceOnes = options => options.filter(o => /^(Defence|Evasion|Movement|Support)/.test(o.textContent));

test('one stance holds it: the other skills see the stance types off, with the reason', () => {
  installFakeDom();
  const node = step(draftOf([skill('Shield work', 'vit', 'defence'), skill('Dodge', 'agi', 'attack')]));
  const other = stanceOnes(typeOptions(node, 1));
  assert.equal(other.length, 4);
  assert.ok(other.every(o => o.hasAttribute('disabled')));
  assert.equal(other[0].textContent, 'Defence — stance taken by Shield work');
  assert.ok(typeOptions(node, 1).filter(o => o.textContent === 'Attack' || o.textContent === 'Heal').every(o => !o.hasAttribute('disabled')));
  assert.ok(typeOptions(node, 0).every(o => !o.hasAttribute('disabled')), "the holder's own list stays open");
});

test('switched to a non-stance type, the stance types come back', () => {
  installFakeDom();
  const node = step(draftOf([skill('Shield work', 'vit', 'attack'), skill('Dodge', 'agi', 'attack')]));
  assert.ok(typeOptions(node, 1).every(o => !o.hasAttribute('disabled')));
  assert.equal(node.querySelector('[data-wiz="stance-note"]'), null);
});

test('a locked signature stance counts as the holder', () => {
  installFakeDom();
  const node = step(draftOf([skill('Old guard', 'vit', 'defence', { sig: true }), skill('Dodge', 'agi', 'attack')]));
  assert.equal(stanceOnes(typeOptions(node, 1))[1].textContent, 'Evasion — stance taken by Old guard');
});

test('two stances from an import: a note names both, and Review still lists twoStances', () => {
  installFakeDom();
  const draft = draftOf([skill('Shield work', 'vit', 'defence'), skill('Dodge', 'agi', 'evasion')]);
  const node = step(draft);
  assert.match(node.querySelector('[data-wiz="stance-note"]').textContent, /Shield work, Dodge are all stances/);
  const lines = drawReview({ run: { draft, busy: false, alive: true, message: '' }, world, command: async () => ({ ok: true }), redraw() {}, close() {} }).textContent;
  assert.match(lines, /Only one stance skill .* Shield work, Dodge are all stances/);
});
