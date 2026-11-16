import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../../testkit/index.js';
import { setupDom } from '../../../../../../tests/ui/view/mounts/helpers.js';
import { BATTLE_ROOT, createBattleLog, createFoldStore, markerNodes, placeAtMarker } from '../../../../src/v2/lean-rpg/view/battle-log.js';
import { stripBattleMarker } from '../../../../../../core/turn.js';
import { roleOf } from './helpers.js';
import { kids, mes, message, prose, spot, world } from './battle-log.helpers.js';

// ---- the marker in a drawn message ----

test('the marker paragraph is replaced by the panel; the prose around it stays', () => {
    const doc = setupDom();
    const { text } = mes(doc, (root, el) => {
        for (const line of ['Before.', '[battle]', 'After.']) { const p = el('p'); p.textContent = line; root.appendChild(p); }
    });
    assert.equal(placeAtMarker(doc, text, spot(doc)), true);
    assert.deepEqual(kids(text), ['p:Before.', 'div:PANEL', 'p:After.']);
});

test('a marker between line breaks splits the paragraph around the panel', () => {
    const doc = setupDom();
    const { text } = mes(doc, (root, el, t) => {
        const p = el('p');
        p.append(t('The rat bites.'), el('br'), t('[battle]'), el('br'), t('It falls back.'));
        root.appendChild(p);
    });
    placeAtMarker(doc, text, spot(doc));
    assert.deepEqual(kids(text), ['p:The rat bites.', 'div:PANEL', 'p:It falls back.']);
});

test('the marker is matched case-folded and trimmed; a second one is hidden; none is no match', () => {
    const doc = setupDom();
    const { text } = mes(doc, (root, el) => {
        for (const line of ['One.', '  [BATTLE]  ', 'Two.', '[battle]', 'Three.']) { const p = el('p'); p.textContent = line; root.appendChild(p); }
    });
    assert.equal(placeAtMarker(doc, text, spot(doc)), true);
    assert.deepEqual(kids(text), ['p:One.', 'div:PANEL', 'p:Two.', 'p:', 'p:Three.']);
    const none = mes(doc, (root, el) => { const p = el('p'); p.textContent = 'He said [battle] cries and a [battle]-axe.'; root.appendChild(p); });
    assert.equal(placeAtMarker(doc, none.text, spot(doc)), false, 'only a line of its own counts');
});

// ---- on the real host ----

test('on a reply with recorded rolls the panel is drawn at its marker, inside the message', async t => {
    const { doc, log, head } = await world(t);
    const el = message(doc, head, prose('The quay.', '[battle]', 'After.'));
    const cards = doc.createElement('div'); cards.className = 'ss-cards';
    el.querySelector('.mes_block').appendChild(cards);
    const node = log.refresh(head, el);
    assert.ok(node);
    assert.equal(node.getAttribute('data-variant'), 'inline');
    assert.deepEqual(kids(el.querySelector('.mes_text')).map(item => item.split(':')[0]), ['p', 'div', 'p']);
    assert.equal(el.querySelectorAll(`.${BATTLE_ROOT}`).length, 1);
    assert.match(node.textContent, /Wessel uses Iron Breath on Sluice Rat A — Success \(26 vs 16\) → Sluice Rat A Wounded/);
});

test('with no marker the same panel is a card under the reply, above "Changed this reply"', async t => {
    const { doc, log, head } = await world(t);
    const el = message(doc, head, prose('The quay.', 'After.'));
    const cards = doc.createElement('div'); cards.className = 'ss-cards';
    el.querySelector('.mes_block').appendChild(cards);
    const node = log.refresh(head, el);
    assert.equal(node.getAttribute('data-variant'), 'card');
    const blocks = el.querySelector('.mes_block').children;
    assert.deepEqual(blocks.map(child => child.className.split(' ')[0]), ['mes_text', 'rpg-battle', 'ss-cards']);
});

