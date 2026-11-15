// Inline cards (SPEC §13.4): keeping the newest reply's card in view when the reader is at the bottom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeObserverClass } from './helpers.js';
import { world } from './card.helpers.js';

// ---- the newest reply's card stays in view (SillyTavern scrolls to a new reply, the card is drawn just after) ----

// The messages go into a `#chat` that has a layout of sorts: the content is 1000 high, each card box 120 and an open card 200 more,
// 400 shown; scrollTop clamps like a browser's.
function inChat(options = {}) {
    const w = world(options);
    const chat = w.doc.createElement('div');
    chat.id = 'chat';
    w.doc.body.appendChild(chat);
    for (const message of w.chat.messages) chat.appendChild(message);
    let top = 0;
    Object.defineProperty(chat, 'clientHeight', { get: () => 400, configurable: true });
    Object.defineProperty(chat, 'scrollHeight', {
        get: () => 1000 + chat.querySelectorAll('.ss-card').length * 120 + chat.querySelectorAll('.ss-card-open').length * 200 + chat.querySelectorAll('.extra-card').length * 90,
        configurable: true,
    });
    Object.defineProperty(chat, 'scrollTop', { get: () => top, set: value => { top = Math.max(0, Math.min(chat.scrollHeight - chat.clientHeight, value)); } });
    chat.toBottom = () => { top = chat.scrollHeight - chat.clientHeight; };
    return { ...w, el: chat, gap: () => chat.scrollHeight - chat.scrollTop - chat.clientHeight };
}

test('a card drawn under the newest reply takes the chat to the bottom again when the reader was at the bottom', () => {
    const w = inChat({ revs: [1, 2] });
    w.el.toBottom();
    assert.equal(w.gap(), 0);
    w.cards.refresh(1);
    assert.equal(w.chat.messages[1].querySelectorAll('.ss-card').length, 1);
    assert.equal(w.gap(), 0, 'the card is under the visible part of the chat, not below the fold');
    assert.ok(w.el.scrollTop > 0);
});

test('a reader who had scrolled up is never moved by a card drawn under the newest reply', () => {
    const w = inChat({ revs: [1, 2] });
    w.el.scrollTop = 0;
    assert.ok(w.gap() > 80);
    w.cards.refresh(1);
    assert.equal(w.chat.messages[1].querySelectorAll('.ss-card').length, 1);
    assert.equal(w.el.scrollTop, 0);
    w.cards.toggle(1, true);
    assert.equal(w.el.scrollTop, 0, 'nor by opening it');
});

test('a card under an older reply never moves the chat, even for a reader at the bottom', () => {
    const w = inChat({ revs: [1, 2, 3] });
    w.el.toBottom();
    const before = w.el.scrollTop;
    w.cards.refresh(0);
    assert.equal(w.chat.messages[0].querySelectorAll('.ss-card').length, 1);
    assert.equal(w.el.scrollTop, before);
    w.cards.toggle(0, true);
    assert.equal(w.el.scrollTop, before);
});

test('opening the newest reply\'s card, which makes it taller, keeps a reader who was at the bottom at the bottom', () => {
    const w = inChat({ revs: [1, 2] });
    w.cards.refresh(1);
    w.el.toBottom();
    assert.equal(w.cards.toggle(1, true), true);
    assert.equal(w.gap(), 0);
    assert.equal(w.chat.messages[1].querySelectorAll('.ss-card-open').length, 1);
    w.cards.toggle(1, false);
    assert.equal(w.gap(), 0, 'closing it leaves the end of the chat in view');
});

test('a pass over every message (a chat opened, a rebuild) ends at the bottom for a reader who started there, and not for one who did not', () => {
    const at = inChat({ revs: [1, 2, 3, 4] });
    at.el.toBottom();
    at.cards.attachAll();
    assert.equal(at.chat.messages.every(message => message.querySelectorAll('.ss-card').length === 1), true);
    assert.equal(at.gap(), 0);
    const up = inChat({ revs: [1, 2, 3, 4] });
    up.el.scrollTop = 0;
    up.cards.attachAll();
    assert.equal(up.el.scrollTop, 0);
});

test('a pass that changes nothing (cards already drawn) does not scroll', () => {
    const w = inChat({ revs: [1, 2] });
    w.el.toBottom();
    w.cards.attachAll();
    w.el.scrollTop = 20;
    w.cards.attachAll();
    w.cards.refresh(1);
    assert.equal(w.el.scrollTop, 20);
});

test('a module\'s reply card that arrives with the commit grows the newest reply\'s box and the chat follows; swipes and edits too', () => {
    let committed = null;
    const extra = { nodes: [] };
    const w = inChat({ revs: [1, 2], extra: {
        on: (name, fn) => { if (name === 'committed') committed = fn; return () => {}; },
        replyCards: () => extra.nodes,
        hasReplyCards: () => true,
        headIndex: () => 1,
    } });
    w.cards.attachAll();
    w.el.toBottom();
    const card = w.doc.createElement('div');
    card.className = 'extra-card';
    extra.nodes = [card];
    committed();
    assert.equal(w.chat.messages[1].querySelectorAll('.extra-card').length, 1);
    assert.equal(w.gap(), 0);
    // an edit redraws the card of the newest reply from scratch: still followed
    const grown = w.doc.createElement('div');
    grown.className = 'extra-card';
    extra.nodes = [card, grown];
    w.cards.onEdit(1);
    assert.equal(w.gap(), 0);
    // a reader who scrolled up while it was drawn is left where they are
    w.el.scrollTop = 0;
    const more = w.doc.createElement('div');
    more.className = 'extra-card';
    extra.nodes = [card, grown, more];
    committed();
    assert.equal(w.el.scrollTop, 0);
});

test('with an IntersectionObserver, the card is drawn when the message comes into view and the same rule applies', () => {
    const Observer = fakeObserverClass();
    const w = inChat({ revs: [1, 2], observer: Observer });
    w.cards.attachAll();
    assert.equal(w.chat.messages[1].querySelectorAll('.ss-card').length, 0);
    w.el.toBottom();
    Observer.instances[0].show(w.chat.messages[1]);
    assert.equal(w.chat.messages[1].querySelectorAll('.ss-card').length, 1);
    assert.equal(w.gap(), 0);
});

test('with no #chat around the messages, or no layout, nothing is scrolled and nothing throws', () => {
    const w = world({ revs: [1, 2] });
    w.cards.attachAll();
    w.cards.toggle(1, true);
    assert.equal(w.chat.messages[1].querySelectorAll('.ss-card-open').length, 1);
    const flat = inChat({ revs: [1, 2] });
    Object.defineProperty(flat.el, 'clientHeight', { get: () => 0, configurable: true });
    flat.cards.attachAll();
    assert.equal(flat.el.scrollTop, 0);
});

test('content other extensions add to the new reply after SillyTavern scrolled (a status card, 150 px) does not make the reader "scrolled up"; half a screen up does', () => {
    const near = inChat({ revs: [1, 2] });
    near.el.scrollTop = near.el.scrollHeight - near.el.clientHeight - 150;
    near.cards.refresh(1);
    assert.equal(near.gap(), 0);
    const far = inChat({ revs: [1, 2] });
    far.el.scrollTop = far.el.scrollHeight - far.el.clientHeight - 260;
    const stayed = far.el.scrollTop;
    far.cards.refresh(1);
    assert.equal(far.el.scrollTop, stayed);
});
