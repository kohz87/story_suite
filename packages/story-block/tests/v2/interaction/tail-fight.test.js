// The tail of a board-fight reply is pinned byte for byte (tail-fight.golden.json: the 4 v 6 fixture, default budget, the RPG's and People's tails present).
// The note joins the leading [Happened] as the board's cue always did, and as a settled interaction's cue does by its receipt type.
// A second golden (tail-fight-tight) puts the budget under pressure: the note counts inside the tail total, so the optional lines of the other sections drop instead.
// Both goldens were produced by main's own assemble (the same cue marked `board: true`), not by this code. These tests hand-build the cues given to `assemble`:
// they pin the assembler's join and the pin; the last test drives the real fight kind's note through the prelude loop (I6) and holds its cue to the same golden.
// The goldens are regenerated only by the note-wording step (C7, done: the fixture is now a v1 fight told by the kind's own note; before it was the old board note): WRITE_GOLDEN=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRegistry } from '../../../src/v2/registry.js';
import { assemble } from '../../../src/v2/prompt.js';
import { FIGHT_RESULT, FIGHT_SETUP, fightNote } from './helpers/fight-note.js';
import { fightKind } from '../../../src/v2/lean-rpg/board/interaction.js';
import { runPreludes } from '../../../src/v2/turn/prelude-run.js';

const GOLDEN = new URL('./tail-fight.golden.json', import.meta.url);
const TIGHT = new URL('./tail-fight-tight.golden.json', import.meta.url);
const TIGHT_BUDGET = 850;   // under the 1203 tokens the whole tail measures, so the optional lines of People and the RPG drop

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

test('the fight kind\'s own settle note, told by the real prelude loop, joins the tail byte-identically to the golden (the I6 port path)', () => {
    const summary = fightKind.note(FIGHT_RESULT, FIGHT_SETUP).join(' | ');
    assert.equal(summary, fightNote(), 'the kind\'s note is the board\'s settled account');
    const bus = { run: () => ({ ok: true, state: null, receipt: { type: 'interaction.settle', summary, seed: 1, narrate: true, data: { interaction: { stop: 'open' } } } }) };
    const cues = {}, ran = runPreludes({ s: { session: null }, bus, store: { head: () => null }, problem: () => {}, kindOf: () => fightKind },
        { requested: [{ moduleId: 'lean-rpg', type: 'interaction.settle', payload: { kindId: 'story-block/fight', key: 'k' } }], cues, prechecks: [], previewState: null });
    assert.equal(ran.blocked, undefined);
    assert.deepEqual(cues['lean-rpg'], [{ text: `[Happened]\n${summary}`, keep: true, interaction: true }]);
    for (const [settings, file] of [[{}, GOLDEN], [{ tailBudget: TIGHT_BUDGET }, TIGHT]]) {
        const golden = JSON.parse(readFileSync(file, 'utf8')), told = assemble({ registry: registry(), view: {}, settings, untold: [{ id: 'rc_1', narrate: true, summary: 'A bonus is paid.' }], cues });
        assert.equal(told.tailText, golden.tailText);
        assert.deepEqual(told.parts, golden.parts);
    }
});

test('the story-check dice cue and the fight note give the same tail in either order (a fight reply\'s preludes now run dice first, then the fight)', () => {
    const dice = { text: 'Story checks: use the three dice for separate attempts.', keep: true }, note = { text: `[Happened]\n${fightNote()}`, keep: true, interaction: true };
    const told = list => assemble({ registry: registry(), view: {}, settings: {}, untold: [], cues: { 'lean-rpg': list } });
    const first = told([dice, note]), second = told([note, dice]);
    assert.equal(first.tailText, second.tailText);
    assert.deepEqual(first.parts, second.parts);
    assert.ok(first.tailText.includes(fightNote()) && first.tailText.includes(dice.text));
});
