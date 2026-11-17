// The `rpg` content kind: `content.rpg.skillSets`, ready-made skills the RPG's New character wizard offers
// (`{ name, slug?, about?, skills: [{ name, about, stat, uses? }] }`). Validation of every field, the caps, the normalized list and the query.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../packs/validate.js';
import { contentOf } from '../../packs/content.js';
import { countsLine } from '../../packs/panel.js';
import { CONTENT_KINDS, LEAN_RPG_LIMITS, OPTIONAL_KINDS } from '../../packs/limits.js';
import { CREATION, STATS, USES } from '../../modules/rpg/names.js';
import { pack } from './helpers/fixtures.js';

const skill = (extra = {}) => ({ name: 'Spear', about: 'Holding a line with a long spear.', stat: 'str', ...extra });
const set = (extra = {}) => ({ name: 'Sealwarden recruit', about: 'Trained at the gates.', skills: [skill()], ...extra });
const withSets = list => pack({ content: { rpg: { skillSets: list } } });

function ok(value) {
    const result = validatePack(value);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    return result.pack;
}

// Through JSON, as a file gives it: a field set to undefined is a field left out.
function refused(value, code, path) {
    const result = validatePack(JSON.stringify(value));
    assert.equal(result.ok, false, `${path} should be refused`);
    const hit = result.errors.find(error => error.path === path);
    assert.ok(hit, `no error at ${path}: ${JSON.stringify(result.errors)}`);
    assert.equal(hit.code, code, hit.message);
    assert.ok(hit.message.length > 20, 'a sentence the reader can act on');
    return hit;
}

test('rpg is a content kind added after the first format, and its limits are the Skills block\'s', () => {
    assert.ok(CONTENT_KINDS.includes('rpg') && OPTIONAL_KINDS.includes('rpg'));
    assert.equal('rpg' in ok(pack()).content, false, 'an older pack normalizes as it always did');
    assert.deepEqual(ok(withSets([])).content.rpg, []);
    assert.deepEqual([LEAN_RPG_LIMITS.sets, LEAN_RPG_LIMITS.skills, LEAN_RPG_LIMITS.skillName, LEAN_RPG_LIMITS.skillAbout], [12, 5, CREATION.skillName, CREATION.skillAbout]);
    assert.deepEqual([...LEAN_RPG_LIMITS.stats].filter(stat => stat !== 'luk'), [...STATS], 'the same seven stats as the Skills block (and LUK, which a v1 sheet reads as WIS, so an earlier pack still loads)');
    assert.deepEqual([...LEAN_RPG_LIMITS.uses].sort(), ['mana', 'mp', 'sp', 'stamina'], 'sp and mp, with the older words stamina and mana still accepted');
    assert.ok([...USES].every(word => LEAN_RPG_LIMITS.uses.includes(word)));
});

test('a set keeps its skills, with the stat in lower case, the pool sp unless it says mp (stamina and mana read the same) and the type attack unless it names one', () => {
    const made = ok(withSets([set({ name: ' Sealwarden   recruit ', skills: [skill(), skill({ name: 'Ward-reading', about: ' Reading seals. ', stat: 'INT', uses: 'Mana' }), skill({ name: 'Gatecraft', stat: ' vit ', uses: 'stamina' })] })]));
    assert.deepEqual(made.content.rpg, [{
        name: 'Sealwarden recruit', about: 'Trained at the gates.',
        skills: [
            { name: 'Spear', about: 'Holding a line with a long spear.', stat: 'str', uses: 'sp', type: 'attack' },
            { name: 'Ward-reading', about: 'Reading seals.', stat: 'int', uses: 'mp', type: 'attack' },
            { name: 'Gatecraft', about: 'Holding a line with a long spear.', stat: 'vit', uses: 'sp', type: 'attack' },
        ],
        id: 'pack.mini/sealwarden-recruit', slug: 'sealwarden-recruit', pack: 'mini',
    }]);
    const plain = ok(withSets([{ name: 'Bare', skills: [skill()] }]));
    assert.equal(plain.content.rpg[0].about, '', 'about may be left out');
});

test('the shipped test fixture pack is valid and its set comes out of the query with its pack', () => {
    const fixture = JSON.parse(readFileSync(new URL('../modules/rpg/fixtures/skill-sets-pack.json', import.meta.url), 'utf8'));
    const made = ok(fixture);
    const found = contentOf([made], 'rpg');
    assert.equal(found.length, 1);
    assert.deepEqual([found[0].name, found[0].pack, found[0].skills.map(entry => [entry.name, entry.stat, entry.uses])],
        ['Sealwarden recruit', 'ersveil-sets', [['Spear', 'str', 'sp'], ['Ward-reading', 'int', 'mp'], ['Gatecraft', 'vit', 'sp']]]);
    assert.deepEqual(contentOf([made, ok(withSets([set()]))], 'rpg').map(entry => entry.pack), ['ersveil-sets', 'mini'], 'pack order, then file order');
    assert.deepEqual(contentOf([made], 'rpg', { pack: 'other' }), []);
    assert.throws(() => { found[0].name = 'changed'; }, TypeError, 'the records are the pack\'s own and frozen');
    assert.equal(contentOf([made], 'rpg')[0].name, 'Sealwarden recruit', 'nothing a caller does changes the pack');
});

