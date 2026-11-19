// The chat surfaces (ui/chat/chat-surfaces.js): one card under every story reply, each with its own data; the newest rests with Choices open and
// carries the corner and the action line; a tapped tab outlives a redraw until a new reply comes; the modules' cards sit below the head card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { latestReplyOf, drawnReplies, restingTab, createChatSurfaces } from '../../../ui/chat/chat-surfaces.js';
import { fixture } from '../../../ui/fixtures/index.js';

// SillyTavern's chat: one .mes per message (mesid its index), the reply column .mes_block inside.
function chat(doc, kinds = ['reply', 'user', 'reply', 'user', 'reply']) {
  const messages = doc.createElement('div');
  const msgs = kinds.map((k, i) => {
    const mes = doc.createElement('div');
    mes.className = k === 'user' ? 'mes user' : 'mes';
    mes.setAttribute('mesid', String(i));
    const block = doc.createElement('div');
    block.className = 'mes_block';
    mes.appendChild(block);
    messages.appendChild(mes);
    return mes;
  });
  doc.body.appendChild(messages);
  return { messages, msgs };
}
const cardIn = mes => mes.querySelector('[data-ss-card]');
const vmOf = (opts = 'default') => { const vm = fixture(opts).chat; vm.replies[0].index = 2; vm.replies[1].index = 4; vm.head.index = 4; return vm; };

test('latestReplyOf and drawnReplies skip the reader\'s messages', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc, ['reply', 'user', 'reply', 'user']);
  assert.equal(latestReplyOf(messages), msgs[2]);
  assert.deepEqual(drawnReplies(messages), [0, 2]);
  assert.deepEqual(drawnReplies(null), []);
  assert.equal(latestReplyOf(null), null);
});

test('one card under each reply with its own data; none under the reader\'s messages', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc);
  createChatSurfaces({ messagesEl: messages }).refresh(vmOf());
  assert.equal(cardIn(msgs[0]), null, 'no card asked for the greeting');
  assert.equal(cardIn(msgs[1]) ?? cardIn(msgs[3]), null);
  assert.equal(cardIn(msgs[2]).dataset.index, '2');
  assert.equal(cardIn(msgs[4]).dataset.index, '4');
  assert.match(cardIn(msgs[2]).querySelector('.ssrc-l1').textContent, /9:10 am/u, 'the older reply keeps its own time');
  assert.match(cardIn(msgs[4]).querySelector('.ssrc-l1').textContent, /9:30 am/u);
  assert.equal(msgs[4].querySelector('.mes_block').querySelectorAll('[data-ss-card]').length, 1);
});

test('the newest rests with Choices open and has the corner and actions; an older one rests shut', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc);
  createChatSurfaces({ messagesEl: messages }).refresh(vmOf());
  const newest = cardIn(msgs[4]);
  assert.deepEqual(newest.querySelectorAll('.tb.on').map(tab => tab.dataset.tab), ['choices']);
  assert.equal(newest.querySelectorAll('.cnr').length, 1);
  assert.equal(newest.querySelectorAll('.ssrc-acts').length, 1);
  const older = cardIn(msgs[2]);
  assert.equal(older.querySelectorAll('.tb.on').length, 0);
  assert.equal(older.querySelectorAll('.cnr').length + older.querySelectorAll('.ssrc-acts').length, 0);
  assert.equal(restingTab({ choices: ['a'] }, { newest: true, order: [{ id: 'choices', on: false }] }), null, 'Choices hidden: nothing rests open');
  assert.equal(restingTab({ choices: [] }, { newest: true, order: [{ id: 'choices', on: true }] }), null);
});

test('a tapped tab outlives a redraw; a new reply lets every older one rest again', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc, ['reply', 'user', 'reply', 'user', 'reply', 'user', 'reply']);
  const surfaces = createChatSurfaces({ messagesEl: messages });
  surfaces.refresh(vmOf());
  cardIn(msgs[2]).querySelector('[data-tab="changes"]').click();
  assert.deepEqual(cardIn(msgs[2]).querySelectorAll('.tb.on').map(tab => tab.dataset.tab), ['changes']);
  cardIn(msgs[4]).querySelector('[data-tab="choices"]').click();
  assert.equal(cardIn(msgs[4]).querySelectorAll('.tb.on').length, 0, 'a tap on the open tab shuts it');
  surfaces.refresh(vmOf());
  assert.deepEqual(cardIn(msgs[2]).querySelectorAll('.tb.on').map(tab => tab.dataset.tab), ['changes'], 'kept across a redraw');
  assert.equal(cardIn(msgs[4]).querySelectorAll('.tb.on').length, 0);
  const next = vmOf();
  next.replies.push({ ...structuredClone(next.replies[1]), index: 6 });
  next.head.index = 6;
  surfaces.refresh(next);
  assert.equal(cardIn(msgs[2]).querySelectorAll('.tb.on').length, 0, 'a new reply: the older ones rest shut');
  assert.equal(cardIn(msgs[4]).querySelectorAll('.tb.on').length + cardIn(msgs[4]).querySelectorAll('.cnr').length, 0);
  assert.deepEqual(cardIn(msgs[6]).querySelectorAll('.tb.on').map(tab => tab.dataset.tab), ['choices']);
});

test('a swipe redraws that reply\'s card with its new data; a delete takes its card away; an unchanged card is left as it is', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc);
  const surfaces = createChatSurfaces({ messagesEl: messages });
  surfaces.refresh(vmOf());
  const older = cardIn(msgs[2]);
  const swiped = vmOf();
  swiped.replies[1].top.place = 'The swiped place';
  surfaces.refresh(swiped);
  assert.equal(cardIn(msgs[2]), older, 'the older card did not change: the same element');
  assert.match(cardIn(msgs[4]).textContent, /The swiped place/u);
  const deleted = vmOf();
  deleted.replies.splice(0, 1);
  surfaces.refresh(deleted);
  assert.equal(cardIn(msgs[2]), null);
  surfaces.clear();
  assert.equal(cardIn(msgs[4]), null);
});

test('the modules\' cards go under the head reply, below its card', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc);
  const vm = vmOf();
  vm.replyCards = { index: 4, list: [{ key: 'join', card: { tone: 'accent', title: 'Mara asks to join', text: '', rows: [], actions: [] } }] };
  createChatSurfaces({ messagesEl: messages }).refresh(vm);
  const kids = msgs[4].querySelector('.mes_block').children;
  assert.deepEqual(kids.map(el => (el.dataset.ssCard ? 'card' : el.dataset.ssCards ? 'cards' : 'other')), ['card', 'cards']);
});

test('nothing to show (no replies, no view) draws nothing', () => {
  const doc = installFakeDom();
  const { messages } = chat(doc);
  const surfaces = createChatSurfaces({ messagesEl: messages });
  surfaces.refresh(null);
  surfaces.refresh(fixture('empty').chat);
  assert.equal(messages.querySelectorAll('[data-ss-card]').length, 0);
  createChatSurfaces({}).refresh(vmOf());
});
