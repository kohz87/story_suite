// The tail of a board-fight reply is pinned byte for byte (tail-fight.golden.json: the 4 v 6 fixture, default budget, the RPG's and People's tails present).
// The note joins the leading [Happened] as the board's cue always did, and as a settled interaction's cue does by its receipt type.
// A second golden (tail-fight-tight) puts the budget under pressure: the note counts inside the tail total, so the optional lines of the other sections drop instead.
// Both goldens were produced by main's own assemble (the same cue marked `board: true`), not by this code. These tests hand-build the cues given to `assemble`:
// they pin the assembler's join and the pin, not the cue the prelude produces (no board kind is registered until I6, which tests that path).
// The goldens are regenerated only by the note-wording step (C7): WRITE_GOLDEN=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRegistry } from '../../../core/registry.js';
import { assemble } from '../../../core/prompt.js';
import { fightNote } from './helpers/fight-note.js';

const GOLDEN = new URL('./tail-fight.golden.json', import.meta.url);
const TIGHT = new URL('./tail-fight-tight.golden.json', import.meta.url);
const TIGHT_BUDGET = 850;   // under the 876 tokens the whole tail measures, so the optional lines of People and the RPG drop

function registry() {
    const reg = createRegistry();
    reg.register({ id: 'lean-rpg', name: 'RPG', context: { tail: () => ({
        lines: ['[Party] Astra 14/20 HP, Bram 18/20 HP, Cyra 20/20 HP, Dov 11/20 HP', '[Foes] Rat 1 Hurt, Rat 2 Hurt, Rat 3 Unhurt, Rat 4 Hurt, Rat 5 Unhurt, Rat 6 Unhurt'],
        optional: ['[Party] Tip: rest heals.'] }) } });
    reg.register({ id: 'npc-state-delta', name: 'People', context: { tail: () => ({
        lines: ['[People] Astra: wary. Bram: steady. Cyra: eager. Dov: shaken.'], optional: ['[People] Rat 1: feral.', '[People] Rat 2: feral.'] }) } });
    return reg;
}
const tailFor = (cue, settings = {}) => assemble({ registry: registry(), view: {}, settings, untold: [{ id: 'rc_1', narrate: true, summary: 'A bonus is paid.' }], cues: { 'lean-rpg': [{ text: `[Happened]\n${fightNote()}`, keep: true, ...cue }] } });

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

test('under a tight tail budget the note stays whole inside the total and the optional lines drop, byte-identical to the golden', () => {
    const board = tailFor({ board: true }, { tailBudget: TIGHT_BUDGET });
    if (process.env.WRITE_GOLDEN === '1') writeFileSync(TIGHT, `${JSON.stringify({ tailText: board.tailText, parts: board.parts }, null, 2)}\n`);
    const golden = JSON.parse(readFileSync(TIGHT, 'utf8'));
    assert.equal(board.tailText, golden.tailText);
    assert.deepEqual(board.parts, golden.parts);
    const port = tailFor({ interaction: true }, { tailBudget: TIGHT_BUDGET });
    assert.equal(port.tailText, golden.tailText);
    assert.deepEqual(port.parts, golden.parts);
    assert.ok(golden.parts.some(part => part.dropped > 0), 'the budget is under pressure: something dropped');
    assert.ok(golden.tailText.includes(fightNote()), 'the note itself is whole');
});
