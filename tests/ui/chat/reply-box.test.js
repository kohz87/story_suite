// The card under a reply (ui/chat/reply-box.js and its parts): the three top lines, a pool's change, the tabs it has (and not the others), the
// reader's tab order, one tab open at a time, and the newest-only parts (the ⧉ corner and the action line).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { replyBox } from '../../../ui/chat/reply-box.js';
import { replyBoxTop } from '../../../ui/chat/reply-box-top.js';
import { tabsOf, replyBoxTabs } from '../../../ui/chat/reply-box-tabs.js';
import { replyBoxActions } from '../../../ui/chat/reply-box-actions.js';
import { readTabOrder } from '../../../ui/select/reply-tabs.js';
import { fixture } from '../../../ui/fixtures/index.js';

const ORDER = readTabOrder('');
const CARD = {
  index: 4,
  top: { date: 'CY 611, October 1', time: '10:00 am', place: 'Bluewatch Village · Guild Office', weather: 'wet snow', pools: [{ kind: 'hp', value: 1, max: 8, before: 8 }, { kind: 'mp', value: 10, max: 10, before: null }, { kind: 'sp', value: 0, max: 12, before: 12 }], condition: 'bandaged hound bite on the left forearm, rat bites on both shins' },
  changes: [{ glyph: 'coin', line: '+2 gold', detail: 'from Pella', applied: true, assist: false }, { glyph: 'people', line: 'Pella: Trust +1', detail: 'the day’s allowance', applied: false, assist: false }],
  chatter: [{ name: 'Pella', text: 'Two gold out of the box before noon.' }],
  here: [{ personId: 'np_p', name: 'Pella', portrait: null, meters: { trust: 22, affection: 6, desire: 0, tension: 0 } }],
  choices: ['Ask Pella where the infirmary is', 'Sell the pelts'],
};
const tabIds = el => el.querySelectorAll('.tb').map(tab => tab.dataset.tab);

test('the top: time · place · weather on line 1, HP · MP · SP with this reply\'s change on line 2, the condition whole on line 3; no money', () => {
  installFakeDom();
  const [l1, l2, l3] = replyBoxTop(CARD.top);
  assert.match(l1.textContent, /CY 611, October 1 · 10:00 am.*Bluewatch Village · Guild Office.*wet snow/su);
  assert.deepEqual(l2.querySelectorAll('.vb').map(vb => vb.dataset.pool), ['hp', 'mp', 'sp']);
  const hp = l2.querySelector('[data-pool="hp"]');
  assert.equal(hp.querySelector('.v').textContent, '1/8');
  assert.equal(hp.querySelector('.d').textContent, '−7', 'the change beside the bar');
  assert.equal(hp.querySelector('.bar u').style.getPropertyValue('width'), '100%', 'the faint part: where it was');
  assert.equal(hp.querySelector('.bar i').style.getPropertyValue('width'), '12.5%');
  assert.equal(l2.querySelector('[data-pool="mp"]').querySelectorAll('.d').length + l2.querySelector('[data-pool="mp"]').querySelectorAll('u').length, 0, 'an unmoved pool has no change and no faint part');
  assert.equal(l3.textContent, 'Condition: bandaged hound bite on the left forearm, rat bites on both shins');
  assert.doesNotMatch([l1, l2, l3].map(el => el.textContent).join(' '), /gold|silver|◉/u);
  assert.deepEqual(replyBoxTop({ date: '', time: '', place: '', weather: null, pools: [], condition: null }), [], 'nothing to show: no lines');
  const healed = replyBoxTop({ pools: [{ kind: 'hp', value: 6, max: 8, before: 2 }] })[0];
  assert.equal(healed.querySelector('.d').textContent, '+4');
  assert.ok(healed.querySelector('.d').classList.contains('up'));
});

