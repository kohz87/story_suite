import test from 'node:test';
import assert from 'node:assert/strict';
import { blockIdOf, hashJson } from '../../core/replay.js';
import { readRecord } from '../../core/persist.js';
import { reply, seams, steps, upgraded, started, blocks, click } from './ctx-seams.helpers.js';

test('a main-written guarded line keeps its seeded id and every stored span byte on reload and unchanged Re-reads', async t => {
    const { host, saved } = await upgraded(t);
    const at = host.ctx.chat.length - 1;
    for (let n = 0; n < 2; n += 1) {
        assert.equal((await host.sdk.reread(at)).ok, true);
        assert.equal(JSON.stringify(readRecord(host.ctx.chat[at]).spans[0]), saved);
        assert.deepEqual(Object.values(host.head().domains.cs.lines), [JSON.parse(saved).boundaries[0].cursor]);
        assert.deepEqual(host.store.problems(), []);
    }
});

test('Continue beside a main-written identical line gives only the new line an occurrence; unchanged Re-read renumbers neither it nor untouched neighbours', async t => {
    const { host, saved } = await upgraded(t);
    await host.cont(reply(' More.', ['! note dup']));
    await click(host, 'neighbour');
    await click(host, 'neighbour');
    const at = host.ctx.chat.length - 1;
    const before = readRecord(host.ctx.chat[at]).spans;
    assert.equal(JSON.stringify(before[0]), saved);
    assert.equal(Object.hasOwn(before[0], 'occurrence'), false);
    assert.equal(Number.isInteger(before[1].occurrence), true, 'the new block has an allocated occurrence');
    assert.notEqual(before[1].id, before[0].id);
    const identities = before.map(span => [span.id, span.occurrence]);
    for (let n = 0; n < 2; n += 1) {
        assert.equal((await host.sdk.reread(at)).ok, true);
        const after = readRecord(host.ctx.chat[at]).spans;
        assert.equal(JSON.stringify(after[0]), saved);
        assert.deepEqual(after.map(span => [span.id, span.occurrence]), identities);
        assert.deepEqual(host.store.problems(), []);
    }
});

