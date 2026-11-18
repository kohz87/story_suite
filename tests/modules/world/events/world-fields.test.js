// The spec's event fields (pack-author spec v0.6 §3) behind story-director.world-events: strict grammar, refs, off = base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect, normalizeEvents } from '../../../../modules/world/events/engine.js';
import { WORLD_FEATURE } from '../../../../modules/world/events/world-calls.js';
import { packRefs, worldOptions } from '../../../../modules/world/events/engine-parts/world-refs.js';
import { parseChance, parseDuration, parseMultiplier } from '../../../../modules/world/events/engine-parts/world-grammar.js';

const raw = (extra = {}) => ({ id: 'e1', cue: 'It happens.', when: 'true', ...extra });
const on = { world: true };
const bad = (extra, options = on) => normalizeEvents([raw(extra)], options).invalid[0]?.why ?? null;
const good = (extra, options = on) => normalizeEvents([raw(extra)], options).defs[0];

// The spec's own example event (§3), field for field.
const spec = {
    kind: 'one-off', certainty: 'likely', reach: 'realm', severity: 'major', where: ['Highmark Empire'],
    requires: ['crown-contested@Highmark Empire', 'died:adalmar'],
    window: { after: 'died:adalmar + 3 days', within: '40 days' }, chance: '70% over the window',
    likelier_if: { 'garrisons-away@Highmark Empire': '×2', 'unrest@Highmark Capital': '×1.5' },
    less_if: { 'regent-named@Highmark Empire': '×0.5' }, pre_empted_by: ['fired:coronation'],
    outcomes: [
        { name: 'the regent holds', weight: 'power:Princess Wendhild', effects: { set: ['regent-named@Highmark Empire: until cleared'] }, summary: 'Wendhild holds the throne in trust.' },
        { name: 'the lords split', weight: 'power:the March lords', effects: { set: ['at-war@the March: 1 season'] } },
    ],
    effects: {
        set: ['roads-closed@Highmark-March road: 20 days', { condition: 'unrest', at: 'Highmark Capital', for: '30 days' }],
        clear: ['crown-contested@Highmark Empire'],
        cast: [{ who: 'Sir Lothar', location: 'Highmark Capital', status: 'summoned to the regent' }],
        facts: [{ id: 'regency-declared', text: 'A regency was declared in Highmark.' }],
    },
    ends_when: { for: '40 days', any_of: ['fired:coronation'] }, anchor_mode: 'first', summary: 'The succession crisis in Highmark: {outcome}.',
};
const coronation = { id: 'coronation', cue: 'x', when: 'true' };
const options = (refs = {}) => ({ world: true, refs });

test('off: the fields are not even read and the def is the base shape (what main gives)', () => {
    const { defs, invalid } = normalizeEvents([raw(spec)]);
    assert.deepEqual(invalid, []);
    assert.deepEqual(defs, [{ id: 'e1', pack: null, when: 'true', cue: 'It happens.', once: true, then: [], after: null }]);
    assert.deepEqual(normalizeEvents([raw({ chance: 'lots', window: 7 })], { world: false }).invalid, []);
    assert.deepEqual(worldOptions({}), { world: false });
    assert.deepEqual(worldOptions({ feature: () => false, query: () => { throw new Error('asked'); } }), { world: false }, 'off asks the pack for nothing');
});

test('on: the spec example event is valid and every field is stored', () => {
    const { defs, invalid } = normalizeEvents([raw(spec), coronation], on);
    assert.deepEqual(invalid, []);
    const def = defs.find(entry => entry.id === 'e1');
    assert.deepEqual(def.chance, { percent: 70, per: 'window' });
    assert.deepEqual(def.likelier_if, { 'garrisons-away@Highmark Empire': 2, 'unrest@Highmark Capital': 1.5 });
    assert.deepEqual(def.less_if, { 'regent-named@Highmark Empire': 0.5 });
    assert.deepEqual(def.window, { after: 'died:adalmar + 3 days', within: '40 days' });
    assert.deepEqual(def.effects.set, [
        { condition: 'roads-closed', at: 'Highmark-March road', for: '20 days' },
        { condition: 'unrest', at: 'Highmark Capital', for: '30 days' },
    ]);
    assert.deepEqual(def.effects.clear, [{ condition: 'crown-contested', at: 'Highmark Empire' }]);
    assert.equal(def.outcomes[0].effects.set[0].for, 'until cleared');
    assert.equal(def.outcomes[0].weight, 'power:Princess Wendhild');
    assert.deepEqual(def.ends_when, { for: '40 days', any_of: ['fired:coronation'] });
    assert.deepEqual(def.reach, 'realm');
    assert.equal(def.severity, 'major');
    assert.equal(def.effects.set[1].condition, 'unrest');
});

