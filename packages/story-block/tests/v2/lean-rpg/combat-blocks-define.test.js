// Combat Rules v1 blocks (Character, Skills, Foes, Combat rules): the block checker takes each definition, and the numbers its rules work out are combat/bars.js's and combat/foes.js's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { COMBAT_V1_TEMPLATES, STATS_V1 } from '../../../src/v2/lean-rpg/templates-combat.js';
import { STANDARD_TEMPLATES } from '../../../src/v2/lean-rpg/templates.js';
import { barsOf } from '../../../src/v2/lean-rpg/combat/bars.js';
import { success } from '../data-modules/helpers.js';

const characterV1 = COMBAT_V1_TEMPLATES[0].definition;
test('the checker takes all four v1 definitions, and each says its own role', async t => {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { name, definition } of COMBAT_V1_TEMPLATES) success(await host.sdk.command('dm.define', { definition: structuredClone(definition) }), name);
    for (const slug of ['character', 'skills', 'foes', 'combat-rules']) assert.ok(host.sdk.query('dataModules.view', { module: `pack.chat/${slug}` }).chat, slug);
});

test('the block prompts fit the checker prompt cap and say what the v1 rules changed', () => {
    for (const { definition } of COMBAT_V1_TEMPLATES) assert.ok(definition.prompt.length <= 1200, definition.slug);
    const [character, skills, foes, rules] = COMBAT_V1_TEMPLATES.map(entry => entry.definition.prompt);
    assert.match(rules, /Code moves HP, MP and SP/u); assert.doesNotMatch(rules, /\d/u, 'the rules text holds no number');
    assert.match(character, /1 to 30/u); assert.match(character, /WIS/u); assert.doesNotMatch(character, /LUK|1 to 20/u);
    assert.match(skills, /Legend/u); assert.match(skills, /one stance/iu);
    assert.match(foes, /tier/u); assert.doesNotMatch(foes, /yield/iu);
});

test('the chooser still offers the earlier templates: nothing v1 reaches a chat until the switch', () => {
    const slugs = STANDARD_TEMPLATES.map(entry => entry.definition.slug);
    assert.ok(slugs.includes('character'));
    assert.notEqual(STANDARD_TEMPLATES[0].definition, characterV1);
    assert.ok(STANDARD_TEMPLATES[0].definition.state.luk, 'still the LUK character');
    assert.equal(STATS_V1.includes('luk'), false);
    assert.equal(STATS_V1.includes('wis'), true);
});

test('a stat sweep (each stat its own value): the largest HP, MP and SP the Character rules work out are combat/bars.js barsOf at every level', async t => {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    success(await host.sdk.command('dm.define', { definition: structuredClone(characterV1) }));
    const sheet = () => host.sdk.query('dataModules.view', { module: 'pack.chat/character' }).chat;
    // Every row gives each stat its own value, so a wrong stat in a formula (STR for VIT, CHA for WIS...) changes the answer.
    const grid = [[{ str: 7, vit: 13, agi: 22, dex: 9, int: 17, wis: 26, cha: 5 }, 1], [{ str: 26, vit: 5, agi: 9, dex: 30, int: 7, wis: 13, cha: 22 }, 15],
        [{ str: 5, vit: 30, agi: 17, dex: 6, int: 26, wis: 8, cha: 11 }, 30], [{ str: 30, vit: 22, agi: 5, dex: 13, int: 9, wis: 30, cha: 7 }, 99],
        [{ str: 13, vit: 9, agi: 30, dex: 22, int: 5, wis: 17, cha: 26 }, 50], [{ str: 17, vit: 7, agi: 26, dex: 5, int: 30, wis: 6, cha: 9 }, 33]];
    for (const [stats, level] of grid) {
        success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { ...stats, level } }));
        const want = barsOf(stats, level);
        const got = sheet();
        assert.deepEqual([got['hp-max'], got['mp-max'], got['sp-max']], [want.hp, want.mp, want.sp], `${JSON.stringify(stats)} level ${level}`);
    }
});
