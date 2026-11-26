// A companion who left (fallen, or their join deleted) and still holds things: no room, still in the load, a real name, and a way to get the things back.
// And a Re-read of an item line from a reply captured before the roster counted is judged as it was then.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { selectBag } from '../../../ui/select/bag.js';
import { buildSelectors } from '../../../ui/select/build.js';
import { createSbPort } from '../../../ui/port/sb-port.js';
import { textRpgModule } from '../src/module.js';
import { newHost, reply, sent, slice, withAstra } from './helpers/host.js';

const RAW = /ac_[0-9a-z]{8}/;
const stackOf = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name).stack;
const ok = async (host, type, payload) => { const out = await host.sdk.command(type, payload); assert.equal(out.ok, true, `${type}: ${out.message}`); return out; };
const idOf = (host, name) => Object.values(slice(host).members).find(member => member.name === name).id;
// Every text a reader or the narrator gets about the load: no ID in any of them (ids as values are fine).
const said = view => [view.carry.breakdown, ...view.carry.parts.flatMap(part => [part.label, part.text]), ...view.carry.people.map(row => row.name),
    ...Object.values(view.rows).flatMap(row => [row.by, row.gone ?? '']), ...view.wearers.map(row => row.label), ...view.carriers.packs.map(row => row.by)].join(' | ');
const snapshot = host => JSON.stringify([host.head().domains.inventory, host.head().domains.textRpg, host.sdk.query('gear.view', {})]);

