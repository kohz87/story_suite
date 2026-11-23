// Replay == live for the foe ladder: the threat fixed at declaration, the battle cap across waves, a swipe, a Re-read and a middle delete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const SET = ['+ foes Rats | count: 24 | kind: vermin'];
const FELL = n => ['? try Astra | Lore | hard | against: Rats', `+ xp Party — rats fall | foes: ${n}`];
const state = host => JSON.stringify(slice(host));
const quiet = t => t.mock.method(console, 'warn', () => {});
const sound = host => { const live = state(host); host.store.rebuild(); assert.equal(state(host), live, 'rebuild == live'); assert.deepEqual(host.store.problems(), []); };

test('24 rats set by kind and felled in waves pay up to the battle cap (25), and a rebuild gives the same record', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    assert.deepEqual([slice(host).foes.groups.rats.kind, slice(host).foes.groups.rats.threat], ['vermin', 1]);
    await host.send('Strike.', reply('Ten fall.', FELL(10)));
    assert.equal(astraOf(host).xp, 25, '10 × 2.5 = 25: the cap');
    await host.send('Strike.', reply('The rest fall.', FELL(14)));
    assert.equal(astraOf(host).xp, 25, 'the cap holds across replies');
    assert.equal(slice(host).foes.groups.rats.left, 0);
    assert.equal(Object.values(slice(host).foes.fights)[0].paid, 25);
    sound(host);
});

test('a swipe and a Re-read recount the battle from where it stood', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    await host.send('Strike.', reply('Four fall.', FELL(4)));
    assert.equal(astraOf(host).xp, 10);
    await host.swipe(reply('They flee.', ['- foes Rats']));
    assert.equal(astraOf(host).xp, 0, 'the swiped reply paid nothing now');
    assert.equal(Object.values(slice(host).foes.fights)[0].paid, undefined, 'and the battle\'s paid total went back');
    await host.swipe(reply('Eight fall.', FELL(8)));
    assert.equal(astraOf(host).xp, 20);
    const at = host.ctx.chat.length - 1;
    host.ctx.chat[at].mes = host.ctx.chat[at].mes.replace('foes: 8', 'foes: 12');
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(astraOf(host).xp, 25, '12 × 2.5 = 30, cut to the cap');
    sound(host);
});

test('a middle delete gives a counting reply\'s foes and its share of the cap back', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', SET));
    const middleAt = host.ctx.chat.length;
    await host.send('Strike.', reply('Four fall.', FELL(4)));
    await host.send('Strike.', reply('Two fall.', FELL(2)));
    assert.equal(astraOf(host).xp, 15);
    await host.st.deleteMessage(middleAt + 1);
    await host.st.deleteMessage(middleAt);
    assert.deepEqual(host.store.problems(), []);
    assert.equal(slice(host).foes.groups.rats.left, 22);
    assert.equal(astraOf(host).xp, 5);
    sound(host);
});

test('an old chat\'s lines replay: threat: on + foes and size: on + xp are still read', async t => {
    quiet(t);
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', ['+ foes rats | count: 6 | threat: a fair match', '? try Astra | Lore | hard | threat: a fair match', '+ xp Party — the rats | size: minor | foes: 6']));
    assert.deepEqual([slice(host).foes.groups.rats.kind, slice(host).foes.groups.rats.threat, astraOf(host).xp], [undefined, 2, 30]);
    sound(host);
});