test('the spec\'s recurring and chain-stage examples are valid', () => {
    const wild = { id: 'wildzone-push', kind: 'recurring', certainty: 'possible', reach: 'regional', where: 'where conditions fit', requires: ['wildzone-stirring@the Northern Reach'], chance: '30% per season', cooldown: '1 season per place', likelier_if: { 'garrisons-away@the Northern Reach': '×2' }, effects: { set: [{ condition: 'refugees', at: 'the Northern Reach', for: '20 days' }] }, ends_when: { for: '30 days' }, summary: 'The Wildzone pushes.', cue: 'c', when: 'true' };
    const stage = { id: 'coronation', kind: 'chain-stage', certainty: 'set-in-motion', reach: 'world', where: ['Highmark Empire'], requires: ['stage:succession-crisis'], window: { after: 'ended:succession-crisis', within: '60 days' }, likelier_if: { 'regent-named@Highmark Empire': '×2' }, effects: { clear: ['crown-contested@Highmark Empire'], facts: [{ id: 'new-emperor-crowned', text: 'A new ruler was crowned.' }] }, summary: 's', cue: 'c', when: 'true' };
    const crisis = { id: 'succession-crisis', cue: 'c', when: 'true' };
    const result = normalizeEvents([wild, stage, crisis], on);
    assert.deepEqual(result.invalid, []);
    assert.equal(result.defs.find(def => def.id === 'wildzone-push').where, 'where conditions fit');
});

test('chance: over the window / per season, whole 0-100; nothing else', () => {
    assert.deepEqual(parseChance('20% over the window').value, { percent: 20, per: 'window' });
    assert.deepEqual(parseChance('7.5% per season').value, { percent: 7.5, per: 'season' });
    for (const text of ['20%', '20 % over the window', '120% over the window', 'about 20% over the window', 0.2, '20% per day']) assert.ok(parseChance(text).why, String(text));
    const window = { window: { within: '40 days' } };
    assert.match(bad({ ...window, chance: '30% per season' }), /per season.*recurring/);
    assert.match(bad({ chance: '30% over the window' }), /needs a window/);
    assert.match(bad({ kind: 'recurring', cooldown: '1 season', chance: '30% over the window' }), /per season/);
    assert.match(bad({ certainty: 'set-in-motion', ...window, chance: '50% over the window' }), /certain/);
});

test('durations: number and unit, until cleared only on a set', () => {
    assert.deepEqual(parseDuration('2 weeks').value, { days: 14, text: '2 weeks' });
    assert.equal(parseDuration('1 season').value.days, 90);
    assert.equal(parseDuration('until cleared', { open: true }).value.days, null);
    for (const text of ['until cleared', 'soon', '0 days', '10', '3 fortnights', '1.5 days', 4]) assert.ok(parseDuration(text).why, String(text));
    assert.match(bad({ window: { within: 'a while' } }), /not a duration/);
    assert.match(bad({ effects: { set: ['a@b: sometime'] } }), /not a duration/);
    assert.match(bad({ ends_when: { for: 'until cleared' } }), /not a duration/);
});

test('likelier_if / less_if: ×N odds multipliers; a percent is refused; keys are conditions or anchors', () => {
    assert.equal(parseMultiplier('×0').value, 0);
    assert.equal(parseMultiplier('×0.5').value, 0.5);
    for (const text of ['+20%', '2', 'x2', '×-1', '×', 2, '×1000']) assert.ok(parseMultiplier(text).why, String(text));
    assert.match(bad({ likelier_if: { 'unrest@Highmark Capital': '+20%' } }), /odds multiplier/);
    assert.deepEqual(good({ likelier_if: { 'set:unrest': '×2', 'died:adalmar': '×3', spring: '×1.5' } }).likelier_if, { 'set:unrest': 2, 'died:adalmar': 3, spring: 1.5 });
    assert.match(bad({ less_if: { 'unrest': '×2' } }), /anchor/);
});

