// The quest step trail (`director.steps`) under Re-read, the validator's headroom and the offer path's first step: replay equals the
// story told that way, for the board and the stored map.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { createModule } from '../../../../ui/legacy/director/module.js';
import { withD1 } from '../../../helpers/director/d1.js';
import { validateDirector } from '../../../../modules/time/tracker/domain-parts/validate.js';
import { recordStep, stepsFor } from '../../../../modules/time/tracker/capture-parts/step-trail.js';
import { STEP_CEILING, STEP_KEPT, stepOrder } from '../../../../modules/time/tracker/domain-parts/shared-step-keys.js';

const said = (text, lines) => `${text}\n<Changes>\n${lines.join('\n')}\n</Changes>`;

// A host with the Director, told one reply per entry of `told` (reply i opens with "R<i>.").
async function tell(t, told) {
    let host = null;
    const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
    host = await createHost({ modules: [director] });
    t.after(() => host.close());
    for (const [i, lines] of told.entries()) await host.send('On.', said(`R${i}.`, lines));
    return host;
}
const replyAt = (host, i) => host.st.ctx.chat.findIndex(m => !m.is_user && String(m.mes).startsWith(`R${i}.`));
const steps = host => host.head().domains.director.steps;
const board = host => Object.fromEntries(host.sdk.query('quest.board').active.concat(host.sdk.query('quest.board').offers).map(q => [q.key, q.steps]));
// The stored map with what differs between two chats taken out: a reply by its place, a thread by its name.
function stored(host) {
    const map = steps(host);
    const names = Object.fromEntries(host.sdk.query('director.threads', {}).map(x => [x.id, x.key]));
    return stepOrder(map).map(key => [map[key].place, Number(key.split('.').at(-1)), names[map[key].thread], map[key].text, map[key].turn]);
}
async function reread(host, i, lines) {
    const at = replyAt(host, i);
    await host.st.editMessage(at, said(`R${i}.`, lines));
    return host.sdk.reread(at);
}

const Q = ['Q0', 'Q1', 'Q2', 'Q3', 'Q4'];

test('an edited Re-read that writes more step lines than before equals the story told the edited way (board and stored map)', async t => {
    t.mock.method(console, 'warn', () => {});
    const told = [Q.map(q => `+ quest ${q} — go | giver: A | step: ${q}-0`), ['~ quest Q0 | step: Q0-1'], ['~ quest Q0 | step: Q0-2'],
        Q.map(q => `~ quest ${q} | step: ${q}-3`), ['~ quest Q1 | step: Q1-4']];
    const edited = Q.map(q => `~ quest ${q} | step: ${q}-e`);
    const host = await tell(t, told);
    const result = await reread(host, 1, edited);
    assert.equal(result.ok, true, JSON.stringify(result));
    const fresh = await tell(t, [told[0], edited, ...told.slice(2)]);
    assert.deepEqual(board(host).Q3, ['Q3-0', 'Q3-e', 'Q3-3']);
    assert.deepEqual(board(host).Q0, ['Q0-0', 'Q0-e', 'Q0-2', 'Q0-3']);
    assert.deepEqual(board(host), board(fresh));
    assert.deepEqual(stored(host), stored(fresh));
    assert.deepEqual(validateDirector(host.head().domains.director), []);
});

test('an edited Re-read that gives step lines to a reply that had none keeps the trail in reply order', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await tell(t, [['+ quest Q — go | giver: A | step: a'], [], ['~ quest Q | step: c']]);
    const result = await reread(host, 1, ['~ quest Q | step: b']);
    assert.equal(result.ok, true, JSON.stringify(result));
    const fresh = await tell(t, [['+ quest Q — go | giver: A | step: a'], ['~ quest Q | step: b'], ['~ quest Q | step: c']]);
    assert.deepEqual(board(host).Q, ['a', 'b', 'c']);
    assert.deepEqual(board(host), board(fresh));
    // The reply count (`turn.n`) does not move for a reply with no Director lines, so the turns differ; the order does not.
    assert.deepEqual(stored(host).map(row => row.slice(0, 4)), stored(fresh).map(row => row.slice(0, 4)));
});

