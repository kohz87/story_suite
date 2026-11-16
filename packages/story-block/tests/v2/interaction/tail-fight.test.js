// The tail of a board-fight reply is pinned byte for byte (tail-fight.golden.json: the 4 v 6 fixture, default budget, the RPG's and People's tails present).
// The note joins the leading [Happened] as the board's cue always did, and as a settled interaction's cue does by its receipt type.
// The golden is regenerated only by the note-wording step (C7): WRITE_GOLDEN=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRegistry } from '../../../src/v2/registry.js';
import { assemble } from '../../../src/v2/prompt.js';
import { fightNote } from './helpers/fight-note.js';

const GOLDEN = new URL('./tail-fight.golden.json', import.meta.url);

function registry() {
    const reg = createRegistry();
    reg.register({ id: 'lean-rpg', name: 'RPG', context: { tail: () => ({
        lines: ['[Party] Astra 14/20 HP, Bram 18/20 HP, Cyra 20/20 HP, Dov 11/20 HP', '[Foes] Rat 1 Hurt, Rat 2 Hurt, Rat 3 Unhurt, Rat 4 Hurt, Rat 5 Unhurt, Rat 6 Unhurt'],
        optional: ['[Party] Tip: rest heals.'] }) } });
    reg.register({ id: 'npc-state-delta', name: 'People', context: { tail: () => ({
        lines: ['[People] Astra: wary. Bram: steady. Cyra: eager. Dov: shaken.'], optional: ['[People] Rat 1: feral.', '[People] Rat 2: feral.'] }) } });
    return reg;
}
const tailFor = cue => assemble({ registry: registry(), view: {}, untold: [{ id: 'rc_1', narrate: true, summary: 'A bonus is paid.' }], cues: { 'lean-rpg': [{ text: `[Happened]\n${fightNote()}`, keep: true, ...cue }] } });

test('the board-fight tail is byte-identical to the golden, by the board cue and by the interaction cue', () => {
    const board = tailFor({ board: true });
    if (process.env.WRITE_GOLDEN === '1') writeFileSync(GOLDEN, `${JSON.stringify({ tailText: board.tailText, parts: board.parts }, null, 2)}\n`);
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    assert.equal(board.tailText, golden.tailText);
    assert.deepEqual(board.parts, golden.parts);
    const port = tailFor({ interaction: true });
    assert.equal(port.tailText, golden.tailText, 'the interaction cue joins the note exactly as the board cue did');
    assert.deepEqual(port.parts, golden.parts);
    assert.ok(golden.tailText.startsWith('[Happened]\nA bonus is paid.\nTell the settled fight results'), 'the note leads the tail');
    assert.ok(golden.tailText.includes('[People] Astra') && golden.tailText.includes('[Party] Astra'), 'both module tails are present');
});

test('without the pin the note stays in the RPG section, not the leading note (so the golden tells the pin works)', () => {
    const plain = tailFor({});
    assert.notEqual(plain.tailText, JSON.parse(readFileSync(GOLDEN, 'utf8')).tailText);
});
