// The public API v1: the events (with replay: a swipe, a Re-read, a delete, a reload), a listener that throws, review fixes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { createPublicApi, createReaders, diffLeaves, plainText } from '../../src/v2/public-api.js';
import { createEvents } from '../../src/v2/sdk.js';
import { sheetDomain, character } from './lean-rpg/helpers.js';
import { skip, reply, settle, record, blocksModule } from './public-api.helpers.js';

// ---- the events ----------------------------------------------------------------------------------------------------------------------------

test('story:changed and story:reply after a live reply: the public paths before and after, in order, once saved', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    const seen = record(host.api);
    const saved = [];
    host.api.on('story:reply', () => saved.push(host.store.dirty()));
    await host.send('Go.', reply('~ place Cellar', '+ coin 5', '+ item Lamp'));
    await settle();
    assert.deepEqual(seen.map(([name]) => name), ['story:changed', 'story:reply']);
    const [[, changed], [, said]] = seen;
    assert.equal(changed.index, host.store.headIndex());
    assert.deepEqual(Object.keys(changed), ['index', 'changes']);
    assert.deepEqual(changed.changes.map(change => change.path), ['items.Lamp.kind', 'items.Lamp.qty', 'money', 'money.text', 'scene.place']);
    assert.deepEqual(changed.changes.find(change => change.path === 'money'), { path: 'money', from: 0, to: 5 });
    assert.deepEqual(changed.changes.find(change => change.path === 'scene.place'), { path: 'scene.place', from: null, to: 'Cellar' });
    assert.deepEqual(Object.keys(said), ['index', 'summary']);
    assert.match(said.summary, /money: 5/);
    assert.match(said.summary, /scene\.place: Cellar/);
    assert.ok(Object.isFrozen(changed) && Object.isFrozen(changed.changes) && Object.isFrozen(changed.changes[0]));
    assert.deepEqual(saved, [false], 'the reply is written before its listeners hear of it');
    // A reply that changes nothing public: a reply event, no changed event.
    seen.length = 0;
    await host.send('Again.', 'Nothing happens.');
    await settle();
    assert.deepEqual(seen.map(([name]) => name), ['story:reply']);
    assert.equal(seen[0][1].summary, '');
    // A second reply: the change is from the first reply's state.
    seen.length = 0;
    await host.send('More.', reply('+ coin 2'));
    await settle();
    assert.deepEqual(seen[0][1].changes.find(change => change.path === 'money'), { path: 'money', from: 5, to: 7 });
});

test('no listener, no work: a reply is saved when its own idle save comes', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    let before = 0;
    host.store.saveSoon = () => { before += 1; return Promise.resolve(true); };
    await host.send('Go.', reply('+ coin 5'));
    await settle();
    assert.equal(before, 0, 'with no listener the api asks the store for nothing');
});

test('story:rebuilt after a swipe, and the state the listener reads is the one a reload reads', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Go.', reply('+ coin 5', '~ place Cellar'));
    await host.swipe(reply('+ coin 9', '~ place Attic'));
    const seen = record(host.api, ['story:rebuilt', 'story:changed']);
    const index = host.store.headIndex();
    const reads = [];
    host.api.on('story:rebuilt', () => reads.push(Object.fromEntries(host.api.paths().map(path => [path, host.api.get(path)]))));
    // The reader goes back to the first swipe.
    await host.st.swipeTo(index, 0);
    await settle();
    assert.deepEqual(seen.map(([name, payload]) => [name, payload.reason]), [['story:rebuilt', 'swipe']]);
    assert.deepEqual(Object.keys(seen[0][1]), ['reason']);
    assert.equal(host.api.get('money'), 5);
    assert.equal(host.api.get('scene.place'), 'Cellar');
    // A page reload: a new host over the same chat file reads the same public state.
    const again = await createHost({ st: { chat: structuredClone(host.ctx.chat), chatMetadata: structuredClone(host.ctx.chatMetadata), chatId: host.ctx.chatId } });
    t.after(() => again.close());
    const fresh = Object.fromEntries(again.api.paths().map(path => [path, again.api.get(path)]));
    assert.deepEqual(reads.at(-1), fresh);
    assert.ok(Object.keys(fresh).length > 3);
});

