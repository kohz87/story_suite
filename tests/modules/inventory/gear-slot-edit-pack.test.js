// The slot-only Edit on a pack's gear: replay equals live, and a cast member's signature piece is never moved.
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
    { name: 'Tin Ring', kind: 'equipment', slot: 'accessory', rarity: 'common' },
    { name: 'Rusty Spear', kind: 'equipment', slot: 'weapon', rarity: 'common' },
    { name: 'Iron Guild Tag', kind: 'equipment', slot: 'accessory', rarity: 'rare' },
    { name: 'Blank Token', kind: 'equipment', rarity: 'rare' },
];
const MARA = { id: 'npc_mara', name: 'Mara', aliases: [], gear: ['Cane Sword', 'Oak Buckler', 'Tin Ring'] };
const ACTORS = { id: 'zz-party', version: '0.0.0', queries: { 'party.actors': () => [{ id: 'ac_mara0001', name: 'Mara' }, { id: 'ac_wessel01', name: 'Wessel' }] } };
const BOUND = /^Bound to Mara: .+ stays with them\.$/;

async function world(t, { gear = true } = {}) {
    t.mock.method(console, 'warn', () => {});
    const raw = pack({ content: { items: ITEMS } });
    const built = validatePack(raw);
    assert.equal(built.ok, true, JSON.stringify(built.errors));
    const host = await createHost({
        modules: [ACTORS],
        settings: { features: gear ? { 'story-block.gear': true, 'story-block.rpg': true } : { 'story-block.rpg': true }, modules: { 'story-block': { rpgJoin: 'auto', rpgFormula: 'classic' } },
            packs: [{ id: built.pack.id, version: built.pack.version, enabled: true, kind: raw.kind, source: 'file', origin: 'test', pack: raw }], selected: { [raw.kind]: raw.id } },
    });
    t.after(() => host.close());
    host.packId = built.pack.id;
    await host.send('Begin.', 'Opening.');
    await writeKeepsakes(host, [MARA]);
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = 'wessel'; defs.character.name = 'Wessel'; defs.character.state.who.default = 'Wessel';
    defs.skills.slug = 'wessel-skills'; defs.skills.name = 'Wessel skills'; defs.skills.state.who.default = 'Wessel';
    for (const definition of [defs.character, defs.skills]) assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    return host;
}
const row = (host, name) => host.sdk.query('inventory.items').find(item => item.name === name && !item.bound);
const inv = host => host.head().domains.inventory;
const defNamed = (host, name) => Object.values(inv(host).defs).find(def => def.name === name);

test('a pack piece takes the reader\'s slot, keeps it past later lines, and a rebuild says the same; its rarity is the pack\'s', { skip }, async t => {
    const host = await world(t);
    await host.send('Loot.', reply('+ item Rusty Spear'));
    const stack = row(host, 'Rusty Spear').stack;
    assert.ok(defNamed(host, 'Rusty Spear').id.startsWith('pack.'));
    const refused = await host.sdk.command('inventory.edit', { stack, rarity: 'rare' });
    assert.equal(refused.ok, false);
    assert.match(refused.message, /come from the pack/);
    const out = await host.sdk.command('inventory.edit', { stack, slot: 'off-hand' });
    assert.equal(out.ok, true, out.message);
    await host.send('More.', reply('+ item Rusty Spear'));
    assert.equal(defNamed(host, 'Rusty Spear').slot, 'off-hand');
    const live = JSON.stringify(inv(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(inv(host)), live);
});

test('a cast member\'s piece keeps its slot, and a loose piece of that item cannot move it', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('Loot.', reply('+ item Cane Sword'));
    const pieces = Object.values(inv(host).stacks).filter(item => item.def === defNamed(host, 'Cane Sword').id);
    assert.deepEqual(pieces.map(item => typeof item.bound === 'string').sort(), [false, true]);
    const rows = host.sdk.query('gear.view', {}).rows;
    for (const piece of pieces) {
        assert.equal(rows[piece.id].slotEdit, undefined);
        const out = await host.sdk.command('inventory.edit', { stack: piece.id, slot: 'head' });
        assert.equal(out.ok, false);
        assert.match(out.message, BOUND);
    }
    assert.equal(defNamed(host, 'Cane Sword').slot, 'weapon');
});

test('a pack piece saves a new slot and a new name together, the same on a rebuild and a Re-read', { skip }, async t => {
    const host = await world(t);
    await host.send('Loot.', reply('+ item Rusty Spear'));
    const loot = host.ctx.chat.length - 1;
    const out = await host.sdk.command('inventory.edit', { stack: row(host, 'Rusty Spear').stack, slot: 'off-hand', name: 'Old Pike' });
    assert.equal(out.ok, true, out.message);
    assert.equal(defNamed(host, 'Old Pike').slot, 'off-hand');
    await host.send('More.', reply('+ coin 2'));
    const live = JSON.stringify(inv(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(inv(host)), live);
    const read = await host.turn.reread(loot);
    assert.equal(read.ok, true, read.message);
    assert.equal(JSON.stringify(inv(host)), live);
    assert.deepEqual(host.store.problems(), []);
});

test('a pack piece that lists no stats keeps its bonus through another slot, none and back', { skip }, async t => {
    const host = await world(t);
    await host.send('Loot.', reply('+ item Iron Guild Tag'));
    const stack = row(host, 'Iron Guild Tag').stack;
    const shown = () => host.sdk.query('gear.view', {}).rows[stack].bonus;
    assert.equal(shown(), '+3 CHA');
    for (const slot of ['head', '', 'feet', 'accessory']) {
        const out = await host.sdk.command('inventory.edit', { stack, slot });
        assert.equal(out.ok, true, out.message);
        assert.equal(shown(), slot ? '+3 CHA' : '', slot);
    }
    const live = JSON.stringify(inv(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(inv(host)), live);
});

test('a pack piece with no slot and no bonus takes a slot and still gives none, with no points to place', { skip }, async t => {
    const host = await world(t);
    await host.send('Loot.', reply('+ item Blank Token'));
    const stack = row(host, 'Blank Token').stack;
    assert.equal(defNamed(host, 'Blank Token').slot, null);
    const out = await host.sdk.command('inventory.edit', { stack, slot: 'accessory' });
    assert.equal(out.ok, true, out.message);
    const shown = host.sdk.query('gear.view', {}).rows[stack];
    assert.deepEqual([shown.bonus, shown.repoint], ['', undefined]);
    assert.equal((await host.sdk.command('inventory.edit', { stack, group: true, stats: { STR: 3 } })).ok, false);
    const live = JSON.stringify(inv(host));
    host.store.rebuild();
    assert.equal(JSON.stringify(inv(host)), live);
});

test('a signature piece set aside while its member is away still blocks the slot Edit, so she wears it where she did when she comes back', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    await host.send('Loot.', reply('+ item Cane Sword'));
    await host.send('Mara goes.', reply('- party Mara'));
    const sword = defNamed(host, 'Cane Sword');
    const loose = Object.values(inv(host).stacks).find(stack => stack.def === sword.id && !stack.bound);
    const out = await host.sdk.command('inventory.edit', { stack: loose.id, slot: 'head' });
    assert.equal(out.ok, false);
    assert.match(out.message, BOUND);
    assert.equal(defNamed(host, 'Cane Sword').slot, 'weapon');
    const view = host.sdk.query('gear.view', {});
    assert.notEqual(view.rows[loose.id]?.slotEdit, true, 'the Edit offers no Slot while she is away');
    await host.send('Mara returns.', reply('+ party Mara'));
    assert.deepEqual(host.store.problems(), []);
});
