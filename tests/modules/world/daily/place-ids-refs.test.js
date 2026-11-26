// File ids past the plain lookup: in `set:` / `cleared:` anchors, in a cast move's `until`, in a person's home, between two places
// of one display name, and where a file id spells a region, a realm or a route. Each anchor shape is run with the id and with the name,
// on an opted-in pack (`placeIdPacks`); the last tests pin that without the opt-in the text counts as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeo, resolveRef } from '../../../../modules/world/daily/geo.js';
import { occurrences } from '../../../../modules/world/daily/anchors.js';
import { withMapName } from '../../../../modules/world/daily/anchor-ref.js';
import { makeWs } from '../../../../modules/world/daily/step.js';
import { setRefusal } from '../../../../modules/world/chronicle/conditions/refusal.js';
import { drawWith, runner, world } from './helpers.js';

const place = (slug, name, extra = {}) => ({ name, id: `pack.sample/${slug}`, slug, pack: 'sample', region: 'Valegard', kind: 'town', ...extra });
const PLACES = [place('deep-hold', 'Deepmantle Hold'), place('auvoth', 'Auvoth', { x: 5 }), place('far-town', 'Far Town', { x: 9 })];
const CONDITIONS = [
    { name: 'evacuated', scope: 'place', fades: 'until cleared', placeStatus: true },
    { name: 'fallen', scope: 'place', fades: 'until cleared', placeStatus: true },
];
const ev = (id, after, extra = {}) => ({ id, kind: 'one-off', certainty: 'set-in-motion', where: ['Far Town'], window: { after, within: '1 day' }, ends_when: 'instant', title: id, summary: id, ...extra });
const person = (extra = {}) => ({ kind: 'figure', id: 'oren', name: 'Oren', pack: 'sample', canDieUnmet: true, ...extra });
const OPT_IN = { placeIdPacks: ['sample'] };
const small = extra => world({ places: PLACES, conditions: CONDITIONS, ...OPT_IN, ...extra });
const geoOf = extra => buildGeo({ ...OPT_IN, ...extra });
const FORMS = [['file id', 'deep-hold', 'deep-hold'], ['display name', 'Deepmantle Hold', 'Deepmantle Hold'], ['lower-case name', 'deepmantle hold', 'Deepmantle Hold']];

for (const [label, ref] of FORMS) {
    // Ersveil's shape `cleared:evacuated@bluewatch-village`: a move that lasts until the condition is cleared, and events waiting on both anchors.
    test(`a ${label}: a move lasts until its condition is cleared, and set: and cleared: anchors open windows`, () => {
        const events = [
            ev('flight', 'start', { ends_when: { for: '1 day' }, effects: { set: [`evacuated@${ref}: until cleared`], cast: [{ who: 'oren', location: 'far-town', until: `cleared:evacuated@${ref}` }] } }),
            ev('after-set', `set:evacuated@${ref}`),
            ev('return', 'fired:flight + 3 days', { effects: { clear: [`evacuated@${ref}`] } }),
            ev('after-cleared', `cleared:evacuated@${ref}`),
        ];
        const run = runner(small({ cast: [person({ homeBase: 'Auvoth' })], events })).to(3);
        assert.equal(run.state.cast.oren.displaced?.to, 'Far Town', 'still away two days after the event ended');
        assert.equal(run.state.cast.oren.displaced.until, 'cleared:evacuated@Deepmantle Hold');
        assert.ok(run.row('after-set').fired, 'set: is met');
        assert.equal(run.row('after-cleared').fired, undefined);
        run.to(6);
        assert.ok(run.row('after-cleared').fired, 'cleared: is met');
        assert.equal(run.state.cast.oren.displaced, undefined, 'released once it is cleared');
    });

    test(`a ${label}: a deferred move keeps the same until and applies while the condition holds`, () => {
        const events = [ev('flight', 'start', { effects: { set: [`evacuated@${ref}: until cleared`], cast: [{ who: 'oren', location: 'far-town', until: `cleared:evacuated@${ref}` }] } })];
        const run = runner(small({ cast: [person({ homeBase: 'Auvoth' })], events }));
        run.withYou = ['oren'];
        run.to(1);
        assert.equal(run.state.cast.oren.deferred.until, 'cleared:evacuated@Deepmantle Hold');
        run.withYou = [];
        run.to(2);
        assert.equal(run.state.cast.oren.displaced?.to, 'Far Town');
    });

    test(`a ${label}: ends_when and pre_empted_by read set: anchors`, () => {
        const events = [
            ev('standing', 'start', { ends_when: { any_of: [`set:evacuated@${ref}`] } }),
            ev('flight', 'start + 2 days', { effects: { set: [`evacuated@${ref}: until cleared`] } }),
            ev('never', 'start + 5 days', { pre_empted_by: [`set:evacuated@${ref}`] }),
        ];
        const run = runner(small({ events })).to(7);
        assert.equal(run.row('standing').state, 'ended');
        assert.equal(run.row('never').state, 'replaced');
    });
}

