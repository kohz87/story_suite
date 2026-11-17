import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { sceneTab } from '../../../../ui/tabs/scene/host.js';
import { selectScene } from '../../../../ui/select/interaction.js';
import { fightSceneAnswer } from '../../../../ui/fixtures/fight-scene.js';
import { createFakePort } from '../../../../ui/port/fake-port.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const open = (fight = 'choose', options) => selectScene(fightSceneAnswer(fight, options));
// A no-target pick that waits for the others: Flee without `alone` (a real Flee stages by itself).
const quiet = vm => { for (const a of vm.view.actors) for (const x of a.groups.Flee) delete x.pick.alone; return vm; };
const build = (vm, port = createFakePort(), go = undefined) => ({ port, tab: sceneTab(vm, { port, go }) });
const sent = port => port.recorded.map(r => [r.type, r.payload]);
const tap = (tab, selector) => tab.querySelector(selector).click();

test('the fight kind draws on the scene host: one header, one Discard, no stance row, no Fight-tab commands', () => {
  installFakeDom();
  const { tab } = build(open('choose'));
  assert.equal(tab.querySelectorAll('[data-card="fight-head"]').length, 1);
  assert.equal(tab.querySelector('[data-card="scene-head"]'), null);
  assert.equal(tab.querySelectorAll('[data-discard]').length, 1);
  assert.equal(tab.querySelector('[data-act="discard"]'), null);
  assert.equal(tab.querySelector('.stance'), null);
  assert.equal(tab.querySelector('[data-act="send"]'), null);
  assert.equal(tab.querySelector('.fpill').textContent, 'exchange 2');
  assert.match(tab.querySelector('.actions-card .ah b').textContent, /^Astra: choose an action/);
});

test('one pick per standing member, in order, then one stage with all four inputs', async () => {
  installFakeDom();
  const vm = open('choose');
  const { tab, port } = build(vm);
  tap(tab, '[data-act="normal"]');
  assert.equal(tab.querySelector('.fight-tab').dataset.step, 'target');
  tap(tab, '[data-target="Hound 2"]');
  assert.match(tab.querySelector('.actions-card .ah b').textContent, /^Torka/);
  assert.equal(port.recorded.length, 0);
  tap(tab, '[data-act="brute"]');
  tap(tab, '[data-target="Captain"]');
  tap(tab, '[data-act="aimed"]');
  tap(tab, '[data-target="Captain"]');
  tap(tab, '[data-act="cleave"]');
  assert.equal(tab.querySelector('.banner').textContent.startsWith('Cleave: one roll'), true);
  tap(tab, '[data-target="Grey hounds"]');
  await flush();
  assert.deepEqual(sent(port), [['interaction.stage', { id: vm.id, step: { inputs: [
    { actor: 'actor-astra', choice: 'attack', args: { who: 'Astra', target: 1 } },
    { actor: 'actor-torka', choice: 'skill', args: { who: 'Torka', skill: 'Brute strike', target: 3 } },
    { actor: 'actor-rika', choice: 'skill', args: { who: 'Rika', skill: 'Aimed shot', target: 3 } },
    { actor: 'actor-brann', choice: 'skill', args: { who: 'Brann', skill: 'Cleave', area: true, group: 0 } },
  ] } }]]);
});

test('an action with no target is picked at once; an item asks for an ally; Back takes the last pick back', async () => {
  installFakeDom();
  const vm = quiet({ ...open('choose'), steps: 7 });
  const { tab, port } = build(vm);
  tap(tab, '[data-act="flee"]');
  assert.match(tab.querySelector('.actions-card .ah b').textContent, /^Torka/);
  assert.equal(tab.querySelector('.party-card [data-member="astra"] .ch2').textContent, 'Flee');
  tap(tab, '[data-act="item"]');
  assert.equal(tab.querySelector('.banner.ally').textContent, 'Use item: tap who gets it.');
  tap(tab, '[data-back]');
  assert.equal(tab.querySelector('.banner'), null);
  tap(tab, '[data-back]');
  assert.match(tab.querySelector('.actions-card .ah b').textContent, /^Astra/);
  assert.equal(port.recorded.length, 0);
});

test('Auto is one auto command for one exchange', async () => {
  installFakeDom();
  const vm = open('choose');
  const { tab, port } = build(vm);
  tap(tab, '[data-auto]');
  await flush();
  assert.deepEqual(sent(port), [['interaction.auto', { id: vm.id, n: 1 }]]);
});

