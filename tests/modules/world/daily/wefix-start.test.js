// WEFIX1: the world a pack begins in (start.world, ruling 43) and region display names (content.regions, ruling 42).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeStart } from '../../../../packs/content-parts/start.js';
import { buildGeo } from '../../../../modules/world/daily/geo.js';
import { regionLabel } from '../../../../modules/world/daily/region-label.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { overrideWorld, readWorld } from '../../../../modules/world/chronicle/world-daily/read-world.js';
import { runner, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark Empire'], window: { after: 'start', within: '1 day' }, ends_when: 'instant', summary: id, ...extra });
const start = { set: ['at-war@Highmark Empire: 30 days', 'grain-dear@Valegard'], facts: ['early-flood'] };

test('E9: start.world is applied on the first step: its conditions are set and its facts written, with no news, no event, no cap or density use', () => {
    const run = runner(world({ startWorld: start, conditions: [...world().conditions, { name: 'at-war', scope: 'realm', fades: 'until cleared' }] }), { draw: () => 0.999 }).to(1);
    assert.ok(run.table['at-war@Highmark Empire'] && run.table['grain-dear@Valegard']);
    assert.equal(run.table['at-war@Highmark Empire'].why, 'the story begins so');
    assert.ok(run.state.facts['early-flood']);
    assert.ok(run.state.anchors['fact:early-flood']);
    assert.deepEqual(run.journal(), [], 'no Journal line');
    assert.deepEqual([run.state.minors, run.state.lastMajor], [[], {}], 'no density or cap use');
    assert.deepEqual(Object.keys(run.state.events).filter(id => run.state.events[id].fired), []);
});

test('E9: start.world is applied once (the first step only) and an event that needs it can fire on day one', () => {
    const w = world({ startWorld: start, events: [ev('muster', { requires: ['grain-dear@Valegard', 'fact:early-flood'] })] });
    const run = runner(w).to(1);
    assert.equal(run.row('muster').fired, 1, 'a day-one event reads the world it begins in');
    run.clear('grain-dear', 'Valegard').to(3);
    assert.equal(run.table['grain-dear@Valegard'], undefined, 'not set again on a later day');
    const second = runDays({ state: run.state, table: run.table, world: w, today: 4, seed: 's', draw: () => 0.999 });
    assert.equal(second.conditions['grain-dear@Valegard'], undefined);
});

test('E9: an unreadable start.world condition is a warning (Problems), not a crash', () => {
    const run = runner(world({ startWorld: { set: ['nonsense@Valegard', 'grain-dear'] } })).to(1);
    assert.equal(run.warnings.filter(text => /start\.world/.test(text)).length, 2);
});

test('E9: the merged pack start carries start.world only when a pack has one', () => {
    const pack = (id, worldPart) => ({ id, name: id, content: { items: [] }, start: { scene: { place: null, present: [] }, inventory: { items: [], money: 0 }, ...(worldPart ? { world: worldPart } : {}) } });
    assert.equal('world' in mergeStart([pack('a')]), false);
    const merged = mergeStart([pack('a', { set: ['x@y'], facts: ['f'] }), pack('b', { set: ['x@y', 'z@y'] })]);
    assert.deepEqual(merged.world, { set: ['x@y', 'z@y'], facts: ['f'] });
    assert.deepEqual(merged.packs, ['a', 'b']);
});

test('E9: the host reads start.world and content.regions through the packs', () => {
    const query = (name, args) => (name === 'packs.start' ? { world: start } : name === 'packs.content' && args?.kind === 'regions' ? [{ id: 'valegard', name: 'The Valegard' }] : []);
    const read = readWorld(query);
    assert.deepEqual(read.startWorld, start);
    assert.deepEqual(read.regions, [{ id: 'valegard', name: 'The Valegard' }]);
    assert.equal('startWorld' in readWorld(() => []), false);
    overrideWorld(null);
});

const named = { regions: [{ id: 'valegard', name: 'The Valegard', aliases: ['the vale'] }], places: [{ name: 'Oakhollow', region: 'valegard', kind: 'town' }], realms: [{ name: 'Highmark Empire', regions: ['valegard'] }] };

test('E9: content.regions gives the display name (by id, name or alias); a place keeps its region id', () => {
    const geo = buildGeo(named);
    assert.deepEqual(['valegard', 'The Valegard', 'the vale', 'elsewhere'].map(ref => regionLabel(geo, ref)), ['The Valegard', 'The Valegard', 'The Valegard', 'elsewhere']);
    assert.equal(geo.places[0].region, 'valegard');
    assert.equal(geo.places[0].regionName, 'The Valegard');
    assert.equal(geo.regionRealm.get('valegard'), 'Highmark Empire');
    assert.equal(regionLabel(buildGeo({ places: named.places }), 'valegard'), 'valegard', 'no content.regions: the text itself');
});

test('E9: {region} in an event summary and a template summary is the region\'s name (narrator and news read names)', () => {
    const w = world({
        ...named, conditions: world().conditions, powers: [], scores: [],
        events: [ev('blight', { kind: 'recurring', where: { kinds: ['town'] }, certainty: 'possible', chance: '100% per season', window: undefined, summary: 'Blight in {region}.', severity: 'minor' })],
        templates: [{ template: 'riot', severity: 'minor', where: { kinds: ['town'] }, sets: ['unrest@place: 3 days'], chance: '100% per season', summary: 'Riots across {region}.' }],
    });
    delete w.events[0].window;
    const text = runner(w, { draw: (day, key) => (key.endsWith('#day') ? 0 : 0.999) }).to(1).journal().map(entry => entry.text);
    assert.ok(text.includes('Blight in The Valegard.'), text.join('|'));
    assert.ok(text.includes('Riots across The Valegard.'), text.join('|'));
});
