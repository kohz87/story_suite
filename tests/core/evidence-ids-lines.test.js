// A proof id belongs to the block that holds it (docs/v2/EVIDENCE.md): legacy occurrences, placement, identical lines, and retries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { T1, T2, director, evidenceHarness, sampleModule, hostModule } from './helpers/evidence.js';
import { ids, rerunOf } from './evidence-ids.helpers.js';

test('a store that never gave proof is written as it was: no list of owners, no occurrences', () => {
    const h = evidenceHarness({ options: { checkpointEvery: 2 } });
    for (let n = 0; n < 6; n += 1) {
        h.send();
        assert.equal(h.command('sd.gate', { value: n % 2 === 0 }).ok, true);
    }
    const records = h.chat.map(message => message.extra?.storySuite).filter(Boolean);
    assert.ok(records.filter(record => record.checkpoint).length >= 2, 'checkpoints were written');
    for (const record of records) {
        assert.equal(Object.hasOwn(record, 'owned'), false);
        assert.equal(Object.hasOwn(record.source ?? {}, 'taken'), false);
        assert.ok(record.spans.every(span => !Object.hasOwn(span, 'occurrence')));
    }
});

// What a build before proof was released wrote: proof spans with no occurrence.
function stripOccurrences(h) {
    for (const message of h.chat) {
        const record = message.extra?.storySuite;
        if (!record) continue;
        for (const span of record.spans ?? []) delete span.occurrence;
        if (record.source) delete record.source.taken;
    }
    h.store.rebuild();
}

test('a block that gives proof and has no occurrence is not supported: it is not applied, it is reported, and its proof is not shown', () => {
    const h = evidenceHarness();
    h.send();
    const made = h.command('sd.many', { specs: [{ kind: 'visit', payload: { place: 'a' } }] }).receipt.data.proofs[0];
    h.command('sd.gate', { value: true });
    h.send();
    const other = h.command('demo.many', { specs: [{ kind: 'event', payload: { foe: 'wolf' }, parents: [made.id] }] }).receipt.data.proofs[0];
    assert.deepEqual(ids(h.ask({ ids: [made.id, other.id] })), [made.id, other.id]);
    stripOccurrences(h);
    assert.deepEqual(h.ask(), [], 'no proof of a block with no occurrence');
    assert.equal(h.problems().filter(problem => /no occurrence/.test(problem.why)).length, 2, 'each is reported');
    assert.equal(h.store.head().domains.sdt.ready, true, 'a block with no proof at all is as it was');
    assert.deepEqual(Object.keys(h.store.head().meta.proofs ?? {}), [], 'and nothing is pinned');
});

test('the earlier identical step that goes does not bring anything back from blocks written without occurrences: they fail closed, however often a reconcile runs', () => {
    const h = evidenceHarness();
    h.send();
    assert.equal(h.command('sd.gate', { value: true }).ok, true);
    h.send();
    const first = h.command('sd.ready', {}, 'system').receipt.data.made;
    h.command('sd.gate', { value: false });
    h.command('sd.gate', { value: true });
    const second = h.command('sd.ready', {}, 'system').receipt.data.made;
    const built = h.command('sd.needs', { thread: T1, selection: 'Turn in', parent: first.id });
    assert.equal(built.ok, true, built.message);
    stripOccurrences(h);
    h.chat.splice(1, 2);
    h.store.rebuild();
    for (let round = 1; round <= 3; round += 1) {
        h.store.reconcile(0, { rerun: rerunOf(h) });
        assert.deepEqual(h.ask({ ids: [first.id, second.id, built.receipt.data.proof.id] }), [], `reconcile ${round}: nothing of them is shown`);
    }
    h.store.rebuild();
    assert.deepEqual(h.ask(), [], 'and not after a replay');
    assert.ok(h.problems().length >= 3);
});