/** The same chat, rebuilt and then loaded into a new host, answers the same. */
async function replays(t, host, features) {
    const live = snapshot(host);
    host.store.rebuild();
    assert.equal(snapshot(host), live, 'rebuild == live');
    assert.deepEqual(host.store.problems(), []);
    let loaded = null;
    const sdk = { feature: id => loaded.sdk.feature(id), settings: id => loaded.sdk.settings(id), command: (...args) => loaded.sdk.command(...args), query: (...args) => loaded.sdk.query(...args) };
    loaded = await createHost({ modules: [textRpgModule(sdk)], settings: { features: { 'text-rpg.on': true, ...features } }, st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.equal(snapshot(loaded), live, 'reload == live');
}

/** Torka joins and gets the Leather Satchel (+12) as their bag, and the anvil. */
async function torkaLoaded(host) {
    await host.send('Hello.', reply('Torka joins.', ['+ companion Torka | level: 3 | strengths: maul']));
    await host.send('Loot.', reply('Finds.', ['+ item Leather Satchel', '+ item Anvil']));
    const torka = idOf(host, 'Torka');
    await ok(host, 'inventory.carry', { stack: stackOf(host, 'Leather Satchel'), carry: 12 });
    await ok(host, 'inventory.bag', { owner: torka, stack: stackOf(host, 'Leather Satchel') });
    await ok(host, 'inventory.transfer', { stack: stackOf(host, 'Anvil'), to: torka });
    return torka;
}

test('Torka falls holding the satchel and an anvil: no room of theirs, their things still count, their name; Put down and a hand-over get it all back', async t => {
    t.mock.method(console, 'warn', () => {});
    const features = { 'story-block.gear': true };
    const host = await withAstra(features);
    t.after(() => host.close());
    const torka = await torkaLoaded(host);
    const before = host.sdk.query('gear.view', {}).carry;
    await host.send('Run.', reply('The roof comes down.', ['! fall Torka | crushed']));
    const view = host.sdk.query('gear.view', {});
    // (Torka's own 30 and the satchel's 12 are gone from the limit; what they hold is still in the load)
    assert.deepEqual([view.carry.load, view.carry.capacity], [before.load, before.capacity - 42]);
    assert.doesNotMatch(view.carry.breakdown, /Torka/);
    assert.equal(view.carry.parts.filter(part => !part.dim).reduce((sum, part) => sum + part.value, 0), view.carry.capacity, 'the chips add up');
    const [line] = view.carry.people;
    assert.deepEqual([line.id, line.name, line.left, line.capacity], [torka, 'Torka', true, undefined]);
    assert.equal(view.rows[stackOf(host, 'Anvil')].gone, 'Torka');
    assert.doesNotMatch(said(view), RAW);
    const bag = selectBag({ rpg: true, items: host.sdk.query('inventory.items'), gear: view, carriers: view.carriers, pcId: 'you' });
    assert.deepEqual(bag.load.people, [{ id: torka, name: 'Torka', value: line.load, limit: 0, level: 'light', left: true }]);
    assert.deepEqual(bag.items.filter(item => item.gone === 'Torka').map(item => item.name).sort(), ['Anvil', 'Leather Satchel']);
    // The rules: not a person, so never named as over; a refusal speaks of the party.
    const rule = host.sdk.query('gear.carry', {});
    assert.deepEqual(rule.people, []);
    assert.equal(rule.left, undefined);
    assert.match(host.sdk.query('gear.carry', { owner: torka, add: [{ qty: 999 }] }).message, /^The party cannot carry that/);
    assert.deepEqual(host.sdk.query('inventory.gear', { owner: torka }).carry.sources.map(source => source.name), ['Torka']);
    await replays(t, host, features);
    // Nothing is handed to them; Put down and a transfer bring it back, the summaries under their name.
    assert.equal((await host.sdk.command('inventory.transfer', { stack: stackOf(host, 'Anvil'), to: torka })).ok, false);
    const down = await ok(host, 'inventory.bag', { owner: torka, stack: null });
    assert.match(down.receipt.summary, /^Torka puts down Leather Satchel \(back in the party's bag\)/);
    assert.match((await host.sdk.command('inventory.bag', { owner: torka, stack: null })).message, /not in the party/);
    const back = await ok(host, 'inventory.transfer', { stack: stackOf(host, 'Anvil'), to: 'party' });
    assert.match(back.receipt.summary, /^Torka gives .*Anvil.* to the party/);
    const after = host.sdk.query('gear.view', {});
    assert.deepEqual([after.carry.people, after.carry.load, after.carry.capacity], [[], before.load, before.capacity - 42 + 12], 'the satchel is held by the party again');
    assert.ok(host.sdk.query('inventory.items').every(item => item.owner === 'party'));
    await replays(t, host, features);
});

test('a join deleted after a hand-over leaves "Someone who left"; the narrator\'s tail and the receipts name no id', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra({ 'story-block.gear': true });
    t.after(() => host.close());
    const torka = await torkaLoaded(host);
    // So much is held that the party is over its limit once Torka's room is gone.
    await host.send('More.', reply('Stones.', ['+ item Stone | qty: 40']));
    await host.st.deleteMessage(host.ctx.chat.findIndex(message => /Torka joins/.test(message.mes)));
    const view = host.sdk.query('gear.view', {});
    assert.deepEqual(view.carry.people.map(row => [row.id, row.name, row.left, row.unnamed]), [[torka, 'Someone who left', true, true]]);
    assert.doesNotMatch(said(view), RAW);
    await host.send('Walk.', 'The road.');
    const tail = sent(host, 'story_suite_tail_0').concat(sent(host, 'story_suite_tail_1')).join('\n');
    const encumbered = tail.split('\n').filter(line => line.startsWith('Encumbered'));
    assert.ok(encumbered.length, 'the narrator is told');
    assert.doesNotMatch(encumbered.join('\n'), RAW);
    const down = await ok(host, 'inventory.bag', { owner: torka, stack: null });
    assert.match(down.receipt.summary, /^Someone who left puts down/);
    await replays(t, host, { 'story-block.gear': true });
});

test('a Re-read of a reply captured before the roster counted judges its item lines by the old limit', async t => {
    t.mock.method(console, 'warn', () => {});
    const features = { 'story-block.gear': true, 'story-block.encumbrance': false };
    const host = await newHost(features);
    t.after(() => host.close());
    // A companion who holds nothing: their room counts now, and did not before. The shared bag's own limit is 30.
    await host.send('Hello.', reply('Torka joins.', ['+ companion Torka | level: 3 | strengths: maul', '+ item Stone | qty: 29']));
    await host.send('More.', 'A quiet find.');
    const at = host.ctx.chat.length - 1;
    const rocks = () => host.sdk.query('inventory.items').filter(item => item.name === 'Rock').reduce((sum, item) => sum + item.qty, 0);
    const marks = () => host.ctx.chat[at].extra.storySuite.rules;
    assert.ok(marks().includes('carryRoster'), 'a new reply is marked');
    host.ctx.chat[at].mes = reply('A quiet find.', ['+ item Rock | qty: 5']);
    assert.equal((await host.sdk.reread(at)).ok, true);
    assert.equal(rocks(), 5, 'marked: Torka\'s room counts');
    host.ctx.chat[at].mes = 'A quiet find.';
    assert.equal((await host.sdk.reread(at)).ok, true);
    host.ctx.chat[at].extra.storySuite.rules = marks().filter(name => name !== 'carryRoster');
    host.ctx.chat[at].mes = reply('A quiet find.', ['+ item Rock | qty: 5']);
    await host.sdk.reread(at);
    assert.equal(rocks(), 0, 'unmarked: refused, as it was before');
    assert.ok(host.turn.problems().some(problem => /cannot carry that: 29 of 30 carried/.test(problem.message)), JSON.stringify(host.turn.problems()));
});

test('through the page\'s own port the Bag knows when Encumbered is off, so it shows no note', async t => {
    t.mock.method(console, 'warn', () => {});
    for (const on of [true, false]) {
        const host = await withAstra({ 'story-block.gear': true, 'story-block.encumbrance': on });
        t.after(() => host.close());
        await host.send('Loot.', reply('Stones.', ['+ item Stone | qty: 20']));
        const load = createSbPort({ sdk: host.sdk, selectors: buildSelectors(() => host.ctx, host.sdk) }).view('bag').load;
        assert.deepEqual([host.sdk.query('inventory.encumbrance') === null, load.untold], on ? [false, undefined] : [true, true]);
    }
});
