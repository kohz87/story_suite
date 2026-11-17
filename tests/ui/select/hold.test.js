// The waiting fight's offer: the view-model from the pause's read-out, and the Fight tab drawing it (working line, two or three answers, foes and party).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { selectHold } from '../../../ui/select/hold.js';
import { sceneTab } from '../../../ui/tabs/scene/host.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { SCENE_SHAPE } from '../../../ui/contract/interaction.js';

const KIND = 'story-block/fight';
const sheet = [{ id: 'astra', name: 'Astra', bars: [{ kind: 'hp', value: 9, max: 11 }, { kind: 'mp', value: 4, max: 10 }, { kind: 'sp', value: 7, max: 10 }] }];
const found = { id: 'sw_1:0:story-block/fight', kindId: KIND, mode: 'new', choice: null, title: 'This is an attack on Rats (12)', note: 'Your message waits while the fight is played on the board.',
  hint: 'Found by the pre-check from your message. Big groups fight as packs.', sendLabel: 'Send without a fight', error: '', foes: [{ name: 'Rats', count: 12, level: 2, tier: 'minion', hp: 3 }, { name: 'Rat king', count: 1, level: 4, tier: 'elite', hp: 14 }] };

test('a pause the pre-check found becomes the Fight tab offer: groups with full health, the party, send without a fight', () => {
  const vm = selectHold(found, { sheet, place: 'Tannery gate' });
  assert.deepEqual(checkShape(vm, SCENE_SHAPE), []);
  assert.equal(vm.state, 'open');
  assert.equal(vm.view.state, 'offer');
  assert.equal(vm.view.title, 'Fight · Tannery gate');
  assert.equal(vm.hold.plain, true);
  assert.equal(vm.view.foeGroups[0].members.length, 8, 'a big group shows its first eight (it fights as packs)');
  assert.deepEqual(vm.view.foeGroups[1].members, [{ id: '2:1', arg: null, name: 'Rat king', hp: 14, max: 14 }]);
  assert.deepEqual([vm.view.foeGroups[1].tier, vm.view.foeGroups[1].lv], ['elite', 4]);
  assert.deepEqual(vm.view.party[0], { id: 'astra', name: 'Astra', portrait: null, hp: 9, hpMax: 11, mp: 4, mpMax: 10, sp: 7, spMax: 10, chosen: null });
});

test('no offer once the board was chosen, for another kind, or with no foe; a working pause has its wait line only', () => {
  assert.equal(selectHold({ ...found, choice: 'board' }), null);
  assert.equal(selectHold({ ...found, kindId: 'other/kind' }), null);
  assert.equal(selectHold({ ...found, foes: [] }), null);
  assert.equal(selectHold(null), null);
  const working = selectHold({ id: 'x', kindId: KIND, mode: 'working', choice: null, title: 'Setting up the fight…', hint: 'Reading your message for the foes.', foes: [] });
  assert.equal(working.hold.working, true);
  assert.equal(working.hold.line, 'Setting up the fight…');
  assert.deepEqual(working.view.foeGroups, []);
});

test('the offer draws mock v7\'s order (head, offer card, foes, party) and its buttons answer the pause through interaction.choose', async () => {
  installFakeDom();
  const sent = [];
  const port = { command: async (type, payload) => { sent.push([type, payload]); return { ok: true }; } };
  const go = [];
  const root = sceneTab(selectHold(found, { sheet }), { port, go: tab => go.push(tab) });
  const fight = root.querySelector('.fight-tab');
  assert.equal(fight.dataset.step, 'offer');
  assert.deepEqual(fight.children.map(el => el.dataset.card ?? el.className), ['fight-head', 'offer', 'foes', 'party', 'fine scene-note']);
  assert.equal(fight.querySelector('.fpill').textContent, 'open');
  assert.match(fight.querySelector('[data-card="offer"] .otext').textContent, /^13 foes stand in your way\./);
  assert.deepEqual(fight.querySelectorAll('[data-offer]').map(b => b.textContent), ['Fight on the board', 'Auto-fight', 'Keep telling the story']);
  fight.querySelector('[data-offer="story"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(sent, [['interaction.choose', { id: found.id, choice: 'plain' }]]);
  assert.deepEqual(go, ['chat'], 'the message went without a fight: the view closes to the chat');
  const known = sceneTab(selectHold({ ...found, mode: 'known', sendLabel: undefined }, { sheet }), { port });
  assert.deepEqual(known.querySelectorAll('[data-offer]').map(b => b.dataset.offer), ['board', 'auto'], 'a known-foe pause has no send without a fight, as the old pause');
  const working = sceneTab(selectHold({ id: 'x', kindId: KIND, mode: 'working', choice: null, title: 'Setting up the fight…', hint: 'Reading your message for the foes.', foes: [] }), { port });
  assert.equal(working.querySelectorAll('[data-offer]').length, 0, 'nothing to choose while the pre-check reads');
  assert.match(working.querySelector('[data-card="offer"]').textContent, /Setting up the fight…/);
});

test('a refused answer shows its message under the offer', async () => {
  installFakeDom();
  const port = { command: async () => ({ ok: false, message: 'The sheet changed. Restore it before opening the fight, or send without a fight.' }) };
  const root = sceneTab(selectHold(found, { sheet }), { port });
  root.querySelector('[data-offer="board"]').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  const note = root.querySelector('.scene-note');
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /The sheet changed/);
});
