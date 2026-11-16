// The public API v1 (src/v2/public-api.js, docs/v2/PUBLIC-API.md): the frozen surface, each path family, hidden values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../packages/story-block/testkit/index.js';
import { API_EVENTS, API_VERSION, createPublicApi } from '../../core/public-api.js';
import { createEvents } from '../../core/sdk.js';
import { VERSION } from '../../core/runtime.js';
import { character } from '../../packages/story-block/tests/v2/lean-rpg/helpers.js';
import { skip, reply, blocksModule, PARTY, TRACKER } from './public-api.helpers.js';

// ---- the surface ---------------------------------------------------------------------------------------------------------------------------

test('the surface is frozen: names, arity, version, host, ready, events', { skip }, async t => {
    const host = await createHost();
    t.after(() => host.close());
    const { api } = host;
    assert.ok(Object.isFrozen(api));
    assert.deepEqual(Object.keys(api), ['version', 'host', 'ready', 'get', 'paths', 'on']);
    assert.equal(api.version, 1);
    assert.equal(API_VERSION, 1);
    assert.equal(api.host, VERSION);
    assert.equal(typeof api.get, 'function');
    assert.equal(api.get.length, 1);
    assert.equal(api.paths.length, 0);
    assert.equal(api.on.length, 2);
    assert.ok(api.ready instanceof Promise);
    assert.equal(await api.ready, api);
    assert.deepEqual([...API_EVENTS], ['story:changed', 'story:reply', 'story:rebuilt', 'story:chat']);
    assert.throws(() => { api.get = () => 1; }, TypeError);
    assert.throws(() => { api.extra = 1; }, TypeError);
    assert.throws(() => api.on('story:nothing', () => {}), /no "story:nothing" event/);
    assert.throws(() => api.on('story:chat', 'x'), /needs a function/);
    const off = api.on('story:chat', () => {});
    assert.equal(typeof off, 'function');
    assert.equal(off.length, 0);
    off();
    assert.ok(Object.isFrozen(api.paths()));
});

test('before a chat has any state every path is undefined and paths() is empty', { skip }, async t => {
    const events = createEvents();
    const api = createPublicApi({ version: '9.9.9', state: () => null, ask: () => null, events });
    assert.equal(api.get('scene.place'), undefined);
    assert.equal(api.get('money'), undefined);
    assert.deepEqual([...api.paths()], []);
    assert.equal(api.host, '9.9.9');
    events.emit('head', { index: 0, reason: 'chat' });
    assert.equal(await api.ready, api);
    t.mock.method(console, 'warn', () => {});
});

// ---- paths ---------------------------------------------------------------------------------------------------------------------------------

test('scene.*: place, kind, region, weather, present; a path that was never written is undefined', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.weather': true } } });
    t.after(() => host.close());
    const { api } = host;
    assert.equal(api.get('scene.place'), undefined);
    assert.deepEqual(api.get('scene.present'), []);
    await host.send('Go.', reply('~ place Vell Harbour | kind: settlement | region: the Reach', '+ present Ren', '+ present Mara', '~ weather sea fog'));
    assert.equal(api.get('scene.place'), 'Vell Harbour');
    assert.equal(api.get('scene.place.kind'), 'settlement');
    assert.equal(api.get('scene.place.region'), 'the Reach');
    assert.equal(api.get('scene.weather'), 'sea fog');
    assert.deepEqual(api.get('scene.present'), ['Ren', 'Mara']);
    assert.ok(Object.isFrozen(api.get('scene.present')));
    assert.equal(api.get('scene.time'), undefined, 'no clock without Story Director');
    assert.equal(api.get('scene.date'), undefined);
    assert.equal(api.get('SCENE.Place'), 'Vell Harbour', 'paths are not case-sensitive');
    assert.equal(api.get('scene'), undefined, 'only the listed paths');
    assert.equal(api.get('scene.nothing'), undefined);
    assert.equal(api.get(42), undefined);
    assert.equal(api.get(), undefined);
});

