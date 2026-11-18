// A person's signature gear (`story-block.gear`, docs/v2/GEAR.md "Signature gear"): the pack equipment their NPC State Keepsakes name. What a join brings
// (items owned by the person and put on, in the join's one receipt), the same join with gear off, a second join without duplicates, and replay equality.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../testkit/index.js';
import { validatePack } from '../../../packs/validate.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../modules/rpg/templates.js';
import { pack } from '../../packs/helpers/fixtures.js';
import { writeKeepsakes } from './gear-keepsakes.helpers.js';

const available = await hostAvailable();
const skip = available.ok ? false : available.reason;
const reply = (...lines) => `The tide turns.\n<Changes>\n${lines.join('\n')}\n</Changes>`;

const ITEMS = [
    { name: 'Cane Sword', kind: 'equipment', slot: 'weapon', rarity: 'uncommon' },
    { name: 'Oak Buckler', kind: 'equipment', slot: 'shield', rarity: 'common' },
    { name: 'Ferry Coat', kind: 'equipment', slot: 'armour', rarity: 'common' },
    { name: 'Tin Ring', kind: 'equipment', slot: 'accessory', rarity: 'common' },
    { name: 'Lucky Charm', kind: 'equipment', slot: 'accessory', rarity: 'common' },
    { name: 'Bone Amulet', kind: 'equipment', slot: 'accessory', rarity: 'common' },
    { name: 'Rusty Spear', kind: 'equipment', slot: 'weapon', rarity: 'common' },
    { name: 'Ship Biscuit', kind: 'consumable' },
    { name: 'Pebble', kind: 'equipment' },
];
const person = (extra = {}) => ({ id: 'npc_mara', name: 'Mara', aliases: ['the ferrywoman'], ...extra });
const withCast = () => pack({ content: { items: ITEMS } });

// ---- a join ---------------------------------------------------------------------------------------------------------------------------

const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_mara0001', name: 'Mara' }, { id: 'ac_wessel01', name: 'Wessel' }] } };
const GEAR = ['Cane Sword', 'Oak Buckler', 'Tin Ring'];

async function world(t, { gear = true, actors = true, list = [person({ gear: GEAR })] } = {}) {
    t.mock.method(console, 'warn', () => {});
    const raw = withCast();
    const built = validatePack(raw);
    assert.equal(built.ok, true, JSON.stringify(built.errors));
    const host = await createHost({
        modules: actors ? [ACTORS] : [],
        settings: { features: gear ? { 'story-block.gear': true, 'story-block.rpg': true } : { 'story-block.rpg': true }, modules: { 'story-block': { rpgJoin: 'auto', rpgFormula: 'classic' } },
            packs: [{ id: built.pack.id, version: built.pack.version, enabled: true, kind: raw.kind, source: 'file', origin: 'test', pack: raw }], selected: { [raw.kind]: raw.id } },
    });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    await writeKeepsakes(host, list);
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = 'wessel'; defs.character.name = 'Wessel'; defs.character.state.who.default = 'Wessel';
    defs.skills.slug = 'wessel-skills'; defs.skills.name = 'Wessel skills'; defs.skills.state.who.default = 'Wessel';
    for (const definition of [defs.character, defs.skills]) assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    return host;
}
const rows = host => host.sdk.query('inventory.items');
const receipts = host => host.ctx.chat.at(-1).extra.storySuite.receipts;
const receipt = host => receipts(host).find(entry => entry.type === 'capture.party');
// (a stack's `from` names the reply that made it, which a Re-read renews)
const stable = inv => ({ ...inv, stacks: Object.fromEntries(Object.entries(inv.stacks).map(([id, item]) => [id, { ...item, from: undefined }])) });
const bytes = host => JSON.stringify([stable(host.head().domains.inventory), host.head().domains.dataModules?.active, host.sdk.query('inventory.items').map(row => ({ ...row, from: undefined }))]);

test('gear on: the join adds the signature gear to the person, put on in its slots, Good, in the join\'s own receipt', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara | about: a ferrywoman'));
    const worn = Object.fromEntries(rows(host).filter(row => row.owner === 'ac_mara0001').map(row => [row.name, row.equipped]));
    assert.deepEqual(worn, { 'Cane Sword': 'weapon', 'Oak Buckler': 'off-hand', 'Tin Ring': 'accessory-1' });
    assert.deepEqual(rows(host).filter(row => row.owner !== 'ac_mara0001'), [], 'no one else got them');
    assert.equal(host.sdk.query('inventory.gear', { owner: 'ac_mara0001' }).slots.weapon.cond, 100, 'condition Good');
    const joined = receipt(host);
    assert.equal(joined.summary, 'Mara joined the party. Gear: Cane Sword, Oak Buckler, Tin Ring.');
    assert.deepEqual(joined.data.gear, { owner: 'ac_mara0001', items: GEAR });
    assert.deepEqual(receipts(host).map(entry => entry.type).filter(type => type !== 'dm.settle' && type !== 'rpg.dice'), ['capture.party'], 'no receipt of its own');
    assert.deepEqual(host.turn.problems().filter(item => !['ROLLS_SKIPPED', 'DICE_SKIPPED', 'NO_CHANGES'].includes(item.code)), []);
});

