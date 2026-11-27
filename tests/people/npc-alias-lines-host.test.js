// Whose entry a story line moves, end to end, with the real adapter and lines mode on (as production runs it): another person's alias, namesakes,
// a renamed person, and a dead beside a living namesake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ID, cast, note, person } from './npc-alias-lines.helpers.js';

const ceiling = value => ({ meterSetup: { limits: { trust: { ceiling: value } } } });

test('"~ npc Bo", Bo aliased "Ana", leaves Ana alone, and "~ npc Ana" leaves Bo alone', async () => {
    const h = await cast(person('npc_bo', 'Bo', ['Ana']), person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    const ana = structuredClone(h.bonds().npc_ana);
    h.line('~ npc Bo | trust: -7');
    assert.deepEqual(h.bonds().npc_ana, ana);
    assert.equal(h.bonds().npc_bo.meters.trust, 3);
    h.line('~ npc Ana | trust: +1');
    assert.deepEqual([h.bonds().npc_ana.meters.trust, h.bonds().npc_bo.meters.trust], [16, 3]);
});

const guards = () => cast(person('npc_g1', 'Guard'), person('npc_g2', 'Guard', ['Old Tom'], { ...ceiling(12), secrets: [note('Tom', { meter: 'trust', at: 11 })] }));

test('"~ npc Old Tom" moves the Guard who has that alias, though the first Guard has the entry the shared name finds', async () => {
    const h = await guards();
    h.line('~ npc Guard | trust: +1');
    const first = structuredClone(h.bonds().npc_g1);
    h.line('~ npc Old Tom | trust: +10');
    assert.deepEqual(h.bonds().npc_g1, first, 'the first Guard is not moved');
    assert.equal(h.bonds().npc_g2.meters.trust, 12, 'held at his own ceiling');
    assert.deepEqual(h.bonds().npc_g2.unlocked, [ID], 'his own note opened');
});

test('a milestone and a taste line written by the alias go to that Guard too', async () => {
    const h = await guards();
    h.line('~ npc Guard | trust: +1');
    h.line('+ milestone Old Tom — shared a watch');
    h.line('~ taste Old Tom | likes: strong tea');
    assert.deepEqual(h.bonds().npc_g1.milestones, {});
    assert.equal(h.bonds().npc_g1.tastes, undefined);
    assert.equal(Object.keys(h.bonds().npc_g2.milestones).length, 1);
    assert.match(h.bonds().npc_g2.tastes, /strong tea/);
});

test('"~ reveal Old Tom" opens that Guard\'s note', async () => {
    const h = await cast(person('npc_g1', 'Guard'), person('npc_g2', 'Guard', ['Old Tom'], { secrets: [note('Tom')] }));
    h.line('~ npc Guard | trust: +1');
    const [result] = h.reply('He admits it: a spare oar lies under the bench.', `~ reveal Old Tom | opened: ${ID} | quote: "a spare oar lies under the bench"`).results;
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual([h.bonds().npc_g1.unlocked, h.bonds().npc_g2.unlocked], [[], [ID]]);
});

test('a renamed person who keeps the old name as an alias is still moved by it, in their own entry', async () => {
    const h = await cast(person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.change('npc_ana', { name: 'Annie', aliases: ['Ana'] });
    h.line('~ npc Ana | trust: +1');
    assert.deepEqual(Object.keys(h.bonds()), ['npc_ana']);
    assert.equal(h.bonds().npc_ana.meters.trust, 16);
});

test('once the old name is dropped, a line for it does not reach the renamed person through their entry\'s stale name', async () => {
    const h = await cast(person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.change('npc_ana', { name: 'Annie', aliases: [] });
    const before = structuredClone(h.bonds());
    const result = h.refused('~ npc Ana | trust: +1');
    assert.match(result.message, /has no record yet/);
    assert.deepEqual(h.bonds(), before);
});

test('a renamed person\'s entry keeps their own limits and notes when another dossier takes the old name', async () => {
    const h = await cast(person('npc_ana', 'Ana', [], { ...ceiling(18), secrets: [note('Annie', { meter: 'trust', at: 99 })] }));
    h.line('~ npc Ana | trust: +5');
    await h.change('npc_ana', { name: 'Annie' });
    await h.add(person('npc_new', 'Ana', [], { ...ceiling(11), secrets: [note('Newcomer', { meter: 'trust', at: 99 })] }));
    const row = h.runQuery('npc.cast').find(item => item.key === 'npc_ana');
    assert.equal(row.bars.find(bar => bar.id === 'trust').ceiling, 18);
    h.line('~ npc Annie | trust: +10');
    assert.equal(h.bonds().npc_ana.meters.trust, 18, 'her own ceiling');
    h.line('~ npc Ana | trust: +10');
    assert.equal(h.bonds().npc_new.meters.trust, 11, 'the new Ana has her own entry and ceiling');
    assert.equal(h.bonds().npc_ana.meters.trust, 18);
});

test('a renamed person\'s old-name entry never takes the setup of someone who has that name as an alias', async () => {
    const h = await cast(person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.change('npc_ana', { name: 'Annie' });
    await h.add(person('npc_bo', 'Bo', ['Ana'], { ...ceiling(11), secrets: [note('Bo', { meter: 'trust', at: 12 })] }));
    h.line('~ npc Annie | trust: +10');
    assert.equal(h.bonds().npc_ana.meters.trust, 25);
    assert.deepEqual(h.bonds().npc_ana.unlocked, []);
    assert.equal(h.runQuery('npc.cast').find(item => item.key === 'npc_ana').bars.find(bar => bar.id === 'trust').ceiling, undefined);
    assert.doesNotMatch(JSON.stringify(h.runQuery('npc.cast').find(item => item.key === 'npc_ana')), /Bo title/);
});

for (const order of ['the dead one stored first', 'the living one stored first']) {
    test(`a dead and a living "Ana", ${order}: the line and the limits are the living one's`, async () => {
        const dead = person('npc_a1', 'Ana', [], ceiling(40));
        const living = person('npc_a2', 'Ana', [], ceiling(12));
        const [first, second] = order.startsWith('the dead') ? [dead, living] : [living, dead];
        const h = await cast(first);
        await h.add(second);
        await h.die('npc_a1');
        h.line('~ npc Ana | trust: +10');
        assert.deepEqual(Object.keys(h.bonds()), ['npc_a2']);
        assert.equal(h.bonds().npc_a2.meters.trust, 12);
        const state = structuredClone(h.store.head());
        state.domains.people.bonds.npcs.npc_a1 = { name: 'Ana', meters: { trust: 20 }, stages: {}, unlocked: [], milestones: {} };
        assert.equal(h.def.queries['npc.meters'](state, { id: 'npc_a1', name: 'Ana' }, null).key, 'npc_a1');
        const row = h.def.queries['npc.cast'](state, {}, null).find(item => item.key === 'npc_a2');
        assert.equal(row.bars.find(bar => bar.id === 'trust').ceiling, 12);
    });
}

test('two present-or-absent namesakes: the present one is the one shown present', async () => {
    const h = await cast(person('npc_g1', 'Guard', [], { present: false }));
    h.line('~ npc Guard | trust: +1');
    await h.add(person('npc_g2', 'Guard'));
    assert.deepEqual(h.runQuery('npc.cast').map(item => [item.key, item.present]).sort(), [['npc_g1', false], ['npc_g2', true]]);
});

test('a reload gives the entries the lines gave live', async () => {
    const h = await guards();
    h.line('~ npc Guard | trust: +1');
    h.line('~ npc Old Tom | trust: +10');
    const live = structuredClone(h.bonds());
    h.store.rebuild();
    assert.deepEqual(h.bonds(), live);
});
