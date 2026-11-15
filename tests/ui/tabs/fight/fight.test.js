import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { fightTab } from '../../../../ui/tabs/fight/fight.js';
import { checkShape } from '../../../../ui/contract/shapes.js';
import { FIGHT_SHAPE } from '../../../../ui/contract/fight.js';
import { FIGHT_STATES } from '../../../../ui/fixtures/fight.js';
import { makeCtx, fightFixture } from './helpers.js';

const cards = tab => tab.querySelectorAll('[data-card]').map(c => c.dataset.card);
const sent = ctx => ctx.port.recorded.map(r => [r.type, r.payload]);

test('every fixture state matches the Fight shape (also with 8 foes)', () => {
  for (const s of FIGHT_STATES) {
    assert.deepEqual(checkShape(fightFixture(s), FIGHT_SHAPE), [], s);
    assert.deepEqual(checkShape(fightFixture(s, { wide: true }), FIGHT_SHAPE), [], `${s} wide`);
  }
});

test('offer: header, offer card, foes and party; no actions or log', () => {
  installFakeDom();
  const tab = fightTab(fightFixture('offer'), makeCtx());
  assert.equal(tab.dataset.tab, 'fight');
  assert.equal(tab.dataset.step, 'offer');
  assert.deepEqual(cards(tab), ['fight-head', 'offer', 'foes', 'party']);
  assert.equal(tab.querySelector('.fpill').textContent, 'open');
  assert.equal(tab.querySelector('.fhead b').textContent, 'Fight · Auvoth bridge');
  assert.equal(tab.querySelector('.fhead small').textContent, 'Grey hounds and Bandit captain');
});

test('offer: board, auto and keep-telling send their command or leave for the chat', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('offer'), ctx);
  tab.querySelector('[data-offer="board"]').click();
  tab.querySelector('[data-offer="auto"]').click();
  tab.querySelector('[data-offer="story"]').click();
  assert.deepEqual(sent(ctx), [['rpg.board.start', { mode: 'board' }], ['rpg.board.auto', {}]]);
  assert.deepEqual(ctx.went, ['chat']);
});

test('choose: actions first on a phone (order), foes and party fold, log below', () => {
  installFakeDom();
  const tab = fightTab(fightFixture('choose'), makeCtx());
  assert.equal(tab.dataset.fold, '1');
  assert.equal(tab.querySelector('.fgrid').classList.contains('chz'), true);
  assert.deepEqual(cards(tab), ['fight-head', 'foes', 'party', 'actions', 'log']);
  assert.equal(tab.querySelector('.fpill').textContent, 'exchange 2');
  assert.equal(tab.querySelector('.fold-view .fline') !== null, true);
});

test('choose: tapping the party fold toggles it open and remembers it on the device', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('choose'), ctx);
  const party = tab.querySelector('.party-card');
  assert.equal(party.dataset.open, 'false');
  party.querySelector('.fold-view .pm').click();
  assert.equal(party.dataset.open, 'true');
  assert.equal(ctx.prefs.getFold('fight.party', false), true);
  party.querySelector('.pfold-btn').click();
  assert.equal(party.dataset.open, 'false');
  assert.equal(fightTab(fightFixture('choose'), ctx).querySelector('.party-card').dataset.open, 'false');
});

test('target: picking an attack opens the foes with a banner; tapping a foe stages it as one command', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('choose'), ctx);
  tab.querySelector('[data-act="normal"]').click();
  assert.equal(tab.dataset.step, 'target');
  assert.equal(tab.dataset.fold, '0');
  assert.match(tab.querySelector('.banner').textContent, /^Normal attack: tap a foe\./);
  assert.equal(tab.querySelectorAll('.mbx.tgt').length, 3);
  tab.querySelector('[data-target="Hound 3"]').click();
  assert.deepEqual(sent(ctx), [['rpg.board.stage', { actorId: 'brann', action: 'normal', target: { kind: 'member', id: 'Hound 3' } }]]);
  assert.equal(tab.dataset.step, 'choose');
});

test('target: an area skill lights groups; Back returns to choosing without a command', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('choose'), ctx);
  tab.querySelector('[data-act="cleave"]').click();
  assert.match(tab.querySelector('.banner').textContent, /^Cleave: one roll for each member of a group\./);
  assert.equal(tab.querySelectorAll('.fg.tgt').length, 2);
  tab.querySelector('[data-back]').click();
  assert.equal(tab.dataset.step, 'choose');
  assert.equal(tab.querySelector('.banner'), null);
  tab.querySelector('[data-act="cleave"]').click();
  tab.querySelector('.fg.tgt').click();
  assert.deepEqual(sent(ctx), [['rpg.board.stage', { actorId: 'brann', action: 'cleave', target: { kind: 'group', id: 'Grey hounds' } }]]);
});

