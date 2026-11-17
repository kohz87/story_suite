// Pack format 3: the `format` number, `requires.suite` (storyBlock still read), the v1 skill words, the formula word, the kinds nothing reads, the foe bestiary and Ersveil 3.0.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack, SUITE_VERSION, HOST_VERSION } from '../../packs/validate.js';
import { contentOf } from '../../packs/content.js';
import { castSkillsOf } from '../../packs/cast-skills.js';
import { FOE_TIERS, SKILL_TYPES_V1, SKILL_RANKS_V1, PACK_FORMAT, LEAN_RPG_LIMITS, CAST_SKILL_STATS } from '../../packs/limits.js';
import { TIERS, RANKS, V1 } from '../../modules/rpg/combat/numbers.js';
import { STATS_V1 } from '../../modules/rpg/names-parts/stats.js';
import { pack } from './helpers/fixtures.js';
import { refused } from './validate.helpers.js';

const suitePack = extra => ({ id: 'mini', format: 3, version: '3.0.0', requires: { suite: '^0.1' }, content: {}, ...extra });
const ok = input => { const result = validatePack(input); assert.equal(result.ok, true, JSON.stringify(result.errors)); return result; };
const person = skills => ({ id: 'ana', name: 'Ana', about: 'A guard.', look: 'Tall.', start: { place: 'Gate', goal: 'Hold it.' }, skills });
const skill = extra => ({ name: 'Cleave', about: 'A wide cut.', stat: 'str', ...extra });

test('the words packs write are pinned to the ones Combat Rules v1 has', () => {
    assert.deepEqual([...FOE_TIERS], Object.keys(TIERS));
    assert.deepEqual([...SKILL_TYPES_V1], Object.keys(V1.skill.types));
    assert.deepEqual([...SKILL_RANKS_V1], RANKS.map(rank => rank.name.toLowerCase()));
    assert.deepEqual(CAST_SKILL_STATS.filter(stat => stat !== 'luk'), [...STATS_V1].sort((a, b) => CAST_SKILL_STATS.indexOf(a) - CAST_SKILL_STATS.indexOf(b)));
    assert.equal(PACK_FORMAT, 3);
});

