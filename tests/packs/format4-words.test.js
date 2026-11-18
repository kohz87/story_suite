// Pack words pinned to Combat Rules v1, the suite version, the foe bestiary in a world pack and the game pack's rpg formula word (the format 3 cases whose subject stayed in format 4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack, SUITE_VERSION, HOST_VERSION } from '../../packs/validate.js';
import { contentOf } from '../../packs/content.js';
import { FOE_TIERS, SKILL_TYPES_V1, SKILL_RANKS_V1, PACK_FORMAT, CAST_SKILL_STATS } from '../../packs/limits.js';
import { TIERS, RANKS, V1 } from '../../modules/rpg/combat/numbers.js';
import { STATS_V1 } from '../../modules/rpg/names-parts/stats.js';
import { pack } from './helpers/fixtures.js';
import { refused } from './validate.helpers.js';

const game = content => ({ id: 'mini-game', format: 4, kind: 'game', version: '1.0.0', requires: { suite: '^0.1' }, content });
const ok = input => { const result = validatePack(input); assert.equal(result.ok, true, JSON.stringify(result.errors)); return result; };
const foes = list => pack({ content: { foes: list } });

test('the words packs write are pinned to the ones Combat Rules v1 has', () => {
    assert.deepEqual([...FOE_TIERS], Object.keys(TIERS));
    assert.deepEqual([...SKILL_TYPES_V1], Object.keys(V1.skill.types));
    assert.deepEqual([...SKILL_RANKS_V1], RANKS.map(rank => rank.name.toLowerCase()));
    assert.deepEqual(CAST_SKILL_STATS.filter(stat => stat !== 'luk'), [...STATS_V1].sort((a, b) => CAST_SKILL_STATS.indexOf(a) - CAST_SKILL_STATS.indexOf(b)));
    assert.equal(PACK_FORMAT, 4);
});

test('SUITE_VERSION is the package version, and the older host number stays as it was', () => {
    assert.equal(SUITE_VERSION, JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
    assert.equal(HOST_VERSION, '2.33.0');
});

test('requires.suite is checked against the suite version', () => {
    assert.deepEqual(ok(pack()).pack.requires, { suite: '^0.1', capabilities: [] });
    refused(pack({ requires: { suite: '^0.2' } }), 'HOST_VERSION');
    refused(pack({ requires: { suite: '^2' } }), 'HOST_VERSION', 'the older host number is not the suite version');
    assert.equal(validatePack(pack(), { suiteVersion: '0.1.7' }).ok, true);
    assert.equal(validatePack(pack(), { suiteVersion: '0.2.0' }).ok, false);
});

test('the game pack rpg formula is "v1" ("standard" is the older word, "classic" is refused); rpg.numbers is said and left out', () => {
    const formula = word => ok(game({ rpg: { formula: word } })).pack.content.rpg.find(record => record.slug === 'formula').formula;
    assert.deepEqual([formula('v1'), formula('standard')], ['v1', 'v1']);
    refused(game({ rpg: { formula: 'classic' } }), 'BAD_CONTENT');
    refused(game({ rpg: { formula: 'other' } }), 'BAD_CONTENT');
    const tuned = validatePack(game({ rpg: { formula: 'v1', numbers: { foeBase: 99, nonsense: 'x' } } }));
    assert.equal(tuned.ok, true, 'a pack that tunes numbers still loads');
    assert.deepEqual(tuned.warnings.map(warning => [warning.code, warning.path]), [['IGNORED_FIELD', 'content.rpg.numbers']]);
    assert.deepEqual(tuned.pack.content.rpg, [{ id: 'mini-game/formula', slug: 'formula', pack: 'mini-game', formula: 'v1' }], 'no numbers kept');
});

test('content.foes: name, aliases, tier, level, about, tags; the tier is needed and one of the six', () => {
    const made = ok(foes([{ name: 'Frost Wolf', aliases: ['ice wolf'], tier: 'Elite', level: 7, about: 'A pack hunter.', tags: ['beast', 'beast'] }, { name: 'Cave Rat', tier: 'mob' }]));
    assert.deepEqual(made.pack.content.foes[0], { name: 'Frost Wolf', aliases: ['ice wolf'], tier: 'elite', level: 7, about: 'A pack hunter.', tags: ['beast'], id: 'pack.mini/frost-wolf', slug: 'frost-wolf', pack: 'mini' });
    assert.deepEqual(made.pack.content.foes[1], { name: 'Cave Rat', aliases: [], tier: 'mob', about: '', tags: [], id: 'pack.mini/cave-rat', slug: 'cave-rat', pack: 'mini' });
    assert.deepEqual(contentOf([made.pack], 'foes').map(foe => foe.name), ['Frost Wolf', 'Cave Rat']);
    const bad = (extra, code = 'BAD_RECORD') => refused(foes([{ name: 'Wolf', tier: 'elite', ...extra }]), code);
    bad({ tier: 'weak' }); refused(foes([{ name: 'Wolf' }]), 'BAD_RECORD'); bad({ level: 0 }); bad({ level: 100 }); bad({ level: 2.5 }); bad({ about: 'x'.repeat(241) }); bad({ aliases: 'wolf' }); bad({ tags: [''] }); bad({ extra: 1 }, 'UNKNOWN_FIELD');
    refused(foes([{ name: 'Wolf', tier: 'mob' }, { name: 'wolf', tier: 'elite' }]), 'DUPLICATE');
});