test('ally: Use item lights the party first with the heal preview; tapping a member stages it', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('choose'), ctx);
  tab.querySelector('[data-act="item"]').click();
  assert.equal(tab.dataset.step, 'ally');
  assert.deepEqual(cards(tab).slice(1, 4), ['party', 'foes', 'actions']);
  assert.match(tab.querySelector('.banner.ally').textContent, /^Use item: tap who gets it\./);
  assert.match(tab.querySelector('[data-ally="torka"]').textContent, /7\/14 → 13/);
  tab.querySelector('[data-ally="torka"]').click();
  assert.deepEqual(sent(ctx), [['rpg.board.stage', { actorId: 'brann', action: 'item', target: { kind: 'ally', id: 'torka' } }]]);
});

test('Flee needs no target: it stages straight away; the stance switch and Auto and Discard send commands', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('choose'), ctx);
  tab.querySelector('[data-act="flee"]').click();
  tab.querySelector('.sw').click();
  tab.querySelector('[data-auto]').click();
  tab.querySelector('[data-discard]').click();
  assert.deepEqual(sent(ctx), [
    ['rpg.board.stage', { actorId: 'brann', action: 'flee', target: null }],
    ['rpg.board.stance', { actorId: 'brann', on: false }],
    ['rpg.board.auto', {}],
    ['rpg.board.discard', {}],
  ]);
  assert.equal(tab.dataset.step, 'choose');
});

test('engine states target and ally with nothing picked yet fall back to choosing', () => {
  installFakeDom();
  assert.equal(fightTab(fightFixture('target'), makeCtx()).dataset.step, 'choose');
  assert.equal(fightTab(fightFixture('ally'), makeCtx()).dataset.step, 'choose');
});

test('after: the resolved card replaces the actions and the next exchange is one command', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('after'), ctx);
  assert.deepEqual(cards(tab), ['fight-head', 'foes', 'party', 'after', 'log']);
  assert.equal(tab.querySelector('.fpill').textContent, 'exchange 2 done');
  assert.equal(tab.querySelector('.anote').textContent, 'Hounds 2 and 3 down · the captain at 2 · Brann and Rika hurt.');
  tab.querySelector('[data-next]').click();
  assert.deepEqual(sent(ctx), [['rpg.board.next', {}]]);
});

test('end: shows the end card then the log; Back finishes the fight and goes to the chat; Discard sends its command', () => {
  installFakeDom();
  const ctx = makeCtx();
  const tab = fightTab(fightFixture('end'), ctx);
  assert.deepEqual(cards(tab), ['fight-head', 'end', 'log']);
  assert.equal(tab.querySelector('.fpill').textContent, 'won');
  assert.equal(tab.querySelector('.fpill').classList.contains('won'), true);
  assert.equal(tab.querySelectorAll('.xpr div')[2].textContent, '4 of 4foes down');
  assert.match(tab.querySelector('.endr').textContent, /^AAstraHealth 11\/14 · Stamina 6\/15 · Mana 14\/14/);
  tab.querySelector('[data-finish]').click();
  tab.querySelector('[data-discard]').click();
  assert.deepEqual(sent(ctx), [['rpg.board.finish', {}], ['rpg.board.discard', {}]]);
  assert.deepEqual(ctx.went, ['chat']);
});

test('the 8-foe worst case renders three groups folded to three lines, and every button is a real control', () => {
  installFakeDom();
  const tab = fightTab(fightFixture('choose', { wide: true }), makeCtx());
  assert.equal(tab.querySelectorAll('.fold-view .fline').length, 3);
  assert.equal(tab.querySelectorAll('.foes-card .fg').length, 3);
  assert.equal(tab.querySelectorAll('.foes-card .mbx').length, 8);
  assert.equal(tab.querySelectorAll('button').every(b => b.getAttribute('type') === 'button'), true);
});

test('no view-model, no foes, or no commands port: null, null, and clicks still work', () => {
  installFakeDom();
  assert.equal(fightTab(null), null);
  assert.equal(fightTab({ ...fightFixture('choose'), foeGroups: [] }), null);
  const tab = fightTab(fightFixture('choose'));
  tab.querySelector('[data-auto]').click();
  tab.querySelector('[data-act="normal"]').click();
  assert.equal(tab.dataset.step, 'target');
});

test('no innerHTML, Date.now or Math.random in the view files', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../../../../ui/tabs/fight/', import.meta.url);
  for (const f of readdirSync(dir)) assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /innerHTML|Date\.now|Math\.random|eval\(/, f);
});

test('a lost or fled fight does not get the green pill; the subtitle lists three groups with commas', () => {
  installFakeDom();
  const vm = fightFixture('end');
  vm.end.outcome = 'lost';
  const tab = fightTab(vm, makeCtx());
  assert.equal(tab.querySelector('.fpill').textContent, 'lost');
  assert.equal(tab.querySelector('.fpill').classList.contains('won'), false);
  const wide = fightTab(fightFixture('choose', { wide: true }), makeCtx());
  assert.equal(wide.querySelector('.fhead small').textContent, 'Grey hounds, Men in grey and Bandit captain');
});
