// An `+ xp` with no `group:` counts down the foes the reply's tries were against first, then older groups, then the ones the reply declared.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecord } from '../../../core/persist.js';
import { validate } from '../src/domain/validate.js';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const CAT = '+ foes Crag-Cat | count: 1 | kind: elite';
const RATS = '+ foes Maw-Rats | count: 10 | kind: vermin';
const STRIKE = '? try Astra | Lore | hard | against: Crag-Cat';
const XP = '+ xp Party — slew them | foes: 1';

async function host(t) {
    t.mock.method(console, 'warn', () => {});
    const h = await withAstra();
    t.after(() => h.close());
    await h.send('Hello.', 'The road.');
    return h;
}
const say = (h, lines) => h.send('Go on.', reply('The fight goes on.', lines));
const left = h => Object.fromEntries(Object.entries(slice(h).foes.groups).map(([id, group]) => [id, group.left]));
const earned = h => h.store.receipts().map(entry => entry.receipt).filter(receipt => receipt.type === 'capture.xp').at(-1).data;
function sound(h) {
    assert.deepEqual(validate(slice(h)), []);
    const live = JSON.stringify(slice(h));
    h.store.rebuild();
    assert.equal(JSON.stringify(slice(h)), live, 'rebuild == live');
}

// What the crag-cat alone pays, from a reply with nothing else standing.
async function catXp(t) {
    const h = await host(t);
    await say(h, [CAT]);
    await say(h, [STRIKE, XP]);
    return earned(h).amount;
}

test('the foe a try was against is counted and pays its kind, though weaker foes are declared in the same reply', async t => {
    const expected = await catXp(t);
    const h = await host(t);
    await say(h, [CAT]);
    await say(h, [STRIKE, XP, RATS]);
    assert.deepEqual(left(h), { 'crag-cat': 0, 'maw-rats': 10 });
    assert.ok(slice(h).foes.groups['maw-rats'].threat <= slice(h).foes.groups['crag-cat'].threat);
    assert.deepEqual([earned(h).amount, earned(h).touched, astraOf(h).xp], [expected, ['crag-cat'], expected]);
    sound(h);
});

test('with no against:, an older group goes before a new one, even when the reply reinforces it', async t => {
    for (const extra of [[], ['+ foes Crag-Cat | count: 1 | kind: elite']]) {
        const h = await host(t);
        await say(h, [CAT]);
        await say(h, [RATS, ...extra, '? try Astra | Lore | hard', XP]);
        assert.deepEqual(left(h), { 'crag-cat': extra.length, 'maw-rats': 10 });
        sound(h);
    }
});

test('a reply with no try still counts older groups before new ones, and pays nothing', async t => {
    const h = await host(t);
    await say(h, [CAT]);
    await say(h, [RATS, XP]);
    assert.deepEqual([left(h), earned(h).amount], [{ 'crag-cat': 0, 'maw-rats': 10 }, 0]);
    sound(h);
});

test('a group declared and killed in the same reply with no older group still counts', async t => {
    const h = await host(t);
    await say(h, [RATS, '? try Astra | Lore | hard', '+ xp Party — rats | foes: 3']);
    assert.deepEqual([left(h), earned(h).foes], [{ 'maw-rats': 7 }, 3]);
    assert.ok(earned(h).amount > 0);
    sound(h);
});

test('an against: group declared in the same reply is counted before an older one; the rest spills over in order', async t => {
    const h = await host(t);
    await say(h, [CAT]);
    await say(h, [RATS, '? try Astra | Lore | hard | against: Maw-Rats', '+ xp Party — all | foes: 11']);
    assert.deepEqual(left(h), { 'crag-cat': 0, 'maw-rats': 0 });
    assert.deepEqual(earned(h).touched, ['maw-rats', 'crag-cat']);
    sound(h);
});

test('a group: line counts the group it names, whatever the try was against', async t => {
    const h = await host(t);
    await say(h, [CAT]);
    await say(h, [RATS, STRIKE, `${XP} | group: Maw-Rats`]);
    assert.deepEqual(left(h), { 'crag-cat': 1, 'maw-rats': 9 });
    sound(h);
});

// A reply recorded as an older version left it: no rule marks from its first capture.
async function sayUnmarked(h, lines) {
    const writer = h.store.setRuleMarks;
    h.store.setRuleMarks = () => { throw new Error('no mark: an old reply'); };
    await say(h, lines);
    h.store.setRuleMarks = writer;
    return h.ctx.chat.length - 1;
}
// What an old reply keeps: the lowest-threat count, its XP, and none of the rule's records or its mark.
function keptOld(h, at, expected) {
    const record = readRecord(h.ctx.chat[at]);
    assert.equal(record.rules, undefined);
    assert.deepEqual([left(h), astraOf(h).xp], expected);
    assert.equal(slice(h).dice[record.sid].aimed, undefined);
    assert.equal(slice(h).foes.groups['maw-rats'].born, undefined);
}

test('a reply captured before the rule keeps the old count on Re-read, and writes none of its records', async t => {
    const h = await host(t);
    await say(h, [CAT]);
    const at = await sayUnmarked(h, [STRIKE, XP, RATS]);
    const before = [left(h), astraOf(h).xp];
    assert.deepEqual(before[0], { 'crag-cat': 1, 'maw-rats': 9 });
    keptOld(h, at, before);
    assert.equal((await h.sdk.reread(at)).ok, true);
    keptOld(h, at, before);
    sound(h);
});

test('an old reply keeps its order and XP on Re-read after the next reply is sent and regenerated', async t => {
    const h = await host(t);
    await say(h, [CAT]);
    const at = await sayUnmarked(h, [STRIKE, XP, RATS]);
    const before = [left(h), astraOf(h).xp];
    assert.deepEqual(before[0], { 'crag-cat': 1, 'maw-rats': 9 });
    await h.send('Next.', 'They walk on.');
    await h.regenerate('They walk on again.');
    assert.equal((await h.sdk.reread(at)).ok, true);
    keptOld(h, at, before);
    sound(h);
});

test('a Continue of an old reply with these lines gains it no mark', async t => {
    const h = await host(t);
    await say(h, [CAT]);
    const at = await sayUnmarked(h, [STRIKE, XP, RATS]);
    const before = [left(h), astraOf(h).xp];
    await h.cont(`\n\n${reply('More.', ['+ foes Bog-Eels | count: 2 | kind: vermin'])}`);
    assert.equal(readRecord(h.ctx.chat[at]).rules, undefined);
    assert.equal(slice(h).foes.groups['bog-eels'].born, undefined);
    assert.equal((await h.sdk.reread(at)).ok, true);
    assert.equal(readRecord(h.ctx.chat[at]).rules, undefined);
    assert.deepEqual([left(h)['crag-cat'], left(h)['maw-rats'], astraOf(h).xp], [before[0]['crag-cat'], before[0]['maw-rats'], before[1]]);
    sound(h);
});
