// Your Holding on the real host with the Director's clock: the narrator's monthly reminder, and the world's two facts about the holding
// (`fact:pc-holding-founded`, `fact:pc-seat-claimed`), recorded on the reply so swipe, Re-read, delete, rebuild and a fresh load agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { holdingAnchors } from '../../../../modules/world/chronicle/world-daily/holding.js';
import { holdingFacts, unheldFacts } from '../../../../modules/world/chronicle/world-daily/holding-facts.js';
import { success } from '../../data-modules/helpers.js';
import { seatRegionOf } from '../../../../modules/world/chronicle/world-daily/party-region.js';
import { MONTH_CUE } from '../../../../modules/data-modules/holding/tail.js';
import { enableDataModules } from '../../../../packs/card-offer.js';
import { seedCrypto } from '../../../suite/qa/helpers/seeded.js';
import { TAIL_KEY } from '../../../../core/turn.js';
import { agrees, newHost, reply } from './daily-host.helpers.js';

const ID = 'pack.ersveil-game/holding';
const FACTS = ['fact:pc-holding-founded', 'fact:pc-seat-claimed'];
const FOUND = '+ dm holding — Founded Ravenhold | kind: found | type: fief | name: Ravenhold';
const SEAT = '~ dm holding — the palisade is up | kind: seat | at: Ravenhold | region: The March';
const GAME = readFileSync(new URL('../../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8');

async function start(on = true) {
    const host = await newHost(on);
    const installed = await host.packs.packs.install(GAME, { origin: 'game.json' });
    assert.equal(installed.ok, true, JSON.stringify(installed.errors));
    const offer = host.sdk.query('dataModules.offers').find(row => row.module === ID);
    assert.equal((await host.sdk.command('dm.pin', { module: ID, hash: offer.hash, packHash: offer.packHash })).ok, true);
    await host.send('Begin.', reply('A hill above the frozen lake.', ['~ time March 29, 1200, 08:00 am']));
    return host;
}
const facts = host => (host.sdk.query('chronicle.world.anchors') ?? []).filter(key => FACTS.includes(key));
/** The tail the prompt of the last send carried: what the narrator was told before writing that reply. */
const sentTail = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).at(-1)?.value ?? '';
const next = async (host, ...lines) => { await host.send('On.', reply('Quiet.', lines.length ? lines : ['! time +5m'])); return sentTail(host); };

test('the monthly reminder rides the first prompt after the reply that began a new story month, once, and only while a holding stood before it', async () => {
    const host = await start();
    try {
        assert.equal((await next(host)).includes(MONTH_CUE), false);
        await next(host, FOUND);
        assert.equal((await next(host)).includes(MONTH_CUE), false, 'founded, same month');
        await next(host, '! time +1d');
        assert.equal((await next(host)).includes(MONTH_CUE), false, 'a new day (March 30) is not a new month');
        await next(host, '! time +3d');
        assert.ok((await next(host)).includes(MONTH_CUE), 'April: the prompt after the crossing reply');
        assert.equal(MONTH_CUE, "A new month: write the holding's upkeep line (! dm holding | kind: month), its income and anything that changed.");
        assert.equal((await next(host)).includes(MONTH_CUE), false, 'only once');
        await agrees(host, 'after the month');
    } finally { host.done(); }
});

test('a reply that starts the month and writes its upkeep line itself is not asked for it again', async () => {
    const host = await start();
    try {
        await next(host, FOUND);
        await next(host, '! time +3d', '! dm holding | kind: month');
        assert.equal(host.sdk.query('dataModules.view', { module: ID }).chat.months, 1);
        assert.equal((await next(host)).includes(MONTH_CUE), false);
    } finally { host.done(); }
});