// `cleared:fallen@auvoth` failed on letter case alone, with no file id involved: an opted-in pack reads the map's name.
test('cleared:fallen@auvoth meets the place named Auvoth in an opted-in pack', () => {
    const events = [
        ev('fall', 'start', { effects: { set: ['fallen@Auvoth: until cleared'], cast: [{ who: 'oren', location: 'Far Town', until: 'cleared:fallen@auvoth' }] } }),
        ev('relief', 'fired:fall + 2 days', { effects: { clear: ['fallen@Auvoth'] } }),
        ev('after', 'cleared:fallen@auvoth'),
    ];
    const run = runner(small({ cast: [person({ homeBase: 'Deepmantle Hold' })], events })).to(2);
    assert.equal(run.state.cast.oren.displaced?.until, 'cleared:fallen@Auvoth');
    run.to(5);
    assert.ok(run.row('after').fired);
    assert.equal(run.state.cast.oren.displaced, undefined);
});

test('an until naming a ref the map does not know is kept as written', () => {
    const events = [ev('flight', 'start', { ends_when: { for: '9 days' }, effects: { cast: [{ who: 'oren', location: 'Far Town', until: 'cleared:fallen@no-such-place' }] } })];
    const run = runner(small({ cast: [person({ homeBase: 'Auvoth' })], events }));
    run.withYou = ['oren'];
    run.to(1);
    assert.equal(run.state.cast.oren.deferred.until, 'cleared:fallen@no-such-place');
});

for (const [label, ref, name] of FORMS) {
    for (const [field, home] of [['homeBase', { homeBase: ref }], ['start.place', { start: { place: ref } }]]) {
        test(`a resident whose ${field} is a ${label} is evacuated, with no cast-store position`, () => {
            const events = [ev('fall', 'start', { effects: { set: [`fallen@${name}: until cleared`] } })];
            const run = runner(small({ cast: [person(home)], events })).to(1);
            assert.equal(run.state.cast.oren?.displaced?.to, 'Auvoth');
        });
    }

    test(`a protected resident whose home is a ${label} keeps a template's placeStatus away, and a narrator's`, () => {
        const cast = [person({ homeBase: ref, protected: true })];
        const template = { template: 'sack', severity: 'minor', where: { kinds: ['town'] }, sets: ['fallen@place: 2 days'], chance: '100% per season', summary: 'x' };
        const run = runner(small({ places: [PLACES[0]], cast, templates: [template] }), { draw: drawWith({ values: { 'template:sack': () => 0 } }) }).to(3);
        assert.deepEqual(run.table, {});
        const why = setRefusal({ query: (type, args) => (type === 'packs.content' ? { places: PLACES, cast }[args.kind] ?? [] : null), chronicle: {}, geo: geoOf({ places: PLACES }), declared: CONDITIONS[1], ref: 'Deepmantle Hold', now: 1440, by: 'narrator' });
        assert.match(why, /Oren lives at Deepmantle Hold and is protected/);
    });
}