test('a redraw keeps the same panel while nothing changed, and follows the marker when it appears', async t => {
    const { doc, log, head } = await world(t);
    const el = message(doc, head, prose('The quay.', 'After.'));
    const first = log.refresh(head, el);
    assert.equal(log.refresh(head, el), first, 'nothing changed: the same node');
    const text = el.querySelector('.mes_text');
    const marker = doc.createElement('p'); marker.textContent = '[battle]';
    text.appendChild(marker);
    const moved = log.refresh(head, el);
    assert.equal(moved.getAttribute('data-variant'), 'inline');
    assert.equal(el.querySelectorAll(`.${BATTLE_ROOT}`).length, 1, 'the card went when the panel moved into the text');
    assert.equal(log.refresh(head, el), moved, 'and it stays while the marker is consumed');
});

test('a reply with no recorded rolls, a message of the reader\'s and the feature off draw nothing', async t => {
    const { doc, log, host, head } = await world(t);
    const quiet = message(doc, 1, prose('Opening.'));
    assert.equal(log.refresh(1, quiet), null);
    assert.equal(quiet.querySelectorAll(`.${BATTLE_ROOT}`).length, 0);
    const reader = message(doc, head - 1, prose('To the quay.'));
    assert.equal(log.refresh(head - 1, reader), null);
    const off = await createHost();
    t.after(() => off.close());
    const el = message(doc, head, prose('The quay.'));
    const log2 = createBattleLog({ ctx: host.ctx, doc, store: host.store, featureOn: () => false, roleOf });
    assert.equal(log2.refresh(head, el), null);
    assert.equal(el.querySelectorAll(`.${BATTLE_ROOT}`).length, 0);
    log2.destroy();
});

test('the fold is the viewer\'s: kept per chat and reply, not in the story', async t => {
    const { doc, log, host, head } = await world(t);
    const el = message(doc, head, prose('The quay.', 'After.'));
    const node = log.refresh(head, el);
    node.querySelector('.rpg-bl-head').click();
    const store = doc.defaultView.localStorage;
    assert.equal(store.map.size, 1);
    assert.match(String(store.map.values().next().value), /true/);
    const again = log.refresh(head, el);
    assert.equal(again.querySelector('.rpg-bl-body').hidden, true, 'redrawn folded');
    assert.notEqual(again, node);
    assert.ok(!JSON.stringify(host.ctx.chat).includes('rpg-bl'), 'nothing of the panel is in the chat');
    assert.equal(createFoldStore(setupDom()).has('x'), false, 'a page with no storage still works');
});

test('latest() is the newest reply with recorded rolls, with its model; none when the feature is off or nothing was rolled', async t => {
    const { host, log, head } = await world(t);
    const found = log.latest();
    assert.equal(found.index, head);
    assert.equal(found.model.rounds[0].n, 2);
    await host.send('Later.', 'A quiet reply.');
    assert.equal(log.latest().index, head, 'a later reply without rolls does not hide the last exchange');
    const off = createBattleLog({ ctx: host.ctx, doc: setupDom(), store: host.store, featureOn: () => false, roleOf });
    assert.equal(off.latest(), null);
    off.destroy();
});

test('refreshAll goes over every drawn reply', async t => {
    const { doc, log, head } = await world(t);
    message(doc, head, prose('The quay.', '[battle]'));
    log.refreshAll();
    assert.equal(doc.querySelectorAll(`.${BATTLE_ROOT}`).length, 1);
    log.destroy();
    assert.equal(doc.querySelectorAll(`.${BATTLE_ROOT}`).length, 0, 'destroy takes the panels away');
});

// ---- out of the prompt ----

test('the marker line leaves the prompt history; the text around it stays', () => {
    assert.equal(stripBattleMarker('The quay.\n\n[battle]\n\nAfter.'), 'The quay.\n\nAfter.');
    assert.equal(stripBattleMarker('A.\n[battle]\nB.'), 'A.\nB.');
    assert.equal(stripBattleMarker('A.\n  [Battle]  \n\nB.'), 'A.\nB.');
    assert.equal(stripBattleMarker('A.\n[battle]'), 'A.\n');
    assert.equal(stripBattleMarker('He loved a [battle] cry.\nNo marker here.'), 'He loved a [battle] cry.\nNo marker here.');
    assert.equal(stripBattleMarker('Plain.'), 'Plain.');
    const cue = '[Rolls] Code rolled these. Tell them in this order and as given, and never invent a roll; write [battle] on its own line where the fight is told.';
    assert.equal(stripBattleMarker(`${cue}\nRound 1: Wessel hits.`), `${cue}\nRound 1: Wessel hits.`, 'the cue mentions the marker mid-sentence: not touched');
    assert.equal(stripBattleMarker(7), 7);
});

