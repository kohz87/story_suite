// gear.view's carry is the whole party's, the numbers the encumbrance rule reads: a companion's own things and bag are in the totals, the chips (which
// add up to the capacity) and `carry.people`, under the name a roster query gives them; all of it is worked out from the state, so replay equals live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

const MARA = 'ac_mara0001';
const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: MARA, name: 'Mara' }] } };
const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
const SETTINGS = { features: { 'story-block.gear': true, 'story-block.rpg': true } };
const ok = async (host, name, payload) => { const out = await host.sdk.command(name, payload); assert.equal(out.ok, true, `${name}: ${out.message}`); return out; };
const carryOf = host => host.sdk.query('gear.view', {}).carry;
const stackOf = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name).stack;
const counted = carry => carry.parts.filter(part => !part.dim).reduce((sum, part) => sum + part.value, 0);

test('a companion with a bag and her own things: the totals, the chips and her own line, the same as the encumbrance rule; replay equals live', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [ACTORS], settings: SETTINGS });
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', ['+ item Old Sack', '+ item Rope']));
    const alone = carryOf(host);
    assert.deepEqual(alone.people, []);
    assert.equal(alone.capacity, 60, 'the reader\'s 30 and Mara\'s, who holds nothing yet');
    await ok(host, 'inventory.carry', { stack: stackOf(host, 'Old Sack'), carry: 12 });
    await ok(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Old Sack') });
    const carry = carryOf(host), rule = host.sdk.query('gear.carry', {});
    assert.deepEqual([carry.load, carry.capacity], [rule.load, rule.capacity]);
    assert.equal(carry.load, Object.values(rule.weights).reduce((sum, n) => sum + n, 0), 'every owner\'s things are in the load');
    const [mara] = rule.people;
    assert.deepEqual(carry.people, [{ id: MARA, name: 'Mara', load: mara.load, capacity: mara.capacity, level: 'normal' }]);
    assert.equal(carry.capacity, alone.capacity + 12, 'the sack\'s room counts, with her');
    assert.deepEqual(carry.parts.slice(-2).map(part => part.text), [`Mara carries ${mara.capacity - 12}`, 'Mara\'s Old Sack +12']);
    assert.match(carry.breakdown, /Mara carries \d+ · Mara's Old Sack \+12$/);
    assert.equal(counted(carry), carry.capacity, 'the chips add up to the capacity');
    // The refusal names her, not her id.
    const heavy = host.sdk.query('gear.carry', { owner: MARA, add: [{ qty: mara.capacity }] });
    assert.match(heavy.message, /^Mara cannot carry that/);
    const live = JSON.stringify(carry);
    host.store.rebuild();
    assert.equal(JSON.stringify(carryOf(host)), live, 'a rebuild equals live');
    const loaded = await createHost({ modules: [ACTORS], st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.equal(JSON.stringify(carryOf(loaded)), live, 'a reload equals live');
});

test('a companion past her own limit is marked on her line while the party\'s bar is not, and the encumbrance rule names her', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ modules: [ACTORS], settings: SETTINGS });
    t.after(() => host.close());
    await host.send('Hello.', reply('The road.', ['+ item Old Sack']));
    await ok(host, 'inventory.bag', { owner: MARA, stack: stackOf(host, 'Old Sack') });
    await ok(host, 'inventory.edit', { stack: stackOf(host, 'Old Sack'), weight: carryOf(host).people[0].capacity + 1 });
    const carry = carryOf(host);
    const rule = host.sdk.query('inventory.encumbrance');
    assert.equal(carry.level, 'normal');
    assert.equal(carry.people[0]?.level, 'over');
    assert.deepEqual(rule.who.map(person => person.name), ['Mara']);
});
