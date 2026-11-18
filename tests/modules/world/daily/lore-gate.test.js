// LF4-5: a hidden lore entry's gate (spec §7) opens from stored state, and once open the entry reaches the narrator's prompt after the
// world note (small, capped); before its gate it is in no prompt. Unit tests on the evaluator, then the real Ersveil pair on the host:
// the leak check before the gate, the next prompt after the reply that reached the place, the latch after You leave, and replay == live
// (swipe and back, edited Re-reads that grow and shrink, a middle delete, a chat change, a reload, a rewind), all with the switch on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FEATURE, reply } from './daily-host.helpers.js';
import { loreGateHolds, openLore } from '../../../../modules/world/chronicle/world-daily/lore-gate.js';
import { knownAnchors } from '../../../../modules/world/chronicle/world-daily/learned.js';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../modules/director/module.js';
import { fakeFightRunner } from '../../../suite/integration/director/helpers/fake-fight-runner.js';

const read = rel => readFileSync(new URL(`../../../../examples/packs/${rel}`, import.meta.url), 'utf8');
const ERSVEIL = read('ersveil/pack.json');
const ERSVEIL_GAME = read('ersveil-game/pack.json');
const PACK = JSON.parse(ERSVEIL).content;
const HIDDEN = PACK.lore.filter(entry => entry.hidden === true);
const CHAMBER = HIDDEN.find(entry => entry.id === 'emperors-chamber');
// Every sentence of 30 characters or more of the five hidden entries (the live run's leak matcher).
const SENTENCES = HIDDEN.flatMap(entry => entry.text.split(/(?<=[.!?])\s+/).map(text => text.trim()).filter(text => text.length >= 30));
const CHAMBER_FIRST = 'Emperor Adalmar died last winter.';
const KEEP = 'Highmark Capital / Crown Keep';
const OPENED = 'opened:lore/emperors-chamber';

test('the evaluator: anchors, place by id, name, alias or a spot under it; and binds tighter than or; stage, meter and quote never open', () => {
    const places = PACK.places;
    const at = place => ({ anchors: new Set(), place, places });
    const gate = CHAMBER.gate;
    assert.equal(loreGateHolds(gate, at('Highmark Capital / Crown Keep Gates')), false, 'a place of a similar name is not the keep');
    assert.equal(loreGateHolds(gate, at(KEEP)), true, 'the place by its name');
    assert.equal(loreGateHolds(gate, at('Crown Keep')), true, 'by its alias');
    assert.equal(loreGateHolds(gate, at(`${KEEP} / Throne Room`)), true, 'a spot under it');
    assert.equal(loreGateHolds(gate, at('Highmark Capital')), false, 'the city around it is not the keep');
    assert.equal(loreGateHolds(gate, { anchors: new Set(['fact:forgery-exposed']), place: 'Auvoth', places }), true, 'an anchor');
    assert.equal(loreGateHolds('fact:a and fact:b or fact:c', { anchors: new Set(['fact:a']) }), false);
    assert.equal(loreGateHolds('fact:a and fact:b or fact:c', { anchors: new Set(['fact:a', 'fact:b']) }), true);
    assert.equal(loreGateHolds('fact:a and fact:b or fact:c', { anchors: new Set(['fact:c']) }), true);
    assert.equal(loreGateHolds('stage of sir-lothar >= 1 or meter trust of sir-lothar >= 0 or quote:anything', { anchors: new Set() }), false, 'not read in a lore gate: false');
    assert.deepEqual(openLore(PACK.lore, { anchors: new Set(), place: 'Bluewatch Village', places }), [], 'nothing open at the start');
    assert.deepEqual(openLore(PACK.lore, { anchors: new Set([OPENED, 'fired:tide-after']), place: 'Auvoth', places }).map(entry => entry.id), ['emperors-chamber', 'after-last-wall'], 'a recorded opening, an anchor; pack order');
});

async function ersveil(chat = null) {
    let host = null;
    const module = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text), feature: id => host?.features.on(id),
        callModel: async () => ({ ok: false, error: 'BUSY', text: '' }), canCallModel: () => true, chat: () => [] } });
    host = await createHost({ modules: [fakeFightRunner(), module], settings: { modules: { 'story-director': { 'tracker.maxJump': 60 } } } });
    host.features.set(FEATURE, true);
    assert.equal((await host.packs.packs.install(ERSVEIL, { origin: 'pack.json' })).ok, true);
    assert.equal((await host.packs.packs.install(ERSVEIL_GAME, { origin: 'pack.json' })).ok, true);
    if (chat) await host.st.loadChat(structuredClone(chat));
    return host;
}

const prompts = host => host.st.promptLog.map(entry => String(entry.value ?? '')).join('\n');
const leaks = text => SENTENCES.filter(sentence => text.includes(sentence));
const opened = host => knownAnchors(host.head().domains.chronicle).has(OPENED);
const stateOf = host => JSON.stringify({ ledger: host.head().domains.chronicle.ledger ?? null, daily: host.head().domains.chronicle.daily ?? null });
// The prompt the next reply is given, as one text (sent and taken back, so the chat is as it was).
async function nextPrompt(host) {
    const from = host.st.promptLog.length;
    await host.send('Speak of Emperor Adalmar.', reply('He waits.'));
    const text = host.st.promptLog.slice(from).map(entry => String(entry.value ?? '')).join('\n');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    return text;
}