test('picks are kept for the same interaction and step count, and dropped when the count or the id changes', () => {
  installFakeDom();
  const vm = quiet({ ...open('choose'), id: 'keyed-1', steps: 3 });
  const first = build(vm);
  tap(first.tab, '[data-act="flee"]');
  const again = build(vm); // a redraw of the same exchange keeps the pick
  assert.match(again.tab.querySelector('.actions-card .ah b').textContent, /^Torka/);
  assert.match(build({ ...vm, steps: 4 }).tab.querySelector('.actions-card .ah b').textContent, /^Astra/);
  tap(build(vm).tab, '[data-act="flee"]');
  assert.match(build({ ...vm, id: 'keyed-2' }).tab.querySelector('.actions-card .ah b').textContent, /^Astra/);
});

test('a held pick for a member no longer asked is dropped', () => {
  installFakeDom();
  const vm = quiet({ ...open('choose'), id: 'keyed-3', steps: 1 });
  tap(build(vm).tab, '[data-act="flee"]'); // Astra
  const view = structuredClone(vm.view);
  view.actors = view.actors.slice(1); // Astra fell: the first asked is now Torka
  assert.match(build({ ...vm, view }).tab.querySelector('.actions-card .ah b').textContent, /^Torka/);
});

test('a resolved exchange: the after card, Send and Discard on the session id, Choose next, no null tags', async () => {
  installFakeDom();
  const vm = open('after');
  vm.view.foeGroups[0].tier = null;
  vm.view.foeGroups[0].odds.word = null;
  const { tab, port } = build(vm);
  assert.equal(tab.querySelector('.fpill').textContent, 'exchange 2 done');
  assert.equal(tab.querySelector('[data-next]'), null);
  assert.equal(tab.querySelector('.foes-card').textContent.includes('null'), false);
  tap(tab, '[data-act="send"]');
  await flush();
  tap(tab, '[data-discard]');
  await flush();
  assert.deepEqual(sent(port), [['interaction.send', { id: vm.id }], ['interaction.discard', { id: vm.id }]]);
});

test('after a resolved exchange with members to ask, Choose exchange N+1 goes back to the picks', () => {
  installFakeDom();
  const vm = open('after');
  vm.view.actors = open('choose').view.actors;
  const { tab } = build(vm);
  tap(tab, '[data-next]');
  assert.ok(tab.querySelector('.actions-card'));
});

test('the end: outcome card with the one danger Discard, Back to the story, a null XP shows no figure; sent and taken-back scenes ask nothing', () => {
  installFakeDom();
  const end = open('end');
  end.view.end.xpEach = null;
  const { tab } = build(end);
  assert.equal(tab.querySelector('.endb').dataset.outcome, 'won');
  assert.equal(tab.querySelector('.xpr').textContent.includes('XP'), false);
  assert.equal(tab.querySelectorAll('[data-discard]').length, 1);
  const sentTab = build(open('choose', { scene: 'sent' })).tab;
  assert.equal(sentTab.querySelector('.scene-state').textContent, 'Sent. It plays out with the next reply.');
  assert.equal(sentTab.querySelector('.actions-card'), null);
  assert.equal(sentTab.querySelector('.fpill').textContent, 'sent');
  assert.equal(build(open('choose', { scene: 'invalidated' })).tab.querySelector('.fpill').textContent, 'taken back');
});

test('a refused stage shows the engine message and keeps the picks for a second try', async () => {
  installFakeDom();
  const vm = quiet({ ...open('choose'), id: 'keyed-4', steps: 2 });
  let calls = 0;
  const port = { command: async () => (calls++ ? { ok: true } : { ok: false, message: 'Choose an action for each standing member.' }) };
  const { tab } = build(vm, port);
  for (const [act, target] of [['normal', 'Hound 2'], ['brute', 'Captain'], ['aimed', 'Captain']]) { tap(tab, `[data-act="${act}"]`); tap(tab, `[data-target="${target}"]`); }
  tap(tab, '[data-act="flee"]');
  await flush();
  assert.equal(tab.querySelector('.scene-note').textContent, 'Choose an action for each standing member.');
  tap(tab, '[data-stage]');
  await flush();
  assert.equal(calls, 2);
});

test('a fight view that is missing or has no foes says so and still offers Discard', () => {
  installFakeDom();
  const bare = build({ ...open('choose'), view: null }).tab;
  assert.ok(bare.querySelector('.scene-empty'));
  assert.equal(bare.querySelectorAll('[data-discard]').length, 1);
  assert.equal(bare.querySelectorAll('[data-card="fight-head"]').length, 1);
});