test('the panel counts them as skill sets', () => {
    assert.equal(countsLine({ items: 2, rpg: 1 }, false), '2 items, 1 skill set');
    assert.equal(countsLine({ rpg: 3 }, false), '3 skill sets');
});

test('a set is refused, in plain words, for anything outside the limits', () => {
    refused(pack({ content: { rpg: [] } }), 'BAD_CONTENT', 'content.rpg');
    refused(pack({ content: { rpg: { skillSets: [set()], extra: 1 } } }), 'UNKNOWN_FIELD', 'content.rpg.extra');
    refused(pack({ content: { rpg: { skillSets: 'no' } } }), 'BAD_CONTENT', 'content.rpg.skillSets');
    refused(withSets(Array.from({ length: 13 }, (_, n) => set({ name: `Set ${n}` }))), 'BAD_CONTENT', 'content.rpg.skillSets');
    assert.equal(ok(withSets(Array.from({ length: 12 }, (_, n) => set({ name: `Set ${n}` })))).content.rpg.length, 12, 'twelve is fine');
    refused(withSets([set({ name: 'x'.repeat(41) })]), 'BAD_RECORD', 'content.rpg.skillSets[0].name');
    refused(withSets([set({ name: '' })]), 'BAD_RECORD', 'content.rpg.skillSets[0].name');
    refused(withSets([set(), set()]), 'DUPLICATE', 'content.rpg.skillSets[1]');
    refused(withSets([set({ about: 'x'.repeat(161) })]), 'BAD_RECORD', 'content.rpg.skillSets[0].about');
    refused(withSets([set({ about: 5 })]), 'BAD_RECORD', 'content.rpg.skillSets[0].about');
    refused(withSets([set({ colour: 'red' })]), 'UNKNOWN_FIELD', 'content.rpg.skillSets[0].colour');
    refused(withSets([set({ skills: [] })]), 'BAD_RECORD', 'content.rpg.skillSets[0].skills');
    refused(withSets([set({ skills: 'many' })]), 'BAD_RECORD', 'content.rpg.skillSets[0].skills');
    refused(withSets([set({ skills: Array.from({ length: 6 }, (_, n) => skill({ name: `Skill ${n}` })) })]), 'BAD_RECORD', 'content.rpg.skillSets[0].skills');
    assert.equal(ok(withSets([set({ skills: Array.from({ length: 5 }, (_, n) => skill({ name: `Skill ${n}` })) })])).content.rpg[0].skills.length, 5, 'five is fine');
});

test('a skill is refused for a bad name, description, stat, resource or field, and a repeated name', () => {
    const at = field => `content.rpg.skillSets[0].skills[0].${field}`;
    refused(withSets([set({ skills: [skill({ name: '' })] })]), 'BAD_RECORD', at('name'));
    refused(withSets([set({ skills: [skill({ name: 'x'.repeat(41) })] })]), 'BAD_RECORD', at('name'));
    refused(withSets([set({ skills: [skill({ name: 7 })] })]), 'BAD_RECORD', at('name'));
    refused(withSets([set({ skills: [skill({ about: '' })] })]), 'BAD_RECORD', at('about'));
    refused(withSets([set({ skills: [skill({ about: 'x'.repeat(121) })] })]), 'BAD_RECORD', at('about'));
    refused(withSets([set({ skills: [skill({ stat: 'hp' })] })]), 'BAD_RECORD', at('stat'));
    refused(withSets([set({ skills: [skill({ stat: undefined })] })]), 'BAD_RECORD', at('stat'));
    refused(withSets([set({ skills: [skill({ uses: 'rage' })] })]), 'BAD_RECORD', at('uses'));
    refused(withSets([set({ skills: [skill({ rank: 2 })] })]), 'UNKNOWN_FIELD', at('rank'));
    refused(withSets([set({ skills: [skill({ practice: 50 })] })]), 'UNKNOWN_FIELD', at('practice'));
    refused(withSets([set({ skills: ['Spear'] })]), 'BAD_RECORD', 'content.rpg.skillSets[0].skills[0]');
    refused(withSets([set({ skills: [skill(), skill({ name: ' spear ' })] })]), 'DUPLICATE', 'content.rpg.skillSets[0].skills[1].name');
    // Rank and practice are never part of a set: a pack cannot hand out Expert skills.
    assert.equal(validatePack(JSON.stringify(withSets([set({ skills: [skill({ rank: 3 })] })]))).ok, false);
});
