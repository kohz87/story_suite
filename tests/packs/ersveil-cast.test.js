// The cast of the format 4 Ersveil world (examples/packs/ersveil, 4.0.0): 31 people, 12 companions and 19 world figures, every one passing the world cast check
// with nothing refused, written only in spec §8 fields (no format 3 cast field), within what NPC State seeds (pack format 4 §5.2: Level 1-99, at most 16
// abilities and 12 keepsakes, names up to 60 and descriptions up to 200 characters), starting at places of the world, and the 12 portraits web-size WebP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../packs/validate.js';
import { RETIRED_CAST_FIELDS } from '../../packs/limits.js';

const folder = new URL('../../examples/packs/ersveil/', import.meta.url);
const packText = readFileSync(new URL('pack.json', folder), 'utf8');
const pack = JSON.parse(packText);
const cast = pack.content.cast;
const COMPANIONS = ['temiwa', 'torka', 'harrak', 'rika', 'ysmeth', 'nysseth', 'sir-lothar', 'gorm', 'nerissa', 'hush', 'asphodel', 'barney'];
const SPEC_FIELDS = ['abilities', 'age', 'aliases', 'apparentAge', 'behaviour', 'canDieUnmet', 'drawnTo', 'gender', 'history', 'homeBase', 'id', 'keepsakes', 'keyRelationships', 'kind', 'level',
    'look', 'mannerisms', 'meters', 'name', 'personality', 'portrait', 'protected', 'role', 'secrets', 'species', 'stages', 'start', 'status', 'tastes', 'ties', 'voice', 'wears', 'withYou'];

test('31 people: the 12 companions first, then 19 figures; the world cast check keeps every one, with no problem', () => {
    assert.equal(cast.length, 31);
    assert.deepEqual(cast.filter(person => person.kind === 'companion').map(person => person.id), COMPANIONS);
    assert.equal(cast.filter(person => person.kind === 'figure').length, 19);
    const result = validatePack(packText);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.warnings ?? [], []);
    assert.deepEqual(result.pack.content.cast.map(person => person.id.split('/').at(-1)), cast.map(person => person.id));
});

test('every field is a spec §8 cast field; no format 3 cast field (about, skills, gear, fields) and no birthday', () => {
    for (const person of cast) {
        for (const key of Object.keys(person)) assert.ok(SPEC_FIELDS.includes(key), `${person.id}.${key}`);
        for (const key of Object.keys(RETIRED_CAST_FIELDS)) assert.equal(key in person, false, `${person.id}.${key}`);
        assert.equal('birthday' in person, false, person.id);
    }
});

test('Level, abilities and keepsakes: only the companions carry them, inside what NPC State seeds; a figure seeds no Level', () => {
    for (const person of cast) {
        if (person.kind === 'figure') {
            for (const key of ['level', 'abilities', 'keepsakes']) assert.equal(person[key], undefined, `${person.id}.${key}`);
            continue;
        }
        assert.ok(Number.isInteger(person.level) && person.level >= 1 && person.level <= 99, `${person.id}: level ${person.level}`);
        assert.ok(person.abilities.length >= 1 && person.abilities.length <= 16, person.id);
        assert.ok(person.keepsakes.length >= 1 && person.keepsakes.length <= 12, person.id);
        for (const list of [person.abilities, person.keepsakes]) {
            const names = list.map(entry => entry.name.toLowerCase());
            assert.equal(new Set(names).size, names.length, `${person.id}: names unique`);
            for (const entry of list) {
                assert.deepEqual(Object.keys(entry).sort(), ['description', 'name'], `${person.id}: ${entry.name}`);
                assert.ok(entry.name.length <= 60 && entry.description.length <= 200, `${person.id}: ${entry.name}`);
            }
        }
    }
    assert.deepEqual(Object.fromEntries(cast.filter(person => person.level).map(person => [person.id, person.level])),
        { temiwa: 4, torka: 6, harrak: 56, rika: 5, ysmeth: 36, nysseth: 44, 'sir-lothar': 42, gorm: 22, nerissa: 24, hush: 48, asphodel: 30, barney: 14 });
});

test('secrets are the spec shape (id, gate, text, and writes_fact when given); ties name people of the cast', () => {
    const ids = new Set(cast.map(person => person.id));
    for (const person of cast) {
        for (const secret of person.secrets ?? []) {
            for (const key of Object.keys(secret)) assert.ok(['id', 'gate', 'text', 'writes_fact'].includes(key), `${person.id}: ${key}`);
            assert.ok(secret.id && secret.gate && secret.text, `${person.id}: ${secret.id}`);
        }
        for (const tie of person.ties ?? []) assert.ok(ids.has(tie.with), `${person.id} ties to ${tie.with}`);
    }
});

test('everyone who has a start place starts at a place id of the world', () => {
    const places = new Set(pack.content.places.map(place => place.id));
    const placed = cast.filter(person => person.start?.place);
    assert.equal(placed.length, 30);
    for (const person of placed) assert.ok(places.has(person.start.place), `${person.id} starts at "${person.start.place}"`);
});

test('the portraits: the 12 companions name one WebP each in the folder, 512 px at most and 150 KB at most; no figure has one', () => {
    const named = cast.filter(person => person.portrait).map(person => [person.id, person.portrait]);
    assert.deepEqual(named.map(([id]) => id), COMPANIONS);
    for (const [id, name] of named) {
        assert.match(name, /^[a-z-]+\.webp$/, id);
        const bytes = readFileSync(new URL(`portraits/${name}`, folder));
        assert.ok(bytes.length <= 150 * 1024, `${name} is ${bytes.length} bytes`);
        assert.equal(bytes.toString('latin1', 0, 4), 'RIFF');
        assert.equal(bytes.toString('latin1', 8, 16), 'WEBPVP8 ', name);
        const width = bytes.readUInt16LE(26) & 0x3fff;
        const height = bytes.readUInt16LE(28) & 0x3fff;
        assert.ok(Math.max(width, height) <= 512 && Math.min(width, height) > 0, `${name} is ${width}x${height}`);
    }
});
