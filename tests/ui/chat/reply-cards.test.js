// The cards under the head reply, piece by piece: the engine handle (any registered card, the Cards under replies switch), the reader,
// the strip and its placement above the inline row, and a button sent through the port (a command, or a window for Edit first).
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { createCardSource } from '../../../ui/port/reply-cards.js';
import { readCard, replyCardsOf } from '../../../ui/select/reply-card.js';
import { replyCardStrip, runCardAction } from '../../../ui/chat/reply-cards.js';
import { createChatSurfaces } from '../../../ui/chat/chat-surfaces.js';
import { CORE_FEATURE } from '../../../core/features.js';

const PROBE = { tone: 'accent', title: 'A probe card', text: 'Asked on the head.', rows: [{ text: 'one row', tag: 'tag' }], actions: [{ id: 'go', label: 'Go', primary: true, command: 'probe.go', payload: { n: 1 } }] };

function engine({ cardsOn = true, entries = null } = {}) {
  const asked = [];
  const registry = {
    feature: id => (id === CORE_FEATURE.cards ? { id } : null),
    featureOn: id => (id === CORE_FEATURE.cards ? cardsOn : false),
    cardEntries: () => entries ?? [
      { moduleId: 'broken', id: 'broken/card', fn: () => { throw new Error('no'); } },
      { moduleId: 'probe', id: 'probe/card', fn: (state, message, ctx) => { asked.push({ state, message, ctx }); return { ...PROBE, title: `${PROBE.title} ${ctx.query('probe.n', {})}` }; } },
      { moduleId: 'quiet', id: 'quiet/card', fn: () => null },
    ],
    query: name => (name === 'probe.n' ? Object.assign(state => state.n, {}) : null),
    queries: () => [],
  };
  const store = { headIndex: () => 2, head: () => ({ n: 7 }), receipts: () => [] };
  return { asked, handle: createCardSource({ registry, store, ctx: () => ({ chat: ['a', 'b', { mes: 'head' }], chatId: 'c1' }) }) };
}

test('the handle asks every registered card about the head reply; a card that throws or answers nothing is left out', () => {
  const { asked, handle } = engine();
  const got = handle.head();
  assert.equal(got.index, 2);
  assert.deepEqual(got.cards.map(item => item.key), ['probe/card']);
  assert.equal(asked[0].ctx.index, 2);
  assert.equal(asked[0].ctx.head, true);
  assert.equal(asked[0].ctx.chatId, 'c1');
  assert.deepEqual(asked[0].message, { mes: 'head' });
  assert.deepEqual(asked[0].state, { n: 7 });
});

test('the Cards under replies switch off, or no module with a card: no cards at all', () => {
  assert.equal(engine({ cardsOn: false }).handle.head(), null);
  assert.equal(engine({ entries: [] }).handle.head(), null);
});

test('readCard keeps a clean card; a card without a title, or a button with neither command nor window, is dropped', () => {
  assert.equal(readCard({ text: 'no title' }), null);
  const card = readCard({ tone: 'end', title: 'T', actions: [{ label: 'x' }, { label: 'Open', open: 'story-block/new-character', payload: { name: 'Pell' } }, { label: 'Bad', command: 'not a command' }] });
  assert.equal(card.tone, 'info', 'an unknown tone reads as info');
  assert.deepEqual(card.actions, [{ id: 'action-1', label: 'Open', primary: false, command: '', open: 'story-block/new-character', payload: { name: 'Pell' } }]);
  assert.deepEqual(readCard({ title: 'T', actions: [{ label: 'Both', open: 'story-block/new-character', command: 'rpg.joinNo' }] }).actions.map(a => [a.open, a.command]), [['story-block/new-character', '']], 'a button with both opens the window');
  assert.equal(replyCardsOf({ index: 3, cards: [{ key: 'k', card: { text: 'untitled' } }] }), null, 'nothing reads: no cards');
  assert.equal(replyCardsOf(null), null);
});

test('the strip sits under the reply it was asked about, above the inline row, and goes when no card answers', () => {
  const doc = installFakeDom();
  const messages = doc.createElement('div');
  for (const [index, user] of [[0, false], [1, true], [2, false]]) {
    const mes = doc.createElement('div');
    mes.className = user ? 'mes user' : 'mes';
    mes.setAttribute('mesid', String(index));
    const block = doc.createElement('div');
    block.className = 'mes_block';
    mes.appendChild(block);
    messages.appendChild(mes);
  }
  doc.body.appendChild(messages);
  const acted = [];
  const surfaces = createChatSurfaces({ messagesEl: messages, handlers: { onCardAction: action => { acted.push(action); return { ok: true }; } } });
  const replyCards = replyCardsOf(engine().handle.head());
  surfaces.refresh({ inlineRow: { date: '', time: '', place: '', weather: null, money: null, changes: 0, notApplied: 0, needsYou: null, fightOpen: false }, drawer: [], replyCards });
  const block = messages.querySelector('.mes[mesid="2"] .mes_block');
  assert.deepEqual([...block.children].map(el => el.className), ['sscards', 'ssrow'], 'cards first, then the row');
  assert.equal(block.querySelector('.sscd-t').textContent, 'A probe card 7');
  block.querySelector('.sscd button[data-act="go"]').click();
  assert.deepEqual(acted.map(action => [action.command, action.payload]), [['probe.go', { n: 1 }]]);
  surfaces.refresh({ inlineRow: null, drawer: [] });
  assert.equal(messages.querySelector('.sscards'), null);
});

test('a button goes through the port: a command as the reader\'s action, a window (Edit first) with its draft; a refusal is said on the card', async () => {
  const calls = [];
  const port = { command: async (type, payload) => { calls.push(['command', type, payload]); return { ok: false, message: 'Not now.' }; }, open: async (id, payload) => { calls.push(['open', id, payload]); return { ok: true }; } };
  assert.deepEqual(await runCardAction(port, { command: 'rpg.joinNo', payload: { name: 'Pell' } }), { ok: false, message: 'Not now.' });
  assert.deepEqual(await runCardAction(port, { open: 'story-block/new-character', payload: { name: 'Pell' } }), { ok: true });
  assert.deepEqual(calls, [['command', 'rpg.joinNo', { name: 'Pell' }], ['open', 'story-block/new-character', { name: 'Pell' }]]);
  installFakeDom();
  const strip = replyCardStrip([{ key: 'k', card: readCard(PROBE) }], action => runCardAction(port, action));
  strip.querySelector('button').click();
  for (let n = 0; n < 4; n += 1) await new Promise(resolve => setImmediate(resolve));
  const why = strip.querySelector('.sscd-why');
  assert.equal(why.hasAttribute('hidden'), false);
  assert.equal(why.textContent, 'Not now.');
  assert.equal(replyCardStrip([], () => {}), null);
});
