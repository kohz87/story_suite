// The owner's play: Obscure and Snap Cut rolled with an edge in their favour against vermin still teach, and the battle XP stays capped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { astraOf, reply, slice, withAstra } from './helpers/host.js';

const TRIES = [
    '+ foes Rats | count: 24 | kind: vermin',
    '? try Astra | Obscure | easy | edge: +1 (they do not see her) | against: Rats',
    '? try Astra | Lore | easy | against: Rats',
    '? try Astra | Lore | easy | edge: +1 (a good angle) | against: Rats',
];
const END = ['? try Astra | Lore | hard | against: Rats', '+ xp Party — the rats fall | foes: 24', '+ lesson Astra — Lore | the angle was learned'];
const state = host => JSON.stringify(slice(host));

test('every use against vermin teaches, edge or none; the battle XP is capped at 25; a rebuild gives the same state', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    await host.send('Rats.', reply('The rats come.', TRIES));
    const practice = astraOf(host).practice;
    assert.ok(practice.obscure >= 1, 'Obscure with an edge taught');
    assert.ok(practice.lore >= 2, 'Lore taught with and without an edge');
    await host.send('Strike.', reply('They fall.', END));
    assert.equal(astraOf(host).xp, 25, 'the battle cap');
    assert.ok(astraOf(host).practice.lore > practice.lore, 'the lesson added practice');
    const live = state(host);
    host.store.rebuild();
    assert.equal(state(host), live, 'replay == live');
    assert.deepEqual(host.store.problems(), []);
});