test('identical steps that gave no proof get a number each when a plan finds them ready: two effects, two proofs, by a reconcile and by a Re-read\'s placement', () => {
    for (const how of ['reconcile', 'placement']) {
        const h = evidenceHarness();
        h.send();
        assert.equal(h.command('sd.gate', { value: false }).ok, true);
        h.send();
        h.command('sd.maybe', {}, 'system');
        h.command('sd.maybe', {}, 'system');
        const log = () => h.store.head().domains.sdt.log.filter(entry => entry === 'open' || entry === 'closed');
        assert.deepEqual(log(), ['closed', 'closed'], `${how}: shut, both did their part`);
        assert.deepEqual(h.ask(), [], `${how}: and no proof`);
        // The reply that shut the gate goes: both should now be ready.
        h.chat.splice(1, 2);
        h.store.rebuild();
        if (how === 'reconcile') h.store.reconcile(0, { rerun: rerunOf(h) });
        else h.store.replaceStory(h.chat.findIndex((message, i) => i > 0 && message.extra?.storySuite), { ops: [], receipts: [], rerun: rerunOf(h) });
        const proofs = () => h.ask().filter(proof => proof.payload.after === 'maybe');
        assert.deepEqual(log(), ['open', 'open'], `${how}: two effects`);
        assert.equal(proofs().length, 2, `${how}: two proofs`);
        assert.equal(new Set(ids(proofs())).size, 2, `${how}: with two ids`);
        const was = ids(proofs());
        h.store.rebuild();
        assert.deepEqual(ids(proofs()), was, `${how}: a replay agrees`);
        assert.deepEqual(log(), ['open', 'open']);
        assert.deepEqual(h.problems(), [], `${how}: no Problem`);
    }
});

// A reply of identical lines (and others), on the host, with a click built on the first of them.
async function lined(t, lines) {
    const link = hostModule();
    const host = await createHost({ modules: [link.def, director(), sampleModule()], core: false });
    t.after(() => host.close());
    link.link(host.store);
    const ask = args => host.sdk.query('story.evidence', args);
    const text = list => `Dawn.\n\n<Changes>\n${list.join('\n')}\n</Changes>`;
    await host.send('Sure, I accept the job. Thanks a lot!', text(lines));
    const at = host.ctx.chat.length - 1;
    const edit = async list => {
        host.ctx.chat[at].mes = text(list);
        host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
        const done = await host.turn.reread(at);
        assert.equal(done.ok, true, done.message);
    };
    const accepted = () => ask({}).filter(proof => proof.kind === 'acceptance' && proof.payload.thread === T1);
    return { host, ask, edit, accepted };
}
const SAME = `! accept ${T1} | words: Sure, I accept the job`;

