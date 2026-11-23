// Replay == live for the foes record, the xp that counts it down and the lessons: a swipe, a Re-read, a middle delete and a rebuild.
import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';
import { leftOf } from './helpers/foes.js';

const SET = ['+ foes rats | count: 6 | threat: a fair match', '? try Astra | Lore | hard | threat: a fair match'];
const FELL = (n, extra = []) => [`? try Astra | Lore | hard | threat: a fair match`, `+ xp Party — rats fall | size: minor | foes: ${n}`, ...extra];
const state = host => JSON.stringify(slice(host));
const left = host => leftOf(slice(host));
const quiet = t => t.mock.method(console, 'warn', () => {});

test('the foes record, the xp that counts it down and a lesson survive a rebuild exactly', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    assert.deepEqual(left(host), { rats: 6 });
    await host.send('Strike.', reply('Four fall.', FELL(4)));
    assert.deepEqual(left(host), { rats: 2 });
    assert.equal(astraOf(host).xp, 20);
    await host.send('Strike.', reply('The rest fall.', FELL(2, ['+ lesson Astra — Lore | the rats fought by smell'])));
    assert.deepEqual(left(host), { rats: 0 });
    assert.equal(astraOf(host).xp, 30);
    const learned = slice(host).foes.fights;
    assert.deepEqual(Object.values(learned).map(fight => fight.taught), [[`${astraOf(host).id}:lore`]]);
    const live = state(host);
    host.store.rebuild();
    assert.equal(state(host), live, 'rebuild == live');
    assert.deepEqual(host.store.problems(), []);
});

test('a swipe takes the reply\'s foes, xp count and lesson back; its own lines replace them', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    const afterSet = state(host);
    await host.send('Strike.', reply('Six fall.', FELL(6, ['+ lesson Astra — Lore | quick'])));
    assert.deepEqual(left(host), { rats: 0 });
    const practiceFull = astraOf(host).practice.lore;
    await host.swipe(reply('They scatter.', ['- foes rats']));
    assert.deepEqual(left(host), { rats: 0 });
    assert.equal(astraOf(host).xp, 0, 'no xp for foes that fled');
    assert.deepEqual(slice(host).foes.fights[Object.keys(slice(host).foes.fights)[0]].taught, [], 'the lesson went with the swiped reply');
    assert.ok(astraOf(host).practice.lore === undefined || astraOf(host).practice.lore < practiceFull);
    await host.swipe(reply('Two fall.', FELL(2)));
    assert.deepEqual(left(host), { rats: 4 });
    await host.swipe(reply('Nothing.'));
    assert.equal(state(host), afterSet, 'a swipe with no lines is the state before the reply');
    const live = state(host);
    host.store.rebuild();
    assert.equal(state(host), live);
});

test('a Re-read of edited lines counts the foes again from where they stood', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    await host.send('Strike.', reply('Four fall.', FELL(4)));
    const at = host.ctx.chat.length - 1;
    assert.deepEqual(left(host), { rats: 2 });
    host.ctx.chat[at].mes = host.ctx.chat[at].mes.replace('foes: 4', 'foes: 1');
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(left(host), { rats: 5 });
    assert.equal(astraOf(host).xp, 5);
    host.ctx.chat[at].mes = host.ctx.chat[at].mes.replace('foes: 1', 'foes: 9');
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.deepEqual(left(host), { rats: 0 }, 'only six stood');
    assert.equal(astraOf(host).xp, 30);
    const live = state(host);
    host.store.rebuild();
    assert.equal(state(host), live);
    assert.deepEqual(host.store.problems(), []);
});

test('a middle delete adds each reply\'s change to what stands: deleting a counting reply gives its foes back', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    const middleAt = host.ctx.chat.length;
    await host.send('Strike.', reply('Four fall.', FELL(4)));
    await host.send('Strike.', reply('Two fall.', FELL(2)));
    assert.deepEqual(left(host), { rats: 0 });
    await host.st.deleteMessage(middleAt + 1);
    await host.st.deleteMessage(middleAt);
    assert.deepEqual(host.store.problems(), [], 'the chat replays with no problem');
    assert.deepEqual(left(host), { rats: 4 }, 'the later reply adds its own two to what is there');
    assert.equal(astraOf(host).xp, 10);
    const after = state(host);
    host.store.rebuild();
    assert.equal(state(host), after);
});

test('reinforcements, a closed group and an ended group replay as they were told', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    await host.send('More.', reply('More come.', ['+ foes rats | count: 4 | threat: above you', '+ foes wolves | count: 2 | threat: above you']));
    assert.equal(slice(host).foes.groups.rats.count, 6);
    assert.equal(slice(host).foes.groups.rats.threat, 2);
    assert.equal(slice(host).foes.groups['rats-2'].threat, 3);
    assert.deepEqual(left(host), { rats: 6, 'rats-2': 4, wolves: 2 });
    await host.send('Run.', reply('The wolves flee.', ['- foes wolves']));
    assert.deepEqual(left(host), { rats: 6, 'rats-2': 4, wolves: 0 });
    const live = state(host);
    host.store.rebuild();
    assert.equal(state(host), live);
    assert.deepEqual(host.store.problems(), []);
});

test('deleting the reply that set the foes up leaves nothing to count down: the later block is skipped and reported, and the state is still sound', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    const at = host.ctx.chat.length;
    await host.send('Rats.', reply('The rats come.', SET));
    await host.send('Strike.', reply('Four fall.', FELL(4)));
    await host.st.deleteMessage(at + 1);
    await host.st.deleteMessage(at);
    assert.equal(slice(host).foes, undefined, 'no record');
    assert.equal(astraOf(host).xp, 0);
    assert.match(host.store.problems()[0].message, /no longer apply/);
    const after = state(host);
    host.store.rebuild();
    assert.equal(state(host), after);
});
