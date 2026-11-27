// The nickname a new namesake gets (real store and people domain): chosen inside the write that makes them, by NPC State's own people.write (a scan, an
// import, the cast, the editor: adapter/people-sync.js) and by the story line's people.stub. A swipe, a delete and a reload then show what live did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeopleSync } from '../../modules/people/adapter/people-sync.js';
import { hashJson } from '../../modules/people/adapter/hash.js';
import { peopleState, peopleView } from '../../modules/people/view.js';
import { newNicknames } from '../../modules/people/meters/npc-meters-parts/nickname.js';
import { stubRecord } from '../../modules/people/meters/npc-lines-parts/derived.js';
import { cast, person } from './npc-alias-lines.helpers.js';

const guard = (id, role, extra = {}) => person(id, 'Guard', [], { role, ...extra });
const aliases = h => Object.fromEntries(Object.entries(h.store.head().domains.people.npcs).map(([id, record]) => [id, record.aliases]));
const copy = value => structuredClone(value);

// NPC State's own writer over the test host: its cache is `state`; `add(record)` is a runtime change that makes a dossier, then commits.
async function writer(h) {
    let state = null;
    const sdk = {
        query: (name, args) => (name === 'scene.place' ? { name: 'the North Gate' } : h.runQuery(name, args)),
        command: (type, payload) => h.sdk.command(type, payload),
        view: () => ({ state: h.store.head() }),
        timeline: {
            head: async () => ({ ok: true, source: h.store.sourceAt(h.store.headIndex()) }),
            history: async () => ({ ok: true, messages: h.chat.map((_, index) => h.store.sourceAt(index) ?? {}) }),
        },
    };
    const sync = createPeopleSync({
        sdk: () => sdk, view: peopleView, restore: peopleState, hash: hashJson, readState: () => copy(state),
        install: keys => { state = { ...state, ...copy(keys) }; return true; },
        setRecord: record => { state.npcs = state.npcs.map(item => (item.id === record.id ? copy(record) : item)); return true; },
    });
    await sync.hydrate();
    return {
        sync,
        state: () => state,
        add: async (...records) => { state.npcs.push(...records.map(copy)); return sync.commit(); },
    };
}
// A reply, then a dossier made on it.
async function onReply(h, w, ...records) {
    const { index } = h.reply('A guard steps up.');
    await w.sync.sync();
    assert.equal((await w.add(...records)).sent, true);
    return index;
}

test('the second Guard and the first, who had none, get nicknames in that one write; the cache holds them and the next write keeps them', async () => {
    const h = await cast(guard('npc_g1', 'Gate guard'));
    const w = await writer(h);
    await onReply(h, w, guard('npc_g2', 'night watch, retired'));
    const named = { npc_g1: ['the gate guard'], npc_g2: ['the night watch'] };
    assert.deepEqual(aliases(h), named);
    assert.deepEqual(Object.fromEntries(w.state().npcs.map(npc => [npc.id, npc.aliases])), named);
    w.state().npcs[0].mood = 'wary';
    await w.sync.commit();
    assert.deepEqual(aliases(h), named);
});

test('a swipe, a reload and a middle delete show the same people as live', async () => {
    const h = await cast(guard('npc_g1', 'gate guard'));
    const w = await writer(h);
    const { index: quiet } = h.reply('Nothing happens.');
    const index = await onReply(h, w, guard('npc_g2', 'gate guard'));
    const live = copy(h.store.head().domains.people.npcs);
    assert.deepEqual(aliases(h), { npc_g1: ['the gate guard'], npc_g2: ['Guard from the North Gate'] });
    h.store.rebuild();   // reload
    assert.deepEqual(h.store.head().domains.people.npcs, live);
    h.swipe(index);   // the new swipe has no Guard yet: both the person and the nicknames are gone
    assert.deepEqual(aliases(h), { npc_g1: [] });
    await w.sync.sync();
    await w.add(guard('npc_g2', 'gate guard'));   // made again on the new swipe: the same nicknames
    assert.deepEqual(h.store.head().domains.people.npcs, live);
    h.swipeTo(index, 0);
    assert.deepEqual(h.store.head().domains.people.npcs, live);
    h.remove(quiet);   // a middle delete before the reply that made them
    assert.deepEqual(h.store.head().domains.people.npcs, live);
});

test('people who already shared a name are never given one; only the newcomer is', async () => {
    const h = await cast(guard('npc_g1', 'sentry'), guard('npc_g2', 'sentry'));
    const w = await writer(h);
    h.reply('Later.');
    await w.sync.sync();
    w.state().npcs[0].mood = 'wary';
    await w.sync.commit();
    assert.deepEqual(aliases(h), { npc_g1: [], npc_g2: [] }, 'an old chat is written as it is');
    await onReply(h, w, guard('npc_g3', 'cook'));
    assert.deepEqual(aliases(h), { npc_g1: [], npc_g2: [], npc_g3: ['the cook'] });
});

test('with unique names the write is the cache\'s view, untouched', async () => {
    const h = await cast(guard('npc_g1', 'sentry'));
    const w = await writer(h);
    const sent = [];
    const send = h.sdk.command;
    h.sdk.command = (type, payload) => { sent.push(payload); return send(type, payload); };
    await onReply(h, w, person('npc_mira', 'Mira', [], { role: 'smith' }));
    assert.deepEqual(sent.at(-1).view, peopleView(w.state()));
    assert.deepEqual(aliases(h), { npc_g1: [], npc_mira: [] });
});

test('the choice: the role, else the place, else the count; never anybody\'s name or alias; a dead namesake and a kept nickname count for nothing', () => {
    const one = (people, fresh, place = '') => Object.fromEntries(newNicknames(people, fresh, () => place).map(item => [item.id, item.aliases]));
    const g = (id, role, extra = {}) => ({ id, name: 'Guard', aliases: [], role, ...extra });
    assert.deepEqual(one([g('a', 'guard'), g('b', '')], ['b']), { a: ['Guard the second'], b: ['Guard the third'] });
    assert.deepEqual(one([g('a', 'A gate guard'), g('b', 'gate guard'), { id: 'c', name: 'The Gate Guard' }], ['b'], 'Karsk'), { a: ['Guard from Karsk'], b: ['Guard the second'] });
    assert.deepEqual(one([g('a', 'cook', { aliases: ['Old Tom'] }), g('b', 'Hesk\'s aide')], ['b']), { b: ['the Hesk\'s aide'] });
    assert.deepEqual(one([g('a', 'cook', { lifeState: 'deceased', lifeStateCertainty: 'explicit' }), g('b', 'cook')], ['b']), {});
    assert.deepEqual(one([g('a', 'x'.repeat(80)), g('b', 'y', { aliases: ['1', '2', '3', '4', '5', '6', '7', '8'] })], ['b']), { a: ['Guard the second'] });
});

test('people.stub, the story line\'s creating write, carries both nicknames in its own ops', async () => {
    const h = await cast(guard('npc_g1', 'sentry'));
    h.registry.register({ id: 'test-maker', name: 'Maker', commands: { 'test-maker.add': ctx => { ctx.call('people.stub', { id: 'npc_g2', record: stubRecord({ name: 'Guard', role: 'cook', look: '' }, 'npc_g2', {}, 2) }); return { summary: 'ok' }; } } });
    const out = await h.sdk.command('test-maker.add', {});
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(aliases(h), { npc_g1: ['the sentry'], npc_g2: ['the cook'] });
    h.store.rebuild();
    assert.deepEqual(aliases(h), { npc_g1: ['the sentry'], npc_g2: ['the cook'] });
});
