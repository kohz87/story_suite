// NB-1 (LIVEF4B): the Combat rules sections the board owns ("Exchanges", "Rolls", the XP guide) never reach the narrator under the board; a
// fight that stands unplayed gets no Combat rules text at all, and a reply that tells the board's play keeps only the flavour sections.
import test from 'node:test';
import assert from 'node:assert/strict';
import { boardReplyGrammar } from '../../../../modules/rpg/board/prompt.js';
import { COMBAT_PROMPT_V1, rulesV1 } from '../../../../modules/rpg/templates-parts/v1-rules.js';
import { foesV1 } from '../../../../modules/rpg/templates-parts/v1-foes.js';
import { sheetDomain } from '../helpers.js';

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
});

test('no foe stands: only the start line, as before', () => {
    const quiet = boardReplyGrammar(state(), { fight: false });
    assert.deepEqual(quiet, ['A fight starts when you set a foe slot; the reader plays it on the board, so tell no blows yourself.']);
});