test('on a map that reads no file ids (no opt-in, or an unmarked reply) a protected home is compared only as written', () => {
    const places = [{ ...PLACES[0], aliases: ['the hold'] }];
    const ask = (home, geo) => {
        const cast = [person({ ...home, protected: true })];
        return setRefusal({ query: (type, args) => (type === 'packs.content' ? { places, cast }[args.kind] ?? [] : null), chronicle: {}, geo, declared: CONDITIONS[1], ref: 'Deepmantle Hold', now: 1440, by: 'narrator' });
    };
    const literal = [['no opt-in', buildGeo({ places })], ['unmarked reply', buildGeo({ ...OPT_IN, places }, { slugs: false })]];
    for (const [label, geo] of literal) {
        for (const home of ['pack.sample/deep-hold', 'the hold', 'deep-hold']) assert.equal(ask({ homeBase: home }, geo), '', `${label}: ${home}`);
        // Only the first of the home base and the start place counts.
        assert.equal(ask({ homeBase: 'a cottage', start: { place: 'Deepmantle Hold' } }, geo), '', label);
        assert.match(ask({ homeBase: 'Deepmantle Hold' }, geo), /is protected/, label);
    }
    for (const home of ['pack.sample/deep-hold', 'the hold', 'deep-hold']) assert.match(ask({ homeBase: home }, geoOf({ places })), /is protected/, home);
});

test('a marked reply: a protected person is found by their start place behind a home base in prose, and by their home base', () => {
    for (const homes of [{ homeBase: 'a cottage behind the old mill', start: { place: 'deep-hold' } }, { homeBase: 'deep-hold', start: { place: 'far-town' } }, { homeBase: 'far-town', start: { place: 'deep-hold' } }]) {
        const cast = [person({ ...homes, protected: true })];
        const why = setRefusal({ query: (type, args) => (type === 'packs.content' ? { places: PLACES, cast }[args.kind] ?? [] : null), chronicle: {}, geo: geoOf({ places: PLACES }), declared: CONDITIONS[1], ref: 'Deepmantle Hold', now: 1440, by: 'narrator' });
        assert.match(why, /Oren lives at Deepmantle Hold and is protected/, homes.homeBase);
    }
});

// State stored before untils were kept under the map's name holds the text as the pack wrote it.
for (const stored of ['cleared:fallen@auvoth', 'cleared:fallen@pack.sample/auvoth']) {
    const events = [
        ev('fall', 'start', { ends_when: { for: '1 day' }, effects: { set: ['fallen@Auvoth: until cleared'], cast: [{ who: 'oren', location: 'Far Town', until: 'cleared:fallen@Auvoth' }] } }),
        ev('relief', 'start + 5 days', { effects: { clear: ['fallen@Auvoth'] } }),
    ];
    const old = () => runner(small({ cast: [person({ homeBase: 'Deepmantle Hold' })], events }));

    test(`a stored displaced until "${stored}" holds while the condition does, and releases when it is cleared`, () => {
        const run = old().to(1);
        run.state.cast.oren.displaced.until = stored;
        run.to(4);
        assert.equal(run.state.cast.oren.displaced?.to, 'Far Town');
        run.to(7);
        assert.equal(run.state.cast.oren.displaced, undefined);
    });

    test(`a stored deferred until "${stored}" still applies when the person parts from You`, () => {
        const run = old();
        run.withYou = ['oren'];
        run.to(1);
        run.state.cast.oren.deferred.until = stored;
        run.withYou = [];
        run.to(2);
        assert.equal(run.state.cast.oren.displaced?.to, 'Far Town');
    });
}

// A place and a region of one name: the narrator keeps a region condition under the region's name, the step reads a ref place first.
const TWINS = {
    places: [place('atlantis', 'Atlantis', { region: 'atlantis' }), place('far-town', 'Far Town', { x: 9 })],
    conditions: [{ name: 'plague', scope: 'region', fades: 'until cleared' }],
};

for (const [label, key] of [['the region\'s name', 'plague@atlantis'], ['the place\'s name', 'plague@Atlantis']]) {
    test(`set: and cleared: anchors read a key kept under ${label}`, () => {
        for (const kind of ['set', 'cleared']) {
            const ws = { geo: geoOf(TWINS), declared: new Map(TWINS.conditions.map(row => [row.name, row])), anchors: { [`${kind}:${key}`]: [5] }, table: {} };
            assert.deepEqual(occurrences(ws, { kind, id: 'plague@atlantis' }), [5], kind);
        }
    });

    test(`an until reads a condition kept under ${label}`, () => {
        const events = [ev('flight', 'start', { ends_when: { for: '1 day' }, effects: { cast: [{ who: 'oren', location: 'Far Town', until: 'cleared:plague@atlantis' }] } })];
        const run = runner(small({ ...TWINS, cast: [person({ homeBase: 'Atlantis' })], events }));
        const [name, ref] = key.split('@');
        run.set(name, ref, 1, 'region').to(4);
        assert.equal(run.state.cast.oren.displaced?.to, 'Far Town', 'held');
        run.clear(name, ref).to(5);
        assert.equal(run.state.cast.oren.displaced, undefined, 'released');
    });
}

