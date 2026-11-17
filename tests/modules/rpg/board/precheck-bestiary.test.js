// The foe pre-check and a pack's bestiary (`content.foes`): a listed foe, by name, alias or plural, has the pack's tier and level; an unlisted foe keeps what the model said; with no bestiary the answer is vetted as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { vetGroups } from '../../../../modules/rpg/board/precheck.js';
import { bestiaryOf } from '../../../../modules/rpg/board/precheck-known.js';
import { runPrecheck } from '../../../../modules/rpg/board/precheck-run.js';

const sheet = { characters: [{ who: 'Astra', level: 5, v1: true }], foes: [] };
const message = 'I attack the frost wolves, the ice wolf and the bandits';
const bestiary = [{ name: 'Frost Wolf', aliases: ['ice wolf'], tier: 'elite', level: 9 }, { name: 'Bandit', aliases: [], tier: 'minion' }];
const answer = [{ name: 'Frost Wolves', count: 2, level: 3, tier: 'mob' }, { name: 'Ice Wolf', count: 1, level: 2, tier: 'mob' }, { name: 'bandits', count: 2, level: 4, tier: 'boss' }];
const shape = groups => groups.map(({ name, count, tier, level }) => [name, count, tier, level]);

test('a listed foe takes the pack\'s tier and level, by name, plural or alias; a listed foe with no level keeps the model\'s level but takes the tier', () => {
    assert.deepEqual(shape(vetGroups(answer, { message, sheet, v1: true, bestiary })), [['Frost Wolves', 2, 'elite', 9], ['Ice Wolf', 1, 'elite', 9], ['bandits', 2, 'minion', 4]]);
});

test('an unlisted foe keeps the model\'s tier and level', () => {
    assert.deepEqual(shape(vetGroups(answer, { message, sheet, v1: true, bestiary: [{ name: 'Troll', tier: 'boss', level: 30 }] })), [['Frost Wolves', 2, 'mob', 3], ['Ice Wolf', 1, 'mob', 2], ['bandits', 2, 'boss', 4]]);
});

test('with no bestiary (none given, empty, or not a list) the answer is vetted exactly as it was', () => {
    const plain = vetGroups(answer, { message, sheet, v1: true });
    for (const none of [undefined, null, [], 'wolves', {}]) assert.deepEqual(vetGroups(answer, { message, sheet, v1: true, bestiary: none }), plain);
    assert.deepEqual(shape(plain), [['Frost Wolves', 2, 'mob', 3], ['Ice Wolf', 1, 'mob', 2], ['bandits', 2, 'boss', 4]]);
});

test('a tier is only added on a v1 sheet; a listed level still applies', () => {
    const got = vetGroups(answer, { message, sheet, bestiary });
    assert.equal(got.some(group => 'tier' in group), false);
    assert.deepEqual(got.map(group => group.level), [9, 9, 4]);
});

test('a person\'s own stated Level wins over a listed one; the tier is still the pack\'s', () => {
    const got = vetGroups([{ name: 'Bandit', count: 1, level: 2, tier: 'mob' }], { message: 'I attack the bandit', sheet, v1: true, bestiary: [{ name: 'Bandit', tier: 'boss', level: 40 }], stated: () => ({ level: 12 }) });
    assert.deepEqual(shape(got), [['Bandit', 1, 'boss', 12]]);
});

test('a listed level is held to the Foes bounds, not to the party\'s cap', () => {
    const got = vetGroups([{ name: 'Frost Wolf', count: 1, level: 2 }], { message: 'I attack the frost wolf', sheet, v1: true, bestiary: [{ name: 'Frost Wolf', tier: 'apex', level: 99 }] });
    assert.deepEqual(shape(got), [['Frost Wolf', 1, 'apex', 99]]);
});

test('bestiaryOf reads the packs\' foes through the query, and nothing when no query answers', () => {
    const seen = [];
    const list = bestiaryOf((name, args) => { seen.push([name, args]); return [bestiary[0], { name: 'No tier' }, null]; });
    assert.deepEqual(seen, [['packs.content', { kind: 'foes' }]]);
    assert.deepEqual(list, [bestiary[0]]);
    assert.deepEqual(bestiaryOf(null), []);
    assert.deepEqual(bestiaryOf(() => { throw new Error('no packs'); }), []);
});

test('runPrecheck reads the bestiary once and applies it; without one the groups are the model\'s', async () => {
    const run = query => runPrecheck({ callModel: async () => JSON.stringify({ groups: answer }), message, sheet, query });
    const listed = await run((name, args) => (name === 'packs.content' && args.kind === 'foes' ? bestiary : null));
    assert.deepEqual(shape(listed), [['Frost Wolves', 2, 'elite', 9], ['Ice Wolf', 1, 'elite', 9], ['bandits', 2, 'minion', 4]]);
    const none = await run(() => null);
    assert.deepEqual(shape(none), [['Frost Wolves', 2, 'mob', 3], ['Ice Wolf', 1, 'mob', 2], ['bandits', 2, 'boss', 4]]);
});
