// `~ train ... | sessions: N` with the story clock registered: the days a `! time` line written AFTER the train line moves are the cap (real host, replay and swipe).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { createModule } from '../../../modules/director/module.js';
import { textRpgModule } from '../src/module.js';
import { BUY, SKILLS, astraOf, reply } from './helpers/host.js';

async function clockHost() {
    let host = null;
    const sdk = { feature: id => host.sdk.feature(id), settings: id => host.sdk.settings(id), command: (...args) => host.sdk.command(...args), query: (...args) => host.sdk.query(...args) };
    const director = createModule({ host: { settings: id => host?.sdk.settings(id) ?? null, substitute: text => host?.sdk.substitute(text) } });
    host = await createHost({ modules: [director, textRpgModule(sdk)], settings: { features: { 'text-rpg.on': true } } });
    const made = await host.sdk.command('textRpg.create', { name: 'Astra', stats: BUY, skills: [...SKILLS, { name: 'Swordplay', about: 'blades', stat: 'str', type: 'attack' }] });
    if (!made.ok) throw new Error(made.message);
    return host;
}
const sword = host => astraOf(host).practice.swordplay ?? 0;
const train = days => reply('Drills.', ['~ train Astra — Swordplay | sessions: 30', `! time +${days} days`]);

test('with the story clock: a time line after the train line sets the days; replay == live; a swipe redraws its own step', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await clockHost();
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', ['~ time June 3, 1200, 08:00 am']));
    await host.send('Train.', train(30));
    assert.equal(sword(host), 30);
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live);
    await host.swipe(train(5));
    assert.equal(sword(host), 5);
    const swiped = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), swiped);
    assert.deepEqual(host.store.problems(), []);
});

test('with the story clock: a ? try is applied (the dice record keeps its clock and stays valid); xp after it pays', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await clockHost();
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', ['~ time June 3, 1200, 08:00 am']));
    await host.send('Fight.', reply('Rats.', ['+ foes rats | count: 2 | threat: a fair match', '? try Astra | STR | ordinary | threat: a fair match', '+ xp Party — two rats fall | size: minor | foes: 2']));
    const record = Object.values(host.head().domains.textRpg.dice).at(-1);
    assert.equal(record.used, 1, 'the try was applied, not refused (it took a die)');
    assert.equal(host.head().domains.textRpg.members[Object.keys(host.head().domains.textRpg.members)[0]].xp, 10, 'two foes at minor, a fair match: 10 xp');
    assert.ok(Number.isInteger(host.head().domains.textRpg.dice[Object.keys(host.head().domains.textRpg.dice).at(-1)].clock));
    assert.deepEqual(host.store.problems(), []);
});
