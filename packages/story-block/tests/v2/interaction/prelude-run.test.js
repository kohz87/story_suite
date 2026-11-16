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
    assert.deepEqual(cues.m, ['[Happened]\ndone 1', '[Happened]\ndone 2']);
});
