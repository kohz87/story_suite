// The world pack installs (spec v0.13): one full sample keeps every field; the legacy pieces still behave; warnings are Problems, not refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePack } from '../../packs/validate.js';
import { contentOf } from '../../packs/content.js';
import { CONTENT_KINDS, OPTIONAL_KINDS } from '../../packs/limits.js';
import { pack } from './helpers/fixtures.js';
import { check, sample } from './helpers/world-pack-sample.js';

const clone = value => JSON.parse(JSON.stringify(value));

test('the full sample world pack installs and keeps every part it was given', () => {
    const result = check(sample);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    const { content } = result.pack;
    for (const kind of ['lore', 'placeKinds', 'routeKinds', 'realms', 'powers', 'scores', 'worldEvents', 'templates']) {
        assert.ok(CONTENT_KINDS.includes(kind) && OPTIONAL_KINDS.includes(kind), kind);
        if (kind !== 'scores') assert.deepEqual(content[kind], sample.content[kind], kind);
    }
    assert.deepEqual(content.scores.map(score => [score.id, score.range, score.drift]), [['highmark-stability', [-100, 100], undefined], ['tide-pressure', [-100, 100], false]], 'a score keeps drift:false; the range defaults to -100..100');
    assert.deepEqual(content.worldEvents.map(event => event.id), ['succession-crisis', 'diet-of-ledgerford', 'coronation', 'famine', 'dungeon-break', 'war-of-faiths']);
    assert.deepEqual(content.worldEvents[0].requires, sample.content.worldEvents[0].requires, 'a threshold in requires is kept as written');
    assert.deepEqual(content.conditions.find(c => c.name === 'grain-dear').effects, { prices: { grain: '×2', all: '×1.3' }, routes: null });
    assert.equal(content.conditions.find(c => c.name === 'fallen').placeStatus, true);
    assert.deepEqual(content.cast.map(person => person.id), ['adalmar', 'sir-lothar', 'toll-keeper']);
    assert.deepEqual(content.cast[1].stages.map(stage => stage.name), ['Wary', 'Trusted']);
    assert.equal(content.cast[1].secrets[0].gate, 'stage >= "Trusted" or fact:letter-found');
    assert.equal(content.places[0].slug, 'highmark-capital', 'a place id is kept as its slug');
    assert.equal(content.places[3].weight, 2);
});

test('the engine reads the parts through packs.content as it expects: kind maps merge, lists are flat', () => {
    const packs = [check(sample).pack];
    assert.deepEqual(Object.assign({}, ...contentOf(packs, 'placeKinds')), sample.content.placeKinds);
    assert.deepEqual(Object.assign({}, ...contentOf(packs, 'routeKinds')), sample.content.routeKinds);
    assert.equal(contentOf(packs, 'worldEvents').length, 6);
    assert.equal(contentOf(packs, 'templates')[0].template, 'bread-riot');
    assert.equal(contentOf(packs, 'powers')[0].id, 'ashen-veil');
});

test('only the two unwritten facts are said (as Problems); the pack installs', () => {
    const result = check(sample);
    assert.deepEqual(result.warnings.map(warning => warning.code), ['UNWRITTEN_FACT', 'UNWRITTEN_FACT']);
    assert.match(result.warnings[0].message, /letter-found/);
});

test('a pack without the world parts keeps its old normalized form: no new key appears', () => {
    const result = validatePack(pack());
    assert.equal(result.ok, true);
    for (const kind of ['lore', 'placeKinds', 'routeKinds', 'realms', 'powers', 'scores', 'worldEvents', 'templates']) assert.equal(kind in result.pack.content, false, kind);
});

test('two routes between the same two places each need a name; with names (a river and a bastion road) they install (B13)', () => {
    const named = check(sample);
    assert.equal(named.ok, true);
    const unnamed = clone(sample);
    delete unnamed.content.routes[1].name;
    const result = check(unnamed);
    assert.equal(result.ok, false);
    assert.match(result.errors.map(error => error.message).join('\n'), /two routes join the same two places, so each needs a "name"/);
    const same = clone(sample);
    same.content.routes[1].name = 'Ledger river';
    assert.match(check(same).errors.map(error => error.message).join('\n'), /same name|share the slug/);
});

test('a sea lane may carry hours (B14); hours on a road is a warning, not a refusal', () => {
    assert.equal(check(sample).pack.content.routes[3].hours, 20);
    const road = clone(sample);
    road.content.routes[2].hours = 5;
    const result = check(road);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.ok(result.warnings.some(warning => warning.code === 'HOURS_ON_NON_SEA' && /lane time of a sea route/.test(warning.message)));
});

test('a legacy event `when` may use the world calls whatever the switch says; a spec event in content.events points to content.worldEvents', () => {
    const legacy = validatePack(pack({ content: { events: [{ id: 'cue', when: "condition('grain-dear') && !active('x')", cue: 'Bread is dear.' }] } }));
    assert.equal(legacy.ok, true, JSON.stringify(legacy.errors));
    const spec = validatePack(pack({ content: { events: [{ id: 'cue', when: 'true', cue: 'x', ends_when: 'instant' }] } }));
    assert.equal(spec.ok, false);
    assert.match(spec.errors[0].message, /write spec events in content\.worldEvents/);
});

test('a pack with a world part but old free-word kinds is refused at the kind; a conditions-only pack does not need kind maps', () => {
    const only = validatePack(pack({ content: { places: [{ name: 'Bluewatch', kind: 'harbour town', x: 0, y: 0 }], conditions: [{ name: 'unrest', scope: 'place', means: 'Crowds.' }] } }));
    assert.equal(only.ok, true, JSON.stringify(only.errors));
    const world = validatePack(pack({ content: { places: [{ name: 'Bluewatch', kind: 'harbour town', x: 0, y: 0 }], realms: [{ id: 'r', name: 'R', regions: [] }] } }));
    assert.equal(world.ok, false);
    assert.match(world.errors[0].message, /not in placeKinds and is not an engine class/);
});