async function agrees(host, label) {
    const live = JSON.stringify(host.head().domains);
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head().domains), live, `${label}: rebuild equals live`);
    const again = await ersveil(host.ctx.chat);
    try { assert.equal(stateOf(again), stateOf(host), `${label}: a reload agrees`); } finally { again.close(); }
}

test('LF4-5: closed lore is in no prompt; the reply that reaches the keep opens it for the next prompt; it stays open; replay == live', async () => {
    const host = await ersveil();
    try {
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 am', '~ place Bluewatch Village / Guild Office']));
        await host.send('Who rules?', reply('Talk of Emperor Adalmar in his chamber.', ['! time +1h']));
        await host.send('Go.', reply('The keep gates.', ['! time +1h', '~ place Highmark Capital / Crown Keep Gates']));
        await host.send('In.', reply('The keep.', ['! time +1h', `~ place ${KEEP}`]));
        const reached = host.ctx.chat.length - 1;
        assert.deepEqual(leaks(prompts(host)), [], 'before the gate, and in the prompt of the reply that reached it: no hidden sentence');
        assert.equal(opened(host), true, 'the reply that reached the keep opened the entry');
        await host.swipe(reply('Still at the gates.', ['! time +1h']));
        assert.equal(opened(host), false, 'a swipe that does not reach the keep: closed');
        await host.st.swipeTo(reached, 0);
        assert.equal(opened(host), true, 'swipe back: open again');
        await agrees(host, 'swipe back');
        const keep = await nextPrompt(host);
        assert.ok(keep.includes(`Lore (now open) — ${CHAMBER.title}: ${CHAMBER_FIRST}`), 'the next prompt carries it after the world note');
        const line = keep.split('\n').find(text => text.startsWith('Lore (now open)'));
        assert.ok(line.length <= 600, 'capped');
        assert.deepEqual(leaks(keep).filter(sentence => !CHAMBER.text.includes(sentence)), [], 'only the open entry');
        await host.send('Out.', reply('The lower town.', ['! time +1h', '~ place Highmark Capital / Lower Market']));
        assert.ok((await nextPrompt(host)).includes(CHAMBER_FIRST), 'it stays open after You leave');
        const before = stateOf(host);
        await agrees(host, 'live');

        await host.st.editMessage(reached, reply('The gates.', ['! time +1h']));
        assert.equal((await host.sdk.reread(reached)).ok, true);
        assert.equal(opened(host), false, 'shrunk Re-read (no place line): closed');
        assert.equal(leaks(await nextPrompt(host)).length, 0, 'and out of the prompt again');
        await agrees(host, 'shrunk Re-read');
        await host.st.editMessage(reached, reply('The keep, and the throne room.', ['! time +1h', `~ place ${KEEP} / Throne Room`]));
        assert.equal((await host.sdk.reread(reached)).ok, true);
        assert.equal(opened(host), true, 'grown Re-read (a spot under the keep): open');
        await agrees(host, 'grown Re-read');
        await host.st.editMessage(reached, reply('The keep.', ['! time +1h', `~ place ${KEEP}`]));
        assert.equal((await host.sdk.reread(reached)).ok, true);
        assert.equal(stateOf(host), before, 'edited back: as it was');

        const chat = structuredClone(host.ctx.chat);
        await host.st.loadChat([{ name: 'Other', is_user: false, mes: 'Elsewhere.' }]);
        assert.equal(opened(host), false, 'another chat: nothing open');
        await host.st.loadChat(chat);
        assert.equal(stateOf(host), before, 'chat change and back');

        await host.st.deleteMessage(reached);
        assert.deepEqual(host.store.problems(), []);
        assert.equal(opened(host), false, 'a middle delete of the reply that reached it: closed (the later reply is at the market)');
        await agrees(host, 'middle delete');
        await host.st.loadChat(chat);
        while (host.ctx.chat.length > reached) await host.st.deleteMessage(host.ctx.chat.length - 1);
        assert.equal(opened(host), false, 'rewound before it: closed');
        assert.equal(leaks(await nextPrompt(host)).length, 0, 'rewound: out of the prompt');
        await agrees(host, 'rewound');
    } finally { host.close(); }
});

test('switch off: nothing opens and the prompt carries no lore line', async () => {
    const host = await ersveil();
    try {
        host.features.set(FEATURE, false);
        await host.send('Begin.', reply('Dust.', ['~ time June 3, 1200, 08:00 am', `~ place ${KEEP}`]));
        await host.send('More.', reply('The keep.', ['! time +1h']));
        assert.equal(host.head().domains.chronicle.ledger ?? null, null);
        assert.equal(prompts(host).includes('Lore (now open)'), false);
        assert.deepEqual(leaks(prompts(host)), []);
    } finally { host.close(); }
});
