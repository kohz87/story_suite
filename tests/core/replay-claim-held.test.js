// REPLAY.md rule 4 for legacy (unguarded) blocks: replay that meets a block claiming a key the line already holds skips the
// block (its ops stay off) and raises one Problem naming the claim and the command, as it does for guarded blocks. The real
// legacy claim families (a once event, wear) are per reply or made by hooks a Re-read never re-runs: nothing changes for them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { probeModule } from '../../packages/story-block/tests/v2/qa/helpers/probe-module.js';

const said = (text, lines = []) => (lines.length ? `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>` : text);
const held = h => h.store.problems().filter(p => p.code === 'REPLAY_PREREQUISITE');
const claimsOf = h => Object.keys(h.head().meta.claims ?? {}).sort();
const hasItem = (h, name) => JSON.stringify(h.head().domains.inventory).includes(name);
const quiet = t => t.mock.method(console, 'warn', () => {});

async function host(t, modules = [probeModule()]) {
    const h = await createHost({ modules });
    t.after(() => h.close());
    return h;
}

function oneProblem(h, key, command) {
    const found = held(h);
    assert.equal(found.length, 1, JSON.stringify(found));
    assert.match(found[0].why, new RegExp(`^claim already held \\(${key}\\), so ${command.replace('.', '\\.')} stays off$`));
    return found[0];
}

test('NEW-1: an edited Re-read takes a claim a later legacy block holds; the later block is skipped with one Problem', async t => {
    quiet(t);
    const h = await host(t);
    await h.send('On.', said('R0.', ['+ item Rope']));
    await h.send('On.', said('R1.', ['+ item Lamp', '! probe frost']));
    await h.st.editMessage(2, said('R0.', ['+ item Rope', '! probe frost']));
    const res = await h.sdk.reread(2);
    assert.equal(res.ok, true, res.message);
    assert.deepEqual(h.head().domains.probe.seen, ['frost'], 'held once, not twice');
    assert.deepEqual(claimsOf(h), ['probe:seen:frost']);
    const problem = oneProblem(h, 'probe:seen:frost', 'capture.probe');
    assert.equal(problem.index, 4, 'the later reply is the one skipped: the first holder wins');
    const stored = h.ctx.chat[4].extra.storySuite;
    assert.ok(stored.ops.some(op => op.path === '/meta/claims/probe:seen:frost'), 'the skipped block stays stored');
    // The same on a rebuild (reload), and the story told that way gives the same state.
    h.store.rebuild();
    assert.deepEqual(h.head().domains.probe.seen, ['frost']);
    oneProblem(h, 'probe:seen:frost', 'capture.probe');
    assert.ok(hasItem(h, 'Lamp'), 'only the claiming line is skipped: the rest of the reply applies');
    const told = await host(t);
    await told.send('On.', said('R0.', ['+ item Rope', '! probe frost']));
    await told.send('On.', said('R1.', ['+ item Lamp', '! probe frost']));
    assert.deepEqual(told.head().domains.probe, h.head().domains.probe);
    assert.deepEqual(claimsOf(told), claimsOf(h));
    assert.deepEqual(told.head().domains.inventory.counts, h.head().domains.inventory.counts);
    // Edited back, the earlier reply lets the claim go and the later block applies again: live and rebuilt agree.
    await h.st.editMessage(2, said('R0.', ['+ item Rope']));
    assert.equal((await h.sdk.reread(2)).ok, true);
    assert.deepEqual(h.head().domains.probe.seen, ['frost']);
    assert.deepEqual(held(h), []);
    const live = JSON.stringify(h.head().domains);
    h.store.rebuild();
    assert.equal(JSON.stringify(h.head().domains), live);
    assert.deepEqual(held(h), []);
});

test('a live apply is unchanged: the second claim is refused by its command, and replay has nothing to skip', async t => {
    quiet(t);
    const h = await host(t);
    await h.send('On.', said('R0.', ['! probe frost']));
    await h.send('On.', said('R1.', ['! probe frost']));
    assert.deepEqual(h.head().domains.probe.seen, ['frost']);
    assert.ok(h.turn.problems().some(p => p.code === 'CLAIMED' && p.line === '! probe frost'));
    assert.deepEqual(held(h), []);
    h.store.rebuild();
    assert.deepEqual(h.head().domains.probe.seen, ['frost']);
    assert.deepEqual(held(h), []);
});

