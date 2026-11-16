// Gear soak in a v1 fight: a worn piece's soak is read when each segment is played (not fixed at open), so a piece worn between two replies reaches the second segment,
// and the witness takes a fight back when the gear changes after staging.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../../testkit/index.js';
import { fightKind } from '../../../../modules/rpg/board/interaction.js';
import { dice } from '../../../../core/interaction/dice.js';
import { hashJson } from '../../../../core/replay.js';
import { COMBAT_V1_TEMPLATES } from '../../../../modules/rpg/templates-combat.js';
import { equip, reply } from '../../inventory/gear-inventory.helpers.js';

const set = (host, slug, fields) => host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields });
async function world(t) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: { 'story-block.gear': true, 'story-block.rpg': true } } });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) {
        const made = structuredClone(definition);
        if (made.slug === 'skills') delete made.state.practice1.edit;
        assert.equal((await host.sdk.command('dm.define', { definition: made })).ok, true);
    }
    await set(host, 'character', { who: 'Ren' });
    await set(host, 'character', { level: 8, vit: 24 });
    await set(host, 'skills', { who: 'Ren' });
    await host.send('Foes.', reply('Rats.', ['+ dm foes — why | kind: set-slot-1 | name: Brutes | count: 4 | level: 6 | tier: standard']));
    return host;
}
// the soak % of the first foe hit that lands in the fight's lines (a foe-attack row: …, outcome, soak, damage, HP)
const soakOfHit = lines => lines.find(line => line[0] === 'foe-attack' && (line[7] === 'hit' || line[7] === 'decisive'))?.[8];
const heroId = host => fightKind.actors(host.head())[0].id;
const stepFor = (host, choice = 'normal') => ({ inputs: [{ actor: heroId(host), choice, args: { target: '1.1' } }] });
const playIn = (host, setup, steps, offset = 0) => fightKind.play(host.head(), setup, steps, dice(11, offset)).result;

test('a worn piece raises the soak the engine uses, and a piece worn between two segments reaches the second one', async t => {
    const host = await world(t);
    const open = () => fightKind.open(host.head(), { anchor: 'a', seed: 11, args: { rules: {} } }).setup;
    const bare = open(), steps = Array.from({ length: 3 }, () => stepFor(host));
    const before = soakOfHit(playIn(host, bare, steps).lines);
    assert.equal(typeof before, 'number', 'a foe hit lands in the fixture fight');
    // (the segment is staged before the armour is worn; the next segment is played after)
    const first = fightKind.settle(host.head(), bare, steps, dice(11, 0)).result;
    assert.equal(first.stop, 'open');
    await host.send('Armour.', reply('Mail.', ['+ item Iron Plate | slot: body | soak: 2']));
    await equip(host, 'Iron Plate');
    const worn = playIn(host, bare, steps).lines;
    assert.ok(soakOfHit(worn) > before, 'worn from the start: more soak than bare');
    const next = fightKind.next(structuredClone(bare), first, host.head());
    assert.equal(Object.hasOwn(next, 'soak'), false, 'no soak is stored in a setup');
    const second = playIn(host, next, steps.slice(0, 1), next.offset).lines.filter(line => line[0] === 'foe-attack' && ['hit', 'decisive'].includes(line[7]));
    assert.ok(second.length > 0, 'a foe hit lands in segment 2');
    for (const line of second) assert.ok(line[8] >= 1, `segment 2 uses the plate: ${line[8]}%`);
});

test('the witness changes with the worn gear, so a fight staged before it is taken back', async t => {
    const host = await world(t), { setup } = fightKind.open(host.head(), { anchor: 'a', seed: 11, args: { rules: {} } });
    const bare = hashJson(fightKind.witness(host.head(), setup, []));
    await host.send('Armour.', reply('Mail.', ['+ item Iron Plate | slot: body | soak: 2']));
    assert.equal(hashJson(fightKind.witness(host.head(), setup, [])), bare, 'carried, not worn: the same fight');
    await equip(host, 'Iron Plate');
    assert.notEqual(hashJson(fightKind.witness(host.head(), setup, [])), bare, 'worn: another fight');
});
