import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../helpers/dom.js';
import { latestReplyOf, drawerLayout, createChatSurfaces } from '../../../ui/chat/chat-surfaces.js';
import { fixture } from '../../../ui/fixtures/index.js';

function chat(doc, kinds = ['reply', 'user', 'reply']) {
  const messages = doc.createElement('div');
  const msgs = kinds.map(k => {
    const mes = doc.createElement('div');
    mes.className = k === 'user' ? 'mes user' : 'mes';
    const bx = doc.createElement('div');
    bx.className = 'bx';
    mes.appendChild(bx);
    messages.appendChild(mes);
    return mes;
  });
  doc.body.appendChild(messages);
  return { messages, msgs };
}

test('latestReplyOf skips the user messages, by class or is_user', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc, ['reply', 'reply', 'user']);
  assert.equal(latestReplyOf(messages), msgs[1]);
  msgs[1].setAttribute('is_user', 'true');
  assert.equal(latestReplyOf(messages), msgs[0]);
  assert.equal(latestReplyOf(chat(doc, ['user']).messages), null);
  assert.equal(latestReplyOf(null), null);
});

test('drawerLayout hides with nobody, folds while typing on narrow only', () => {
  const rows = [{ name: 'a' }];
  assert.deepEqual(drawerLayout([], {}), { hidden: true, folded: false, perPage: 4 });
  assert.equal(drawerLayout(undefined).hidden, true);
  assert.deepEqual(drawerLayout(rows, { typing: true, narrow: true }), { hidden: false, folded: true, perPage: 2 });
  assert.equal(drawerLayout(rows, { typing: true, narrow: false }).folded, false);
  assert.equal(drawerLayout(rows, { open: false }).folded, true);
  assert.equal(drawerLayout(rows).folded, false);
});

test('the row moves to the newest reply on each refresh', () => {
  const doc = installFakeDom();
  const { messages, msgs } = chat(doc);
  const drawerHost = doc.createElement('div');
  const s = createChatSurfaces({ messagesEl: messages, drawerHost });
  const vm = fixture('default').chat;
  s.refresh(vm);
  assert.equal(msgs[2].querySelectorAll('.ssrow').length, 1);
  assert.equal(msgs[0].querySelectorAll('.ssrow').length, 0);
  const next = doc.createElement('div');
  next.className = 'mes';
  next.appendChild(doc.createElement('div'));
  messages.appendChild(next);
  s.refresh(vm);
  assert.equal(messages.querySelectorAll('.ssrow').length, 1);
  assert.equal(next.querySelectorAll('.ssrow').length, 1);
  assert.equal(msgs[2].querySelectorAll('.ssrow').length, 0);
  s.refresh(null);
  assert.equal(messages.querySelectorAll('.ssrow').length, 0);
});

test('no reply, no row; handlers reach the row and drawer', () => {
  const doc = installFakeDom();
  const { messages } = chat(doc, ['user']);
  const drawerHost = doc.createElement('div');
  const seen = [];
  const s = createChatSurfaces({ messagesEl: messages, drawerHost, handlers: { onOpenPerson: id => seen.push(id) } });
  s.refresh(fixture('default').chat);
  assert.equal(messages.querySelectorAll('.ssrow').length, 0);
  drawerHost.querySelector('.pc2').click();
  assert.equal(seen.length, 1);
  createChatSurfaces({}).refresh(fixture('default').chat);
});

test('drawer hides when nobody is here and returns when someone is', () => {
  const doc = installFakeDom();
  const { messages } = chat(doc);
  const drawerHost = doc.createElement('div');
  const s = createChatSurfaces({ messagesEl: messages, drawerHost });
  const vm = fixture('default').chat;
  s.refresh({ ...vm, drawer: [] });
  assert.equal(drawerHost.hasAttribute('hidden'), true);
  assert.equal(drawerHost.children.length, 0);
  s.refresh(vm);
  assert.equal(drawerHost.hasAttribute('hidden'), false);
  assert.equal(drawerHost.querySelectorAll('.drawer').length, 1);
});

test('typing folds the drawer on a narrow screen only; toggle and paging work', () => {
  const doc = installFakeDom();
  const { messages } = chat(doc);
  const drawerHost = doc.createElement('div');
  let narrow = true;
  const s = createChatSurfaces({ messagesEl: messages, drawerHost, isNarrow: () => narrow });
  const vm = fixture('default').chat;
  s.refresh(vm);
  const expanded = () => drawerHost.querySelector('.dhd').getAttribute('aria-expanded');
  assert.equal(expanded(), 'true');
  s.setTyping(true);
  assert.equal(expanded(), 'false');
  s.setTyping(false);
  assert.equal(expanded(), 'true');
  narrow = false;
  s.setTyping(true);
  assert.equal(expanded(), 'true');
  s.setTyping(false);
  s.toggleDrawer();
  assert.equal(expanded(), 'false');
  drawerHost.querySelector('.dhd').click();
  assert.equal(expanded(), 'true');
  narrow = true;
  s.refresh(vm);
  if (vm.drawer.length > 2) {
    drawerHost.querySelector('.arr[aria-label="Next"]').click();
    assert.equal(drawerHost.querySelector('.drawer').dataset.page, '1');
  }
});

test('latestReplyOf works when querySelectorAll returns a NodeList-like (no filter method)', () => {
  const els = [{ classList: { contains: () => false }, getAttribute: () => null }, { classList: { contains: c => c === 'user' }, getAttribute: () => null }];
  const messagesEl = { querySelectorAll: () => ({ length: els.length, 0: els[0], 1: els[1], [Symbol.iterator]: () => els[Symbol.iterator]() }) };
  assert.equal(latestReplyOf(messagesEl), els[0]);
});
