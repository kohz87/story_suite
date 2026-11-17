// `rpg.sheet` (one row per party member) and `party.terms`: read from a Combat Rules v1 sheet through the real sdk; null with the RPG off; follows the state a command writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { v1Blocks, HERO_ID } from './board/v1.helpers.js';
import { setup } from './helpers.js';
import { actorIdOf } from '../../../modules/rpg/roster.js';
import { sheetSkills } from '../../../modules/rpg/sheet-skills.js';

const MEMBER_SKILL = { glyph: 'atk', name: 'Cut', kind: 'attack', stat: 'STR', resource: 'stamina', cost: 1, rank: 'Apprentice', mastery: 2 };

async function world(options = {}, extra = {}) {
    const blocks = v1Blocks({ hero: { points: 2, xp: 30, level: 5, vit: 12, ...options } });
    return setup({ blocks, planner: false, ...extra });
}

test('rpg.sheet answers the member with level, line, bars, xp, points, soak, WIS stats and skills', async t => {
    const { host } = await world();
    t.after(() => host.close());
    const [astra, ...rest] = host.sdk.query('rpg.sheet');
    assert.equal(rest.length, 0);
    assert.deepEqual([astra.id, astra.name, astra.level, astra.line, astra.className], [HERO_ID, 'Astra', 5, 'Lv 5', null]);
    assert.deepEqual(astra.bars, [{ kind: 'hp', value: 30, max: 30 }, { kind: 'mp', value: 12, max: 12 }, { kind: 'sp', value: 12, max: 12 }]);
    assert.deepEqual([astra.xpPct, astra.points, astra.soakPct, astra.away, astra.effects], [30, 2, 12, null, []]);
    assert.deepEqual(astra.stats, { STR: 14, VIT: 12, AGI: 10, DEX: 10, INT: 8, WIS: 8, CHA: 5 });
    assert.deepEqual(astra.skills, [MEMBER_SKILL]);
});

test('party.terms answers the level word with the RPG on', async t => {
    const { host } = await world();
    t.after(() => host.close());
    assert.deepEqual(host.sdk.query('party.terms'), { levelName: 'Lv' });
});

test('with the RPG off both answer null, as before', async t => {
    const { host } = await world({}, { feature: false });
    t.after(() => host.close());
    assert.equal(host.sdk.query('rpg.sheet'), null);
    assert.equal(host.sdk.query('party.terms'), null);
});

test('the sheet follows the story state: a command that spends the points and lowers the HP shows at once', async t => {
    const { host } = await world();
    t.after(() => host.close());
    await host.send('Go.', 'Reply.');
    await host.sdk.command('test.set', { slug: 'character', field: 'points', value: 0 });
    await host.sdk.command('test.set', { slug: 'character', field: 'hp', value: 7 });
    const [astra] = host.sdk.query('rpg.sheet');
    assert.deepEqual([astra.points, astra.bars[0].value], [0, 7]);
});

test('sheetSkills maps types, pools and ranks of the v1 tables; the rank needs the level too', () => {
    const rows = [{ name: 'Bolt', stat: 'int', type: 'attack', practice: 0 }, { name: 'Mend', stat: 'wis', type: 'heal', practice: 250 }, { name: 'Guard', stat: 'vit', type: 'defence', practice: 100 },
        { name: 'Sweep', stat: 'str', type: 'area', practice: 600 }, { name: 'Lore', stat: 'int', type: 'utility', practice: 0 }];
    const out = sheetSkills(rows, 5);
    assert.deepEqual(out.map(row => [row.name, row.kind, row.resource, row.cost, row.rank, row.mastery]), [['Bolt', 'magic', 'mana', 1, 'Novice', 1], ['Mend', 'heal', 'mana', 2, 'Apprentice', 2],
        ['Guard', 'stance', 'stamina', 1, 'Apprentice', 2], ['Sweep', 'area', 'stamina', 2, 'Apprentice', 2], ['Lore', 'magic', 'stamina', 0, 'Novice', 1]]);
    assert.equal(out[4].line, 'Utility · INT · story only');
    assert.equal(sheetSkills(rows.slice(3, 4), 99)[0].rank, 'Legend');
    assert.deepEqual(sheetSkills(null, 1), []);
});

test('the shared party bag soaks for the member the fight gives it to (first v1 Character by block id), not the first pinned', async t => {
    const base = v1Blocks({ hero: { vit: 10 } }).character;
    const named = who => ({ ...base, fields: { ...base.fields, who } });
    // pinned zed first, amy second: the sheet (and the fight) read amy first
    const gear = { 'inventory.gear': (_state, args) => ({ soak: { pieces: args.owner === 'party' ? [{ name: 'Shared mantle', soak: 5 }] : [] } }) };
    const { host } = await setup({ blocks: { zed: named('Zed'), amy: named('Amy') }, planner: false, queries: gear });
    t.after(() => host.close());
    const rows = Object.fromEntries(host.sdk.query('rpg.sheet').map(row => [row.name, row]));
    assert.deepEqual([rows.Zed.soakPct, rows.Amy.soakPct], [10, 15]);
    assert.equal(rows.Amy.id, actorIdOf('pack.chat/amy'));
});

test('replay: a change on a reply goes with the reply (swipe takes it away), stays through the next reply, and the sheet keeps no copy of its own', async t => {
    const { host } = await world();
    t.after(() => host.close());
    const points = () => host.sdk.query('rpg.sheet')[0].points;
    await host.send('Go.', 'Reply one.');
    await host.sdk.command('test.set', { slug: 'character', field: 'points', value: 0 });
    assert.equal(points(), 0);
    await host.swipe('Reply one, again.');
    assert.equal(points(), 2, 'the swipe took the change away with its reply');
    await host.sdk.command('test.set', { slug: 'character', field: 'points', value: 1 });
    await host.send('Next.', 'Reply two.');
    assert.equal(points(), 1, 'a later reply replays it');
    await host.swipe('Reply two, again.');
    assert.equal(points(), 1, 'a swipe of the later reply leaves the earlier change');
});