// A UI command on a reply (a kept, non-story block of that reply) and a story line that make the same claim.
function marker() {
    const mark = (ctx, word) => {
        if (!ctx.claim(`mark:${word}`)) ctx.fail('CLAIMED', `${word} is marked already.`);
        ctx.draft('marks').list.push(word);
    };
    return {
        id: 'qa-mark', name: 'QA mark', version: '0.0.0',
        domains: { marks: { initial: () => ({ list: [] }) } },
        commands: { 'mark.set'(ctx, { word } = {}) { mark(ctx, word); return { summary: `Marked ${word}.` }; } },
        capture: { kinds: { mark: { grammar: '! mark Word' } }, apply(ctx, line) { mark(ctx, String(line.name).toLowerCase()); return { summary: 'Marked.' }; } },
    };
}

test('a Re-read whose new story takes the claim of a kept legacy block on the same reply skips that block, not the Re-read', async t => {
    quiet(t);
    const h = await host(t, [marker()]);
    await h.send('On.', said('R0.'));
    assert.equal((await h.sdk.command('mark.set', { word: 'frost' })).ok, true);
    assert.deepEqual(h.head().domains.marks.list, ['frost']);
    await h.st.editMessage(2, said('R0.', ['! mark frost']));
    const res = await h.sdk.reread(2);
    assert.equal(res.ok, true, res.message);
    assert.deepEqual(h.head().domains.marks.list, ['frost'], 'marked once');
    assert.deepEqual(claimsOf(h), ['mark:frost']);
    assert.equal(oneProblem(h, 'mark:frost', 'mark.set').index, 2, 'the kept block of the Re-read reply is the one skipped');
    h.store.rebuild();
    assert.deepEqual(h.head().domains.marks.list, ['frost']);
    oneProblem(h, 'mark:frost', 'mark.set');
});

// CLAIMLEGACY's families on a Story Block host: nothing changes (the Story Director families are in its time tests).
const bells = JSON.stringify({ id: 'cl-events', version: '1.0.0', name: 'CL', requires: { storyBlock: '^2' },
    content: { events: [{ id: 'bells', when: "query('scene.place').name == 'Bluewatch Village'", cue: 'Bells ring.', once: true,
        then: [{ command: 'wallet.receive', payload: { owner: 'party', amount: 1000 } }] }] } });
const coin = h => h.head().domains.inventory.wallets?.party?.coin ?? 0;

test('a once event (legacy, whole-story key): an edited Re-read that moves its place earlier still pays once, no Problem', async t => {
    quiet(t);
    const h = await host(t, []);
    await h.packs.packs.install(bells);
    await h.send('Go.', said('R0.', ['+ item Rope']));
    await h.send('Go.', said('R1.', ['~ place Bluewatch Village | kind: settlement']));
    await h.send('Go.', said('R2.'));
    await h.send('Go.', said('R3.'));
    assert.equal(coin(h), 1000);
    const before = claimsOf(h);
    assert.ok(before.includes('event:pack.cl-events/bells'));
    await h.st.editMessage(2, said('R0.', ['+ item Rope', '~ place Bluewatch Village | kind: settlement']));
    assert.equal((await h.sdk.reread(2)).ok, true);
    for (const index of [4, 6, 8]) assert.equal((await h.sdk.reread(index)).ok, true, `Re-read ${index}`);
    assert.equal(coin(h), 1000);
    assert.deepEqual(claimsOf(h), before);
    assert.deepEqual(held(h), []);
});

test('wear (legacy, per reply and stack): an edited Re-read adds its own key beside the later ones, no Problem', async t => {
    quiet(t);
    const h = await host(t, []);
    await h.send('x', said('R0.', ['+ item Cane Sword']));
    await h.send('x', said('R1.', ['~ item Cane Sword | wear: tear']));
    await h.send('x', said('R2.', ['~ item Cane Sword | wear: tear']));
    const wear = () => claimsOf(h).filter(key => key.startsWith('wear:'));
    assert.equal(wear().length, 2);
    await h.st.editMessage(2, said('R0.', ['+ item Cane Sword', '~ item Cane Sword | wear: tear']));
    assert.equal((await h.sdk.reread(2)).ok, true);
    assert.equal(wear().length, 3, 'three distinct reply keys');
    assert.deepEqual(held(h), []);
    h.store.rebuild();
    assert.equal(wear().length, 3);
    assert.deepEqual(held(h), []);
});