test('the reminder reads the same after a swipe and a reload, and a month crossed in the founding reply asks for nothing', async () => {
    const host = await start();
    try {
        await next(host, FOUND, '! time +10d');
        assert.equal((await next(host)).includes(MONTH_CUE), false, 'the holding did not stand before that reply');
        await next(host, '! time +40d');
        await next(host);
        await host.swipe(reply('Another telling.', ['! time +5m']));
        assert.ok(sentTail(host).includes(MONTH_CUE), 'the swiped reply is asked the same');
        await host.st.loadChat(structuredClone(host.ctx.chat));
        await host.swipe(reply('A third telling.', ['! time +5m']));
        assert.ok(sentTail(host).includes(MONTH_CUE), 'and after a reload');
    } finally { host.done(); }
});

test('founding and the seat are each written to the world once; swipe, Re-read, delete, rebuild and a fresh load agree', async () => {
    const host = await start();
    try {
        assert.deepEqual(facts(host), []);
        await next(host, FOUND);
        assert.deepEqual(facts(host), [FACTS[0]]);
        await agrees(host, 'founded');
        await next(host, SEAT);
        assert.deepEqual(facts(host), FACTS);
        await agrees(host, 'seated');
        await host.swipe(reply('No palisade yet.', ['! time +5m']));
        assert.deepEqual(facts(host), [FACTS[0]], 'the swipe takes the seat back');
        await agrees(host, 'swiped');
        const last = host.ctx.chat.length - 1;
        await host.st.editMessage(last, reply('The palisade after all.', [SEAT]));
        assert.equal((await host.sdk.reread(last)).ok, true);
        assert.deepEqual(facts(host), FACTS, 'Re-read writes it again');
        await agrees(host, 'Re-read');
        await next(host, '! time +2d');
        assert.deepEqual(facts(host), FACTS, 'the daily step keeps them');
        assert.equal(host.sdk.receipts().filter(entry => entry.receipt.type === 'chronicle.world.holding').length, 2, 'once each');
        await agrees(host, 'stepped');
        assert.deepEqual(host.store.problems(), []);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        await host.st.deleteMessage(host.ctx.chat.length - 1);
        assert.deepEqual(facts(host), [FACTS[0]], 'deleting the seat reply takes its fact back');
        await agrees(host, 'deleted');
    } finally { host.done(); }
});

test('with World events off, nothing is written to the world', async () => {
    const host = await start(false);
    try {
        await next(host, FOUND, SEAT);
        assert.equal(host.sdk.receipts().some(entry => entry.receipt.type === 'chronicle.world.holding'), false);
        assert.equal(host.head().domains.chronicle?.ledger ?? null, null);
    } finally { host.done(); }
});

test('a deleted founding takes both facts with it, though the later seat reply stored its day; a cleared seat takes its own', async () => {
    const host = await start();
    try {
        await next(host, FOUND);
        const founding = host.ctx.chat.length - 1;
        await next(host, SEAT);
        assert.deepEqual(facts(host), FACTS);
        await host.st.deleteMessage(founding);
        assert.equal(host.sdk.query('dataModules.holding'), null);
        assert.deepEqual(facts(host), []);
        await agrees(host, 'founding deleted');
        await next(host);
        await next(host, '! time +1d');
        assert.deepEqual(facts(host), [], 'the daily step does not bring them back');
        assert.equal(Object.keys(host.head().domains.chronicle.daily[0].anchors).some(key => key.startsWith('fact:pc-')), false, 'and drops the days it was carrying');
        await agrees(host, 'two replies later');
        await next(host, FOUND);
        assert.deepEqual(facts(host), [FACTS[0]], 'a new founding is its own');
        await agrees(host, 'founded again');
        await next(host, SEAT);
        assert.deepEqual(facts(host), FACTS);
        success(await host.sdk.command('dm.set', { module: ID, field: 'seat', value: '' }));
        assert.deepEqual(facts(host), [FACTS[0]], 'no seat, no seat fact');
        await agrees(host, 'seat cleared');
    } finally { host.done(); }
});