test('scene.weather: undefined once the weather feature is off', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    await host.send('Go.', reply('~ place Quay', '~ weather rain'));
    assert.equal(host.api.get('scene.weather'), 'rain');
    host.features.set('story-block.weather', false);
    assert.equal(host.api.get('scene.place'), 'Quay');
    assert.equal(host.api.get('scene.weather'), undefined);
    assert.ok(!host.api.paths().includes('scene.weather'));
});

test('scene.time and scene.date: from the clock Story Director answers (director.time)', { skip }, async t => {
    const clocks = [
        [{ minutes: 100, text: 'Goldwane 12, 611, 06:40 am', parts: { year: 611, month: 3, day: 12, minutes: 400 } }, '06:40 am', 'Goldwane 12, 611'],
        [{ minutes: 100, text: '06:40, 12 March', parts: { minutes: 400 } }, '06:40', '12 March'],
        [{ minutes: 1500, text: 'Day 2', parts: { minutes: 60 } }, '01:00', 'Day 2'],
        [{ minutes: null, text: '', parts: null }, undefined, undefined],
    ];
    for (const [answer, time, date] of clocks) {
        const host = await createHost({ modules: [{ id: 'story-director', name: 'Director', version: '1', domains: {}, queries: { 'director.time': () => answer } }] });
        await host.send('Go.', 'Opening.');
        assert.equal(host.api.get('scene.time'), time, JSON.stringify(answer));
        assert.equal(host.api.get('scene.date'), date, JSON.stringify(answer));
        host.close();
    }
});

test('money and money.text: in the smallest coin and as the chat writes it', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { modules: { 'story-block': { coins: [{ name: 'copper', value: 1 }, { name: 'silver', value: 10 }], currency: 'copper' } } } });
    t.after(() => host.close());
    assert.equal(host.api.get('money'), 0);
    await host.send('Go.', reply('+ coin 65'));
    assert.equal(host.api.get('money'), 65);
    assert.equal(host.api.get('money.text'), '6 silver 5 copper');
    assert.equal(host.api.get('money.gold'), undefined);
});

test('items, items.<name>.qty: the party\'s bag; names with dots and any case work; the stacks of a name add up', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost();
    t.after(() => host.close());
    assert.deepEqual(host.api.get('items'), []);
    await host.send('Go.', reply('+ item Healing Draught | qty: 2 | note: bitter', "+ item Mr. Fox's Pie | note: still warm", '+ item Lamp'));
    const list = host.api.get('items');
    assert.deepEqual(list.map(item => item.name).sort(), ['Healing Draught', 'Lamp', "Mr. Fox's Pie"]);
    assert.deepEqual(Object.keys(list[0]), ['name', 'qty', 'kind', 'note']);
    assert.equal(host.api.get('items.Healing Draught.qty'), 2);
    assert.equal(host.api.get('items.healing draught.qty'), 2);
    assert.equal(host.api.get("items.Mr. Fox's Pie.qty"), 1);
    assert.equal(host.api.get("items.Mr. Fox's Pie.note"), 'still warm');
    assert.equal(host.api.get('items.Healing Draught.kind'), 'goods');
    assert.equal(host.api.get('items.Lamp.note'), undefined);
    assert.equal(host.api.get('items.Nothing.qty'), undefined);
    assert.deepEqual(host.api.get('items.Lamp'), { name: 'Lamp', qty: 1, kind: 'goods', note: '' });
    await host.send('More.', reply('+ item Healing Draught | qty: 3'));
    assert.equal(host.api.get('items.Healing Draught.qty'), 5);
    assert.throws(() => { host.api.get('items').push(1); }, TypeError);
    assert.throws(() => { host.api.get('items')[0].qty = 9; }, TypeError);
    assert.ok(host.api.paths().includes('items.Healing Draught.qty'));
    assert.ok(host.api.paths().includes("items.Mr. Fox's Pie.note"));
});