test('story:rebuilt after Re-read, a delete and a chat change; story:chat with the chat id; a changed chat again is a reload', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Go.', reply('+ coin 5'));
    const seen = record(host.api, ['story:rebuilt', 'story:chat', 'story:changed']);
    const index = host.store.headIndex();
    const done = await host.sdk.reread(index);
    assert.equal(done.ok, true, JSON.stringify(done));
    await settle();
    assert.deepEqual(seen.map(([name, payload]) => [name, payload.reason ?? payload.chatId]), [['story:rebuilt', 'reread']]);
    seen.length = 0;
    await host.send('Next.', reply('+ coin 1'));
    seen.length = 0;
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    await settle();
    assert.deepEqual(seen.map(([name, payload]) => [name, payload.reason]), [['story:rebuilt', 'delete']]);
    assert.equal(host.api.get('money'), 5, 'the deleted reply\'s coin is gone');
    seen.length = 0;
    // The same chat read again: story:chat, then a reload.
    await host.st.loadChat(host.ctx.chat, 'chat-1');
    await settle();
    assert.deepEqual(seen.map(([name, payload]) => [name, payload.reason ?? payload.chatId]), [['story:chat', 'chat-1'], ['story:rebuilt', 'reload']]);
    seen.length = 0;
    await host.st.loadChat(host.ctx.chat, 'chat-2');
    await settle();
    assert.deepEqual(seen.map(([name, payload]) => [name, payload.reason ?? payload.chatId]), [['story:chat', 'chat-2']]);
    assert.deepEqual(Object.keys(seen[0][1]), ['chatId']);
    assert.equal(host.api.get('money'), 5);
});

test('a message edit is not announced as a rebuild', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Go.', reply('+ coin 5'));
    const seen = record(host.api);
    await host.st.editMessage(host.store.headIndex(), host.ctx.chat[host.store.headIndex()].mes + ' ');
    await settle();
    assert.deepEqual(seen, []);
});

test('the lines a module adds to a reply afterwards (the safety net\'s way) are told as their own change, not the reply\'s again', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    let late = true;
    const addLate = { id: 'late-lines', name: 'Late', version: '1', domains: {}, hooks: { afterReply: ({ capture }) => (late ? capture('+ coin 3') : undefined) } };
    const host = await createHost({ modules: [addLate] });
    t.after(() => host.close());
    const seen = record(host.api, ['story:changed', 'story:reply']);
    await host.send('Go.', reply('+ coin 5'));
    await settle();
    await settle();
    const names = seen.map(([name]) => name);
    assert.deepEqual(names, ['story:changed', 'story:reply', 'story:changed'], names.join());
    assert.deepEqual(seen[0][1].changes.find(change => change.path === 'money'), { path: 'money', from: 0, to: 5 });
    assert.deepEqual(seen[2][1].changes.map(change => change.path), ['money', 'money.text']);
    assert.deepEqual(seen[2][1].changes.find(change => change.path === 'money'), { path: 'money', from: 5, to: 8 });
    assert.equal(seen[2][1].index, seen[0][1].index);
    late = false;
});