test('tabs: only the ones the reply has, in the reader\'s order, a hidden one left out', () => {
  installFakeDom();
  assert.deepEqual(tabsOf(CARD, ORDER).map(tab => [tab.id, tab.n]), [['changes', 2], ['chatter', 1], ['here', 1], ['choices', 2]]);
  assert.deepEqual(tabsOf({ ...CARD, chatter: [], choices: [] }, ORDER).map(tab => tab.id), ['changes', 'here']);
  assert.deepEqual(tabsOf(CARD, readTabOrder('choices here -chatter changes')).map(tab => tab.id), ['choices', 'here', 'changes']);
  assert.equal(replyBoxTabs({ changes: [], chatter: [], here: [], choices: [] }, { order: ORDER }), null, 'nothing: no strip');
  const strip = replyBoxTabs(CARD, { order: ORDER });
  assert.deepEqual(tabIds(strip), ['changes', 'chatter', 'here', 'choices']);
  assert.ok(strip.classList.contains('shut'));
  assert.equal(strip.querySelectorAll('.tp').length, 0, 'shut: no panel');
  assert.equal(strip.querySelector('[data-tab="changes"]').textContent, 'Changes2');
});

test('one tab open at a time; a tap on the open tab shuts it, a tap on another opens that one', () => {
  installFakeDom();
  const seen = [];
  const open = replyBoxTabs(CARD, { order: ORDER, open: 'here', onTab: id => seen.push(id) });
  assert.deepEqual(open.querySelectorAll('.tb.on').map(tab => tab.dataset.tab), ['here']);
  assert.equal(open.querySelector('.tp').dataset.panel, 'here');
  open.querySelector('[data-tab="here"]').click();
  open.querySelector('[data-tab="changes"]').click();
  assert.deepEqual(seen, [null, 'changes']);
  assert.equal(replyBoxTabs(CARD, { order: ORDER, open: 'nope' }).querySelectorAll('.tb.on').length, 0, 'an unknown tab: shut');
});

test('the panels: changes with Why on a held-back move, chatter rows, Here cards that open a page, choices that fill the message box', () => {
  installFakeDom();
  const changes = replyBoxTabs(CARD, { order: ORDER, open: 'changes' });
  const rows = changes.querySelectorAll('.chg');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelectorAll('.why').length, 0);
  const why = rows[1].querySelector('.why');
  assert.ok(rows[1].querySelector('.why-x').hasAttribute('hidden'));
  why.click();
  assert.equal(rows[1].querySelector('.why-x').hasAttribute('hidden'), false);
  assert.equal(rows[1].querySelector('.why-x').textContent, 'the day’s allowance');
  assert.match(replyBoxTabs(CARD, { order: ORDER, open: 'chatter' }).querySelector('.ch').textContent, /^Pella: .*Two gold out of the box before noon\./u);
  const opened = [];
  const here = replyBoxTabs(CARD, { order: ORDER, open: 'here', on: { onOpenPerson: (id, name) => opened.push([id, name]) } });
  here.querySelector('.pc2').click();
  assert.deepEqual(opened, [['np_p', 'Pella']]);
  const typed = [];
  const choices = replyBoxTabs(CARD, { order: ORDER, open: 'choices', on: { onChoice: text => typed.push(text) } });
  choices.querySelectorAll('.cho')[1].click();
  assert.deepEqual(typed, ['Sell the pelts']);
});

test('the newest reply has the ⧉ corner (Open Suite) and its action line; an older one has neither', () => {
  installFakeDom();
  const actions = fixture({ fightOpen: true, rpg: true }).chat.head.actions;
  const opened = [];
  const newest = replyBox(CARD, { newest: true, actions, order: ORDER, on: { onOpenSuite: tab => opened.push(tab), onFight: () => opened.push('fight') } });
  assert.ok(newest.classList.contains('newest'));
  newest.querySelector('.cnr').click();
  assert.equal(newest.querySelector('.cnr').getAttribute('aria-label'), 'Open Suite');
  newest.querySelector('.ab.hot').click();
  assert.deepEqual(opened, ['now', 'fight']);
  assert.equal(newest.dataset.index, '4');
  const older = replyBox(CARD, { newest: false, actions, order: ORDER });
  assert.equal(older.querySelectorAll('.cnr').length + older.querySelectorAll('.ssrc-acts').length, 0);
});

