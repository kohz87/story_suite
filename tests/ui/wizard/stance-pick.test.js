// The Skills step stops a second stance skill as the reader chooses: the other skills' stance types are off and say why; Review still holds Create.
// A focus skill rolls with INT or WIS: the Stat list says so, a type change moves the stat, and Review holds a file's focus skill on another stat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { drawSkills } from '../../../ui/wizard/skills.js';
import { drawReview } from '../../../ui/wizard/review.js';
import { newDraft, withSet, withSkillPatch } from '../../../modules/rpg/view/wizard-data.js';

const skill = (name, stat, type, extra = {}) => ({ name, about: 'Does a thing.', stat, uses: 'stamina', start: 0, type, ...extra });
const draftOf = skills => ({ ...newDraft({ persona: 'Wessel' }), name: 'Wessel', skills });
const world = { world: () => ({ extras: { add: [], skipped: [] }, room: true, persona: 'Wessel', names: [], hasYou: false }), query: () => [], chatId: () => 'c' };
const step = draft => drawSkills({ run: { draft, pendingSet: null }, world, put() {}, summary() {}, redraw() {} });
const typeOptions = (node, at) => node.querySelectorAll('[data-skill]')[at].querySelector('[data-field="type"]').querySelectorAll('option');
const stanceOnes = options => options.filter(o => /^(Defence|Speed|Focus)/.test(o.textContent));

test('one stance holds it: the other skills see the stance types off, with the reason', () => {
  installFakeDom();
  const node = step(draftOf([skill('Shield work', 'vit', 'defence'), skill('Dodge', 'agi', 'attack')]));
  const other = stanceOnes(typeOptions(node, 1));
  assert.equal(other.length, 3);
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
  assert.equal(stanceOnes(typeOptions(node, 1))[1].textContent, 'Speed — stance taken by Old guard');
});

test('two stances from an import: a note names both, and Review still lists twoStances', () => {
  installFakeDom();
  const draft = draftOf([skill('Shield work', 'vit', 'defence'), skill('Dodge', 'agi', 'speed')]);
  const node = step(draft);
  assert.match(node.querySelector('[data-wiz="stance-note"]').textContent, /Shield work, Dodge are all stances/);
  const lines = drawReview({ run: { draft, busy: false, alive: true, message: '' }, world, command: async () => ({ ok: true }), redraw() {}, close() {} }).textContent;
  assert.match(lines, /Only one stance skill .* Shield work, Dodge are all stances/);
});

const statOptions = (node, at) => node.querySelectorAll('[data-skill]')[at].querySelector('[data-field="stat"]').querySelectorAll('option');

test('a focus skill rolls with INT or WIS: its Stat list offers only those two and says why for the others', () => {
  installFakeDom();
  const node = step(draftOf([skill('Calm', 'wis', 'focus'), skill('Cut', 'str', 'attack')]));
  const open = statOptions(node, 0).filter(o => !o.hasAttribute('disabled')).map(o => o.textContent);
  assert.deepEqual(open, ['INT', 'WIS']);
  assert.ok(statOptions(node, 0).some(o => o.textContent === 'CHA — a focus skill rolls with INT or WIS'));
  assert.ok(statOptions(node, 1).every(o => !o.hasAttribute('disabled')), 'an attack keeps every stat');
});

test('turning a skill into Focus moves a stat other than INT or WIS to WIS; a set or file that brings one is held at Review with the reason', () => {
  installFakeDom();
  const draft = draftOf([skill('Calm', 'cha', 'utility'), skill('Spark', 'int', 'attack')]);
  const turned = withSkillPatch(draft, 0, { type: 'focus' });
  assert.deepEqual([turned.skills[0].type, turned.skills[0].stat], ['focus', 'wis']);
  assert.equal(withSkillPatch(draftOf([skill('Calm', 'int', 'attack')]), 0, { type: 'focus' }).skills[0].stat, 'int', 'INT stays');
  const set = { id: 'pack.x/medic', name: 'Medic', skills: [{ name: 'Calm', about: 'Steadies.', stat: 'cha', uses: 'stamina', type: 'support' }] };
  assert.deepEqual(withSet(draftOf([]), set).skills.map(each => [each.type, each.stat]), [['focus', 'wis']], 'a set\'s support on CHA comes in as focus on WIS');
  const imported = draftOf([skill('Calm', 'cha', 'focus')]);
  const lines = drawReview({ run: { draft: imported, busy: false, alive: true, message: '' }, world, command: async () => ({ ok: true }), redraw() {}, close() {} }).textContent;
  assert.match(lines, /Calm is a focus skill: pick INT or WIS for its stat\./);
});
