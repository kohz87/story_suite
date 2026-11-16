import test from 'node:test';
import assert from 'node:assert/strict';
import { IDLE_MAX_MS } from '../../core/persist.js';
import { createStore } from '../../core/store.js';
import { RECENT, createCardMount } from '../../ui/legacy/view/mounts/card.js';
import { RECENT_MESSAGES as NOTES_RECENT, createReplyNotes } from '../../ui/legacy/reply-notes.js';
import { RECENT_MESSAGES as EXTRAS_RECENT, createReplyExtras } from '../../ui/legacy/extras-ui.js';
import { prng, seedCrypto } from '../suite/qa/helpers/seeded.js';
import { checkInvariants } from '../suite/qa/helpers/oracle.js';
import { installFakeDom, makeMessage } from '../helpers/ui-fake-dom.js';
import { fakeChat, fakeObserverClass, fakeQuery, fakeRenderer, screen, screensWith, setupDom } from '../ui/view/mounts/helpers.js';
import { plain, filed, chatOf } from './long-chat.helpers.js';

test('store.at: an earlier reply\'s state is replayed once and kept while its messages stay the same', async t => {
    const h = await chatOf(t, 40);
    const carriers = h.ctx.chat.map((message, index) => (message.is_user ? -1 : index)).filter(index => index >= 0).slice(0, -1);
    const fresh = createStore({ chat: () => h.ctx.chat, save: async () => {} });
    const start = h.store.work();
    for (const index of carriers) assert.deepEqual(h.store.at(index), fresh.at(index), `state at ${index} == a fresh replay`);
    const first = h.store.work();
    assert.equal(first.replays - start.replays, carriers.length, 'one replay each the first time');
    for (const index of carriers) h.store.at(index);
    assert.equal(h.store.work().replays, first.replays, 'none the second time');
    // A new reply (written on the head) leaves the earlier states as they were.
    await h.send('More.', 'Yet more.\n<Changes>\n+ item Thing 1\n</Changes>');
    const after = h.store.work();
    for (const index of carriers) assert.deepEqual(h.store.at(index), fresh.at(index));
    assert.equal(h.store.work().replays, after.replays, 'still kept');
    // An edit of an earlier reply's text: that reply and the ones after it are replayed again.
    const edited = carriers.at(-3);
    h.ctx.chat[edited].mes = 'Edited by hand.';
    const before = h.store.work().replays;
    for (const index of carriers) assert.deepEqual(h.store.at(index), fresh.at(index));
    assert.ok(h.store.work().replays - before >= 1 && h.store.work().replays - before <= 3, 'only those depending on it');
    // A deleted reply in the middle (the rebuild forgets everything kept), replay == fresh.
    h.ctx.chat.splice(carriers[10] - 1, 2);
    h.store.rebuild();
    const shifted = h.ctx.chat.map((message, index) => (message.is_user ? -1 : index)).filter(index => index >= 0).slice(0, -1);
    const again = createStore({ chat: () => h.ctx.chat, save: async () => {} });
    for (const index of shifted) assert.deepEqual(h.store.at(index), again.at(index), `after the delete, ${index}`);
});

test('store.receipts and store.untold: one pass over the chat until the next write, equal to a fresh store', async t => {
    const h = await chatOf(t, 30);
    const fresh = () => createStore({ chat: () => h.ctx.chat, save: async () => {} });
    const start = h.store.work().lineScans;
    for (let i = 0; i < 5; i++) {
        assert.deepEqual(h.store.receipts(), fresh().receipts());
        assert.deepEqual(h.store.untold(), fresh().untold());
    }
    assert.equal(h.store.work().lineScans - start, 2, 'one pass for each, however often asked');
    assert.equal((await h.sdk.command('scene.present', { add: 'Ann' })).ok, true);
    assert.deepEqual(h.store.receipts(), fresh().receipts(), 'a write: read again');
    assert.equal(h.store.work().lineScans - start, 3);
    h.ctx.chat.splice(h.ctx.chat.length - 2, 2);          // the last reply deleted (SillyTavern, before its event)
    assert.deepEqual(h.store.receipts(), fresh().receipts(), 'the chat changed under it: read again');
    assert.ok(Object.isFrozen(h.store.receipts()) && Object.isFrozen(h.store.receipts()[0].receipt), 'frozen');
});