test('an edited Re-read at the cap succeeds: the validator leaves replay room above what the writer keeps', async t => {
    t.mock.method(console, 'warn', () => {});
    const Z = Array.from({ length: 10 }, (_, i) => `Z${i}`);
    const told = [Z.map(q => `+ quest ${q} — go | giver: A | step: ${q}-0`), ...Array.from({ length: 41 }, (_, r) => Z.map(q => `~ quest ${q} | step: ${q}-${r + 1}`)),
        ['~ quest Z0 | step: Z0-41'], Z.map(q => `~ quest ${q} | step: ${q}-after`)];
    const host = await tell(t, told);
    assert.equal(Object.keys(steps(host)).length, STEP_KEPT);
    const result = await reread(host, 42, ['~ quest Z0 | step: Z0-edited']);
    assert.equal(result.ok, true, JSON.stringify(result));
    const count = Object.keys(steps(host)).length;
    // Above the writer's cap (a later reply's stored prune of a key the Re-read took is skipped), within the ceiling.
    assert.ok(count > STEP_KEPT && count <= STEP_CEILING, String(count));
    assert.deepEqual(validateDirector(host.head().domains.director), []);
    assert.deepEqual(board(host).Z0.slice(-3), ['Z0-41', 'Z0-edited', 'Z0-after']);
});

test('the validator: at most 2 × the kept entries, keys by reply, each entry with its turn and place', () => {
    assert.equal(STEP_CEILING, 2 * STEP_KEPT);
    const director = { time: { minutes: null }, threads: {}, keys: {}, writes: {}, problems: {}, turn: { n: 0, now: null } };
    const map = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`sw_${i}.0`, { thread: 'th_x', text: 's', turn: i, place: i }]));
    const stepErrors = steps => validateDirector({ ...director, steps }).filter(e => e.startsWith('director.steps'));
    assert.deepEqual(stepErrors(map(STEP_CEILING)), []);
    assert.equal(stepErrors(map(STEP_CEILING + 1)).length, 1);
    assert.deepEqual(stepErrors({ 'r12.0': { thread: 'th_x', text: 's', turn: 0, place: -1 } }), []);
    assert.equal(stepErrors({ 'bad key.0': { thread: 'th_x', text: 's', turn: 0, place: 0 } }).length, 1);
    assert.equal(stepErrors({ 'sw_1.0': { thread: 'th_x', text: 's' } }).length, 1);
});

test('an offer writes its first step: deleting the reply that next changes the step keeps it (the story told without that reply)', async t => {
    t.mock.method(console, 'warn', () => {});
    const told = [['+ hook Rats — cellar | goal: clear it | giver: Fenna | step: A'], ['~ quest Rats | step: A'], ['~ quest Rats | step: B'], ['~ quest Rats | step: C']];
    const host = await tell(t, told);
    assert.deepEqual(board(host).Rats, ['A', 'B', 'C']);
    await host.st.deleteMessage(replyAt(host, 2));
    const fresh = await tell(t, [told[0], told[1], told[3]]);
    assert.deepEqual(board(host).Rats, ['A', 'C']);
    assert.deepEqual(board(host), board(fresh));
    // Places and turns after the delete keep the values stored when written; the entries, their order and texts match.
    assert.deepEqual(stored(host).map(row => row.slice(1, 4)), stored(fresh).map(row => row.slice(1, 4)));
});

test('a step written outside a reply\'s capture (an arc plan) is kept under <sid>:<receipt>.<n>, and every older key form still reads in order', () => {
    const director = { turn: { n: 3, now: null }, steps: { 'r4.0': { thread: 'th_x', text: 'old-r', turn: 1, place: -1 }, '5.0': { thread: 'th_x', text: 'old-rev', turn: 2, place: 4 } } };
    const thread = { id: 'th_x', fields: { step: 'planned' } };
    recordStep(director, { cause: 'plan', reply: { sid: 'sw_9' }, receiptId: 'rc1', rev: 7 }, thread);
    recordStep(director, { cause: 'story', carrier: { sid: 'sw_9', index: 2 }, rev: 7 }, { id: 'th_x', fields: { step: 'told' } });
    assert.deepEqual(Object.keys(director.steps).sort(), ['5.0', 'r4.0', 'sw_9.0', 'sw_9:rc1.0']);
    assert.deepEqual(stepsFor(director, 'th_x'), ['old-r', 'old-rev', 'planned', 'told']);
    assert.deepEqual(validateDirector({ time: { minutes: null }, threads: {}, keys: {}, writes: {}, problems: {}, turn: { n: 0, now: null }, steps: director.steps }), []);
});

