// NB-1 (LIVEF4B): a fight the narrator opens and the reader does not play on the board. While the foes stand unplayed the narrator keeps
// "tell no blows yourself" and is told the story goes on, never the Combat rules' narrated-combat text; in the reply to the reader's second
// message that does not play it, the fight lapses: a prelude clears the foes with a receipt. Swipe, swipe back, edited Re-read (grown and
// shrunk), middle delete, rewind and reload agree. The Ersveil pair (format 4) is installed; the turns are LIVEF4B's T5-T7.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characterV1 } from '../../../../modules/rpg/templates-parts/v1-character.js';
import { foesV1 } from '../../../../modules/rpg/templates-parts/v1-foes.js';
import { rulesV1 } from '../../../../modules/rpg/templates-parts/v1-rules.js';
import { BOARD_LAPSE, CHECKS_SETTING, LEAN_RPG_FEATURE } from '../../../../modules/rpg/index.js';
import { reload, success } from '../../data-modules/helpers.js';
import { lapseOffer } from '../../../../modules/rpg/board/lapse.js';
import { readSheet } from '../../../../modules/rpg/read.js';

const { createHost } = await import('../../../../testkit/index.js');
const { createFakeModel } = await import('../../../../testkit/model.js');

const pack = name => JSON.parse(readFileSync(new URL(`../../../../examples/packs/${name}/pack.json`, import.meta.url), 'utf8'));
const said = (text, lines = []) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const SET = '+ dm foes — two fen-hounds come out of the reeds | kind: set-slot-1 | name: Fen-hound | count: 2';
const T6 = 'I walk the frontier road toward Auvoth for the next three days, camping beside the road each night, until the city walls come in sight.';
const T7 = 'In Auvoth I find the Pale Market and look for the mage Rika.';
const START = 'the reader plays it on the board, so tell no blows yourself';
const STANDING = 'a message that is not played on the board moves the story on';
const LAPSED = 'was left unplayed on the board, so it lapsed: they withdrew or were left behind.';

const textOf = request => request.chat.map(message => message.content).join('\n');
const foes = host => host.head().domains.dataModules.instances['pack.chat/foes'].chat.fields;
const standing = host => foes(host).count1 > 0 && foes(host).foe1 === 'Fen-hound';
const lapses = host => host.ctx.chat.flatMap((message, index) => (message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type === BOARD_LAPSE && receipt.narrate !== false).map(() => index));

async function road(t, settings = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ callModel: createFakeModel(['none']), settings: { modules: { 'story-block': settings } } });
    t.after(() => host.close());
    host.features.set(LEAN_RPG_FEATURE, true);
    assert.equal((await host.packs.packs.install(pack('ersveil'))).ok, true);
    const game = pack('ersveil-game');
    assert.equal((await host.packs.packs.install(game)).ok, true);
    assert.equal(await host.packs.packs.select('game', game.id), true);
    await host.send('I set out.', said('The road runs south.'));
    for (const definition of [characterV1, foesV1, rulesV1]) success(await host.sdk.command('dm.define', { definition: structuredClone(definition) }));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { who: 'Astra', level: 1 } }));
    // T5: the narrator sets a foe slot on the road; the reader never opens the board.
    await host.send('At first light I set out south on the frontier road.', said('Two fen-hounds slink out of the reeds.', [SET]));
    assert.ok(standing(host));
    return host;
}

test('NB-1: foes that stand unplayed keep "tell no blows", get the story-goes-on line and never the Combat rules text', async t => {
    const host = await road(t);
    const { request } = await host.send(T6, said('Astra walks on; the hounds trail her.'));
    const sent = textOf(request);
    assert.ok(sent.includes(START), 'the board still owns the fight');
    assert.ok(sent.includes(STANDING), 'a message that is not an attack moves the story on');
    for (const owned of ['[COMBAT SYSTEM]', 'Exchanges:', 'tell a fight exchange by exchange', 'No Plot Armor', 'Code moves HP']) assert.ok(!sent.includes(owned), `no "${owned}"`);
    assert.ok(standing(host), 'one ignored message does not lapse the fight');
    assert.deepEqual(lapses(host), []);
});