test('a reply\'s build and capture read the whole chat a fixed number of times, not more as the chat grows', async t => {
    const h = await chatOf(t, 10);
    const cost = async n => {
        const before = h.store.work();
        await h.send(`Turn ${n}.`, `Reply ${n}.\n<Changes>\n+ item Thing 2\n+ present Ann\n</Changes>`);
        const after = h.store.work();
        return { replays: after.replays - before.replays, scans: after.lineScans - before.lineScans };
    };
    const early = await cost(11);
    for (let n = 12; n < 60; n++) await h.send(`Turn ${n}.`, `Reply ${n}.`);
    const late = await cost(60);
    assert.deepEqual(late, early, 'the same work at 60 replies as at 10');
    assert.ok(late.scans <= 2, `whole-chat passes per reply: ${late.scans}`);
});

// ---- cards, notes and extras --------------------------------------------------------------------------

function cardWorld({ count = 100, observer = true, cards = { 'm/sheet': true } } = {}) {
    const doc = setupDom();
    const chat = fakeChat(doc, Array.from({ length: count }, (_, i) => i + 1));
    const lookups = [];
    const Observer = observer ? fakeObserverClass() : null;
    const handlers = {};
    const mount = createCardMount({
        screens: screensWith([screen('m/sheet', ['card'])], { reader: { cards } }),
        render: fakeRenderer(),
        query: fakeQuery(),
        stateAt: chat.stateAt,
        headIndex: chat.headIndex,
        changesAt: chat.changesAt,
        carriers: chat.carriers,
        swipeAt: chat.swipeAt,
        messageElement: index => { lookups.push(index); return chat.messages[index] ?? null; },
        IntersectionObserver: Observer,
        on: (event, fn) => { (handlers[event] ??= []).push(fn); return () => {}; },
    });
    const emit = event => (handlers[event] ?? []).forEach(fn => fn({}));
    return { chat, lookups, mount, Observer, emit };
}

test('cards: a change to the story redraws the head carrier\'s cards alone; a rebuild the last RECENT and those on screen', () => {
    const { chat, lookups, mount, Observer, emit } = cardWorld();
    mount.attachAll();
    const observer = Observer.instances[0];
    assert.equal(observer.targets.size, 100, 'a chat opened: every drawn message is watched once');
    observer.show(chat.messages[5]);
    lookups.length = 0;
    chat.reads.length = 0;
    emit('committed');
    assert.deepEqual(lookups, [99], 'committed: the head carrier only');
    lookups.length = 0;
    emit('head');
    assert.equal(lookups.length, RECENT + 1, 'head: the last RECENT carriers and the one on screen');
    assert.ok(lookups.includes(5));
    assert.deepEqual([...new Set(chat.reads)], [5], 'states are built only for messages on screen');
});

test('cards: with no card screen turned on, a change looks up no message and builds no state', () => {
    const { chat, lookups, mount, emit } = cardWorld({ cards: {} });
    mount.attachAll();
    emit('head');
    emit('committed');
    assert.equal(lookups.filter(index => index !== 99).length, 0, 'no message looked up for a pass');
    assert.deepEqual(chat.reads, []);
});

function noteWorld(count) {
    const doc = installFakeDom();
    const chat = [];
    for (let i = 0; i < count; i++) {
        chat.push(i % 2 ? { is_user: false, mes: `Reply ${i}.`, extra: { storySuite: { v: 2, ops: [], receipts: [], narrated: [] } } }
            : { is_user: true, mes: `Turn ${i}.`, extra: {} });
        makeMessage(doc, i);
    }
    let queries = 0;
    const real = doc.querySelector;
    doc.querySelector = selector => { queries++; return real(selector); };
    const checked = [];
    const ctx = { chat, eventSource: null };
    return { doc, chat, ctx, checked, queries: () => queries };
}

