// The shipped Arsveil cast: all eleven pass the pack check and reach NPC State's cast entry with their texts and secrets whole, each has a
// portrait small enough to be kept as it is, and arsveil.zip is what the build script gives.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validatePack } from '../../packs/validate.js';
import { readPackZip } from '../../packs/bundle.js';
import { PORTRAIT_LIMITS } from '../../packs/limits.js';
import { normalizeEntry } from '../../modules/people/dossier/cast-dossier.js';
import { normalizeSecrets } from '../../modules/people/meters/npc-meters-secrets-parts/notes.js';
import { readZip } from '../../packs/zip.js';
import { buildArsveilZip } from '../../scripts/core/build-example-zip.mjs';

const packs = new URL('../../examples/packs/', import.meta.url);
const text = readFileSync(new URL('arsveil/pack.json', packs), 'utf8');
const written = JSON.parse(text).content.cast;
const IDS = ['nasai', 'kel', 'annet', 'arn', 'veil-saintess', 'flame-saintess', 'courier', 'heir', 'merisande', 'moonlily', 'clover'];

test('the eleven are all kept, with no cast Problem', () => {
    const result = validatePack(text);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.deepEqual(result.pack.content.cast.map(person => person.id), IDS);
    assert.deepEqual(result.warnings.filter(warning => warning.path.startsWith('content.cast')), []);
});

test('NPC State cuts none of their texts or secrets', () => {
    for (const person of validatePack(text).pack.content.cast) {
        const entry = normalizeEntry(person);
        for (const field of ['look', 'wears', 'voice', 'personality', 'history', 'withYou']) assert.equal(entry[field], person[field], `${person.id} ${field}`);
        assert.equal(entry.start.routine, person.start.routine, person.id);
        assert.deepEqual(entry.behaviour, person.behaviour, person.id);
        assert.deepEqual(entry.mannerisms, person.mannerisms, person.id);
        const notes = normalizeSecrets(entry.gated.map(note => ({ ...note })));
        assert.deepEqual(notes.map(note => note.text), person.secrets.map(secret => secret.text), person.id);
    }
});

test('each has a portrait that is kept as it is, and the zip holds them and is up to date', async () => {
    const files = readdirSync(new URL('arsveil/portraits/', packs)).sort();
    assert.deepEqual(files, written.map(person => person.portrait).sort());
    for (const file of files) assert.ok(readFileSync(new URL(`arsveil/portraits/${file}`, packs)).length <= PORTRAIT_LIMITS.bytes, file);
    const zip = new Uint8Array(readFileSync(new URL('arsveil.zip', packs)));
    assert.ok(Buffer.from(zip).equals(Buffer.from(buildArsveilZip())), 'examples/packs/arsveil.zip is out of date');
    const read = await readPackZip(zip);
    assert.equal(read.ok, true, read.message);
    assert.equal(read.files.length, IDS.length);
});

test('the zip carries pack.json and game.json minified: the same content in the same order as the pretty-printed source files', async () => {
    const entries = readZip(new Uint8Array(readFileSync(new URL('arsveil.zip', packs))));
    for (const [name, from] of [['pack.json', 'arsveil/pack.json'], ['game.json', 'ersveil-game/pack.json']]) {
        const inside = new TextDecoder().decode(await entries.find(entry => entry.name === name).read());
        const source = readFileSync(new URL(from, packs), 'utf8');
        assert.equal(inside, JSON.stringify(JSON.parse(source)), name);
        assert.ok(!inside.includes('\n'), `${name} has no line breaks`);
        assert.deepEqual(JSON.parse(inside), JSON.parse(source), name);
    }
});
