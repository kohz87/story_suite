// Combat Rules v1 blocks as the sheet reader reads them: stats with WIS, bars as numbers, a skill's type and its rank in force (practice AND the owner's level), a foe's tier; the stance
// rule where learn lines are routed; and an earlier block is read exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../packages/story-block/testkit/index.js';
import { COMBAT_V1_TEMPLATES } from '../../../modules/rpg/templates-combat.js';
import { readSheet } from '../../../modules/rpg/read.js';
import { rankOf } from '../../../modules/rpg/combat/skills.js';
import { V1 } from '../../../modules/rpg/combat/numbers.js';
import { STANCE_TYPES } from '../../../core/runtime/skill-slots.js';
import { reply, success, rebuilt } from '../data-modules/helpers.js';

const sign = kind => (/^(practice-|set-slot)/u.test(kind) ? '+' : '~');
const line = (slug, kind, extra = '') => `${sign(kind)} dm ${slug} — why | kind: ${kind}${extra}`;
async function story(t) {
    const host = await createHost(); t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    for (const { definition } of COMBAT_V1_TEMPLATES) {
        const made = structuredClone(definition);
        if (made.slug === 'skills') delete made.state.practice1.edit;
        success(await host.sdk.command('dm.define', { definition: made }));
    }
    for (const slug of ['character', 'skills']) success(await host.sdk.command('dm.set', { module: `pack.chat/${slug}`, fields: { who: 'Ren' } }));
    return host;
}
const sheet = host => readSheet(host.head());

test('the reader gives a v1 Character numbers and WIS, its skills with the rank in force, and the Foes with their tier', async t => {
    const host = await story(t);
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { wis: 12, level: 10 } }));
    await host.send('Learn.', reply(line('skills', 'learn-1', ' | name: Slash | about: A hard cut. | stat: str | type: attack')));
    success(await host.sdk.command('dm.set', { module: 'pack.chat/skills', fields: { practice1: 300 } }));
    await host.send('Wolves.', reply(line('foes', 'set-slot-1', ' | name: Wolf | count: 3 | level: 8 | tier: elite')));
    const ren = sheet(host).characters[0];
    assert.equal(ren.v1, true);
    assert.deepEqual([ren.stats.wis, 'luk' in ren.stats, ren.level, ren.max.hp, ren.hp], [12, false, 10, 5 + 3 + 2, 10]);
    const [slash] = ren.skills;
    assert.deepEqual([slash.name, slash.stat, slash.type, slash.practice, slash.rank], ['Slash', 'str', 'attack', 300, 3], '300 practice has earned rank 3');
    // The rank in force also needs the level (combat/skills.js): Expert wants level 25.
    assert.equal(rankOf(slash.practice, ren.level).name, 'Adept', 'level 10 holds only Adept');
    success(await host.sdk.command('dm.set', { module: 'pack.chat/character', fields: { level: 25 } }));
    const grown = sheet(host).characters[0];
    assert.equal(rankOf(grown.skills[0].practice, grown.level).name, 'Expert', 'level 25 lets Expert stand');
    assert.deepEqual(sheet(host).foes.filter(foe => foe.filled).map(({ name, count, level, tier, v1 }) => ({ name, count, level, tier, v1 })), [{ name: 'Wolf', count: 3, level: 8, tier: 'elite', v1: true }]);
    rebuilt(host);
});

test('one stance skill per owner: a second stance is refused, the same stance updates, other types are free; a swipe is judged the same', async t => {
    const host = await story(t);
    const learn = (name, type) => line('skills', 'learn-1', ` | name: ${name} | about: x | stat: vit | type: ${type}`);
    const names = () => sheet(host).characters[0].skills.map(skill => skill.name);
    await host.send('Guard.', reply(learn('Brace', 'defence')));
    assert.deepEqual(names(), ['Brace']);
    await host.send('Dodge.', reply(learn('Weave', 'evasion')));
    assert.deepEqual(names(), ['Brace'], 'evasion is a second stance');
    await host.send('Hit.', reply(learn('Chop', 'attack')));
    await host.send('Heal.', reply(learn('Mend', 'heal')));
    assert.deepEqual(names(), ['Brace', 'Chop', 'Mend']);
    await host.send('Again.', reply(learn('Brace', 'defence')));
    assert.deepEqual(names(), ['Brace', 'Chop', 'Mend'], 'the same name updates the slot it holds');
    await host.send('Rename.', reply(learn('Chop', 'evasion')));
    assert.equal(sheet(host).characters[0].skills.find(skill => skill.name === 'Chop').type, 'attack', 'a learn of a held name never re-types the slot (the learn kind wants an empty one), so it cannot make a second stance');
    await host.swipe(reply(learn('Weave', 'support')));
    assert.deepEqual(names(), ['Brace', 'Chop', 'Mend'], 'support is a stance too');
    rebuilt(host);
});

test('the stance types the learn route holds to one are the combat table\'s stances', () => {
    const table = Object.entries(V1.skill.types).filter(([, entry]) => entry.kind === 'stance').map(([type]) => type);
    assert.deepEqual([...STANCE_TYPES].sort(), table.sort());
});
