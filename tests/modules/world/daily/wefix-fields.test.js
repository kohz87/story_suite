// WEFIX1, the daily step's fields: threshold keys in likelier_if / less_if (E4), weight expressions (E7), templates' requires_any, likelier_if /
// less_if and major templates (E8), severity on the caps (ruling 47), protected deaths (48) and skipped deaths (49).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readDefs } from '../../../../modules/world/daily/defs.js';
import { weightValue } from '../../../../modules/world/daily/weight.js';
import { applyCast } from '../../../../modules/world/daily/cast.js';
import { runner, world } from './helpers.js';

const ev = (id, extra = {}) => ({ id, kind: 'one-off', certainty: 'likely', where: ['Highmark Empire'], ends_when: 'instant', summary: id, ...extra });
const powers = [{ id: 'ashen-veil', name: 'Ashen Veil', start: 50 }, { id: 'crown', name: 'Crown', start: -50 }];

test('E4: a threshold key in likelier_if / less_if is applied, not dropped with the whole event', () => {
    const w = world({ powers, events: [ev('war', { window: { after: 'start', within: '20 days' }, chance: '50% over the window', less_if: { 'power:ashen-veil >= 40': '×0' } })] });
    const defs = readDefs(w);
    assert.deepEqual(defs.events.map(def => def.id), ['war']);
    assert.deepEqual(defs.warnings, []);
    const blocked = runner(w, { draw: () => 0 }).to(2);
    assert.equal(blocked.log('roll', 'war')[0].result, 'blocked (×0)', 'the Veil is at 50: the modifier holds');
    assert.equal(blocked.row('war').fired, undefined);
    const open = runner(world({ powers: [{ id: 'ashen-veil', name: 'Ashen Veil', start: 10 }], events: w.events }), { draw: () => 0 }).to(1);
    assert.equal(open.row('war').fired, 1, 'the Veil at 10: the modifier does not hold');
});

test('E4: a threshold naming no power of this world still leaves the event out with a warning', () => {
    const defs = readDefs(world({ powers, events: [ev('bad', { likelier_if: { 'power:old-crown >= 10': '×2' } })] }));
    assert.deepEqual(defs.events, []);
    assert.match(defs.warnings[0], /old-crown/);
});

test('E7: a weight is a number, a ref (+100), or a sum or difference; clamped at 0; unreadable reads 0', () => {
    const ws = { standings: { 'power:a': -30, 'power:b': 50, 'score:s': 0 }, standingKey: (kind, id) => `${kind}:${id}` };
    const at = weight => weightValue(ws, weight);
    assert.deepEqual([at(40), at('power:a'), at('power:a + power:b'), at('200 - power:b'), at('score:s + 5'), at('power:a - 500'), at('power:nobody'), at('2 * 3')], [40, 70, 220, 50, 105, 0, 0, 0]);
});

test('E7: an outcome weighted "200 - power:crown" is picked by the live standing, "the weakest falls"', () => {
    const outcomes = [{ name: 'weak falls', weight: '200 - power:crown' }, { name: 'strong falls', weight: 'power:crown' }];
    const w = world({ powers, events: [ev('fall', { certainty: 'set-in-motion', window: { after: 'start', within: '1 day' }, outcomes })] });
    // crown at -50: weights 150 and 50 → a draw of 0.7 (of 200 = 140) lands in the first.
    assert.equal(runner(w, { draw: (day, key) => (key === 'fall#outcome' ? 0.7 : 0.9) }).to(1).row('fall').outcome, 'weak falls');
    assert.equal(runner(w, { draw: (day, key) => (key === 'fall#outcome' ? 0.8 : 0.9) }).to(1).row('fall').outcome, 'strong falls');
});

const tpl = extra => ({ template: 'bread-riot', scope: 'place', severity: 'minor', where: { kinds: ['town'] }, sets: ['unrest@place: 10 days'], chance: '100% per season', summary: 'Riot in {place}.', ...extra });
const fired = run => run.journal().filter(entry => entry.by === 'template:bread-riot');

test('E8: requires_any on a template places it only where one of the troubles holds', () => {
    const w = world({ templates: [tpl({ requires_any: ['grain-dear@region', 'refugees@region'] })] });
    assert.deepEqual(fired(runner(w).to(2)), [], 'nothing holds: nothing is placed');
    const run = runner(w).set('grain-dear', 'Valegard', 1, 'region');
    assert.ok(fired(run.to(2)).length > 0);
    assert.ok(fired(run).every(entry => entry.place === 'Oakhollow' || entry.place === 'Town'), 'only in Valegard');
});

test('E8: a template\'s less_if ×0 blocks it and likelier_if applies at the picked place', () => {
    const w = world({ templates: [tpl({ less_if: { 'peace@place': '×0' } })] });
    const run = runner(w).set('peace', 'Oakhollow', 1, 'place').set('peace', 'Town', 1, 'place');
    assert.deepEqual(fired(run.to(3)), [], 'peace at every town it could pick');
    // likelier_if ×3 at the picked place: a draw just above the plain chance is inside the raised one.
    const base = 1 - (1 - 0.3) ** (1 / 90);
    const edge = base * 1.5;
    const w2 = extra => world({ templates: [tpl({ chance: '30% per season', ...extra })] });
    const hit = made => runner(made, { draw: (day, key) => (key === 'template:bread-riot' ? edge : 0.5) }).set('grain-dear', 'Valegard', 1, 'region').to(1);
    assert.equal(fired(hit(w2({ likelier_if: { 'grain-dear@region': '×3' } }))).length, 1, 'with the modifier the draw is inside the chance');
    assert.equal(fired(hit(w2({}))).length, 0, 'without it the same draw misses');
});