test('notes and extras: a redraw after a new message or a rebuild looks at the last few drawn messages, with one query', () => {
    const { doc, ctx, queries } = noteWorld(200);
    const notes = createReplyNotes({ ctx, doc });
    const before = queries();
    let touched = 0;
    const read = ctx.chat.map((message, index) => new Proxy(message, { get: (target, key) => { if (key === 'extra' || key === 'mes') touched = Math.max(touched, 200 - index); return target[key]; } }));
    ctx.chat.splice(0, ctx.chat.length, ...read);
    notes.refreshAll({ recent: true });
    assert.equal(queries() - before, 0, 'no document query per message');
    assert.ok(touched <= NOTES_RECENT, `only the last ${NOTES_RECENT} looked at (reached ${touched} back)`);
    let shown = 0;
    const extras = createReplyExtras({ ctx, doc, display: () => { shown++; return {}; }, featureOn: () => true });
    extras.refreshAll({ recent: true });
    assert.equal(queries() - before, 0);
    assert.ok(shown <= EXTRAS_RECENT, `extras read ${shown} replies`);
    shown = 0;
    extras.refreshAll();
    // Only the latest reply has anything under it now (its Choices; chatter is not drawn under replies).
    assert.equal(shown, 1, 'a full pass (a chat opened) reads the latest reply alone');
});

// ---- replay == live, and the file == live, with the turn's save ----------------------------------------

test('fuzz: sends, reader actions, swipes and middle deletes with the turn\'s save: every state replays as live, and the file rebuilds as live', async t => {
    for (const seed of [5, 17, 42]) await t.test(`seed ${seed}`, async st => {
        const restore = seedCrypto(seed);
        try {
            const { h, srv, tick } = await filed(st);
            const r = prng(seed);
            for (let step = 0; step < 24; step++) {
                const roll = r.int(0, 9);
                const label = `seed ${seed} step ${step}`;
                if (roll < 6 || h.ctx.chat.length < 6) {
                    const lines = [`+ item Thing ${r.int(0, 4)} | qty: ${r.int(1, 3)}`, r.chance(0.5) ? `+ coin ${r.int(1, 20)}` : `+ present Guest ${step}`];
                    await h.send(`Step ${step}.`, `Step ${step} goes on.\n<Changes>\n${lines.join('\n')}\n</Changes>`);
                } else if (roll < 8) {
                    await h.swipe(`Another take on step ${step}.\n<Changes>\n+ item Thing ${r.int(0, 4)}\n</Changes>`);
                } else {
                    const replies = h.ctx.chat.map((message, at) => (!message.is_user && at > 2 && at < h.ctx.chat.length - 1 ? at : -1)).filter(at => at >= 0);
                    if (replies.length) {
                        const gone = r.pick(replies);
                        await h.st.deleteMessage(gone);
                        await h.st.deleteMessage(gone - 1);
                    }
                }
                for (let n = r.int(0, 3); n > 0; n--) {
                    assert.equal((await h.sdk.command('scene.present', { add: `Visitor ${step}-${n}` })).ok, true, label);
                    await tick(r.int(100, 2000));
                }
                checkInvariants(h, label);
                if (r.chance(0.5)) {
                    await tick(IDLE_MAX_MS);
                    assert.equal(h.store.dirty(), false, `${label}: saved`);
                    // The page reloaded: the chat read back from its file rebuilds to the same head.
                    const live = plain(h.head());
                    await h.st.loadChat(srv.messages('chat-1'), 'chat-1');
                    assert.deepEqual(plain(h.head()), live, `${label}: the file rebuilds as live`);
                }
            }
        } finally {
            restore();
        }
    });
});
