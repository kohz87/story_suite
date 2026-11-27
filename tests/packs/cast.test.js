// The world pack's `cast` content kind: the people a world pack writes by hand. What is kept (one plain line, the habits, the way they treat You,
// the portrait file name), one bad person refused alone while the rest load, and the query `packs.content({ kind: 'cast' })` with `pack` and `packVersion`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { contentOf } from '../../packs/content.js';
import { CONTENT_KINDS, OPTIONAL_KINDS, WORLD_CAST_LIMITS } from '../../packs/limits.js';
import { createPacksPart } from '../../packs/index.js';
import { fakeSettings } from './helpers/fake-settings.js';
import { pack } from './helpers/fixtures.js';

const person = (extra = {}) => ({ kind: 'companion', id: 'fenna', name: 'Fenna', role: 'Runs the night ferry', look: 'Wiry, tar-stained coat.', start: { place: 'Bluewatch docks', goal: 'Keep the ferry running.' }, ...extra });
const withCast = list => pack({ content: { cast: list } });

function ok(value) {
    const result = validatePack(value);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    return result.pack;
}
// One bad person is a Problem of the pack, naming the person and the field, and the person is left out; the pack still installs.
function leftOut(list, path) {
    const result = validatePack(JSON.stringify(withCast(list)));
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const hit = result.warnings.find(warning => warning.path === path);
    assert.ok(hit, `no Problem at ${path}: ${JSON.stringify(result.warnings)}`);
    assert.match(hit.message, /was refused, the rest of the cast still loads/);
    return result.pack.content.cast;
}
const kept = extra => ok(withCast([person(extra)])).content.cast[0];

test('cast is a content kind, optional: a world pack without it has no cast key', () => {
    assert.ok(CONTENT_KINDS.includes('cast') && OPTIONAL_KINDS.includes('cast'));
    assert.equal('cast' in ok(pack()).content, false);
});

test('a person is kept with the pack id, and nothing it did not give', () => {
    const fenna = kept();
    assert.deepEqual(Object.keys(fenna).sort(), ['id', 'kind', 'look', 'name', 'pack', 'role', 'start']);
    assert.equal(fenna.pack, 'mini');
    assert.deepEqual(fenna.start, { place: 'Bluewatch docks', goal: 'Keep the ferry running.' });
});

test('text is one plain line: line breaks become spaces, markup and braces refuse that person', () => {
    assert.equal(kept({ look: 'Tall,\n  thin.' }).look, 'Tall, thin.');
    assert.equal(kept({ wears: 'A tar-stained\n  coat.' }).wears, 'A tar-stained coat.');
    for (const field of ['look', 'history', 'wears', 'withYou']) {
        assert.equal(leftOut([person({ [field]: 'A <b>tall</b> woman' })], `content.cast[0].${field}`).length, 0, field);
        assert.equal(leftOut([person({ [field]: 'She said {{user}}' })], `content.cast[0].${field}`).length, 0, field);
    }
});

test('required fields, unknown fields and duplicate ids refuse one person alone', () => {
    assert.equal(leftOut([person(), person({ id: 'sera', name: 'Sera', nickname: 'x' })], 'content.cast[1].nickname').length, 1);
    assert.equal(leftOut([person({ id: 'Fenna!' })], 'content.cast[0].id').length, 0);
    assert.equal(leftOut([person({ name: undefined })], 'content.cast[0].name').length, 0);
    assert.equal(leftOut([person({ kind: 'hero' })], 'content.cast[0].kind').length, 0);
    assert.equal(leftOut([person(), person({ name: 'Other' })], 'content.cast[1].id').length, 1, 'a second person with the same id');
    assert.equal(leftOut([person(), person({ id: 'f2', aliases: ['fenna'] })], 'content.cast[1].name').length, 1, 'an alias that is another person\'s name');
    const outsider = validatePack(JSON.stringify(pack({ content: { cast: { id: 'x' } } })));
    assert.equal(outsider.ok, false);
    assert.ok(outsider.errors.some(error => error.code === 'BAD_CONTENT' && error.path === 'content.cast'));
});

test('the caps: people per pack, aliases, text lengths', () => {
    const many = Array.from({ length: WORLD_CAST_LIMITS.entries + 1 }, (_, n) => person({ id: `p${n}`, name: `Person ${n}` }));
    const result = validatePack(JSON.stringify(withCast(many)));
    assert.equal(result.ok, true);
    assert.equal(result.pack.content.cast.length, WORLD_CAST_LIMITS.entries, 'the people after the cap are left out');
    assert.ok(result.warnings.some(warning => warning.code === 'BAD_CONTENT' && warning.path === 'content.cast'));
    assert.equal(kept({ aliases: Array.from({ length: WORLD_CAST_LIMITS.aliases }, (_, n) => `A${n}`) }).aliases.length, WORLD_CAST_LIMITS.aliases);
    leftOut([person({ aliases: Array.from({ length: WORLD_CAST_LIMITS.aliases + 1 }, (_, n) => `A${n}`) })], 'content.cast[0].aliases');
    assert.equal(kept({ look: 'a'.repeat(800) }).look.length, 800);
    leftOut([person({ look: 'a'.repeat(801) })], 'content.cast[0].look');
    leftOut([person({ withYou: 'a'.repeat(321) })], 'content.cast[0].withYou');
});