test('gear off: the same join is as it was without the field (same receipts, same state)', { skip }, async t => {
    const off = await world(t, { gear: false });
    const bare = await world(t, { gear: false, list: [person()] });
    await off.send('Mara walks in.', reply('+ party Mara | about: a ferrywoman'));
    await bare.send('Mara walks in.', reply('+ party Mara | about: a ferrywoman'));
    assert.deepEqual(rows(off), []);
    assert.equal(receipt(off).summary, 'Mara joined the party.');
    assert.equal('gear' in receipt(off).data, false);
    const strip = host => JSON.stringify(receipts(host).map(({ type, module, cause, summary, narrate, data, rev, guarded, line }) => ({ type, module, cause, summary, narrate, join: data.join, keys: Object.keys(data), rev, guarded, line })));
    assert.equal(strip(off), strip(bare), 'byte-identical receipts');
    assert.equal(bytes(off), bytes(bare));
});

test('a person whose record names no gear, or who has no record, joins exactly as before even with gear on', { skip }, async t => {
    const host = await world(t, { list: [person()] });
    await host.send('Two arrive.', reply('+ party Mara', '+ party Pip'));
    assert.deepEqual(rows(host), []);
    assert.deepEqual(receipts(host).filter(entry => entry.type === 'capture.party').map(entry => entry.summary), ['Mara joined the party.', 'Pip joined the party.']);
});

test('an alias finds the person; without a party actor nothing is given (pinned change, 3 Nov: it used to be put on in the party\'s bag)', { skip }, async t => {
    const host = await world(t, { actors: false, list: [person({ gear: GEAR }), person({ id: 'npc_tam', name: 'Tam', aliases: [], gear: ['Rusty Spear', 'Oak Buckler'] })] });
    await host.send('Both.', reply('+ party the ferrywoman', '+ party Tam'));
    const worn = Object.fromEntries(rows(host).filter(row => row.owner === 'party').map(row => [row.name, row.equipped ?? null]));
    assert.deepEqual(worn, {});
});

// (pinned change, 3 Nov, bound gear: leaving used to keep their things in the bag; now the bound pieces leave with them and come back once,
// gear-bind.test.js; and a bound piece cannot be sold or dropped meanwhile, so "the piece they no longer own" cannot happen)
test('leaving takes the bound pieces with them; coming back brings them once, worn where they were, nothing doubled', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('She goes.', reply('- party Mara'));
    assert.equal(rows(host).length, 0, 'their bound pieces left with them');
    assert.equal(receipt(host).summary, 'Mara left the party. Their bound gear leaves with them: Cane Sword, Oak Buckler, Tin Ring.');
    await host.send('She is back.', reply('+ party Mara'));
    assert.equal(rows(host).length, 3, 'nothing doubled');
    assert.deepEqual(Object.fromEntries(rows(host).map(row => [row.name, row.equipped])), { 'Cane Sword': 'weapon', 'Oak Buckler': 'off-hand', 'Tin Ring': 'accessory-1' });
    assert.equal(receipt(host).summary, 'Mara is back in the party. Gear: Cane Sword, Oak Buckler, Tin Ring.');
    assert.deepEqual(receipt(host).data.gear, { owner: 'ac_mara0001', items: GEAR });
});

test('replay equals live: a rebuild, a reload, a Re-read, a swipe and a delete', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    const live = bytes(host);
    assert.equal(rows(host).length, 3);
    host.store.rebuild();
    assert.equal(bytes(host), live, 'a rebuild equals live');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(bytes(host), live, 'a reload equals live');
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(bytes(host), live, 'a Re-read equals live');
    await host.swipe(reply('Nobody after all.', ['+ coin 1']));
    assert.deepEqual(rows(host), [], 'a swipe takes the join and its gear away together');
    assert.equal(host.head().domains.dataModules.active['pack.chat/mara'], undefined);
    await host.send('Mara again.', reply('+ party Mara'));
    assert.equal(rows(host).length, 3);
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.deepEqual(rows(host), [], 'a delete takes them away too');
    assert.deepEqual(host.store.problems(), []);
    host.store.rebuild();
    assert.deepEqual(rows(host), []);
});