test('set: reads a condition in the table under either name', () => {
    for (const ref of ['atlantis', 'Atlantis']) {
        const ws = { geo: geoOf(TWINS), declared: new Map(TWINS.conditions.map(row => [row.name, row])), anchors: {}, table: { [`plague@${ref}`]: { name: 'plague', ref, since: 3 * 1440 } } };
        assert.deepEqual(occurrences(ws, { kind: 'set', id: 'plague@atlantis' }), [3], ref);
    }
});

test('two places of one display name: each file id finds its own', () => {
    const geo = geoOf({ places: [place('north-mill', 'Mill', { region: 'North' }), place('south-mill', 'Mill', { region: 'South' })] });
    for (const [slug, region] of [['north-mill', 'North'], ['south-mill', 'South']]) {
        assert.equal(resolveRef(geo, slug)?.place.region, region, slug);
        assert.equal(resolveRef(geo, `pack.sample/${slug}`)?.place.region, region, slug);
    }
});

test('a file id that spells a realm, a region, a region name or a route leaves that meaning alone', () => {
    const geo = geoOf({
        realms: [{ id: 'highmark-realm', name: 'Highmark', regions: ['lowfen'] }],
        regions: [{ id: 'lowfen', name: 'Zetaland', aliases: ['the-fen'] }],
        routes: [{ name: 'ford', from: 'A', to: 'B' }],
        places: ['highmark', 'highmark-realm', 'lowfen', 'zetaland', 'the-fen', 'ford', 'a-b', 'the wilds', 'plain'].map(slug => place(slug, `Town of ${slug}`, { region: 'Valegard' })),
    });
    for (const [ref, kind] of [['highmark', 'realm'], ['highmark-realm', 'realm'], ['lowfen', 'region'], ['ford', 'route'], ['a-b', 'route'], ['the wilds', 'realm']]) assert.equal(resolveRef(geo, ref)?.kind, kind, ref);
    // A region's shown name and alias are no ref of their own, and a file id does not take them either.
    for (const ref of ['zetaland', 'the-fen']) assert.equal(resolveRef(geo, ref), null, ref);
    assert.equal(resolveRef(geo, 'plain')?.name, 'Town of plain');
});

test('slugs: false leaves the file ids out and keeps names and full ids', () => {
    const geo = buildGeo({ ...OPT_IN, places: PLACES }, { slugs: false });
    assert.equal(resolveRef(geo, 'deep-hold'), null);
    for (const ref of ['Deepmantle Hold', 'pack.sample/deep-hold']) assert.equal(resolveRef(geo, ref)?.name, 'Deepmantle Hold');
});

test('with no opt-in, homes, anchors and untils are read as written, aliases and letter case included', () => {
    const places = [place('deep-hold', 'Deepmantle Hold', { aliases: ['The Hold'] })];
    const read = placeIdPacks => {
        const state = { seed: 's', day: 1, start: 1, anchors: { 'set:unrest@Deepmantle Hold': [1] } };
        const { ws } = makeWs({ state, world: { places, placeIdPacks, conditions: [{ name: 'unrest', scope: 'place' }], cast: [person({ homeBase: 'The Hold' })] }, today: 2 });
        return {
            home: ws.people.get('oren').home, until: withMapName(ws, 'unrest@deepmantle hold'),
            days: ['unrest@The Hold', 'unrest@deep-hold'].map(id => occurrences(ws, { kind: 'set', id })),
        };
    };
    assert.deepEqual(read([]), { home: 'The Hold', until: 'unrest@deepmantle hold', days: [[], []] });
    assert.deepEqual(read(['sample']), { home: 'Deepmantle Hold', until: 'unrest@Deepmantle Hold', days: [[1], [1]] });
});