test('NB-1: the second message that does not play the fight lapses it with a receipt; swipe, swipe back, Re-read, reload, rewind and middle delete agree', async t => {
    const host = await road(t);
    await host.send(T6, said('Astra walks on; the hounds trail her.'));
    const { request, index } = await host.send(T7, said('The Pale Market is loud.'));
    const sent = textOf(request);
    assert.ok(sent.includes(LAPSED) && sent.includes('Fen-hound ×2'), 'the narrator is told the fight lapsed');
    assert.ok(!sent.includes(STANDING), 'the tail reads the state the lapse leaves: no foe stands');
    assert.ok(sent.includes(START), 'a new group would still start a board fight');
    assert.equal(standing(host), false, 'the slot is cleared');
    assert.deepEqual(lapses(host), [index]);
    // Swipe: the swipe counts what the first try counted, so it lapses again; swipe back keeps the first try's lapse.
    const swiped = await host.swipe(said('The market again.'));
    assert.ok(textOf(swiped.request).includes(LAPSED), 'the swipe lapses too');
    assert.equal(standing(host), false);
    await host.st.swipeTo(index, 0);
    assert.equal(standing(host), false, 'swipe back');
    assert.deepEqual(lapses(host), [index]);
    // Edited Re-read, grown and shrunk: the stored prelude is kept.
    await host.st.editMessage(index, said('The Pale Market is loud, and longer now.', ['+ coin 5 | from: Rika']));
    assert.equal((await host.sdk.reread(index)).ok, true);
    assert.equal(standing(host), false, 'grown Re-read');
    await host.st.editMessage(index, said('Short.'));
    assert.equal((await host.sdk.reread(index)).ok, true);
    assert.equal(standing(host), false, 'shrunk Re-read');
    host.store.rebuild();
    await reload(host);
    assert.equal(standing(host), false, 'rebuild and reload');
    assert.deepEqual(lapses(host), [index]);
    // Rewind: deleting the lapsed reply brings the foes back.
    await host.st.deleteMessage(index);
    assert.ok(standing(host), 'rewind');
});

test('NB-1: a middle delete of the reply that set the foes: the stored lapse is planned again on what is there now, clears nothing and fails nothing', async t => {
    const host = await road(t);
    await host.send(T6, said('Astra walks on.'));
    await host.send(T7, said('The Pale Market is loud.'));
    const lapsedAt = host.ctx.chat.length - 1;
    assert.deepEqual(lapses(host), [lapsedAt]);
    const setAt = host.ctx.chat.findIndex(message => String(message.mes).includes(SET));
    await host.st.deleteMessage(setAt);
    host.store.rebuild();
    await reload(host);
    assert.equal(foes(host).count1, 0, 'no foe was ever set');
    const stored = host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).filter(receipt => receipt.type === BOARD_LAPSE);
    assert.equal(stored.length, 1, 'the lapse prelude is still stored with its reply');
    // (the replay plans the stored step again on the state there now, the quiet REPLANNED note; it clears nothing and fails nothing)
    const codes = (host.turn?.problems?.() ?? []).map(problem => problem.code);
    assert.ok(codes.includes('REPLANNED'), codes.join(','));
    assert.deepEqual(codes.filter(code => !['REPLANNED', 'DICE_SKIPPED'].includes(code)), [], 'no step failed');
});

test('NB-1: a typed attack on the standing foes is held by the fight pause, and the lapse never takes it; nor a fight open on the board', async t => {
    const host = await road(t);
    await host.send(T6, said('Astra walks on.'));
    const held = await host.send('I attack the Fen-hound.', said('Steel.'));
    assert.equal(held.aborted, true, 'the pause holds the attack');
    const messages = host.ctx.chat, index = messages.length - 1;
    const ask = (text, meta = null) => lapseOffer({ state: host.head() }, { sheet: readSheet(host.head()), messages, index, text, meta });
    assert.equal(ask('I look around.')?.type, BOARD_LAPSE, 'a plain message at this point lapses the fight');
    assert.equal(ask('I attack the Fen-hound.'), null, 'a typed attack does not');
    assert.equal(ask('I look around.', { storySuiteInteraction: { open: { kindId: 'story-block/fight' } } }), null, 'nor while the board is open');
});

test('NB-1: foes the reader set by hand are never lapsed, even after a group the story set earlier', async t => {
    const host = await road(t);
    await host.send('The hounds flee.', said('They run.', ['- dm foes — they flee | kind: clear-1 | why: fled']));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/foes', fields: { foe1: 'Rats', count1: 3 } }));
    await host.send(T6, said('Astra walks on.'));
    await host.send(T7, said('The market.'));
    assert.deepEqual(lapses(host), []);
    assert.equal(foes(host).foe1, 'Rats');
});

test('NB-1: with Story checks off (no dice prelude) the second message that does not play the fight still lapses it', async t => {
    const host = await road(t, { [CHECKS_SETTING]: false });
    await host.send(T6, said('Astra walks on.'));
    const { request, index } = await host.send(T7, said('The market.'));
    assert.ok(!textOf(request).includes('Dice for this reply'), 'no dice offered');
    assert.ok(textOf(request).includes(LAPSED));
    assert.deepEqual(lapses(host), [index]);
    assert.equal(standing(host), false);
});
