// selectWorld with World events: the conditions block and how the news came (rumour or confirmed) only while the switch is on; off it is the view as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWorld } from '../../../ui/select/world.js';
import { heardLine } from '../../../ui/tabs/world/news.js';
import { conditionsCard } from '../../../ui/tabs/world/conditions.js';
import { installFakeDom } from '../helpers/dom.js';

const worldView = { news: [{ id: 'ev_1', name: 'The lord calls a levy', state: 'ongoing', summary: 'Soldiers at the gate.', heard: [
  { where: 'in Highmark', when: 'June 4, 1200', from: 'a courier' }, { where: 'in Highmark', when: 'June 5, 1200', from: 'rumour' }, { where: 'in Highmark', when: 'June 6, 1200', from: 'Oyla' }] }] };
const here = { place: 'Highmark', conditions: [
  { key: 'unrest@Highmark', name: 'unrest', ref: 'Highmark', sinceText: 'June 4, 1200', why: 'levy', means: 'Crowds in the streets.', told: 'all goods ×1.3, grain ×2' },
  { key: 'x', name: '', ref: 'nowhere' }, null] };

test('off: no conditions field and no `how` on a stamp, whatever the answers hold', () => {
  const view = selectWorld({ worldView, conditionsHere: here });
  assert.equal('conditions' in view, false);
  assert.deepEqual(view.news[0].heard.map(h => 'how' in h), [false, false, false]);
  assert.deepEqual(view, selectWorld({ worldView }));
});

test('on: the conditions (named ones only) and `how` for the world\'s own stamps, not for a person\'s word', () => {
  const view = selectWorld({ worldView, worldEvents: true, conditionsHere: here });
  assert.deepEqual(view.conditions, { place: 'Highmark', rows: [{ key: 'unrest@Highmark', name: 'unrest', ref: 'Highmark', since: 'June 4, 1200', why: 'levy', means: 'Crowds in the streets.', told: 'all goods ×1.3, grain ×2' }] });
  assert.deepEqual(view.news[0].heard.map(h => h.how), ['confirmed', 'rumour', undefined]);
  assert.equal(selectWorld({ worldView, worldEvents: true }).conditions, null, 'the answer is missing');
});

test('heardLine says rumour or confirmed first when the stamp has `how`; without it the line is as before', () => {
  assert.equal(heardLine([{ where: 'in Highmark', when: 'June 5', from: 'rumour', how: 'rumour' }]), 'rumour · heard in Highmark, June 5');
  assert.equal(heardLine([{ where: 'a', when: 'b', from: 'x' }, { where: 'in Highmark', when: 'June 4', from: 'a courier', how: 'confirmed' }]), 'confirmed · last news: heard in Highmark, June 4 · from a courier');
  assert.equal(heardLine([{ where: 'in Highmark', when: 'June 4', from: 'a courier' }]), 'heard in Highmark, June 4 · from a courier');
});

test('the card: name, place, date, reason, meaning and told effects; nothing when nothing holds or the field is absent', () => {
  installFakeDom();
  assert.equal(conditionsCard(undefined), null);
  assert.equal(conditionsCard({ place: 'Highmark', rows: [] }), null);
  const card = conditionsCard(selectWorld({ worldView, worldEvents: true, conditionsHere: here }).conditions);
  assert.equal(card.dataset.card, 'conditions');
  assert.equal(card.querySelector('.cnt').textContent, 'Highmark');
  assert.equal(card.querySelector('.eh b').textContent, 'unrest');
  assert.deepEqual(card.querySelectorAll('.meta2 span').map(s => s.textContent), ['since June 4, 1200', 'because levy', 'prices and roads: all goods ×1.3, grain ×2']);
});
