// Your Holding on the real host with the Director's clock: the narrator's monthly reminder, and the world's two facts about the holding
// (`fact:pc-holding-founded`, `fact:pc-seat-claimed`), recorded on the reply so swipe, Re-read, delete, rebuild and a fresh load agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { holdingAnchors } from '../../../../modules/world/chronicle/world-daily/holding.js';
import { partyRegions } from '../../../../modules/world/daily/party-regions.js';
import { MONTH_CUE } from '../../../../modules/data-modules/holding/tail.js';
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

test('the party\'s regions are the scene\'s and, while the holding has a seat, the seat\'s', async () => {
    const answers = (scene, holding, atlas = null) => name => ({ 'scene.place': scene, 'dataModules.holding': holding, 'atlas.place': atlas })[name] ?? null;
    const scene = { name: 'Highmark', region: 'The March' };
    assert.deepEqual(partyRegions(answers(scene, null)), ['The March']);
    assert.deepEqual(partyRegions(answers(scene, { seat: '', region: 'Auvoth' })), ['The March'], 'no seat, no second region');
    assert.deepEqual(partyRegions(answers(scene, { seat: 'Ravenhold', region: 'Auvoth' })), ['The March', 'Auvoth']);
    assert.deepEqual(partyRegions(answers(scene, { seat: 'Ravenhold', region: 'the march' })), ['The March'], 'one region once');
    assert.deepEqual(partyRegions(answers(scene, { seat: 'Ravenhold', region: '' }, { region: 'shornmarch' })), ['The March', 'shornmarch'], 'the map\'s region for the seat');
    assert.deepEqual(partyRegions(answers({ name: 'Ravenhold', region: 'Auvoth' }, { seat: 'ravenhold', region: '' })), ['Auvoth']);
    assert.deepEqual(partyRegions(() => { throw new Error('no such query'); }), []);
    assert.deepEqual(holdingAnchors(null), []);
    assert.deepEqual(holdingAnchors({ seat: 'Ravenhold' }, new Set([FACTS[0]])), [FACTS[1]]);
    const host = await start();
    try {
        await next(host, '~ place Highmark', FOUND, SEAT.replace('The March', 'Bluewatch Reach'));
        assert.deepEqual(partyRegions((name, args) => host.sdk.query(name, args)), ['The March', 'Bluewatch Reach']);
    } finally { host.done(); }
});
