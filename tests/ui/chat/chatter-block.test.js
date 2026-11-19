// The foldable Inner chatter block inside a reply (ui/chat/chatter-block.js) and how the chat surfaces place it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { chatterBlock } from '../../../ui/chat/chatter-block.js';
import { createChatSurfaces } from '../../../ui/chat/chat-surfaces.js';
import { selectChatter } from '../../../ui/select/chatter.js';

const LINES = [{ name: 'Mira', text: 'He is late again.' }, { name: 'Kell', text: 'Not my business.' }];

function chat(doc, count = 2) {
  const messages = doc.createElement('div');
  const msgs = Array.from({ length: count }, (_, i) => {
    const mes = doc.createElement('div');
    mes.className = 'mes';
    mes.setAttribute('mesid', String(i));
    const bx = doc.createElement('div');
    bx.className = 'bx';
    mes.appendChild(bx);
    messages.appendChild(mes);
    return mes;
  });
  doc.body.appendChild(messages);
  return { messages, msgs };
}

test('the block is folded with a count, one row per person, and the header toggles', () => {
  installFakeDom();
  const seen = [];
  const folded = chatterBlock(LINES, { onToggle: open => seen.push(open) });
  assert.match(folded.querySelector('.ssch-t').textContent, /Inner chatter · 2/);
  assert.equal(folded.querySelector('.ssch-head').getAttribute('aria-expanded'), 'false');
  assert.ok(folded.querySelector('.ssch-body').hasAttribute('hidden'), 'folded by default');
  const rows = folded.querySelectorAll('.ssch-row');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector('b').textContent, 'Mira:');
  assert.equal(rows[0].querySelector('q.ssch-q').textContent, 'He is late again.');
  folded.querySelector('.ssch-head').click();
  assert.deepEqual(seen, [true]);
  const open = chatterBlock(LINES, { open: true });
  assert.equal(open.querySelector('.ssch-body').hasAttribute('hidden'), false);
});

test('no chatter, no block', () => {
  installFakeDom();
  assert.equal(chatterBlock([]), null);
  assert.equal(chatterBlock(undefined), null);
  assert.equal(chatterBlock([{ name: '', text: 'x' }]), null);
});

test('selectChatter keeps replies with thoughts only; the feature off (no answer) gives nothing', () => {
  assert.deepEqual(selectChatter(null), []);
  assert.deepEqual(selectChatter([]), []);
  assert.deepEqual(selectChatter([{ index: 1, lines: LINES }, { index: 2, lines: [] }, { index: -1, lines: LINES }, { lines: LINES }]), [{ index: 1, lines: LINES }]);
});

test('each reply draws its own block; the fold is shared and kept; a redraw without chatter leaves nothing', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc, 3);
  let stored = false;
  const s = createChatSurfaces({ messagesEl: messages, drawerHost: doc.createElement('div'), handlers: { chatterOpen: () => stored, onChatterFold: open => { stored = open; } } });
  const vm = { drawer: [], chatter: [{ index: 0, lines: [LINES[0]] }, { index: 2, lines: LINES }] };
  s.refresh(vm);
  assert.equal(messages.querySelectorAll('[data-ss-chatter]').length, 2);
  assert.equal(msgs[1].querySelectorAll('[data-ss-chatter]').length, 0, 'a reply with no chatter shows nothing');
  assert.match(msgs[0].querySelector('.ssch-t').textContent, /· 1$/);
  assert.match(msgs[2].querySelector('.ssch-t').textContent, /· 2$/);
  assert.equal(msgs[2].querySelector('.ssch-row b').textContent, 'Mira:');
  msgs[0].querySelector('.ssch-head').click();
  assert.equal(stored, true, 'the choice is stored');
  assert.equal(messages.querySelectorAll('[data-ss-chatter]').length, 2, 'redrawn, not doubled');
  for (const el of messages.querySelectorAll('.ssch-body')) assert.equal(el.hasAttribute('hidden'), false, 'every reply follows the fold');
  s.refresh({ drawer: [], chatter: [{ index: 2, lines: [LINES[1]] }] });
  assert.equal(messages.querySelectorAll('[data-ss-chatter]').length, 1);
  assert.equal(msgs[2].querySelector('.ssch-row b').textContent, 'Kell:', 'a swipe shows its own thoughts');
  s.refresh({ drawer: [] });
  assert.equal(messages.querySelectorAll('[data-ss-chatter]').length, 0, 'Inner chatter off: nothing');
});
