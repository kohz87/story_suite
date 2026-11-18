// R1: the pull (pack format 4, §5.3): a joining person's sheet is built from their NPC State record. Pure rules first, then the hosted join
// (swipe, swipe back, edited Re-read, middle delete, reload) and the card (Add and Edit first make the same sheet).
import test from 'node:test';
import assert from 'node:assert/strict';
import { pullOf, personOf, rankAtLevel } from '../../../modules/rpg/join-parts/from-person.js';
import { joinDefinitions } from '../../../modules/rpg/join-parts/draft.js';
import { JOIN_ADD } from '../../../modules/rpg/join.js';
import { skip, reply, world, fields, rebuilt, blocks } from './join.helpers.js';

const ANN = { id: 'npc_ann', name: 'Ann', aliases: ['the ferrywoman'], role: 'Ferry healer', level: 12,
    abilities: [{ name: 'Mend', description: 'binds a wound shut' }, { name: 'Lantern Ward', description: 'a shield of light' }, { name: 'Ferry Lore', description: 'knows every channel' }],
    keepsakes: [{ name: 'Brass key', description: 'a cellar key' }] };
const slice = record => ({ domains: { people: { npcs: record ? { [record.id]: record } : {} } } });

test('pullOf: level, best stat, one skill per ability by the keyword table, one stance; same record, same sheet', () => {
    const got = pullOf(slice(ANN), { name: 'ann', soul: 1 });
    assert.equal(got.level, 12);
    assert.equal(got.best, 'wis');
    assert.deepEqual(got.skills.map(skill => [skill.name, skill.type ?? 'attack', skill.stat]), [['Mend', 'heal', 'wis'], ['Lantern Ward', 'defence', 'vit'], ['Ferry Lore', 'utility', 'int']]);
    assert.deepEqual(got.keepsakes, ['Brass key']);
    assert.deepEqual(pullOf(slice(ANN), { name: 'the ferrywoman' }), got, 'an alias finds them; deterministic');
    assert.equal(pullOf(slice(ANN), { name: 'Ann', best: 'dex' }).best, 'dex', 'the line\'s best stat wins');
    assert.equal(pullOf(slice(ANN), { name: 'Ann', cap: 8 }).level, 8, 'held to the cap');
});

test('pullOf: the stance, the ability count, no record', () => {
    const plain = { ...ANN, abilities: [{ name: 'Rope Haul', description: 'hauls a line' }], role: 'Dockhand' };
    const one = pullOf(slice(plain), { name: 'Ann' });
    assert.equal(one.skills.length, 2);
    assert.equal(one.skills[1].type, 'defence', 'a stance is added when no ability is one');
    assert.equal(pullOf(slice(plain), { name: 'Ann', pull: { stance: false } }).skills.length, 1);
    const many = { ...ANN, abilities: Array.from({ length: 9 }, (_, n) => ({ name: `Trick ${n}`, description: 'a trick' })) };
    assert.equal(pullOf(slice(many), { name: 'Ann' }).skills.length, 5, 'default 4 abilities + the stance');
    assert.equal(pullOf(slice(many), { name: 'Ann', pull: { abilities: 6 } }).skills.length, 7);
    const none = pullOf(slice(null), { name: 'Ann', soul: 2, fallback: [{ name: 'Cast skill' }] });
    assert.deepEqual(none, { best: '', skills: [{ name: 'Cast skill' }], keepsakes: [] }, 'no record: no level, the format 3 skills');
    assert.equal(personOf(slice(ANN), 'Nobody'), null);
    assert.equal(rankAtLevel(5), 0); assert.equal(rankAtLevel(30), 2);
});

async function annWorld(mode = 'auto') {
    const host = await world({ mode });
    await host.send('Ann waits.', 'Ann waits at the dock.');
    const source = host.store.sourceAt(host.store.headIndex());
    const view = { v: 1, order: ['npc_ann'], npcs: { npc_ann: ANN }, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} };
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view })).ok, true);
    return host;
}
const sheet = host => JSON.stringify([fields(host, 'ann'), fields(host, 'ann-skills')]);