test('a listener that throws does not break a reply, and is told once', { skip }, async t => {
    const warned = [];
    t.mock.method(console, 'warn', (...args) => warned.push(args.map(String).join(' ')));
    const host = await createHost();
    t.after(() => host.close());
    let calls = 0;
    host.api.on('story:reply', () => { calls += 1; throw new Error('boom'); });
    host.api.on('story:reply', async () => { throw new Error('async boom'); });
    const heard = [];
    host.api.on('story:changed', payload => heard.push(payload.changes.length));
    const first = await host.send('Go.', reply('+ coin 5'));
    await settle();
    assert.ok(first, 'the reply was taken');
    assert.equal(host.api.get('money'), 5);
    await host.send('More.', reply('+ coin 1'));
    await settle();
    assert.equal(calls, 2, 'the listener keeps being called');
    assert.equal(host.api.get('money'), 6);
    assert.equal(heard.length, 2, 'the others still hear');
    assert.equal(warned.filter(line => /a "story:reply" listener failed/.test(line)).length, 2, 'one line per failing listener, not per reply');
    assert.equal(host.store.dirty(), false);
});

test('off() stops a listener; on() twice with one function is one listener', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    let count = 0;
    const fn = () => { count += 1; };
    const off = host.api.on('story:reply', fn);
    host.api.on('story:reply', fn);
    await host.send('Go.', 'One.');
    await settle();
    assert.equal(count, 1);
    off();
    await host.send('Go.', 'Two.');
    await settle();
    assert.equal(count, 1);
});

test('diffLeaves and plainText', () => {
    const a = new Map([['x', 1], ['y', ['a']], ['z', 'same']]);
    const b = new Map([['x', 2], ['y', ['a']], ['z', 'same'], ['w', 'new']]);
    assert.deepEqual(diffLeaves(a, b), [{ path: 'w', from: null, to: 'new' }, { path: 'x', from: 1, to: 2 }]);
    assert.deepEqual(diffLeaves(new Map([['gone', 1]]), new Map()), [{ path: 'gone', from: 1, to: null }]);
    assert.equal(plainText('a\nb'), 'a b');
    assert.equal(plainText(0), '0');
    assert.equal(plainText(false), 'false');
    assert.equal(plainText(['Ren', 'Mara']), 'Ren, Mara');
    assert.equal(plainText([{ name: 'Lamp', qty: 2 }, { name: 'Rope' }]), 'Lamp x2, Rope');
    assert.equal(plainText([]), null);
    assert.equal(plainText({ a: 1 }), null);
    assert.equal(plainText(undefined), null);
    assert.equal(plainText('   '), null);
    assert.equal(plainText(Infinity), null);
});

test('a change in the party is a public change: xp and level of a member, by name', () => {
    const states = [30, 130].map(xp => ({ domains: { dataModules: sheetDomain({ ren: { role: 'character', fields: character('Ren', { level: xp > 100 ? 3 : 2, xp }) } }) } }));
    const events = createEvents();
    const api = createPublicApi({ version: '1', state: () => states[1], before: () => states[0], ask: () => null, rpgOn: () => true, persona: () => 'Ren', events });
    const seen = [];
    api.on('story:changed', payload => seen.push(payload));
    events.emit('turn', { index: 3, type: 'normal', receipts: [], steps: [], problems: [], told: [] });
    return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
        assert.equal(seen.length, 1);
        assert.deepEqual(seen[0].changes, [{ path: 'party.Ren.level', from: 2, to: 3 }, { path: 'party.Ren.xp', from: 30, to: 130 }]);
        assert.equal(api.get('party.me.xp'), 130);
    });
});

// ---- review fixes: hidden blocks, rewind, maps, cache, frozen members, "me", duplicate names -------------------------------------------------