test('SUITE_VERSION is the package version, and the older host number stays as it was', () => {
    assert.equal(SUITE_VERSION, JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
    assert.equal(HOST_VERSION, '2.33.0');
});

test('format: left out it is format 2 and the normalized pack has no key (older packs keep their bytes and hashes), 3 is read, a newer one is refused, a bad one is a plain error', () => {
    assert.equal('format' in ok(pack()).pack, false);
    assert.equal(ok(suitePack()).pack.format, 3);
    const newer = refused(suitePack({ format: 4 }), 'FORMAT_NEWER');
    assert.match(newer.errors[0].message, /format 4.*up to 3/);
    for (const bad of [0, 2.5, '3', null, -1]) refused(suitePack({ format: bad }), 'BAD_FIELD');
    assert.equal(ok(suitePack({ format: 1 })).pack.format, 1);
});

test('requires.suite is checked against the suite version; storyBlock is read too, by the older host number or the suite version', () => {
    assert.deepEqual(ok(suitePack()).pack.requires, { suite: '^0.1', capabilities: [] });
    refused(suitePack({ requires: { suite: '^0.2' } }), 'HOST_VERSION');
    refused(suitePack({ requires: { suite: '^2' } }), 'HOST_VERSION', 'the older host number is not the suite version');
    assert.equal(validatePack(suitePack({ requires: { suite: '^0.1' } }), { suiteVersion: '0.1.7' }).ok, true);
    assert.equal(validatePack(suitePack({ requires: { suite: '^0.1' } }), { suiteVersion: '0.2.0' }).ok, false);
    // a pack of the earlier kind keeps loading, and keeps its own word in the normalized pack
    assert.deepEqual(ok(pack({ requires: { storyBlock: '^2' } })).pack.requires, { storyBlock: '^2', capabilities: [] });
    refused(pack({ requires: { storyBlock: '^9' } }), 'HOST_VERSION');
    assert.deepEqual(ok(pack({ requires: { storyBlock: '^0.1' } })).pack.requires, { storyBlock: '^0.1', capabilities: [] }, 'an alias for the suite version');
    refused(suitePack({ requires: { suite: '^0.1', storyBlock: '^2' } }), 'BAD_REQUIRES');
    refused(suitePack({ requires: {} }), 'BAD_REQUIRES');
    refused(suitePack({ requires: { suite: 5 } }), 'BAD_REQUIRES');
    refused(suitePack({ requires: { suite: '^0.1', other: 1 } }), 'UNKNOWN_FIELD');
});

test('cast skills: the eight types, the seven ranks, sp or mp; combat is attack, LUK is WIS', () => {
    for (const type of SKILL_TYPES_V1) assert.equal(ok(suitePack({ content: { cast: [person([skill({ type })])] } })).pack.content.cast[0].skills[0].type, type);
    for (const rank of SKILL_RANKS_V1) assert.equal(ok(suitePack({ content: { cast: [person([skill({ rank })])] } })).pack.content.cast[0].skills[0].rank, rank);
    const read = extra => ok(suitePack({ content: { cast: [person([skill(extra)])] } })).pack.content.cast[0].skills[0];
    assert.equal(read({ type: 'combat' }).type, 'attack');
    assert.equal(read({}).type, undefined, 'no type: the reader takes attack');
    assert.deepEqual([read({ uses: 'sp' }).uses, read({ uses: 'mp' }).uses, read({ uses: 'stamina' }).uses, read({ uses: 'mana' }).uses, read({}).uses], ['sp', 'mp', 'sp', 'mp', 'sp']);
    assert.equal(read({ stat: 'luk' }).stat, 'wis');
    assert.equal(read({ stat: 'wis' }).stat, 'wis');
    const bad = extra => refused(suitePack({ content: { cast: [person([skill(extra)])] } }), 'BAD_RECORD');
    bad({ type: 'physical' }); bad({ type: 'Attack' }); bad({ rank: 'grand' }); bad({ uses: 'rage' });
});

test('castSkillsOf hands the rest of the suite the words it reads: stamina or mana, rank 0 to 6, a type key only for a skill that is not a plain attack', () => {
    const made = ok(suitePack({ content: { cast: [person([skill({ rank: 'legend', uses: 'sp' }), skill({ name: 'Mend', stat: 'wis', type: 'heal', uses: 'mp', rank: 'apprentice' }), skill({ name: 'Talk', type: 'attack' })])] } })).pack;
    assert.deepEqual(castSkillsOf([made], 'Ana').skills, [
        { name: 'Cleave', about: 'A wide cut.', stat: 'str', uses: 'stamina', rank: 6 },
        { name: 'Mend', about: 'A wide cut.', stat: 'wis', uses: 'mana', rank: 1, type: 'heal' },
        { name: 'Talk', about: 'A wide cut.', stat: 'str', uses: 'stamina', rank: 0 },
    ]);
});

test('rpg.skillSets: sp or mp and a v1 type; rpg.formula is "v1" ("standard" is the older word, "classic" is refused); rpg.numbers is said and left out', () => {
    const set = extra => suitePack({ content: { rpg: { skillSets: [{ name: 'Recruit', skills: [{ name: 'Spear', about: 'A spear.', stat: 'str', ...extra }] }], ...extra.rpg } } });
    const skills = result => result.pack.content.rpg[0].skills[0];
    assert.deepEqual([skills(ok(set({}))).uses, skills(ok(set({}))).type], ['sp', 'attack']);
    assert.deepEqual([skills(ok(set({ uses: 'mana', type: 'area' }))).uses, skills(ok(set({ uses: 'mana', type: 'area' }))).type], ['mp', 'area']);
    refused(set({ type: 'physical' }), 'BAD_RECORD');
    assert.ok(LEAN_RPG_LIMITS.types.includes('utility'));
    const formula = word => ok(suitePack({ content: { rpg: { formula: word } } })).pack.content.rpg.find(record => record.slug === 'formula').formula;
    assert.deepEqual([formula('v1'), formula('standard')], ['v1', 'v1']);
    refused(suitePack({ content: { rpg: { formula: 'classic' } } }), 'BAD_CONTENT');
    refused(suitePack({ content: { rpg: { formula: 'other' } } }), 'BAD_CONTENT');
    const tuned = validatePack(suitePack({ content: { rpg: { formula: 'v1', numbers: { foeBase: 99, nonsense: 'x' } } } }));
    assert.equal(tuned.ok, true, 'a pack that tunes numbers still loads');
    assert.deepEqual(tuned.warnings.map(warning => [warning.code, warning.path]), [['IGNORED_FIELD', 'content.rpg.numbers']]);
    assert.deepEqual(tuned.pack.content.rpg, [{ id: 'mini/formula', slug: 'formula', pack: 'mini', formula: 'v1' }], 'no numbers kept');
});

test('the kinds nothing reads are accepted with one warning each and left out; layouts and screens too', () => {
    const made = validatePack(suitePack({ layouts: [{ id: 'a' }], screens: [{ id: 'b', template: 'x' }], content: { quests: [{ name: 'Q' }], shops: 5, crafts: 'nope' } }));
    assert.equal(made.ok, true, JSON.stringify(made.errors));
    assert.deepEqual(made.warnings.map(warning => warning.path).sort(), ['content.crafts', 'content.quests', 'content.shops', 'layouts', 'screens']);
    assert.deepEqual(Object.keys(made.pack.content), ['items', 'events']);
    assert.deepEqual([made.pack.layouts, made.pack.screens], [[], []]);
    refused(suitePack({ content: { spells: [] } }), 'UNKNOWN_KIND');
});

test('content.foes: name, aliases, tier, level, about, tags; the tier is needed and one of the six', () => {
    const made = ok(suitePack({ content: { foes: [{ name: 'Frost Wolf', aliases: ['ice wolf'], tier: 'Elite', level: 7, about: 'A pack hunter.', tags: ['beast', 'beast'] }, { name: 'Cave Rat', tier: 'mob' }] } }));
    assert.deepEqual(made.pack.content.foes[0], { name: 'Frost Wolf', aliases: ['ice wolf'], tier: 'elite', level: 7, about: 'A pack hunter.', tags: ['beast'], id: 'pack.mini/frost-wolf', slug: 'frost-wolf', pack: 'mini' });
    assert.deepEqual(made.pack.content.foes[1], { name: 'Cave Rat', aliases: [], tier: 'mob', about: '', tags: [], id: 'pack.mini/cave-rat', slug: 'cave-rat', pack: 'mini' });
    assert.deepEqual(contentOf([made.pack], 'foes').map(foe => foe.name), ['Frost Wolf', 'Cave Rat']);
    const bad = extra => refused(suitePack({ content: { foes: [{ name: 'Wolf', tier: 'elite', ...extra }] } }), extra.slug === undefined && extra.extra === undefined ? 'BAD_RECORD' : 'UNKNOWN_FIELD');
    bad({ tier: 'weak' }); refused(suitePack({ content: { foes: [{ name: 'Wolf' }] } }), 'BAD_RECORD'); bad({ level: 0 }); bad({ level: 100 }); bad({ level: 2.5 }); bad({ about: 'x'.repeat(241) }); bad({ aliases: 'wolf' }); bad({ tags: [''] }); bad({ extra: 1 });
    refused(suitePack({ content: { foes: [{ name: 'Wolf', tier: 'mob' }, { name: 'wolf', tier: 'elite' }] } }), 'DUPLICATE');
});

test('Ersveil is format 3, version 3.0.0, with an explicit v1 type and a pool word on every cast and skill-set skill, and no LUK on its gear', () => {
    const raw = JSON.parse(readFileSync(new URL('../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8'));
    assert.deepEqual([raw.format, raw.version, raw.requires.suite, raw.requires.storyBlock], [3, '3.0.0', '^0.1', undefined]);
    const skills = [...raw.content.cast.flatMap(entry => entry.skills), ...raw.content.rpg.skillSets.flatMap(set => set.skills)];
    assert.equal(skills.length, 29);
    for (const entry of skills) assert.ok(SKILL_TYPES_V1.includes(entry.type), `${entry.name}: ${entry.type}`);
    for (const entry of raw.content.cast.flatMap(each => each.skills)) assert.ok(['sp', 'mp'].includes(entry.uses), entry.name);
    assert.equal(raw.content.rpg.formula, 'v1');
    assert.equal(raw.content.items.some(item => Object.keys(item.stats ?? {}).includes('LUK')), false);
    const result = validatePack(JSON.stringify(raw), { capabilities: ['scene', 'inventory', 'data-modules-v1', 'chronicle-lasting'] });
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.warnings, undefined, 'nothing ignored');
    for (const name of ['ersveil-factions', 'ersveil-survival']) {
        const add = JSON.parse(readFileSync(new URL(`../../examples/packs/${name}/pack.json`, import.meta.url), 'utf8'));
        assert.deepEqual([add.format, add.requires.suite, add.requires.storyBlock], [3, '^0.1', undefined], name);
        assert.equal(add.requires.capabilities.includes('story-director'), false, `${name}: story-director is not a capability any more`);
    }
});
