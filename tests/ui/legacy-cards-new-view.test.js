// While the new view is on, the old view's reply cards are not looked for, observed or built (they are hidden anyway);
// "Use the old view" (the body class goes) draws them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeObserverClass } from './view/mounts/helpers.js';
import { cardsUnder, world } from './view/mounts/card.helpers.js';
import { NEW_VIEW_CLASS } from '../../ui/entry/flag.js';

// A body-class watcher the way a browser runs it: the callback fires after the class changes.
function withMutationObserver(run) {
    const before = globalThis.MutationObserver;
    const watchers = [];
    globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; this.on = true; watchers.push(this); } observe() {} disconnect() { this.on = false; } };
    try { return run(() => watchers.filter(w => w.on).forEach(w => w.fn([]))); } finally { globalThis.MutationObserver = before; }
}

test('new view on: no card is built, observed or replayed, on a pass, a commit, a swipe or an edit', () => {
    withMutationObserver(() => {
        const Observer = fakeObserverClass();
        const { doc, chat, render, cards } = world({ observer: Observer });
        doc.body.classList.add(NEW_VIEW_CLASS);
        cards.attachAll();
        cards.onSwipe({ index: 1 });
        cards.onEdit({ index: 2 });
        cards.refresh(3);
        assert.equal(chat.reads.length, 0, 'no state replay');
        assert.equal(render.calls.length, 0);
        assert.equal(Observer.instances.flatMap(o => [...o.targets]).length, 0, 'no message observed');
        for (const message of chat.messages) assert.equal(cardsUnder(message).length, 0);
        assert.equal(cards.cacheSize(), 0);
    });
});

test('switching to the old view draws the cards on the messages on screen', () => {
    withMutationObserver(flip => {
        const Observer = fakeObserverClass();
        const { doc, chat, cards } = world({ observer: Observer });
        doc.body.classList.add(NEW_VIEW_CLASS);
        flip();
        cards.attachAll();
        assert.equal(chat.reads.length, 0);
        doc.body.classList.remove(NEW_VIEW_CLASS);
        flip();
        const observer = Observer.instances[0];
        assert.equal(observer.targets.size, chat.messages.length, 'every message is watched again');
        observer.show(chat.messages[2]);
        assert.equal(cardsUnder(chat.messages[2]).length, 1, 'the one on screen is drawn');
        assert.equal(cardsUnder(chat.messages[0]).length, 0, 'the others wait for the scroll');
        // and back to the new view: later commits stay cheap again
        doc.body.classList.add(NEW_VIEW_CLASS);
        flip();
        const reads = chat.reads.length;
        cards.refresh(2);
        cards.attachAll({ recent: true });
        assert.equal(chat.reads.length, reads);
        assert.equal(chat.messages[2].querySelector('.ss-cards'), null, 'the strip goes while the new view is on');
    });
});

test('without the new view class the cards draw as before (old view, also the tests\' own default)', () => {
    const { chat, cards } = world();
    cards.attachAll();
    assert.equal(cardsUnder(chat.messages[2]).length, 1);
});

test('destroy stops watching the body class', () => {
    withMutationObserver(flip => {
        const { doc, cards } = world({ observer: fakeObserverClass() });
        doc.body.classList.add(NEW_VIEW_CLASS);
        flip();
        cards.destroy();
        doc.body.classList.remove(NEW_VIEW_CLASS);
        assert.doesNotThrow(flip);
    });
});
