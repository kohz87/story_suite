// NB-1 (LIVEF4B): the Combat rules sections the board owns ("Exchanges", "Rolls", the XP guide) never reach the narrator under the board; a
// fight that stands unplayed gets no Combat rules text at all, and a reply that tells the board's play keeps only the flavour sections.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boardReplyGrammar } from '../../../../modules/rpg/board/prompt.js';
import { COMBAT_PROMPT_V1, rulesV1 } from '../../../../modules/rpg/templates-parts/v1-rules.js';
import { foesV1 } from '../../../../modules/rpg/templates-parts/v1-foes.js';
import { sheetDomain } from '../helpers.js';
import { holdHost, stageFight } from './v1-hold.helpers.js';
import { success } from '../../data-modules/helpers.js';

const state = (prompt = COMBAT_PROMPT_V1) => ({ domains: { dataModules: sheetDomain({
    'combat-rules': { role: 'rules', definition: { ...rulesV1, prompt }, fields: {} },
    foes: { role: 'foes', definition: foesV1, fields: { foe1: 'Fen-hound', count1: 2, level1: 1, tier1: 'standard' } },
}) } });
const OWNED = ['Exchanges:', 'tell a fight exchange by exchange', 'Rolls:', 'Code moves HP'];
const START = 'the reader plays it on the board, so tell no blows yourself';

test('a fight standing unplayed: no Combat rules text, the start line and the story-goes-on line', () => {
    const text = boardReplyGrammar(state(), { fight: true }).join('\n');
    for (const owned of [...OWNED, '[COMBAT SYSTEM]', 'No Plot Armor']) assert.ok(!text.includes(owned), owned);
    assert.ok(text.includes(START));
    assert.match(text, /moves the story on/u);
    assert.match(text, /kind: clear-N/u, 'the narrator may still clear a group that goes away');
});

test('a reply that tells the board\'s play (open or ended): the flavour sections only, never the board-owned ones nor the standing line', () => {
    for (const flags of [{ fight: true, played: true }, { fight: true, ended: true }]) {
        const text = boardReplyGrammar(state(), flags).join('\n');
        assert.ok(text.includes('[COMBAT SYSTEM]') && text.includes('No Plot Armor') && text.includes('Believable Outcomes'), JSON.stringify(flags));
        for (const owned of OWNED) assert.ok(!text.includes(owned), `${owned} ${JSON.stringify(flags)}`);
        assert.doesNotMatch(text, /moves the story on/u);
    }
});

test('an older or edited rules text loses its board-owned sections by label, and a text with none is kept whole', () => {
    const old = '[COMBAT SYSTEM]\nNo Plot Armor: x.\nExchanges: a fight is told exchange by exchange.\nRolls: code moves the bars for hits, heals, skill costs: never set those.\nXP guide: code gives XP.';
    assert.equal(boardReplyGrammar(state(old), { fight: true, played: true })[0], '[COMBAT SYSTEM] No Plot Armor: x.');
    assert.equal(boardReplyGrammar(state('Fights are short and cruel.'), { fight: true, played: true })[0], 'Fights are short and cruel.');
    const flat = boardReplyGrammar(state(COMBAT_PROMPT_V1.replace(/\n/gu, ' ')), { fight: true, played: true })[0];
    assert.match(flat, /^\[COMBAT SYSTEM\] No Plot Armor: .* Weight & Risk: .* Believable Outcomes: .*justified\.$/u, 'a one-line text (as pinned) loses the same sections');
    for (const owned of OWNED) assert.ok(!flat.includes(owned), owned);
    assert.ok(flat.includes('a believable edge exists: ambush'), 'a colon inside a sentence is no section label');
});

test('no foe stands: only the start line, as before', () => {
    const quiet = boardReplyGrammar(state(), { fight: false });
    assert.deepEqual(quiet, ['A fight starts when you set a foe slot; the reader plays it on the board, so tell no blows yourself.']);
});

test('through the host: a reply that carries a played board segment reads the pinned Combat rules flavour, never its board-owned sections nor the standing line', async t => {
    const host = await holdHost(t, { count: 2, level: 1 });
    success(await host.sdk.command('dm.define', { definition: structuredClone(rulesV1) }));
    const pinned = Object.entries(host.head().domains.dataModules.active).find(([id]) => id.endsWith('combat-rules'));
    assert.ok(!host.head().domains.dataModules.pins[pinned[1].hash].definition.prompt.includes('\n'), 'a pinned text is one line: its sections are found within it');
    stageFight(host, 1);
    const { request, aborted } = await host.send('I fight.', 'Steel.');
    assert.notEqual(aborted, true);
    const text = request.chat.map(message => message.content).join('\n');
    assert.ok(text.includes('No Plot Armor') && text.includes('Believable Outcomes'), 'the flavour sections are told');
    for (const owned of OWNED) assert.ok(!text.includes(owned), owned);
    assert.doesNotMatch(text, /moves the story on/u, 'the board played: no standing line');
});

test('through the host: a mid-fight segment (stop open) reads the flavour, not the standing line; while the board stays open, plain messages after it never lapse the fight', async t => {
    const host = await holdHost(t, { count: 3, level: 5 });
    success(await host.sdk.command('dm.define', { definition: structuredClone(rulesV1) }));
    stageFight(host, 1);
    const { request } = await host.send('I fight.', 'Steel.');
    const stops = host.ctx.chat.at(-1).extra.storySuite.receipts.filter(receipt => receipt.type === 'interaction.settle').map(receipt => receipt.data?.interaction?.stop);
    assert.deepEqual(stops, ['open'], 'the fight goes on after this segment');
    const text = request.chat.map(message => message.content).join('\n');
    assert.ok(text.includes('No Plot Armor'), 'the flavour is told with the board\'s note');
    assert.doesNotMatch(text, /moves the story on/u);
    for (const said of ['I look around.', 'I walk on.']) await host.send(said, 'Quiet.');
    assert.equal(host.ctx.chatMetadata.storySuiteInteraction?.open?.kindId, 'story-block/fight', 'the board is still open');
    assert.equal(host.ctx.chat.flatMap(message => message.extra?.storySuite?.receipts ?? []).some(receipt => receipt.type === 'rpg.board.lapse'), false, 'no lapse while the fight is open on the board');
    assert.equal(host.head().domains.dataModules.instances['pack.chat/foes'].chat.fields.count1, 3);
});