test('a block with no show is hidden like the Blocks screen says; its own screens or layouts make it shown', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const state = { plan: { type: 'int', min: 0, max: 9, default: 0 } };
    const bare = { definition: { state }, fields: { plan: 1 } };
    const withScreens = { definition: { state, screens: [{ id: 'x' }] }, fields: { plan: 2 } };
    const withLayouts = { definition: { state, layouts: [{ id: 'y' }] }, fields: { plan: 3 } };
    const cardOnly = { definition: { state, show: { tab: false, card: true } }, fields: { plan: 4 } };
    const host = await createHost({ core: false, modules: [blocksModule({ bare, withScreens, withLayouts, cardOnly })] });
    t.after(() => host.close());
    await host.send('Go.', 'Opening.');
    const { api } = host;
    assert.deepEqual(api.get('blocks'), ['pack.chat/cardOnly', 'pack.chat/withLayouts', 'pack.chat/withScreens']);
    assert.equal(api.get('blocks.pack.chat/bare.plan'), undefined);
    assert.equal(api.get('blocks.pack.chat/bare'), undefined);
    assert.equal(api.get('blocks.pack.chat/withScreens.plan'), 2);
    assert.equal(api.get('blocks.pack.chat/withLayouts.plan'), 3);
    assert.equal(api.get('blocks.pack.chat/cardOnly.plan'), 4);
    assert.ok(!api.paths().some(path => path.includes('bare')));
});

test('story:rebuilt after a take-back (rewind) and a module change', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const clock = { id: 'clock', name: 'Clock', domains: { clock: { initial: () => ({ ticks: 0 }) } },
        commands: { 'clock.tick': ctx => { ctx.draft('clock').ticks += 1; ctx.claim(`tick:${ctx.rev}`); return { summary: 'Tick.', narrate: false }; } } };
    const host = await createHost({ modules: [clock] });
    t.after(() => host.close());
    await host.send('Go.', 'You find rope.\n<Changes>\n+ item Rope\n</Changes>');
    for (let i = 0; i < 2; i += 1) await host.sdk.command('clock.tick', {});
    const second = host.sdk.receipts().filter(entry => entry.receipt.type === 'clock.tick')[1].receipt.rev;
    const seen = record(host.api, ['story:rebuilt']);
    const done = await host.sdk.rewind({ index: 2, beforeRev: second });
    assert.equal(done.ok, true, done.message);
    await settle();
    assert.ok(seen.some(([, payload]) => payload.reason === 'rewind'), JSON.stringify(seen));
    seen.length = 0;
    host.events.emit('head', { index: host.store.headIndex(), reason: 'module' });
    await settle();
    assert.deepEqual(seen.map(([, payload]) => payload.reason), ['module']);
});

test('a map field is one change per key, not the object as well', () => {
    const domainOf = marks => {
        const domain = sheetDomain({ tracker: { fields: { hope: 4, marks } } });
        const definition = domain.pins.h0.definition;
        delete definition.role;
        Object.assign(definition, { id: 'pack.chat/tracker', slug: 'tracker', name: 'tracker', show: { tab: true, card: false },
            state: { hope: { type: 'int', min: 0, max: 9, default: 3 }, marks: { type: 'map', keys: ['a', 'b'], values: { type: 'int', min: 0, max: 5 } } } });
        return { domains: { dataModules: domain } };
    };
    const readers = createReaders({ ask: () => null });
    const before = domainOf({ a: 1, b: 0 }), after = domainOf({ a: 2, b: 0 });
    assert.deepEqual(diffLeaves(readers.leaves(before), readers.leaves(after)), [{ path: 'blocks.pack.chat/tracker.marks.a', from: 1, to: 2 }]);
    assert.deepEqual(readers.get(after, 'blocks.pack.chat/tracker.marks'), { a: 2, b: 0 }, 'the object still reads');
});

test('sections are kept per head state and read again when the head changes (or the RPG switch / persona does)', { skip }, () => {
    const states = [1, 2].map(qty => ({ domains: { inventory: {}, dataModules: sheetDomain({ ren: { role: 'character', fields: character('Ren', { level: qty }) } }) } }));
    let asked = 0;
    let on = true;
    const readers = createReaders({ ask: (state, name) => { if (name === 'inventory.items') asked += 1; return name === 'inventory.items' ? [{ name: 'Lamp', qty: states.indexOf(state) + 1, kind: 'goods', note: '' }] : null; }, rpgOn: () => on, persona: () => 'Ren' });
    for (let i = 0; i < 5; i += 1) assert.equal(readers.get(states[0], 'items.Lamp.qty'), 1);
    assert.equal(asked, 1, 'five gets on one head read the section once');
    assert.equal(readers.get(states[1], 'items.Lamp.qty'), 2, 'a new head is read again');
    assert.equal(asked, 2);
    assert.equal(readers.get(states[0], 'party.me.level'), 2 - 1);
    on = false;
    assert.equal(readers.get(states[0], 'party.me.level'), undefined, 'the RPG switch is not cached away');
    on = true;
    assert.equal(readers.get(states[1], 'party.me.level'), 2);
});

