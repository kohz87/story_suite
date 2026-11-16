// The prelude loop's interaction rules (turn/prelude-run.js): an interaction settle that cannot be previewed holds the send with the command's sentence;
// a settled opening leaves the state the segment is previewed on (preview == what capture will settle); its summary is told as a [Happened] note.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runPreludes } from '../../../src/v2/turn/prelude-run.js';

const SETTLE = 'interaction.settle';
const receipt = summary => ({ seed: 5, summary, narrate: true, data: { v2: { result: {} } } });

function run(answer) {
    const calls = [], problems = [];
    const bus = { run: (type, payload, options) => { calls.push({ type, payload, state: options.state ?? null }); return answer(payload); } };
    const out = runPreludes({ s: {}, bus, store: { head: () => ({}) }, problem: entry => problems.push(entry) },
        { requested: [{ moduleId: 'story-block', type: SETTLE, payload: { n: 1, opening: true } }, { moduleId: 'story-block', type: SETTLE, payload: { n: 2 } }], cues: {}, prechecks: [], previewState: null });
    return { out, calls, problems };
}

test('a settle that cannot be previewed holds the send with its own sentence and a Problem', () => {
    const { out, problems } = run(payload => (payload.n === 2 ? { ok: false, code: 'NO_LONGER_DONE', message: 'What the Probe read has changed; discard it and start again.' } : { ok: true, receipt: receipt('Opens.'), state: { s: 1 } }));
    assert.deepEqual(out.blocked, { moduleId: 'story-block', reason: 'What the Probe read has changed; discard it and start again.' });
    assert.equal(problems[0].code, 'NO_LONGER_DONE');
});

test('the segment is previewed on the state its opening leaves, and each summary is told once', () => {
    const cues = {};
    const calls = [];
    const bus = { run: (type, payload, options) => { calls.push(options.state ?? null); return { ok: true, receipt: receipt(`done ${payload.n}`), state: { after: payload.n } }; } };
    const out = runPreludes({ s: {}, bus, store: { head: () => ({}) }, problem: () => {} },
        { requested: [{ moduleId: 'm', type: SETTLE, payload: { n: 1 } }, { moduleId: 'm', type: SETTLE, payload: { n: 2 } }], cues, prechecks: [], previewState: null });
    assert.deepEqual(calls, [null, { after: 1 }], 'the second settle starts from what the first left');
    assert.deepEqual(out.previewState, { after: 2 });
    assert.deepEqual(cues.m, [
        { text: '[Happened]\ndone 1', keep: true, interaction: true },
        { text: '[Happened]\ndone 2', keep: true, interaction: true },
    ], 'each note is pinned by its receipt type, not by data.keep');
});

// The settled note's allowance (interaction/note.js) reaches the reader only through this loop: the quiet NOTE_LONG Problem, the note still whole and pinned.
const LONG = 'The long note. '.repeat(600);
function runNote(summary, { payload = { kindId: 'mod/hard_bargain' }, kindOf } = {}) {
    const cues = {}, problems = [];
    const bus = { run: () => ({ ok: true, receipt: receipt(summary), state: {} }) };
    runPreludes({ s: {}, bus, store: { head: () => ({}) }, problem: entry => problems.push(entry), ...(kindOf ? { kindOf } : {}) },
        { requested: [{ moduleId: 'mod', type: SETTLE, payload }], cues, prechecks: [], previewState: null });
    return { cues, problems };
}

test('an over-long note raises the quiet NOTE_LONG with the module and is still told whole and pinned', () => {
    const { cues, problems } = runNote(LONG, { kindOf: () => ({ title: 'Bargain' }) });
    assert.equal(problems.length, 1);
    assert.deepEqual({ code: problems[0].code, quiet: problems[0].quiet, module: problems[0].module }, { code: 'NOTE_LONG', quiet: true, module: 'mod' });
    assert.match(problems[0].message, /^The Bargain note is \d+ tokens, over its 1290; it is sent whole\.$/);
    assert.deepEqual(cues.mod, [{ text: `[Happened]\n${LONG}`, keep: true, interaction: true }]);
});

test('a kind\'s limits.noteTokens is the allowance; a short note raises nothing', () => {
    const kindOf = () => ({ title: 'Bargain', limits: { noteTokens: 5 } });
    assert.equal(runNote('Short note that is over five tokens for sure, yes.', { kindOf }).problems[0]?.code, 'NOTE_LONG');
    assert.match(runNote('Short note that is over five tokens for sure, yes.', { kindOf }).problems[0].message, /over its 5;/);
    assert.deepEqual(runNote('Short.', { kindOf }).problems, []);
});

test('with no kindOf or an unknown kind the shared allowance and the readable kind id are used', () => {
    assert.match(runNote(LONG).problems[0].message, /^The Hard bargain note is \d+ tokens, over its 1290;/);
    assert.match(runNote(LONG, { kindOf: () => null }).problems[0].message, /^The Hard bargain note/);
    assert.deepEqual(runNote('Short.').problems, []);
});

test('a note with no text tells nothing: no bare [Happened] header is pinned (the receipt is still recorded)', () => {
    for (const summary of ['', '  \n', undefined]) {
        const cues = {}, prechecks = [];
        const bus = { run: () => ({ ok: true, receipt: receipt(summary), state: {} }) };
        runPreludes({ s: {}, bus, store: { head: () => ({}) }, problem: () => {} }, { requested: [{ moduleId: 'mod', type: SETTLE, payload: {} }], cues, prechecks, previewState: null });
        assert.deepEqual(cues, {});
        assert.equal(prechecks.length, 1);
    }
});
