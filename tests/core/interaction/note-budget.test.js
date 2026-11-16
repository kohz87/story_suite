// The settled-note allowance is measured on the longest board fight, never guessed: a change to the number or to the note is a reviewed diff.
import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERACTION_NOTE_TOKENS, noteLong, settleCue } from '../../../src/v2/interaction/note.js';
import { estimateTokens } from '../../../src/v2/prompt-parts/shared-helpers.js';
import { fightNote } from './helpers/fight-note.js';

// The longest board note (4 v 6, 4 exchanges, items and wear) is 798 tokens; the allowance is that plus 20 %, rounded up to ten.
const MEASURED = 798;

test('the allowance is the measured longest board note plus 20 %', () => {
    assert.equal(estimateTokens(fightNote()), MEASURED, 'the fixture note changed: measure again');
    assert.equal(INTERACTION_NOTE_TOKENS, Math.ceil(MEASURED * 1.2 / 10) * 10);
    assert.ok(MEASURED <= INTERACTION_NOTE_TOKENS);
});

test('a note over its allowance names the kind in a quiet Problem and is never cut', () => {
    const note = fightNote();
    assert.equal(noteLong(note, {}, 'Fight'), null, 'the longest fight fits');
    const long = `${note} | ${note}`;
    const problem = noteLong(long, {}, 'Fight');
    assert.equal(problem.code, 'NOTE_LONG');
    assert.equal(problem.quiet, true);
    assert.match(problem.message, /Fight/);
    assert.equal(noteLong(note, { limits: { noteTokens: 100 } }, 'Fight').code, 'NOTE_LONG', 'a kind limit overrides the number');
    assert.equal(settleCue({ type: 'interaction.settle', summary: long }), long, 'the cue is the whole summary');
    assert.equal(settleCue({ type: 'rpg.resolve', summary: long }), '', 'only a settle receipt is read directly');
});
