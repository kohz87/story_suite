import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { buildJournal } from '../../../../ui/fixtures/journal.js';
import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { questsCard, leadsCard, closedCard } from '../../../../ui/tabs/journal/quests.js';

const mk = () => {
  const sent = [];
  const went = [];
  const edited = [];
  return { sent, went, edited, prefs: createPrefs({ chatId: 'q' }), command: (t, p) => sent.push([t, p]), go: (t, a) => went.push([t, a]), editQuest: q => edited.push(q.id) };
};

test('quest cards: focus first, step, dots, giver, due, trip, reward and difficulty', () => {
  installFakeDom();
  const card = questsCard(buildJournal(), mk());
  assert.equal(card.querySelector('h3').textContent, 'Quests');
  assert.equal(card.querySelector('.cnt').textContent, '4 under way');
  const cards = card.querySelectorAll('.qc');
  assert.equal(cards[0].dataset.quest, 'boat');
  assert.equal(cards[0].classList.contains('focus'), true);
  assert.equal(cards[0].querySelector('.step').textContent, '2Reach Auvoth and ask at the docks');
  assert.equal(cards[0].querySelectorAll('.sdots i').length, 3);
  assert.equal(cards[0].querySelectorAll('.sdots i.on').length, 1);
  assert.match(cards[0].querySelector('.sdots span').textContent, /step 2 of 3/);
  const kv = cards[0].querySelector('.qkv').textContent;
  assert.match(kv, /Sister Temiwa/);
  assert.match(kv, /Goldwane 18 in 5 days/);
  assert.match(kv, /Trip to Auvoth planned/);
  assert.match(kv, /40 copper · 60 XP/);
  assert.match(kv, /normal/);
  assert.equal(cards[1].querySelector('.sdots'), null);
});

test('an overdue quest says overdue with a red due word', () => {
  installFakeDom();
  const over = questsCard(buildJournal(), mk()).querySelector('[data-quest="over"]');
  assert.equal(over.classList.contains('over'), true);
  assert.equal(over.querySelector('.qst').textContent, 'overdue');
  assert.equal(over.querySelector('.due').classList.contains('late'), true);
});

test('with RPG off it is Tasks with no reward, XP or difficulty', () => {
  installFakeDom();
  const card = questsCard(buildJournal({ rpg: false }), mk());
  assert.equal(card.querySelector('h3').textContent, 'Tasks');
  assert.doesNotMatch(card.textContent, /Reward|Difficulty|XP|copper/);
});

test('the star puts a quest first, sends quest.focus, and a second tap clears focus', () => {
  installFakeDom();
  const ctx = mk();
  const card = questsCard(buildJournal(), ctx);
  card.querySelector('[data-quest="harb"] .fstar').click();
  assert.deepEqual(ctx.sent.at(-1), ['quest.focus', { id: 'harb' }]);
  assert.equal(card.querySelector('.qc').dataset.quest, 'harb');
  assert.equal(card.querySelector('.fstar.on').getAttribute('aria-pressed'), 'true');
  assert.equal(card.querySelectorAll('.fstar.on').length, 1);
  card.querySelector('.fstar.on').click();
  assert.deepEqual(ctx.sent.at(-1), ['quest.focus', { id: null }]);
  assert.equal(card.querySelectorAll('.fstar.on').length, 0);
});

test('focus goes through the port when there is no command callback, and nothing breaks without either', () => {
  installFakeDom();
  const log = [];
  const card = questsCard(buildJournal(), { port: { command: (t, p) => log.push([t, p]) } });
  card.querySelector('[data-quest="hound"] .fstar').click();
  assert.deepEqual(log, [['quest.focus', { id: 'hound' }]]);
  questsCard(buildJournal(), {}).querySelector('.fstar').click();
});

test('Edit hands the quest to the editor and the giver opens their dossier', () => {
  installFakeDom();
  const ctx = mk();
  const card = questsCard(buildJournal(), ctx);
  card.querySelector('[data-quest="boat"] .qedit').click();
  assert.deepEqual(ctx.edited, ['boat']);
  card.querySelector('[data-quest="boat"] .lk').click();
  assert.deepEqual(ctx.went, [['people', { personId: 'temiwa' }]]);
  assert.equal(card.querySelector('[data-quest="hound"] .lk'), null);
  questsCard(buildJournal(), {}).querySelector('.qedit').click();
});

test('no quests means no card', () => {
  installFakeDom();
  assert.equal(questsCard(buildJournal({ empty: true }), mk()), null);
  assert.equal(questsCard(undefined), null);
});

test('leads list who, where and when each lapses; none means no card', () => {
  installFakeDom();
  const card = leadsCard(buildJournal());
  assert.equal(card.querySelector('.cnt').textContent, '3 not taken');
  const first = card.querySelector('.lead2');
  assert.equal(first.querySelector('b').textContent, 'Guards wanted for the frontier road');
  assert.match(first.textContent, /Bluewatch Guild · notice board/);
  assert.equal(first.querySelector('.lapse').textContent, 'lapses Goldwane 20');
  assert.match(card.querySelector('.fine').textContent, /2 days later/);
  assert.equal(leadsCard(buildJournal({ empty: true })), null);
  assert.equal(leadsCard(null), null);
});

test('Closed is folded by default, opens to all five outcomes with pay, and the fold is remembered', () => {
  installFakeDom();
  const ctx = mk();
  const card = closedCard(buildJournal(), ctx);
  assert.equal(card.querySelector('.fold').getAttribute('aria-expanded'), 'false');
  assert.equal(card.querySelector('.closed'), null);
  card.querySelector('.fold').click();
  assert.equal(card.querySelectorAll('.cq').length, 5);
  assert.deepEqual(card.querySelectorAll('.cq .qst').map(n => n.textContent), ['done', 'declined', 'lapsed', 'failed', 'given up']);
  assert.match(card.querySelector('.cq small').textContent, /\+12 XP/);
  assert.equal(ctx.prefs.getFold('journal.closed', false), true);
  assert.equal(closedCard(buildJournal(), ctx).querySelector('.closed') !== null, true);
  card.querySelector('.fold').click();
  assert.equal(card.querySelector('.closed'), null);
});

test('Closed hides pay with RPG off and is absent when empty', () => {
  installFakeDom();
  const ctx = mk();
  ctx.prefs.setFold('journal.closed', true);
  assert.doesNotMatch(closedCard(buildJournal({ rpg: false }), ctx).textContent, /XP/);
  assert.equal(closedCard(buildJournal({ empty: true }), ctx), null);
  assert.equal(closedCard(undefined), null);
});