test('the action line: each thing to do runs its command; nothing to do, no line', () => {
  installFakeDom();
  const seen = [];
  const on = { onFight: () => seen.push('fight'), onPoints: () => seen.push('points'), onOverdue: () => seen.push('overdue'), onJoin: name => seen.push(`join ${name}`), onOffers: () => seen.push('offers'), onReread: () => seen.push('reread') };
  const all = { fight: true, loot: [], points: { n: 2, who: ['Astra'] }, overdue: { n: 1, names: ['the rent'] }, joins: ['Mara'], offers: 1, unrecorded: true };
  const line = replyBoxActions(all, on);
  assert.deepEqual(line.querySelectorAll('button').map(b => b.textContent), ['⚔ Fight open›', '2 points to spend›', '1 overdue›', 'Mara asks to join›', '1 pack offer›', '!No changes recorded — Re-read']);
  line.querySelectorAll('button').forEach(b => b.click());
  assert.deepEqual(seen, ['fight', 'points', 'overdue', 'join Mara', 'offers', 'reread']);
  assert.equal(replyBoxActions({ fight: false, loot: [], points: null, overdue: null, joins: [], offers: 0, unrecorded: false }, on), null);
  assert.equal(replyBoxActions(null, on), null);
  assert.match(replyBoxActions({ unrecorded: true }, {}).textContent, /^!No changes recorded$/u, 'no Re-read here: the badge only');
});

test('the action line\'s Pick up names the loot and folds its picker; Take sends the ticked ones', async () => {
  installFakeDom();
  const sent = [];
  const loot = [{ sid: 'rc-loot-1', where: 'in the sacks', taken: false, items: [{ at: 0, label: 'rat tails ×12' }, { at: 1, label: 'torn grain sack' }] }];
  const line = replyBoxActions({ loot }, { onLootTake: (sid, pick) => { sent.push([sid, pick]); return { ok: true }; } });
  const pick = line.querySelector('[data-loot]');
  assert.equal(pick.textContent, 'Pick up: rat tails ×12, torn grain sack›');
  assert.ok(line.querySelector('.sslootp').hasAttribute('hidden'));
  pick.click();
  assert.equal(line.querySelector('.sslootp').hasAttribute('hidden'), false);
  assert.equal(pick.getAttribute('aria-expanded'), 'true');
  line.querySelectorAll('.lpchip')[0].click();
  line.querySelector('.lptake').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(sent, [['rc-loot-1', [0]]]);
  assert.equal(replyBoxActions({ loot: [{ ...loot[0], taken: true }] }, {}), null, 'taken: nothing to pick up');
});

test('a Here card: the ring and the portrait (a bad file name shows the initial); a tap opens the page', async () => {
  installFakeDom();
  const { hereCard } = await import('../../../ui/chat/here-card.js');
  const opened = [];
  const card = hereCard({ personId: 'np_r', name: 'Watch-Captain Edda Rorke', portrait: '/a.png', meters: { trust: 12 } }, (id, name) => opened.push(id + name));
  assert.equal(card.querySelectorAll('svg path').length, 1, 'one feeling above 0: one arc');
  assert.match(card.querySelector('.ph').style.getPropertyValue('background-image'), /\/a\.png/u);
  assert.equal(card.querySelector('b').textContent, 'Watch-Captain Edda Rorke', 'the whole name (two lines by the CSS)');
  card.click();
  assert.deepEqual(opened, ['np_rWatch-Captain Edda Rorke']);
  assert.equal(card.getAttribute('role'), 'button');
  assert.equal(hereCard({ personId: 'x', name: 'Bo', portrait: 'bad"url', meters: {} }).querySelector('.ph').textContent, 'B');
});