test('one reply\'s steps stay in count order when a later write carries a lower place (a Continue after a middle delete, a swipe or Re-read that shifted the count)', () => {
    const step = (text, turn, place) => ({ thread: 'th_x', text, turn, place });
    // The review's probe: same turn, sw_A.0 placed 5, then its Continue sw_A.1 placed 4.
    const probe = { turn: { n: 3, now: null }, steps: { 'sw_A.0': step('a0', 3, 5), 'sw_A.1': step('a1', 3, 4) } };
    assert.deepEqual(stepsFor(probe, 'th_x'), ['a0', 'a1']);
    // A later reply B (same turn, higher place) still follows A, and an earlier reply Z (lower place) still precedes it.
    const mixed = { turn: { n: 3, now: null }, steps: { 'sw_B.0': step('b0', 3, 9), 'sw_A.1': step('a1', 3, 4), 'sw_Z.0': step('z0', 3, 2), 'sw_A.0': step('a0', 3, 5) } };
    assert.deepEqual(stepsFor(mixed, 'th_x'), ['z0', 'a0', 'a1', 'b0']);
    // A swipe / Re-read of an earlier message moved the count up and then down: a reply's steps carry places 6, 4 and 7, still by number.
    const shifted = { turn: { n: 5, now: null }, steps: { 'sw_A.2': step('a2', 2, 7), 'sw_A.0': step('a0', 2, 6), 'sw_A.1': step('a1', 2, 4), 'sw_C.0': step('c0', 3, 1) } };
    assert.deepEqual(stepsFor(shifted, 'th_x'), ['a0', 'a1', 'a2', 'c0']);
    // A write kept on the reply under its receipt belongs to the same reply (equal counts: its own place decides).
    const receipt = { turn: { n: 3, now: null }, steps: { 'sw_A.0': step('a0', 3, 5), 'sw_A:rc1.0': step('kept', 3, 4), 'sw_B.0': step('b0', 3, 6) } };
    assert.deepEqual(stepsFor(receipt, 'th_x'), ['kept', 'a0', 'b0']);
});

test('a Re-read gives step lines to a reply that had none, earlier exchanges are deleted, then the later reply is Continued: story order a, b, c, d', async t => {
    t.mock.method(console, 'warn', () => {});
    for (const fillers of [1, 2]) {
        let host = null;
        const director = withD1(createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } }));
        host = await createHost({ modules: [director] });
        t.after(() => host.close());
        await host.send('On.', said('R0.', ['+ quest Q — go | giver: A | step: a']));
        for (let i = 0; i < fillers; i += 1) await host.send('Chat.', `F${i}. small talk`);
        await host.send('On.', 'R1. nothing');
        await host.send('On.', said('R2.', ['~ quest Q | step: c']));
        assert.equal((await reread(host, 1, ['~ quest Q | step: b'])).ok, true);
        for (let i = fillers - 1; i >= 0; i -= 1) {
            const f = host.st.ctx.chat.findIndex(m => !m.is_user && String(m.mes).startsWith(`F${i}.`));
            await host.st.deleteMessage(f);
            await host.st.deleteMessage(f - 1);
        }
        await host.cont(`\n${said('More of R2.', ['~ quest Q | step: d'])}`);
        const map = steps(host);
        assert.deepEqual(stepOrder(map).map(k => map[k].text), ['a', 'b', 'c', 'd']);
        assert.deepEqual(board(host).Q, ['a', 'b', 'c', 'd']);
        assert.equal(stepsFor(host.head().domains.director, Object.values(map)[0].thread).at(-1), 'd');
        // Any key order of the map gives the same order.
        const keys = Object.keys(map);
        const rev = Object.fromEntries(keys.reverse().map(k => [k, map[k]]));
        assert.deepEqual(stepOrder(rev).map(k => rev[k].text), ['a', 'b', 'c', 'd']);
    }
});
