import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../../testkit/index.js';
import { setupDom } from '../../../ui/view/mounts/helpers.js';
import { BATTLE_ROOT, createBattleLog, createFoldStore, markerNodes, placeAtMarker } from '../../../../modules/rpg/view/battle-log.js';
import { stripBattleMarker } from '../../../../core/turn.js';
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
    const css = readFileSync(new URL('../../../../modules/rpg/view/lean-rpg.css', import.meta.url), 'utf8');
    assert.match(css, /\.rpg-battle \{[^}]*monospace/);
    assert.match(css, /\.rpg-bl-head \{[^}]*min-height: 44px/);
    assert.match(css, /\.rpg-bl-stat \{[^}]*grid-template-columns: 4\.6em minmax\(36px, 1fr\) 8\.5em/, 'label, bar and word in fixed columns, so the bars line up');
    assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.rpg-bl-stats \{ grid-template-columns: 1fr/, 'one row per bar on a phone');
});