test('ready, get, paths and on are frozen', { skip }, async t => {
    const host = await createHost();
    t.after(() => host.close());
    const { api } = host;
    for (const part of [api.ready, api.get, api.paths, api.on]) assert.ok(Object.isFrozen(part));
    assert.throws(() => { api.ready.then = () => 'hijacked'; }, TypeError);
    assert.throws(() => { api.get.evil = 1; }, TypeError);
    assert.equal(await api.ready, api);
});

test('a member called "me" is not reachable by name (party.me stays the reader\'s); duplicate character names are read by id', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ core: false, st: { user: 'Ren' }, modules: [blocksModule({
        ren: { definition: { role: 'character' }, fields: character('Ren', { level: 2 }) },
        me: { definition: { role: 'character' }, fields: character('Me', { level: 7 }) },
    }, { feature: true })] });
    t.after(() => host.close());
    host.features.set('story-block.rpg', true);
    await host.send('Go.', 'Opening.');
    assert.equal(host.api.get('party.me.level'), 2, 'the alias is the reader');
    assert.equal(host.api.get('party.me.name'), 'Ren');
    assert.deepEqual(host.api.get('party').map(member => member.name), ['Me', 'Ren'], 'still in the list');
    assert.ok(!host.api.paths().some(path => path.startsWith('party.Me')));
    const twin = { definition: { scope: 'character', show: { tab: true, card: false }, state: { trust: { type: 'int', min: 0, max: 9, default: 0 } } }, subjects: ['ca_aaaaaaaa', 'ca_bbbbbbbb'],
        characters: { ca_aaaaaaaa: { fields: { trust: 1 } }, ca_bbbbbbbb: { fields: { trust: 8 } } } };
    const other = await createHost({ core: false, modules: [blocksModule({ bond: twin })] });
    t.after(() => other.close());
    await other.send('Go.', 'Opening.');
    // (no Story Director here, so both subjects show as their ids: the keys are distinct either way)
    assert.equal(other.api.get('blocks.pack.chat/bond.ca_aaaaaaaa.trust'), 1);
    assert.equal(other.api.get('blocks.pack.chat/bond.ca_bbbbbbbb.trust'), 8);
    const named = { domains: other.head().domains };
    const readers = createReaders({ ask: () => null });
    const withActors = names => ({ domains: { ...structuredClone(named.domains), checks: { policy: { actors: { ca_aaaaaaaa: { id: 'ca_aaaaaaaa', name: names[0] }, ca_bbbbbbbb: { id: 'ca_bbbbbbbb', name: names[1] } } } } } });
    const state = withActors(['Mara', 'mara']);
    state.domains.checks = { policy: { actors: { ca_aaaaaaaa: { id: 'ca_aaaaaaaa', name: 'Mara' }, ca_bbbbbbbb: { id: 'ca_bbbbbbbb', name: 'mara' } } } };
    assert.equal(readers.get(state, 'blocks.pack.chat/bond.ca_aaaaaaaa.trust'), 1, 'two Maras: by id');
    assert.equal(readers.get(state, 'blocks.pack.chat/bond.Mara.trust'), undefined);
    assert.equal(readers.get(withActors(['Mara', 'Tomas']), 'blocks.pack.chat/bond.Mara.trust'), 1, 'one Mara: by name');
});