test('the holding\'s facts come from the holding as it stands', () => {
    assert.deepEqual(holdingFacts(null), []);
    assert.deepEqual(holdingFacts({ seat: ' ' }), [FACTS[0]]);
    assert.deepEqual(holdingFacts({ seat: 'Ravenhold' }), FACTS);
    assert.deepEqual(unheldFacts(() => null), FACTS);
    assert.deepEqual(unheldFacts(() => ({ seat: '' })), [FACTS[1]]);
    assert.deepEqual(holdingAnchors({ seat: 'Ravenhold' }, new Set([FACTS[0]])), [FACTS[1]]);
});

// The chat a card offer makes: the pack installed and its data modules turned on by the offer, which leaves the holding off.
async function offered(game) {
    const host = await newHost(true);
    assert.equal((await host.packs.packs.install(game, { origin: 'game.json' })).ok, true);
    const done = await enableDataModules({ sdk: host.sdk, packId: 'ersveil-game' });
    await host.send('Begin.', reply('A hill above the frozen lake.', ['~ time March 29, 1200, 08:00 am']));
    return { host, done };
}
/** One more reply, and every prompt text its send carried, by key (the empty values that clear a slot afterwards left out). */
async function carried(host, lines) {
    const from = host.st.promptLog.length;
    await next(host, ...lines);
    return Object.fromEntries(host.st.promptLog.slice(from).filter(entry => entry.value).map(entry => [entry.key, entry.value]));
}

test('after a card offer the holding is off: no line of it in the prompt, no reminder, nothing to the world; its switch turns it on', async () => {
    const without = JSON.parse(GAME);
    without.content.dataModules = without.content.dataModules.filter(module => module.slug !== 'holding');
    const runs = [];
    for (const game of [GAME, JSON.stringify(without)]) {
        const unseed = seedCrypto(11);   // (both runs roll the same dice, so only the pack can make their prompts differ)
        const { host, done } = await offered(game);
        try {
            assert.deepEqual([done.pinned, done.total, done.failed], [3, 3, []]);
            assert.deepEqual(done.off, game === GAME ? ['Your Holding'] : []);
            const seen = [];
            for (const lines of [[FOUND, SEAT], ['! time +3d'], ['! time +5m'], ['! time +40d'], ['! time +5m']]) {
                seen.push(await carried(host, lines));
            }
            const text = JSON.stringify(seen);
            assert.ok(seen.every(sent => sent[TAIL_KEY] && sent.story_suite_static) && /guild-membership/.test(text), 'the prompts were sent, with the other modules in them');
            for (const word of [/holding/i, /kind: found/, /Ravenhold \|/]) assert.equal(word.test(text), false, String(word));
            assert.equal(text.includes(MONTH_CUE), false);
            assert.equal(host.sdk.query('dataModules.holding'), null);
            assert.deepEqual(facts(host), []);
            assert.equal(host.sdk.receipts().some(entry => entry.receipt.type === 'chronicle.world.holding'), false);
            assert.equal(seatRegionOf((name, args) => host.sdk.query(name, args)), '', 'no seat region while off');
            await agrees(host, 'off');
            runs.push(seen);
            if (game !== GAME) continue;
            const offer = host.sdk.query('dataModules.setup').find(row => row.module === ID);
            assert.equal((await host.sdk.command('dm.pin', { module: ID, hash: offer.hash, packHash: offer.packHash, subjects: [] })).ok, true);
            await next(host, FOUND, SEAT);
            assert.deepEqual(facts(host), FACTS, 'once on, the world learns of it');
            assert.match(JSON.stringify(await carried(host, ['! time +5m'])), /Your Holding — Ravenhold/, 'and the narrator is told of it');
            await agrees(host, 'turned on');
        } finally { host.done(); unseed(); }
    }
    assert.deepEqual(runs[0], runs[1], 'the prompts are the ones a pack without the module gives');
});