test('anchors: the whole vocabulary, by id; anything else is refused', () => {
    const anchors = ['set:grain-dear', 'cleared:grain-dear', 'set:grain-dear@the March', 'fired:coronation', 'ended:coronation', 'lapsed:coronation', 'died:adalmar', 'departed:adalmar', 'fact:letter-found', 'spring', 'winter', 'start'];
    assert.deepEqual(good({ pre_empted_by: anchors }, options({ events: new Set(['coronation']) })).pre_empted_by, anchors);
    for (const text of ['coronation', 'fired:', 'fired:Two Words', 'fact:', 'fact:Two Words', 'sprung', 'happens:x', 'set:', 'set:a@', 'stage:coronation', 3]) assert.match(bad({ pre_empted_by: [text] }), /anchor|list/, String(text));
    assert.match(bad({ window: { after: 'start + 3 fortnights', within: '5 days' } }), /not a duration/);
    assert.equal(good({ window: { after: 'lapsed:e2 + 1 season', within: '5 days' } }, options({ events: new Set(['e2']) })).window.after, 'lapsed:e2 + 1 season');
    assert.equal(good({ window: { within: '5 days' } }).window.after, undefined, 'a window may open when requires first holds');
});

test('anchor_mode, reach and severity: only the spec words', () => {
    assert.equal(good({ anchor_mode: 'each', reach: 'local', severity: 'minor' }).reach, 'local');
    assert.match(bad({ anchor_mode: 'latest' }), /anchor_mode must be one of first, each/);
    assert.match(bad({ reach: 'global' }), /reach must be one of local, regional, realm, world/);
    assert.match(bad({ severity: 'huge' }), /severity must be one of minor, major/);
    assert.match(bad({ kind: 'sometimes' }), /kind must be/);
});

test('refs: places, routes, regions, realms, powers, scores, conditions, cast and events must exist (case aside)', () => {
    const refs = {
        places: new Set(['highmark capital']), routes: new Set(['highmark-march road']), regions: new Set(['the march', 'the wilds']), realms: new Set(['highmark empire', 'the wilds']),
        powers: new Set(['princess wendhild']), scores: new Set(['north readiness']), conditions: new Set(['unrest', 'at-war']), cast: new Set(['sir lothar', 'adalmar']),
    };
    const o = options(refs);
    assert.equal(bad({ where: ['HIGHMARK EMPIRE', 'The March', 'Highmark Capital'] }, o), null);
    assert.match(bad({ where: ['Atlantis'] }, o), /not a place, region or realm/);
    assert.match(bad({ requires: ['unrest@Atlantis'] }, o), /"Atlantis" is not a place/);
    assert.match(bad({ requires: ['sleepy@Highmark Empire'] }, o), /condition "sleepy" is not defined/);
    assert.equal(bad({ effects: { set: ['unrest@Highmark-March road: 5 days'] } }, o), null, 'a route is a ref');
    assert.match(bad({ outcomes: [{ name: 'a', weight: 'power:Nobody' }] }, o), /power "Nobody"/);
    assert.match(bad({ outcomes: [{ name: 'a', weight: 'score:Princess Wendhild' }] }, o), /score "Princess Wendhild"/, 'a power is not a score');
    assert.equal(bad({ outcomes: [{ name: 'a', weight: 'score:North Readiness' }, { name: 'b', weight: 3 }] }, o), null);
    assert.match(bad({ effects: { cast: [{ who: 'Ghost', status: 'x' }] } }, o), /cast member "Ghost"/);
    assert.match(bad({ effects: { cast: [{ who: 'Sir Lothar', location: 'Atlantis' }] } }, o), /location "Atlantis"/);
    assert.match(bad({ requires: ['died:nobody'] }, o), /cast id "nobody"/);
    assert.match(bad({ pre_empted_by: ['fired:ghost-event'] }, o), /event "ghost-event"/);
    assert.equal(normalizeEvents([raw({ pre_empted_by: ['fired:e2'] }), raw({ id: 'e2' })], o).invalid.length, 0, 'an event of the same list counts');
    assert.equal(bad({ where: ['Atlantis'], requires: ['died:nobody'] }), null, 'with no pack sections nothing is checked');
});