test('a count change on Re-read retires a mixed old/new key and hides its dependent with a Problem', async t => {
    t.mock.method(console, 'warn', () => {});
    const { host, saved } = await upgraded(t);
    await host.cont(reply(' More.', ['! note dup']));
    const at = host.ctx.chat.length - 1;
    const [old, newer] = readRecord(host.ctx.chat[at]).spans;
    assert.equal(JSON.stringify(old), saved);
    assert.equal((await host.sdk.command('cs.on', { block: newer.id })).ok, true);
    host.ctx.chat[at].mes = reply('A. More.', ['! note dup']);
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
    assert.equal((await host.sdk.reread(at)).ok, true);
    const survivor = readRecord(host.ctx.chat[at]).spans.find(span => span.story);
    assert.equal([old.id, newer.id].includes(survivor.id), false, 'both old identities retire');
    assert.equal(survivor.occurrence > newer.occurrence, true);
    for (let n = 0; n < 2; n += 1) {
        assert.equal(host.head().domains.cs.ons[newer.id], undefined);
        assert.equal(host.store.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE' && /line it stands on is gone/.test(problem.why)), true);
        host.store.rebuild();
    }
});

test('an old guarded line that starts giving proof keeps its seeded id and its allocated occurrence on subsequent Re-reads', async t => {
    const owner = {
        id: 'story-director', name: 'Proof owner', version: '0.0.1',
        commands: { 'cs.visit'(ctx) { ctx.proof({ kind: 'visit', payload: { place: 'A' } }); return { summary: 'Visited.' }; } },
    };
    const { host, saved } = await upgraded(t, [seams({ giveProof: true }), owner]);
    const at = host.ctx.chat.length - 1;
    let identity;
    for (let pass = 0; pass < 3; pass += 1) {
        assert.equal((await host.sdk.reread(at)).ok, true);
        const record = readRecord(host.ctx.chat[at]);
        const span = record.spans[0];
        assert.equal(span.id, JSON.parse(saved).id);
        assert.deepEqual(host.head().domains.cs.lines[span.id], span.boundaries[0].cursor);
        assert.equal(Number.isInteger(span.occurrence), true);
        assert.equal(span.evidence.length, 1);
        const now = [span.id, span.occurrence, span.evidence[0].id, record.source.taken];
        if (identity) assert.deepEqual(now, identity);
        identity = now;
        assert.deepEqual(host.store.problems(), []);
    }
});

test('during a Re-read an afterCapture step reads the op its own stamped boundary has, as a story line does', async t => {
    const host = await started(t);
    steps.n = 2;
    t.after(() => { steps.n = 0; });
    await host.send('Go.', reply('A.', ['! mark line']));
    await click(host, 'kept');
    await click(host, 'kept2');
    const at = host.ctx.chat.length - 1;
    for (const { span } of blocks(host).filter(each => each.span.operation.type === 'cs.step')) {
        assert.deepEqual(host.head().domains.cs.steps[span.id], span.boundaries[0].cursor, 'live afterCapture');
    }
    for (let n = 0; n < 2; n += 1) {
        assert.equal((await host.sdk.reread(at)).ok, true);
        const stepBlocks = blocks(host).map(each => each.span).filter(span => span.operation.type === 'cs.step');
        assert.equal(stepBlocks.length, 2);
        for (const span of stepBlocks) {
            const read = host.head().domains.cs.steps[span.id];
            assert.deepEqual(read, span.boundaries[0].cursor, `Re-read ${n + 1}: what the step read is where its block starts`);
        }
        assert.notEqual(stepBlocks[0].boundaries[0].cursor.op, stepBlocks[1].boundaries[0].cursor.op);
    }
    const line = blocks(host).map(each => each.span).find(span => span.operation.payload.raw?.includes('line') || span.operation.payload.name === 'line');
    assert.deepEqual(host.head().domains.cs.marks.line.cursor, line.boundaries[0].cursor);
});

for (const count of [1, 2]) test(`Re-read replans ${count} kept system steps at their actual preceding-op count`, async t => {
    const host = await started(t);
    await host.send('Go.', reply('A.', ['! mark line']));
    for (let n = 0; n < count; n += 1) {
        const out = host.bus.run('cs.step', {}, { cause: 'system' });
        assert.equal(out.ok, true, out.message);
        host.store.append({ ops: out.ops, receipt: out.receipt, block: out.block });
    }
    const stepBlocks = () => blocks(host).map(each => each.span).filter(span => span.operation.type === 'cs.step');
    const before = stepBlocks().map(span => span.boundaries[0].cursor);
    for (const span of stepBlocks()) assert.deepEqual(host.head().domains.cs.steps[span.id], span.boundaries[0].cursor, 'live system step');
    const at = host.ctx.chat.length - 1;
    host.ctx.chat[at].mes = reply('A.', ['! mark before', '! mark line']);
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
    for (let pass = 0; pass < 2; pass += 1) {
        assert.equal((await host.sdk.reread(at)).ok, true);
        const after = stepBlocks();
        assert.equal(after.length, count);
        for (const [n, span] of after.entries()) {
            assert.equal(span.id, before[n].block);
            assert.equal(span.boundaries[0].cursor.op > before[n].op, true, 'the added line moved the step');
            assert.deepEqual(host.head().domains.cs.steps[span.id], span.boundaries[0].cursor, 'every cursor field matches the stamped boundary');
        }
        assert.deepEqual(host.store.problems(), []);
        host.store.rebuild();
    }
});

test('reconcile reruns a later kept step at its new offset when an earlier step is taken back', async t => {
    const host = await started(t);
    await host.send('Go.', reply('A.', ['! mark needed']));
    const first = host.ctx.chat.length - 1;
    await host.send('Next.', reply('B.', ['! mark anchor']));
    for (const payload of [{ needs: 'needed' }, {}]) {
        const out = host.bus.run('cs.step', payload, { cause: 'system' });
        assert.equal(out.ok, true, out.message);
        host.store.append({ ops: out.ops, receipt: out.receipt, block: out.block });
    }
    const before = blocks(host).map(each => each.span).filter(span => span.operation.type === 'cs.step');
    host.ctx.chat.splice(first - 1, 2);
    await host.turn.onTimelineChanged();
    const after = blocks(host).map(each => each.span).filter(span => span.operation.type === 'cs.step');
    assert.equal(after.length, 1);
    assert.equal(after[0].id, before[1].id);
    assert.equal(after[0].boundaries[0].cursor.op < before[1].boundaries[0].cursor.op, true);
    assert.deepEqual(host.head().domains.cs.steps[after[0].id], after[0].boundaries[0].cursor);
    assert.deepEqual(host.store.problems(), []);
});

test('delete the first of two identical lines and read the reply again: the survivor is a fresh block, the click on the first is hidden with a Problem, also after a rebuild', async t => {
    const host = await started(t);
    await host.send('Go.', reply('A.', ['! note dup', '! note dup']));
    const at = host.ctx.chat.length - 1;
    const lines = () => host.head().domains.cs.lines;
    const [first, second] = Object.keys(lines()).sort((a, b) => lines()[a].op - lines()[b].op);
    assert.notEqual(first, second);
    const done = await host.sdk.command('cs.on', { block: first });
    assert.equal(done.ok, true, done.message);
    assert.equal(host.head().domains.cs.ons[first], true);
    host.ctx.chat[at].mes = reply('A.', ['! note dup']);
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
    assert.equal((await host.sdk.reread(at)).ok, true);
    const survivor = Object.keys(lines());
    assert.equal(survivor.length, 1);
    assert.equal(survivor.includes(first) || survivor.includes(second), false, 'neither old block id');
    // The cursor it read is the stored block, and the stored occurrence is the one its id is made of.
    const span = blocks(host).map(each => each.span).find(each => each.id === survivor[0]);
    assert.deepEqual(lines()[survivor[0]], span.boundaries[0].cursor);
    assert.equal(span.occurrence >= 2, true, 'a number nobody had used');
    assert.equal(span.id, blockIdOf({ sid: span.boundaries[0].cursor.sid, swipeKey: span.boundaries[0].cursor.swipeKey, key: hashJson({ type: span.operation.type, line: span.operation.payload.raw ?? span.operation.payload }), rank: span.occurrence }));
    // The click stood on the first: it is hidden, with a Problem, now and after a rebuild.
    const hidden = () => host.head().domains.cs.ons[first] === undefined;
    assert.equal(hidden(), true, 'the click is hidden');
    assert.equal(host.store.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE' && /line it stands on is gone/.test(problem.why)), true);
    host.store.rebuild();
    assert.equal(hidden(), true, 'and after a rebuild');
    assert.equal(host.store.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE' && /line it stands on is gone/.test(problem.why)), true);
    assert.deepEqual(Object.keys(lines()), survivor);
});

test('the count rule covers blocks that give no proof: fewer identical steps than before and none of the old ids is given again', async t => {
    const host = await started(t);
    steps.n = 2;
    t.after(() => { steps.n = 0; });
    await host.send('Go.', reply('A.', ['! mark line']));
    const at = host.ctx.chat.length - 1;
    const ids = () => Object.keys(host.head().domains.cs.steps).sort();
    const before = ids();
    assert.equal(before.length, 2);
    steps.n = 1;
    assert.equal((await host.sdk.reread(at)).ok, true);
    const after = ids();
    assert.equal(after.length, 1);
    assert.equal(before.includes(after[0]), false, 'the survivor is a new block, not either old one');
    for (let n = 0; n < 2; n += 1) {
        assert.equal((await host.sdk.reread(at)).ok, true);
        assert.deepEqual(ids(), after, 'and then it holds still');
    }
    assert.deepEqual(host.head().domains.cs.steps[after[0]], blocks(host).map(each => each.span).find(span => span.id === after[0]).boundaries[0].cursor);
});
