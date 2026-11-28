// A companion joins at the level the world already gives them (NPC State dossier, else world pack cast entry), over the narrator's; only on replies captured under the rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readRecord } from '../../../core/persist.js';
import { applyCompanion } from '../src/module-parts/kinds/roster.js';
import { fakeCtx, line, run, sliceOf } from './helpers/fake-ctx.js';
import { reply, slice, withAstra } from './helpers/host.js';

const ARSVEIL = readFileSync(new URL('../../packs/arsveil/pack.json', import.meta.url), 'utf8');
const join = (name, level) => `+ companion ${name} | level: ${level} | strengths: maul`;
const named = (host, name) => Object.values(slice(host).members).find(member => member.name === name);

// The level `name` joins at on a marked reply: `people` are NPC State dossiers, `cast` the packs' entries.
function joined(name, { people = [], cast = [], rules = ['companionKnownLevel'], members } = {}) {
    const answers = {
        'people.list': () => people,
        'people.dossier': ({ id }) => people.find(person => person.id === id) ?? null,
        'packs.content': () => cast,
    };
    const state = members ?? sliceOf();
    const done = run(applyCompanion, fakeCtx(state, { rules, query: (query, args) => answers[query](args) }), line('companion', name, '', { level: '12' }));
    assert.equal(done.ok, true, done.message);
    return { level: done.result.data.level, state };
}
const person = (id, name, level, aliases = []) => ({ id, name, aliases, ...(level === undefined ? {} : { level }) });

test('a dossier, by name or alias, beats the pack, and the pack beats the line', () => {
    const cast = [person('nasai', 'Nasai', 5, ['Half-Coin'])];
    assert.equal(joined('Nasai', { people: [person('npc_a', 'nasai', 3)], cast }).level, 3);
    assert.equal(joined('Half-Coin', { people: [person('npc_a', 'Nasai', 3, ['half-coin'])], cast }).level, 3);
    assert.equal(joined('Nasai', { people: [person('npc_a', 'Nasai')], cast }).level, 5, 'a dossier with no level says nothing');
    assert.equal(joined('Half-Coin', { cast }).level, 5);
    assert.equal(joined('Torka', { people: [person('npc_a', 'Nasai', 3)], cast }).level, 12);
});

test('a name beats an alias; two people under one name with different levels leave it to the next source', () => {
    assert.equal(joined('Ash', { people: [person('npc_a', 'Vorn', 9, ['Ash']), person('npc_b', 'Ash', 2)] }).level, 2);
    assert.equal(joined('Ash', { cast: [person('a', 'Ash', 4), person('b', 'Ash', 7)] }).level, 12);
});

test('a query nobody answers does not refuse the join', () => {
    const done = run(applyCompanion, fakeCtx(sliceOf(), { rules: ['companionKnownLevel'], query: () => { throw new Error('no query'); } }), line('companion', 'Nasai', '', { level: '12' }));
    assert.equal(done.result.data.level, 12);
});

test('a later join line keeps the level they joined at, whatever is known by then', () => {
    const { state } = joined('Nasai');
    assert.equal(joined('Nasai', { members: state, cast: [person('nasai', 'Nasai', 3)] }).level, 12);
});

async function arsveil(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    t.after(() => host.close());
    assert.equal((await host.packs.packs.install(ARSVEIL, { origin: 'pack.json' })).ok, true);
    await host.packs.packs.setEnabled('arsveil', true);
    await host.send('Hello.', 'The road.');
    return host;
}
function sound(host) {
    assert.deepEqual(host.store.problems(), []);
    const live = JSON.stringify(slice(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(slice(host)), live, 'rebuild == live');
}

test('host: the Arsveil pack alone gives Nasai level 3, by name or alias; someone unknown keeps the line\'s level', async t => {
    const host = await arsveil(t);
    await host.send('Come.', reply('Two join.', [join('Half-Coin', 12), join('Torka', 6)]));
    assert.deepEqual([named(host, 'Half-Coin').companion.level, named(host, 'Torka').companion.level], [3, 6]);
    sound(host);
});

test('host: an NPC State dossier\'s level wins over the pack\'s and the line\'s', async t => {
    const host = await arsveil(t);
    // (the domain's own command, sent as a module: a reader cannot send people.stub)
    host.sdk.registerModule({ id: 'x', name: 'X', commands: { 'x.stub': (ctx, payload) => { ctx.call('people.stub', payload); return { summary: 'stubbed' }; } } });
    const made = await host.sdk.command('x.stub', { id: 'npc_nasai', record: { id: 'npc_nasai', name: 'Nasai', level: 4 } });
    assert.equal(made.ok, true, made.message);
    assert.equal(host.sdk.query('people.dossier', { name: 'Nasai' }).level, 4);
    await host.send('Come.', reply('Nasai joins.', [join('Nasai', 12)]));
    assert.equal(named(host, 'Nasai').companion.level, 4);
    sound(host);
});

test('host: a reply without the mark keeps 12 on Re-read; editing its line to 3 and Re-read corrects it', async t => {
    const host = await arsveil(t);
    const { setRuleMarks } = host.store;
    host.store.setRuleMarks = () => { throw new Error('an older reply'); };
    await host.send('Come.', reply('Nasai joins.', [join('Nasai', 12)]));
    host.store.setRuleMarks = setRuleMarks;
    const index = host.ctx.chat.length - 1;
    assert.equal(readRecord(host.ctx.chat[index]).rules?.includes('companionKnownLevel') ?? false, false);
    assert.equal(named(host, 'Nasai').companion.level, 12);
    assert.equal((await host.sdk.reread(index)).ok, true);
    assert.equal(named(host, 'Nasai').companion.level, 12);
    await host.send('Walk.', 'The road goes on.');
    host.ctx.chat[index].mes = host.ctx.chat[index].mes.replace('level: 12', 'level: 3');
    assert.equal((await host.sdk.reread(index)).ok, true);
    assert.equal(named(host, 'Nasai').companion.level, 3);
    sound(host);
});

test('host: the joined level stays when the pack is switched off, through a rebuild and an earlier reply\'s deletion', async t => {
    const host = await arsveil(t);
    const before = host.ctx.chat.length;
    await host.send('Wait.', reply('A bruise.', ['~ condition Astra | Sore']));
    await host.send('Come.', reply('Nasai joins.', [join('Nasai', 12)]));
    assert.equal(named(host, 'Nasai').companion.level, 3);
    await host.packs.packs.setEnabled('arsveil', false);
    host.store.rebuild();
    assert.equal(named(host, 'Nasai').companion.level, 3);
    await host.st.deleteMessage(before + 1);
    await host.st.deleteMessage(before);
    assert.equal(named(host, 'Nasai').companion.level, 3);
    sound(host);
});