test('packRefs reads realms, powers, scores, places and routes from packs.content; a missing kind is unchecked', () => {
    const content = {
        places: [{ name: 'Highmark Capital', region: 'Highmark' }], realms: [{ name: 'Highmark Empire', regions: ['Highmark', 'The March'] }], powers: [{ name: 'Princess Wendhild', aliases: ['the regent'] }],
        scores: [{ name: 'North Readiness' }], routes: [{ from: 'Highmark Capital', to: 'Kesh', kind: 'road' }],
    };
    const refs = packRefs({ query: (name, args) => { if (name !== 'packs.content') return null; if (args.kind === 'conditions') throw new Error('no'); return content[args.kind] ?? null; } });
    assert.ok(refs.powers.has('the regent') && refs.scores.has('north readiness') && refs.realms.has('the wilds') && refs.regions.has('the march') && refs.routes.has('highmark capital-kesh'));
    assert.equal(refs.conditions, undefined);
    assert.equal(refs.cast, undefined);
    const view = { state: { v: 2, meta: { rev: 1, claims: {} }, domains: {} }, feature: id => id === WORLD_FEATURE, query: (name, args) => (name === 'packs.content' ? content[args.kind] ?? null : null) };
    const list = [raw({ where: ['Highmark Empire'], outcomes: [{ name: 'a', weight: 'power:Nobody' }] })];
    assert.match(inspect(view, list).invalid[0].why, /power "Nobody"/, 'inspect reads the pack names');
    assert.equal(inspect({ ...view, feature: () => false }, list).invalid.length, 0, 'off: the same list is as before');
});

test('effects and cast: shapes, and no duration on a clear', () => {
    assert.match(bad({ effects: { set: [3] } }), /set:/);
    assert.match(bad({ effects: { clear: ['a@b: 5 days'] } }), /no duration/);
    assert.match(bad({ effects: { cast: [{ who: 'X' }] } }), /at least one of/);
    assert.match(bad({ effects: { cast: [{ who: 'X', died: false }] } }), /died.*true/);
    assert.match(bad({ effects: { facts: [{ id: 'Two Words', text: 't' }] } }), /lower-case-hyphen/);
    assert.match(bad({ effects: { burn: [] } }), /set, clear, cast and facts/);
    assert.equal(good({ effects: { cast: [{ who: 'X', died: true }] } }).effects.cast[0].died, true);
});

test('ends_when is an object, outcomes and kinds hold together', () => {
    assert.match(bad({ ends_when: '40 days, or cleared by coronation' }), /object/);
    assert.match(bad({ ends_when: {} }), /object/);
    assert.match(bad({ ends_when: { any_of: [] } }), /any_of/);
    assert.match(bad({ deadline: true }), /deadline is not a field/);
    assert.match(bad({ outcomes: [] }), /outcomes must be/);
    assert.match(bad({ outcomes: [{ name: 'a', weight: -1 }] }), /0 to/);
    assert.match(bad({ kind: 'recurring', chance: '5% per season' }), /cooldown/);
    assert.match(bad({ kind: 'recurring', cooldown: '1 season per place', window: { within: '5 days' } }), /no window/);
    assert.match(bad({ kind: 'one-off', where: 'where conditions fit' }), /recurring events only/);
    assert.match(bad({ kind: 'chain-stage', requires: ['unrest@x'] }), /stage:/);
    assert.match(bad({ cooldown: 'a while' }), /cooldown/);
    assert.equal(good({ cooldown: '2 weeks per place', kind: 'recurring', where: ['x'] }).cooldown, '2 weeks per place');
    assert.equal(good({ where: 'the March' }).where.length, 1, 'a name alone is a list of one');
});