const rebuild = extra => ({ template: 'reconstruction', scope: 'place', severity: 'major', reach: 'regional', needs: ['fallen@place'], clears: ['fallen@place'], cooldown: '1 year per place', summary: '{place} is retaken.', chance: '100% per season', ...extra });

test('E8: a major template is rolled: it clears fallen where it needs it and takes the realm\'s 45-day slot', () => {
    const w = world({ templates: [rebuild()] });
    const run = runner(w).set('fallen', 'Oakhollow', 1, 'place').to(2);
    assert.equal(run.table['fallen@Oakhollow'], undefined, 'cleared');
    assert.equal(run.state.lastMajor['Highmark Empire'], 1);
    assert.ok(run.journal().some(entry => entry.by === 'template:reconstruction'));
    assert.equal(run.state.minors.length, 0, 'a major does not use the minor density');
});

test('E8 / ruling 47: a major template is held back by the realm\'s new-major timer; a minor event takes no slot', () => {
    const w = world({ templates: [rebuild()], events: [ev('rising', { certainty: 'set-in-motion', window: { after: 'start', within: '1 day' }, effects: {} })] });
    const run = runner(w).set('fallen', 'Oakhollow', 1, 'place').to(3);
    assert.ok(run.table['fallen@Oakhollow'], 'the major event of day 1 holds the realm for 45 days');
    assert.ok(run.log('cap', 'reconstruction').length > 0);
    const minor = runner(world({ templates: [rebuild()], events: [ev('rising', { severity: 'minor', certainty: 'set-in-motion', window: { after: 'start', within: '1 day' } })] })).set('fallen', 'Oakhollow', 1, 'place').to(3);
    assert.equal(minor.table['fallen@Oakhollow'], undefined, 'a minor event neither takes a slot nor starts the timer');
});

const cast = [
    { kind: 'figure', id: 'adalmar', name: 'Adalmar', homeBase: 'Oakhollow', protected: true, canDieUnmet: true },
    { kind: 'figure', id: 'oren', name: 'Oren', homeBase: 'Oakhollow', canDieUnmet: true },
];
const kill = (who, extra = {}) => ev('end', { certainty: 'set-in-motion', where: ['Oakhollow'], window: { after: 'start', within: '1 day' }, summary: 'The old lord dies.', effects: { cast: [{ who, died: true }] }, ...extra });

test('ruling 48: an authored event naming a protected person kills them; a template or open template never does', () => {
    const run = runner(world({ cast, events: [kill('adalmar')] })).to(1);
    assert.equal(run.state.cast.adalmar.died, 1);
    const ws = { people: new Map(cast.map(person => [person.id, { ...person, protected: person.protected === true }])), cast: {}, withYou: new Set(), met: new Set(), warnings: [], log: [], journal: [], deaths: [], anchors: {}, geo: { places: [], byName: new Map() }, pos: {} };
    for (const source of [{ kind: 'template', id: 'open-wild', title: 'x', open: true }, { kind: 'template', id: 'plain', title: 'x' }]) {
        applyCast(ws, [{ who: 'adalmar', died: true }], { ...source, survived: [] }, 5);
        assert.equal(ws.cast.adalmar?.died, undefined, source.id);
    }
    assert.ok(ws.deaths.length === 0 && ws.warnings.some(text => /protected/.test(text)));
});

test('ruling 49: a death that is skipped says "(<name> survived)" in the Journal line and a Problems note', () => {
    const run = runner(world({ cast, events: [kill('oren')] }));
    run.withYou = ['oren'];
    run.to(1);
    assert.equal(run.state.cast.oren?.died, undefined);
    const line = run.journal().find(entry => entry.fired);
    assert.equal(line.text, 'The old lord dies. (Oren survived)');
    assert.ok(run.warnings.some(text => /Oren survived/.test(text)));
    const clear = runner(world({ cast, events: [kill('oren')] })).to(1);
    assert.equal(clear.journal().find(entry => entry.fired).text, 'The old lord dies.', 'a death that happens has no note');
});

test('ruling 49: an unmet person who cannot die before they are met survives the same way', () => {
    const shy = [{ kind: 'figure', id: 'oren', name: 'Oren', homeBase: 'Oakhollow', canDieUnmet: false }];
    const run = runner(world({ cast: shy, events: [kill('oren')] })).to(1);
    assert.match(run.journal().find(entry => entry.fired).text, /\(Oren survived\)$/);
});

test('E8: an open template\'s per "region per season" (a bare unit, as the check accepts) is read, not refused', () => {
    const open = { menu: { powers: { pick: 1, of: 'any', delta: [-5, 5] } } };
    const defs = readDefs(world({ templates: [{ template: 'open-x', scope: 'place', severity: 'minor', where: { kinds: ['town'] }, open, per: 'region per season', summary: 'x' }] }));
    assert.deepEqual(defs.warnings, []);
    assert.deepEqual(defs.templates[0].per, { by: 'region', days: 90 });
});