test('the history strip runs only while the feature is on: chat completion and text completion', async t => {
    for (const mainApi of ['openai', 'textgenerationwebui']) {
        const on = await createHost({ st: { mainApi } });
        t.after(() => on.close());
        on.features.set('story-block.rpg', true);
        await on.send('One.', 'The quay.\n\n[battle]\n\nAfter.');
        const second = await on.send('Two.', 'Reply two.');
        const seen = mainApi === 'openai' ? second.request.chat.filter(item => item.role === 'assistant').map(item => item.content).join('\n') : second.request.prompt;
        assert.ok(seen.includes('The quay.'), `${mainApi}: the reply is still there`);
        assert.ok(!/\[battle\]/.test(seen), `${mainApi}: no marker in the history`);
        const off = await createHost({ st: { mainApi } });
        t.after(() => off.close());
        await off.send('One.', 'The quay.\n\n[battle]\n\nAfter.');
        const third = await off.send('Two.', 'Reply two.');
        const kept = mainApi === 'openai' ? third.request.chat.filter(item => item.role === 'assistant').map(item => item.content).join('\n') : third.request.prompt;
        assert.ok(/\[battle\]/.test(kept), `${mainApi}: with the feature off the text goes in as it always did`);
    }
});

test('the stylesheet: a dark monospace panel from tokens, the status bars aligned, a tap row 44px tall', () => {
    const css = readFileSync(new URL('../../../../src/v2/lean-rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-battle \{[^}]*monospace/);
    assert.match(css, /\.rpg-bl-head \{[^}]*min-height: 44px/);
    assert.match(css, /\.rpg-bl-stat \{[^}]*grid-template-columns: 4\.6em minmax\(36px, 1fr\) 8\.5em/, 'label, bar and word in fixed columns, so the bars line up');
    assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.rpg-bl-stats \{ grid-template-columns: 1fr/, 'one row per bar on a phone');
});

test('B14: destroying the panel gives back the marker line it took, so switching off and on keeps the inline place', async t => {
    const { host, doc, log, head } = await world(t);
    const el = message(doc, head, prose('The quay.', '[battle]', 'After.'));
    const first = log.refresh(head, el);
    assert.equal(first.getAttribute('data-variant'), 'inline');
    const text = el.querySelector('.mes_text');
    assert.equal(markerNodes(text).length, 0, 'the marker line is consumed while the panel is there');
    log.destroy();
    assert.equal(el.querySelectorAll(`.${BATTLE_ROOT}`).length, 0, 'the panel is gone');
    assert.deepEqual(kids(text).map(item => item.split(':')[0]), ['p', 'p', 'p'], 'and the marker line is back between the paragraphs');
    assert.equal(markerNodes(text).length, 1);
    // The feature comes back: a new panel finds the marker again and is inline, not the fallback card.
    const again = createBattleLog({ ctx: host.ctx, doc, store: host.store, featureOn: () => true, roleOf, events: host.events });
    t.after(() => again.destroy());
    const second = again.refresh(head, el);
    assert.equal(second.getAttribute('data-variant'), 'inline');
    assert.deepEqual(kids(text).map(item => item.split(':')[0]), ['p', 'div', 'p']);
    // A card (no marker) leaves nothing behind.
    again.destroy();
    const plain = message(doc, head, prose('The quay.', 'After.'));
    const log2 = createBattleLog({ ctx: host.ctx, doc, store: host.store, featureOn: () => true, roleOf, events: host.events });
    t.after(() => log2.destroy());
    assert.equal(log2.refresh(head, plain).getAttribute('data-variant'), 'card');
    log2.destroy();
    assert.equal(markerNodes(plain.querySelector('.mes_text')).length, 0);
});

test('B15: latest() still finds the last rolled reply after fifteen quiet exchanges', async t => {
    const { host, log, head } = await world(t);
    for (let n = 0; n < 15; n += 1) await host.send(`Quiet ${n}.`, `Nothing happens ${n}.`);
    assert.ok(host.ctx.chat.length - head > 30, 'more than the last thirty messages lie between');
    const found = log.latest();
    assert.ok(found, 'the roll is still in the chat');
    assert.equal(found.index, head);
});
