// The Rules page's Level cap and XP rate: read when a reply's dice step is made, kept in that step's receipt, so a Re-read or a replay uses the reply's own numbers, never today's settings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { textRpgModule } from '../src/module.js';
import { levelOf } from '../src/module-parts/standing.js';
import { readRules, recordable, rulesOf, xpCeiling } from '../src/module-parts/rules-now.js';
import { astraOf, drawn, reply, withAstra } from './helpers/host.js';

const REAL = ['+ foes Rats | count: 1 | kind: common', '? try Astra | Lore | ordinary', '+ xp Party — a deed'];
const set = (host, key, value) => host.settings.set('text-rpg', key, value);
const quiet = t => t.mock.method(console, 'warn', () => {});

test('the settings: Level cap is 1 to 99 (default 99) and XP rate 50 to 300 % in steps of 25 (default 100), both on the Rules page', () => {
    const { schema, defaults } = textRpgModule(null).settings;
    assert.deepEqual([schema.levelCap.type, schema.levelCap.min, schema.levelCap.max, defaults.levelCap], ['int', 1, 99, 99]);
    assert.deepEqual([schema.xpRate.type, defaults.xpRate], ['choice', '100']);
    assert.deepEqual(schema.xpRate.options.map(option => option.value), ['50', '75', '100', '125', '150', '175', '200', '225', '250', '275', '300']);
    assert.deepEqual([readRules({ cap: 0, rate: 60 }), readRules({ cap: 5, rate: 150 }), readRules(null)], [{ cap: 99, rate: 100 }, { cap: 5, rate: 150 }, { cap: 99, rate: 100 }]);
    assert.deepEqual([recordable({ cap: 99, rate: 100 }), recordable({ cap: 5, rate: 100 })], [null, { cap: 5, rate: 100 }]);
    assert.deepEqual([xpCeiling(1), xpCeiling(2), xpCeiling(99), xpCeiling('x')], [99, 199, 9999, 9999]);
    assert.deepEqual(rulesOf({ settings: () => ({ levelCap: 7, xpRate: '175' }) }), { cap: 7, rate: 175 });
    assert.deepEqual(rulesOf({ settings: () => { throw new Error('no'); } }), { cap: 99, rate: 100 });
});

test('the rate multiplies what + xp pays (the 10 XP a common foe pays), and the receipt of the reply\'s dice step holds the rules only when they are not the defaults', async t => {
    quiet(t);
    const host = await withAstra({}, { modules: { 'text-rpg': { xpRate: '200' } } });
    try {
        await host.send('One.', reply('Told.', REAL));
        assert.equal(astraOf(host).xp, 20, '10 xp at 200 %');
        assert.deepEqual(drawn(host).rules, { cap: 99, rate: 200 });
        set(host, 'xpRate', '50');
        await host.send('Two.', reply('Told.', REAL));
        assert.equal(astraOf(host).xp, 25, 'and 5 at 50 %');
        set(host, 'xpRate', '100');
        await host.send('Three.', reply('Told.', REAL));
        assert.equal(astraOf(host).xp, 35);
        assert.equal(drawn(host).rules, undefined, 'the defaults are not recorded');
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});

test('the level cap stops xp adding levels: at cap 2 the xp stops at the end of level 2 and the level stays', async t => {
    quiet(t);
    const host = await withAstra({}, { modules: { 'text-rpg': { levelCap: 2 } } });
    try {
        const elite = ['+ foes Ogres | count: 1 | kind: elite', '? try Astra | Lore | hard', '+ xp Party — a deed'];
        for (const text of ['One.', 'Two.', 'Three.']) await host.send(text, reply('Told.', elite));
        assert.deepEqual([astraOf(host).xp, levelOf(astraOf(host))], [199, 2], '120 + the 79 that fit, then nothing');
        assert.deepEqual(drawn(host).rules, { cap: 2, rate: 100 });
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});

test('a Re-read pays a reply at the rules it was written under, not today\'s settings', async t => {
    quiet(t);
    const host = await withAstra({}, { modules: { 'text-rpg': { xpRate: '200', levelCap: 3 } } });
    try {
        const at = host.ctx.chat.length;
        await host.send('One.', reply('First.', REAL));
        assert.equal(astraOf(host).xp, 20);
        set(host, 'xpRate', '50');
        set(host, 'levelCap', 1);
        assert.equal((await host.sdk.reread(at + 1)).ok, true);
        assert.equal(astraOf(host).xp, 20, 'the same 20 after the settings changed');
        await host.send('Two.', reply('Second.', REAL));
        assert.equal(astraOf(host).xp, 25, 'a new reply is paid at today\'s 50 % (5 xp) and held to today\'s cap 1 (99 xp)');
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});

test('a middle delete and a rebuild replay every surviving reply with the rules it was written under', async t => {
    quiet(t);
    const host = await withAstra({}, { modules: { 'text-rpg': { xpRate: '200' } } });
    try {
        await host.send('One.', reply('A.', REAL));
        const middleAt = host.ctx.chat.length;
        set(host, 'xpRate', '300');
        await host.send('Two.', reply('B.', REAL));
        set(host, 'xpRate', '50');
        await host.send('Three.', reply('C.', REAL));
        assert.equal(astraOf(host).xp, 20 + 30 + 5);
        await host.st.deleteMessage(middleAt + 1);
        await host.st.deleteMessage(middleAt);
        assert.deepEqual(host.store.problems(), []);
        assert.equal(astraOf(host).xp, 20 + 5, 'the first reply at 200 % and the third at 50 %, whatever the setting says now');
        const live = JSON.stringify(host.head());
        host.store.rebuild();
        assert.equal(JSON.stringify(host.head()), live, 'rebuild == live');
    } finally {
        host.close();
    }
});
