import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { buildJournal } from '../../../../ui/fixtures/journal.js';
import { questSheet, questPatch } from '../../../../ui/tabs/journal/quest-sheet.js';

const boat = () => buildJournal().quests.find(q => q.id === 'boat');

test('questPatch returns only what changed', () => {
  const q = boat();
  const same = { title: q.title, summary: q.summary, stepIndex: '1', due: 'Goldwane 18', reward: '40 copper · 60 XP', difficulty: 'normal' };
  assert.deepEqual(questPatch(q, same), {});
  assert.deepEqual(questPatch(q, { ...same, title: ' Found Hal ', stepIndex: '2', difficulty: 'hard' }), { title: 'Found Hal', stepIndex: 2, difficulty: 'hard' });
});

test('questPatch keeps old text for blank title and summary, clears due and reward, and ignores bad steps', () => {
  const q = boat();
  const patch = questPatch(q, { title: '  ', summary: '', stepIndex: '9', due: ' ', reward: '' });
  assert.deepEqual(patch, { due: null, reward: null });
  assert.deepEqual(questPatch(q, { stepIndex: 'x' }), {});
  assert.deepEqual(questPatch({ ...q, due: null }, { due: '' }), {});
  assert.deepEqual(questPatch({ ...q, due: null }, { due: 'Goldwane 20' }), { due: 'Goldwane 20' });
  assert.deepEqual(questPatch(q, {}), {});
});

test('the form shows every field with the quest values and the narrator note', () => {
  installFakeDom();
  const el = questSheet(boat(), {});
  assert.equal(el.getAttribute('aria-label'), 'Edit quest');
  assert.equal(el.querySelectorAll('.ef').length, 6);
  assert.equal(el.querySelectorAll('select option').length, 3 + 3);
  assert.match(el.textContent, /1 of 3 · Ask at the Bluewatch docks/);
  assert.match(el.querySelector('.fine').textContent, /narrator is told the quest as it now stands/);
  assert.equal(el.querySelector('.qmore').hasAttribute('hidden'), true);
});

test('with RPG off it says task and leaves out reward and difficulty', () => {
  installFakeDom();
  const el = questSheet(boat(), { rpg: false });
  assert.equal(el.querySelector('.dn').textContent, 'Edit task');
  assert.equal(el.querySelectorAll('.ef').length, 4);
  assert.match(el.querySelector('.giveup').textContent, /Give up this task/);
});

test('the ⋯ button opens and closes the give-up and delete menu', () => {
  installFakeDom();
  const calls = [];
  const el = questSheet(boat(), { onGiveUp: () => calls.push('giveup'), onDelete: () => calls.push('delete') });
  const more = el.querySelector('.qmore-btn');
  more.click();
  assert.equal(el.querySelector('.qmore').hasAttribute('hidden'), false);
  assert.equal(more.getAttribute('aria-expanded'), 'true');
  el.querySelector('.giveup').click();
  el.querySelector('.delete').click();
  assert.deepEqual(calls, ['giveup', 'delete']);
  more.click();
  assert.equal(el.querySelector('.qmore').hasAttribute('hidden'), true);
});

test('Save sends the patch from the typed values; Cancel and × only close', () => {
  installFakeDom();
  const saved = [];
  let closed = 0;
  const el = questSheet(boat(), { onSave: p => saved.push(p), onClose: () => { closed += 1; } });
  el.querySelector('.save').click();
  assert.deepEqual(saved.at(-1), {});
  const [title, due] = el.querySelectorAll('input');
  title.value = 'Find Hal';
  due.value = '';
  el.querySelectorAll('select')[0].value = '2';
  el.querySelectorAll('select')[1].value = 'hard';
  el.querySelector('.save').click();
  assert.deepEqual(saved.at(-1), { title: 'Find Hal', stepIndex: 2, due: null, difficulty: 'hard' });
  el.querySelector('.cancel').click();
  el.querySelector('.qclose').click();
  assert.equal(closed, 2);
  assert.equal(saved.length, 2);
});

test('buttons do nothing harmful without callbacks', () => {
  installFakeDom();
  const el = questSheet(boat());
  for (const sel of ['.save', '.cancel', '.qclose', '.giveup', '.delete']) el.querySelector(sel).click();
});