test('a line of identical lines goes: the one that stays does not take the identity of the one that went, and what was built on it is hidden, also after a rebuild', async t => {
    const { host, ask, edit, accepted } = await lined(t, [SAME, SAME]);
    const [first, second] = accepted();
    assert.notEqual(first.id, second.id);
    const click = host.bus.command('sd.needs', { thread: T2, selection: 'Turn in', parent: first.id }, { cause: 'ui' });
    assert.equal(click.ok, true, click.message);
    const clickId = click.receipt.data.proof.id;
    assert.deepEqual(ids(ask({ ids: [clickId] })), [clickId]);
    await edit([SAME]);
    assert.equal(accepted().length, 1);
    assert.deepEqual([first.id, second.id].includes(accepted()[0].id), false, 'a number nobody used: a new id');
    assert.deepEqual(ask({ ids: [clickId] }), [], 'the click built on the line that went is not shown');
    assert.ok(host.store.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE'), 'and it is reported');
    host.store.rebuild();
    assert.deepEqual(ask({ ids: [clickId] }), [], 'also after a rebuild');
    assert.ok(host.store.problems().some(problem => problem.code === 'REPLAY_PREREQUISITE'));
});

test('an identical line is added before the original: the original\'s id is not given to the new one, and what was built on it is hidden', async t => {
    const { host, ask, edit, accepted } = await lined(t, [SAME]);
    const [only] = accepted();
    const click = host.bus.command('sd.needs', { thread: T2, selection: 'Turn in', parent: only.id }, { cause: 'ui' });
    assert.equal(click.ok, true, click.message);
    const clickId = click.receipt.data.proof.id;
    await edit([SAME, SAME]);
    assert.equal(accepted().length, 2);
    assert.equal(accepted().some(proof => proof.id === only.id), false, 'neither takes the old id');
    assert.deepEqual(ask({ ids: [clickId] }), []);
    host.store.rebuild();
    assert.deepEqual(ask({ ids: [clickId] }), []);
});

test('lines of identical text as many as before keep every id, and another operation of the reply keeps its ids when this one changes', async t => {
    const other = `! accept ${T2} | words: Sure, I accept the job`;
    const { ask, edit, accepted } = await lined(t, [SAME, SAME, other]);
    const mine = ask({}).map(proof => proof.id);
    assert.equal(mine.length, 3);
    await edit([SAME, SAME, other]);
    assert.deepEqual(ask({}).map(proof => proof.id), mine, 'an unchanged Re-read keeps every id');
    const second = ask({}).find(proof => proof.payload.thread === T2).id;
    await edit([SAME, other]);
    assert.equal(accepted().length, 1);
    assert.equal(ask({}).find(proof => proof.payload.thread === T2).id, second, 'the other operation keeps its id');
    assert.equal(mine.slice(0, 2).includes(accepted()[0].id), false, 'and this one has a new id');
});

test('identical steps with no guard that gave no proof get a number each when a Re-read\'s placement finds them ready: two effects, two proofs', () => {
    const h = evidenceHarness();
    h.send();
    assert.equal(h.command('sd.gate', { value: false }).ok, true);
    h.send();
    assert.equal(h.command('sd.plain', {}, 'system').ok, true);
    assert.equal(h.command('sd.plain', {}, 'system').ok, true);
    const log = () => h.store.head().domains.sdt.log.filter(entry => entry === 'open' || entry === 'closed');
    assert.deepEqual(log(), ['closed', 'closed']);
    h.chat.splice(1, 2);
    h.store.rebuild();
    h.store.replaceStory(h.chat.findIndex((message, i) => i > 0 && message.extra?.storySuite), { ops: [], receipts: [], rerun: rerunOf(h) });
    const proofs = () => h.ask().filter(proof => proof.payload.after === 'plain');
    assert.deepEqual(log(), ['open', 'open'], 'two effects');
    assert.equal(proofs().length, 2, 'two proofs');
    assert.equal(new Set(ids(proofs())).size, 2);
    const was = ids(proofs());
    h.store.rebuild();
    assert.deepEqual(ids(proofs()), was, 'also after a rebuild');
    assert.deepEqual(h.problems(), []);
});

test('a retry of a Re-read starts from the same inputs: an unchanged line that makes an id keeps it', async t => {
    const link = hostModule();
    const host = await createHost({ modules: [link.def, director({ marks: true }), sampleModule()], core: false });
    t.after(() => host.close());
    link.link(host.store);
    const text = list => `Dawn.\n\n<Changes>\n${list.join('\n')}\n</Changes>`;
    await host.send('Sure, I accept the job. Thanks a lot!', text([SAME, SAME, '! mark alpha']));
    const at = host.ctx.chat.length - 1;
    const mark = () => host.head().domains.sdt.marks.alpha;
    const was = mark();
    // A duplicate line goes: the Re-read is planned twice, and the other line is read the same both times.
    host.ctx.chat[at].mes = text([SAME, '! mark alpha']);
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(mark(), was, 'the id the unchanged line made is the one it made');
});

test('a retry that changes another operation retires it too: a step whose group shrinks on the second plan does not keep an old number', async t => {
    const link = hostModule();
    const track = { id: null };
    const host = await createHost({ modules: [link.def, director({ after: 'twins', track }), sampleModule()], core: false });
    t.after(() => host.close());
    link.link(host.store);
    const ask = args => host.sdk.query('story.evidence', args);
    const text = list => `Dawn.\n\n<Changes>\n${list.join('\n')}\n</Changes>`;
    await host.send('Sure, I accept the job. Thanks a lot!', text([SAME, SAME]));
    const at = host.ctx.chat.length - 1;
    const twins = () => ask({}).filter(proof => proof.kind === 'visit' && proof.payload.place === 'twin');
    assert.equal(twins().length, 2);
    track.id = ask({}).find(proof => proof.kind === 'acceptance').id;
    const click = host.bus.command('sd.needs', { thread: T2, selection: 'Turn in', parent: twins()[0].id }, { cause: 'ui' });
    assert.equal(click.ok, true, click.message);
    const clickId = click.receipt.data.proof.id;
    // One of the duplicate lines goes. The first plan keeps two steps (the tracked proof is shown), the second finds one: the steps are another group
    // that changed, so none of their old numbers is given back, and what was built on one of them is hidden.
    host.ctx.chat[at].mes = text([SAME]);
    host.ctx.chat[at].swipes[host.ctx.chat[at].swipe_id] = host.ctx.chat[at].mes;
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(twins().length, 1);
    assert.deepEqual(ask({ ids: [clickId] }), [], 'the click built on a step that went is not shown');
    host.store.rebuild();
    assert.deepEqual(ask({ ids: [clickId] }), [], 'also after a rebuild');
});