test('party and party.<name>.<field>, party.me.<field>: the Characters while the RPG is on', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ core: false, modules: [blocksModule(PARTY(), { feature: true })], st: { user: 'Ren' } });
    t.after(() => host.close());
    host.features.set('story-block.rpg', true);
    await host.send('Go.', 'Opening.');
    const { api } = host;
    assert.deepEqual(api.get('party').map(member => member.name), ['Ren', 'Wessel'], 'in block-id order');
    assert.deepEqual(api.get('party.Wessel'), { name: 'Wessel', level: 4, xp: 30, health: 'Unhurt', mana: 'Fresh', stamina: 'Fresh', stats: { str: 14, vit: 12, agi: 12, dex: 10, int: 8, luk: 9, cha: 10 } });
    assert.equal(api.get('party.wessel.level'), 4);
    assert.equal(api.get('party.Ren.health'), 'Hurt');
    assert.equal(api.get('party.Ren.stats.int'), 16);
    assert.deepEqual(api.get('party.Ren.stats').int, 16);
    assert.equal(api.get('party.me.name'), 'Ren');
    assert.equal(api.get('party.me.level'), 2);
    assert.equal(api.get('party.me.xp'), 10);
    assert.equal(api.get('party.me.health'), 'Hurt');
    assert.equal(api.get('party.me.stats.str'), 8);
    assert.equal(api.get('party.Nobody.level'), undefined);
    assert.ok(api.paths().includes('party.me.mana'));
    assert.ok(api.paths().includes('party.Wessel.stamina'));
    // The reader is nobody in particular: party.me reads nothing (the first block is not guessed).
    host.ctx.name1 = 'Somebody Else';
    assert.equal(api.get('party.me.level'), undefined);
    assert.equal(api.get('party.me'), undefined);
    assert.equal(api.get('party.Ren.level'), 2);
    // A stage the pack names reads as its name.
    const named = blocksModule({ ren: { definition: { role: 'character', state: { health: { type: 'int', min: 0, max: 5, default: 5, names: { 5: 'Hale', 3: 'Bruised' } } } }, fields: character('Ren', { health: 3 }) } }, { feature: true });
    const second = await createHost({ core: false, modules: [named], st: { user: 'Ren' } });
    t.after(() => second.close());
    second.features.set('story-block.rpg', true);
    await second.send('Go.', 'Opening.');
    assert.equal(second.api.get('party.me.health'), 'Bruised');
});

test('party: undefined while the RPG is off, whatever the chat holds', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ core: false, modules: [blocksModule(PARTY(), { feature: true })], st: { user: 'Ren' } });
    t.after(() => host.close());
    await host.send('Go.', 'Opening.');
    assert.equal(host.api.get('party'), undefined);
    assert.equal(host.api.get('party.me.level'), undefined);
    assert.equal(host.api.get('blocks.pack.chat/wessel.who'), undefined, 'a role block is part of the RPG');
    assert.deepEqual(host.api.paths().filter(path => path.startsWith('party') || path.startsWith('blocks.')), []);
    host.features.set('story-block.rpg', true);
    assert.equal(host.api.get('party.me.level'), 2);
    host.features.set('story-block.rpg', false);
    assert.equal(host.api.get('party.me.level'), undefined);
});

test('blocks.<blockId>.<field>: any pinned block, the id with its dots and slash; a map reads by key', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ core: false, modules: [blocksModule({ tracker: TRACKER })] });
    t.after(() => host.close());
    await host.send('Go.', 'Opening.');
    const { api } = host;
    assert.deepEqual(api.get('blocks'), ['pack.chat/tracker']);
    assert.equal(api.get('blocks.pack.chat/tracker.hope'), 4);
    assert.equal(api.get('blocks.pack.chat/tracker.title'), 'The Lamp-lighter');
    assert.deepEqual(api.get('blocks.pack.chat/tracker.marks'), { a: 2, b: 0 });
    assert.equal(api.get('blocks.pack.chat/tracker.marks.a'), 2);
    assert.equal(api.get('blocks.PACK.chat/Tracker.hope'), 4);
    assert.deepEqual(api.get('blocks.pack.chat/tracker'), { hope: 4, title: 'The Lamp-lighter', marks: { a: 2, b: 0 } });
    assert.equal(api.get('blocks.pack.chat/tracker.nothing'), undefined);
    assert.equal(api.get('blocks.pack.chat/other.hope'), undefined);
    assert.ok(api.paths().includes('blocks.pack.chat/tracker.hope'));
    assert.ok(Object.isFrozen(api.get('blocks.pack.chat/tracker.marks')));
});