test('meters and stages: whole numbers in range, a stage names a meter the person has', () => {
    assert.deepEqual(kept({ meters: { preset: 'companion', trust: 10, regard: -5 } }).meters, { preset: 'companion', trust: 10, regard: -5 });
    leftOut([person({ meters: { trust: 1.5 } })], 'content.cast[0].meters.trust');
    leftOut([person({ meters: { trust: 5000 } })], 'content.cast[0].meters.trust');
    leftOut([person({ meters: { preset: 'Not A Slug' } })], 'content.cast[0].meters.preset');
    const stage = meter => [{ name: 'Regular', needs: [{ meter, at: 20 }], text: 'She nods at You.' }];
    leftOut([person({ stages: stage('devotion') })], 'content.cast[0].stages[0].needs[0].meter');
    assert.equal(kept({ meters: { devotion: 20 }, stages: stage('devotion') }).stages.length, 1);
    assert.equal(kept({ stages: stage('loyalty') }).stages.length, 1, 'a built-in meter needs no definition');
    assert.equal(kept({ meters: { preset: 'my-own' }, stages: stage('devotion') }).stages.length, 1, 'a preset of the pack may add it');
});

test('a secret opens by a gate; a secret with no gate refuses that person', () => {
    const secret = extra => [{ id: 'debt', text: 'She owes the smugglers.', ...extra }];
    assert.equal(kept({ secrets: secret({ gate: 'meter trust of fenna >= 20 or fact:weir-opened' }) }).secrets.length, 1);
    leftOut([person({ secrets: secret({}) })], 'content.cast[0].secrets[0].gate');
});

test('mannerisms: up to the cap of one-line habits; behaviour is "Lever: level - effect", written back in one form', () => {
    assert.equal(WORLD_CAST_LIMITS.mannerisms, 4);
    assert.equal('mannerisms' in kept(), false, 'absent when not given');
    assert.deepEqual(kept({ mannerisms: ['Coils a\n rope', 'Hums'] }).mannerisms, ['Coils a rope', 'Hums']);
    leftOut([person({ mannerisms: ['a', 'b', 'c', 'd', 'e'] })], 'content.cast[0].mannerisms');
    leftOut([person({ mannerisms: ['a'.repeat(121)] })], 'content.cast[0].mannerisms');
    assert.deepEqual(kept({ behaviour: ['mercy: LOW -  stitches\n slowly', 'CARE : High – protective'] }).behaviour, ['Mercy: low - stitches slowly', 'Care: high - protective']);
    leftOut([person({ behaviour: ['Care: mid - x'] })], 'content.cast[0].behaviour[0]');
    leftOut([person({ behaviour: ['Charm: high - x'] })], 'content.cast[0].behaviour[0]');
});

test('portrait names: a file name beside the pack; a path or another type refuses that person', () => {
    for (const name of ['fenna.webp', 'a_b-c.PNG', 'x.jpg', 'x.jpeg']) assert.equal(kept({ portrait: name }).portrait, name);
    for (const name of ['../fenna.webp', 'dir/fenna.webp', 'fenna.gif', 'fenna', '.webp', 'fenna.svg', 'a b.png']) leftOut([person({ portrait: name })], 'content.cast[0].portrait');
});

test('packs.content({ kind: cast }): the packs\' people in pack order, each with pack and packVersion; frozen', () => {
    const a = ok(withCast([person()]));
    const b = ok({ ...withCast([person({ id: 'sera', name: 'Sera' })]), id: 'other', version: '2.1.0' });
    const list = contentOf([a, b], 'cast');
    assert.deepEqual(list.map(entry => [entry.pack, entry.packVersion, entry.id]), [['mini', '1.0.0', 'fenna'], ['other', '2.1.0', 'sera']]);
    assert.deepEqual(contentOf([a, b], 'cast', { pack: 'other' }).map(entry => entry.id), ['sera']);
    assert.throws(() => { list[0].name = 'changed'; }, TypeError, 'frozen: the pack\'s own records');
    assert.deepEqual(contentOf([ok(pack())], 'cast'), []);
});

test('the part answers packs.content for cast over installed packs, and the list counts them', async () => {
    const { part, packs } = createPacksPart({ settings: fakeSettings() });
    assert.equal((await packs.install(withCast([person(), person({ id: 'sera', name: 'Sera' })]))).ok, true);
    const list = part.queries['packs.content']({}, { kind: 'cast' });
    assert.deepEqual(list.map(entry => entry.id), ['fenna', 'sera']);
    assert.equal(list[0].packVersion, '1.0.0');
    assert.equal(packs.list()[0].counts.cast, 2);
    await packs.setEnabled('mini', false);
    assert.deepEqual(part.queries['packs.content']({}, { kind: 'cast' }), []);
});