test('Discard is drawn once in every state: the actions card, the target step, a sent fight, a taken-back fight, the live after card has none', () => {
  installFakeDom();
  const count = vm => build(vm).tab.querySelectorAll('[data-discard]').length;
  assert.equal(count(open('target')), 1);
  assert.equal(count({ ...open('choose', { scene: 'sent' }), canDiscard: true }), 1); // as the kind reports a sent fight (preview.js)
  assert.equal(count(open('choose', { scene: 'invalidated' })), 1);
  assert.equal(count(open('offer')), 1);
  const after = open('after');
  after.view.actors = open('choose').view.actors;
  assert.equal(count(after), 0); // staged and live: "Choose exchange N+1" carries no Discard (mock v7)
  after.view.actors = [];
  assert.equal(count(after), 1);
  assert.equal(count({ ...open('choose'), canDiscard: false }), 0);
  const tab = build(open('choose')).tab;
  assert.equal(tab.querySelector('.actions-card [data-discard]').textContent, 'Discard fight');
});

test('Flee from the 2nd of 4 members stages exactly that one input, at once', async () => {
  installFakeDom();
  const vm = { ...open('choose'), id: 'keyed-5', steps: 1 };
  const { tab, port } = build(vm);
  tap(tab, '[data-act="normal"]');
  tap(tab, '[data-target="Hound 2"]');
  tap(tab, '[data-act="flee"]'); // Torka
  await flush();
  assert.deepEqual(sent(port), [['interaction.stage', { id: vm.id, step: { inputs: [{ actor: 'actor-torka', choice: 'flee', args: { who: 'Torka' } }] } }]]);
});

test('an edited Re-read that shrinks or grows the foes or the party drops the held picks', () => {
  installFakeDom();
  const vm = quiet({ ...open('choose'), id: 'keyed-6', steps: 1 });
  tap(build(vm).tab, '[data-act="flee"]');
  assert.match(build(vm).tab.querySelector('.actions-card .ah b').textContent, /^Torka/);
  const fewer = structuredClone(vm.view);
  fewer.foeGroups[0].members.pop();
  assert.match(build({ ...vm, view: fewer }).tab.querySelector('.actions-card .ah b').textContent, /^Astra/);
  const more = structuredClone(vm.view);
  more.actors.push(structuredClone(more.actors[0]));
  more.actors.at(-1).id = 'actor-new';
  assert.match(build({ ...vm, view: more }).tab.querySelector('.actions-card .ah b').textContent, /^Astra/);
});

test('an ended fight draws "Back to the story ›", and pressing it goes to the chat', () => {
  installFakeDom();
  const went = [];
  const { tab } = build(open('end'), createFakePort(), (...where) => went.push(where));
  assert.equal(tab.querySelectorAll('[data-finish]').length, 1);
  tap(tab, '[data-finish]');
  assert.deepEqual(went, [['chat']]);
});

// A stance in the view (as the v1 engine writes it): the switch is drawn, and turning it off stages an input that says so.
const withStance = (stance = { name: 'Shield work', on: true, soakOn: 22, soakOff: 12, paid: null }) => {
  const vm = open('choose');
  vm.view.actors[0].stance = stance;
  return vm;
};

test('a stance in the view draws the switch and the soak now, with no cost note', () => {
  installFakeDom();
  const { tab } = build(withStance());
  assert.equal(tab.querySelectorAll('.stance').length, 1);
  assert.equal(tab.querySelector('.stance .t').textContent.startsWith('Shield work'), true);
  assert.equal(tab.querySelector('.stance .now').textContent, 'now: soak 22%');
  assert.equal(tab.querySelector('.stance small'), null);
  assert.equal(tab.querySelector('[data-stance]').getAttribute('aria-checked'), 'true');
});

test('turning the stance off, then picking, stages an input with args.stance === false; left on, the input has no stance key', async () => {
  installFakeDom();
  const first = build(withStance());
  tap(first.tab, '[data-stance]');
  assert.equal(first.tab.querySelector('[data-stance]').getAttribute('aria-checked'), 'false');
  assert.equal(first.tab.querySelector('.stance .now').textContent, 'now: soak 12%');
  tap(first.tab, '[data-act="flee"]');
  await flush();
  assert.equal(first.port.recorded[0].payload.step.inputs[0].args.stance, false);
  const second = build(withStance());
  tap(second.tab, '[data-act="flee"]');
  await flush();
  assert.equal('stance' in second.port.recorded[0].payload.step.inputs[0].args, false);
});

test('a stance the last exchange had off starts off, and the next pick carries it', async () => {
  installFakeDom();
  const { tab, port } = build(withStance({ name: 'Shield work', on: false, soakOn: 22, soakOff: 12, paid: null }));
  assert.equal(tab.querySelector('[data-stance]').getAttribute('aria-checked'), 'false');
  tap(tab, '[data-act="flee"]');
  await flush();
  assert.equal(port.recorded[0].payload.step.inputs[0].args.stance, false);
});