test('a character block reads by who: blocks.<blockId>.<who>.<field>', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const block = { definition: { scope: 'character', show: { tab: true, card: false }, state: { trust: { type: 'int', min: 0, max: 9, default: 0 } } }, subjects: ['ca_aaaaaaaa'], characters: { ca_aaaaaaaa: { fields: { trust: 6 } } } };
    const host = await createHost({ core: false, modules: [blocksModule({ bond: block })] });
    t.after(() => host.close());
    await host.send('Go.', 'Opening.');
    assert.equal(host.api.get('blocks.pack.chat/bond.ca_aaaaaaaa.trust'), 6);
    assert.deepEqual(host.api.get('blocks.pack.chat/bond.ca_aaaaaaaa'), { trust: 6 });
});

// ---- hidden values -------------------------------------------------------------------------------------------------------------------------

test('hidden: a field the pack hides from the story (prompt: false) reads as undefined, as its path is not listed; a block shown nowhere is not there', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const secret = { definition: { show: { tab: false, card: false }, state: { plan: { type: 'int', min: 0, max: 9, default: 0 } } }, fields: { plan: 5 } };
    const shown = { definition: { show: { tab: true, card: false }, state: { plan: { type: 'int', min: 0, max: 9, default: 0 } } }, fields: { plan: 6 } };
    const host = await createHost({ core: false, modules: [blocksModule({ tracker: TRACKER, secret, shown })] });
    t.after(() => host.close());
    await host.send('Go.', 'Opening.');
    const { api } = host;
    assert.equal(api.get('blocks.pack.chat/tracker.dread'), undefined);
    assert.equal(api.get('blocks.pack.chat/tracker.hope'), 4);
    assert.ok(!('dread' in api.get('blocks.pack.chat/tracker')));
    assert.equal(api.get('blocks.pack.chat/secret.plan'), undefined);
    assert.equal(api.get('blocks.pack.chat/secret'), undefined);
    assert.equal(api.get('blocks.pack.chat/shown.plan'), 6);
    assert.deepEqual(api.get('blocks'), ['pack.chat/shown', 'pack.chat/tracker']);
    const listed = JSON.stringify(api.paths());
    assert.ok(!listed.includes('dread') && !listed.includes('secret'), listed);
    // Nothing of a hidden value is in the leaves the events compare either.
    assert.ok(![...api.paths()].some(path => /dread|secret/.test(path)));
});

test('hidden: a member\'s hidden level, xp, bar and stat are left out; a hidden Who is the block\'s name', { skip }, async t => {
    t.mock.method(console, 'warn', () => {});
    const hidden = {
        definition: { role: 'character', name: 'Stranger', state: {
            who: { type: 'text', max: 40, default: '', prompt: false }, level: { type: 'int', min: 1, max: 99, default: 1, prompt: false }, xp: { type: 'int', min: 0, max: 100, default: 0, prompt: false },
            mana: { type: 'int', min: 0, max: 4, default: 4, prompt: false }, luk: { type: 'int', min: 1, max: 20, default: 9, prompt: false },
        } },
        fields: character('Ysolde', { level: 9, xp: 55, mana: 1, luk: 17 }),
    };
    const host = await createHost({ core: false, modules: [blocksModule({ ysolde: hidden }, { feature: true })], st: { user: 'Stranger' } });
    t.after(() => host.close());
    host.features.set('story-block.rpg', true);
    await host.send('Go.', 'Opening.');
    const member = host.api.get('party.Stranger');
    assert.equal(member.name, 'Stranger', 'the hidden name is not given');
    assert.equal(member.level, undefined);
    assert.equal(member.xp, undefined);
    assert.equal(member.mana, undefined);
    assert.equal(member.stats.luk, undefined);
    assert.equal(member.health, 'Unhurt');
    assert.equal(member.stats.str, 14);
    assert.equal(host.api.get('party.me.level'), undefined);
    assert.equal(host.api.get('party.Ysolde.level'), undefined);
    assert.ok(!JSON.stringify(host.api.paths()).includes('Ysolde'));
    assert.ok(!JSON.stringify(host.api.get('party')).includes('Ysolde'));
});
