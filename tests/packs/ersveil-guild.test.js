// The shipped Ersveil Guild membership (game pack 1.1.0): probation ends after three contracts or a promotion above F, the contracts done since the last
// promotion count toward the next letter's examination, and the story is told when it is ready. The year end and the dues work as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { world, success, reply, rebuilt } from '../modules/data-modules/helpers.js';
import { grammarFor, summaryOf } from '../../modules/data-modules/part.js';

const ID = 'pack.ersveil-game/guild-membership';
const EXAM = letter => `ready for the ${letter} examination`;
const ersveil = () => JSON.parse(readFileSync(new URL('../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8'));

async function member(t, { register = true } = {}) {
    const host = await world(t, ersveil());
    const offer = host.sdk.query('dataModules.offers').find(row => row.module === ID);
    success(await host.sdk.command('dm.pin', { module: ID, hash: offer.hash, packHash: offer.packHash }));
    await host.send('Begin.', 'The guild hall.');
    if (register) await host.send('I sign.', reply('+ dm guild-membership — signs the ledger | kind: register'));
    return host;
}
const guild = host => host.sdk.query('dataModules.view', { module: ID }).chat;
const told = host => summaryOf(host.head(), ID);
const work = (host, name) => host.send('Work.', reply(`+ dm guild-membership — ${name} | kind: contract`));
const promote = (host, letter) => host.send('The panel meets.', reply(`~ dm guild-membership — the examiners pass them | kind: promote | letter: ${letter}`));
const turnYear = host => host.send('A year passes.', reply('! dm guild-membership — the Guild year turns | kind: yearend'));
const put = async (host, field, value) => success(await host.sdk.command('dm.set', { module: ID, field, value }));
const pick = (host, ...keys) => keys.map(key => guild(host)[key]);

test('register starts on probation with no contracts; the third contract makes the standing good', async t => {
    const host = await member(t, { register: false });
    assert.deepEqual(pick(host, 'standing', 'contracts', 'contracts-at-rank', 'exam'), ['unregistered', 0, 0, 0]);
    await host.send('I sign.', reply('+ dm guild-membership — signs the ledger | kind: register'));
    assert.deepEqual(pick(host, 'standing', 'letter', 'contracts', 'contracts-at-rank'), ['probation', 'F', 0, 0]);
    await work(host, 'brush-hogs');
    await work(host, 'road scout');
    assert.deepEqual(pick(host, 'standing', 'contracts'), ['probation', 2]);
    await work(host, 'crag jackals');
    assert.deepEqual(pick(host, 'standing', 'contracts', 'contracts-at-rank'), ['good', 3, 3]);
    assert.deepEqual(host.turn.problems().filter(problem => problem.code !== 'NO_CHANGES'), []);
    rebuilt(host);
});

test('one reply counts one contract: a second contract line in it is refused, as before', async t => {
    const host = await member(t);
    await host.send('Two jobs.', reply('+ dm guild-membership — brush-hogs | kind: contract', '+ dm guild-membership — shale-horn bull | kind: contract'));
    assert.deepEqual(pick(host, 'contracts', 'contracts-at-rank'), [1, 1]);
    assert.ok(host.turn.problems().some(problem => problem.code === 'CLAIMED'));
});

test('a promotion to E ends probation with no contracts done, and starts the count for the next letter again', async t => {
    const host = await member(t);
    await work(host, 'escort');
    await promote(host, 'E');
    assert.deepEqual(pick(host, 'standing', 'letter', 'contracts', 'contracts-at-rank', 'member-years'), ['good', 'E', 1, 0, 0]);
    await work(host, 'sightline');
    assert.deepEqual(pick(host, 'standing', 'contracts', 'contracts-at-rank'), ['good', 2, 1]);
});

test('the story is told the examination is ready at each letter\'s bar and not one contract before; a promotion clears it', async t => {
    const host = await member(t);
    for (const [at, [letter, next, bar]] of [['F', 'E', 5], ['E', 'D', 12], ['D', 'C', 25], ['C', 'B', 45], ['B', 'A', 70], ['A', 'S', 100]].entries()) {
        if (letter !== 'F') await promote(host, letter);
        assert.deepEqual(pick(host, 'contracts-at-rank', 'exam'), [0, 0], `${letter}: the count starts again`);
        // (the reader's edit stands in for the earlier contracts of this letter)
        await put(host, 'contracts-at-rank', bar - 2);
        await work(host, `${letter} almost`);
        assert.equal(guild(host).exam, 0, `${letter}: ${bar - 1} contracts`);
        assert.match(told(host), /exam not ready/);
        await work(host, `${letter} enough`);
        assert.equal(guild(host).exam, at + 1, `${letter}: ${bar} contracts`);
        assert.ok(told(host).includes(`contracts-at-rank ${bar}; exam ${EXAM(next)}`), told(host));
    }
    await promote(host, 'S');
    assert.deepEqual(pick(host, 'exam', 'standing'), [7, 'good']);
    assert.match(told(host), /exam no further examination/);
    await put(host, 'contracts-at-rank', 500);
    await work(host, 'S work');
    assert.equal(guild(host).exam, 7, 'S has no next examination, however many contracts');
    rebuilt(host);
});

test('a promotion naming the current letter is refused: the count and the exam stay; a new letter applies', async t => {
    const host = await member(t);
    await put(host, 'contracts-at-rank', 4);
    await work(host, 'fifth');
    const before = pick(host, 'letter', 'standing', 'contracts-at-rank', 'exam');
    assert.deepEqual(before, ['F', 'probation', 5, 1]);
    await promote(host, 'F');
    assert.deepEqual(pick(host, 'letter', 'standing', 'contracts-at-rank', 'exam'), before);
    assert.ok(host.turn.problems().some(problem => problem.message.includes('Register first; a promotion names a new letter')), JSON.stringify(host.turn.problems()));
    rebuilt(host);
    await promote(host, 'E');
    assert.deepEqual(pick(host, 'letter', 'standing', 'contracts-at-rank', 'exam'), ['E', 'good', 0, 0]);
    rebuilt(host);
});

test('a promotion before registering is refused', async t => {
    const host = await member(t, { register: false });
    await promote(host, 'E');
    assert.deepEqual(pick(host, 'letter', 'standing'), ['F', 'unregistered']);
});

test('the whole tail line fits its room at its longest, and the reader cannot edit the examination field', async t => {
    const host = await member(t);
    await promote(host, 'A');
    for (const [field, value] of [['contracts', 998], ['contracts-at-rank', 998], ['unpaid-years', 1], ['idle-years', 2], ['member-years', 99]]) await put(host, field, value);
    const line = told(host);
    assert.ok(line.endsWith(`standing "dues-owed"; dues 500; unpaid-years 1; idle-years 2; member-years 99; contracts 998; contracts-at-rank 998; exam ${EXAM('S')}.`), line);
    assert.equal((await host.sdk.command('dm.set', { module: ID, field: 'exam', value: 0 })).ok, false);
});

test('the counts stop at 999 and the contract still applies', async t => {
    const host = await member(t);
    await put(host, 'contracts', 999);
    await put(host, 'contracts-at-rank', 999);
    await put(host, 'idle-years', 1);
    await work(host, 'one more');
    assert.deepEqual(pick(host, 'contracts', 'contracts-at-rank', 'idle-years', 'standing'), [999, 999, 0, 'good']);
});

test('the year end still works: a year with no contract since means probation again until one is done; unpaid years owe and lapse', async t => {
    const host = await member(t);
    await promote(host, 'E');
    await turnYear(host);
    assert.deepEqual(pick(host, 'standing', 'unpaid-years', 'idle-years', 'member-years'), ['dues-owed', 1, 1, 1]);
    await host.send('Pay.', reply('+ dm guild-membership — pays | kind: dues'));
    assert.equal(guild(host).standing, 'probation', 'idle for a year');
    await work(host, 'back to work');
    assert.equal(guild(host).standing, 'good');
    await turnYear(host);
    await turnYear(host);
    assert.equal(guild(host).standing, 'lapsed');
});

test('an F member who has been a year in the Guild is off probation with fewer than three contracts', async t => {
    const host = await member(t);
    await turnYear(host);
    await host.send('Pay.', reply('+ dm guild-membership — pays | kind: dues'));
    await work(host, 'first job');
    assert.deepEqual(pick(host, 'standing', 'letter', 'contracts', 'member-years'), ['good', 'F', 1, 1]);
});

test('dues by letter are unchanged', async t => {
    const host = await member(t);
    const dues = [guild(host).dues];
    for (const letter of ['E', 'D', 'C', 'B', 'A', 'S']) { await promote(host, letter); dues.push(guild(host).dues); }
    assert.deepEqual(dues, [50, 50, 100, 100, 500, 500, 500]);
});

test('swipe and rebuild give the same counts as live; the narrator is still offered all five lines', async t => {
    const host = await member(t);
    await work(host, 'one');
    await work(host, 'two');
    await work(host, 'three');
    await host.swipe('Another telling.');
    assert.deepEqual(pick(host, 'standing', 'contracts'), ['probation', 2]);
    rebuilt(host);
    const grammar = grammarFor(host.head());
    for (const kind of ['register', 'dues', 'contract', 'promote', 'yearend']) assert.ok(grammar.includes(`kind: ${kind}`), kind);
});