test('a join builds the sheet from the record, and replays as live: swipe, swipe back, edited Re-read, middle delete, reload', { skip }, async t => {
    const host = await annWorld();
    t.after(() => host.close());
    await host.send('Ann comes.', reply('+ party Ann'));
    const at = host.ctx.chat.length - 1;
    assert.equal(fields(host, 'ann').level, 12);
    assert.deepEqual([1, 2, 3, 4].map(n => fields(host, 'ann-skills')[`skill${n}`]), ['Mend', 'Lantern Ward', 'Ferry Lore', '']);
    await rebuilt(host, 'after the join');
    const joined = sheet(host);
    await host.swipe('Nobody comes.');
    assert.equal(fields(host, 'ann'), undefined, 'a swipe takes the sheet');
    await rebuilt(host, 'after the swipe');
    await host.swipe(reply('+ party Ann'));
    assert.equal(sheet(host), joined, 'a swipe back gives the same sheet');
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.equal(sheet(host), joined, 'a Re-read gives the same sheet');
    await rebuilt(host, 'after the Re-read');
    await host.st.editMessage?.(at, reply('+ party Ann | best: dex'));
    assert.equal((await host.turn.reread(at)).ok, true);
    assert.ok(fields(host, 'ann').dex > fields(host, 'ann').str, 'an edited Re-read: the line\'s best stat wins');
    await rebuilt(host, 'after the edited Re-read');
    await host.st.deleteMessage(at - 1);
    await rebuilt(host, 'after deleting the reply that held their record');
    assert.equal(fields(host, 'ann').level, 12, 'the join pinned its own sheet: deleting the record\'s reply leaves it as made');
});

test('the Ask card: Add and Edit first make the same sheet, and the card says the record\'s level', { skip }, async t => {
    const host = await annWorld('ask');
    t.after(() => host.close());
    const page = host.sdk.query('rpg.partyAdd', { name: 'Ann' });
    assert.match(JSON.stringify(page.card.rows), /12/);
    const payload = page.card.actions[1].payload;
    assert.equal(payload.level, 12);
    assert.equal(payload.skills.length, 3, '3 abilities, one already a stance');
    const added = await host.sdk.command(JOIN_ADD, page.card.actions[0].payload, { cause: 'ui' });
    assert.equal(added.ok, true, added.message);
    const edit = joinDefinitions(payload, { used: [], soul: payload.soul, cap: null });
    const made = fields(host, 'ann'), draft = edit.character.state;
    assert.equal(made.level, draft.level.default);
    for (const stat of ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']) assert.equal(made[stat], draft[stat].default, stat);
    assert.deepEqual([1, 2, 3, 4].map(n => fields(host, 'ann-skills')[`skill${n}`]), [1, 2, 3, 4].map(n => edit.skills.state[`skill${n}`]?.default));
});

test('a keepsake that names pack equipment is gear; the rest is prose only', async () => {
    const { keepsakeGearOf } = await import('../../../packs/cast-gear.js');
    const packs = [{ content: { items: [{ id: 'pack.x/cane', name: 'Cane Sword', aliases: ['cane'], kind: 'equipment', slot: 'weapon' }, { id: 'pack.x/key', name: 'Brass key', kind: 'misc' }] } }];
    const got = keepsakeGearOf(packs, ['Brass key', 'the Cane', 'Cane Sword', 'Locket']);
    assert.deepEqual(got.map(item => item.id), ['pack.x/cane'], 'the alias finds the equipment; the misc item and the unknown name are prose');
    assert.equal(keepsakeGearOf(packs, ['Brass key', 'Locket']).length, 0);
    assert.equal(keepsakeGearOf(packs, ['cane', 'Cane Sword']).length, 1, 'one piece once');
});

test('a foe named like a person has the built-in Level; a custom Level still reads when there is none', async () => {
    const { statedLevel } = await import('../../../modules/rpg/board/stated-level.js');
    const ask = dossier => (name) => (name === 'npc.known' ? ['Vorn'] : name === 'npc.dossier' ? dossier : null);
    assert.deepEqual(statedLevel(ask({ name: 'Vorn', level: 31, customFields: { Level: '5' } }), 'Vorn'), { level: 31 });
    assert.deepEqual(statedLevel(ask({ name: 'Vorn', customFields: { Level: 'Lv 7' } }), 'Vorn'), { level: 7 });
    assert.equal(statedLevel(ask({ name: 'Vorn' }), 'Vorn'), null);
});
