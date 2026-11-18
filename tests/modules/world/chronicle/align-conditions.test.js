// WEALIGN: the conditions store (job A) and the world line (job D) aligned to world-pack-spec v0.14.4 §1-§2: refs read as the
// condition's scope through the packs' map (ids, realms, the Wilds, named routes), the scope hierarchy read (`at`), clear beats set
// for the whole day across the world line and the daily step, the protected-resident rule for placeStatus, and the ledger (E24).
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChronicle } from '../../../../modules/world/chronicle/domain.js';
import { ledgerOf, validateLedger } from '../../../../modules/world/chronicle/conditions/ledger.js';
import { runDays } from '../../../../modules/world/daily/step.js';
import { recordAnchor } from '../../../../modules/world/daily/anchors.js';
import { WORLD_EVENTS } from '../../../../modules/world/chronicle/capture/world-parts/switch.js';
import { part } from '../../../../modules/world/chronicle/index.js';
import { clockAt, line, makeState, query, runCommand } from './helpers/fake-ctx.js';

const DAY = 1440;
const ON = { [WORLD_EVENTS]: true };
const PACKS = {
    conditions: [
        { name: 'grain-dear', scope: 'region', fades: '10 days', means: 'Bread costs more.' },
        { name: 'at-war', scope: 'realm', fades: 'until cleared', means: 'War.' },
        { name: 'roads-closed', scope: 'route', fades: 'until cleared', means: 'Nobody passes.' },
        { name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds.' },
        { name: 'fallen', scope: 'place', fades: 'until cleared', means: 'Fallen.', placeStatus: true },
    ],
    realms: [{ id: 'highmark-empire', name: 'Highmark Empire', regions: ['Valegard', 'The March'] }],
    places: [
        { name: 'Oakhollow', id: 'oakhollow', region: 'Valegard', x: 0, y: 0 }, { name: 'Highmark', id: 'highmark-capital', region: 'The March', x: 5, y: 0 },
        { name: 'Ledgerford', id: 'ledgerford', region: 'The March', x: 9, y: 0 }, { name: 'Northledger Depot', id: 'northledger-depot', region: 'The March', x: 9, y: 9 },
        { name: 'Shackles City', id: 'shackles-city', region: 'Deepfen', x: 50, y: 50 }, { name: 'Shackles City / Veil Market', id: 'veil-market', region: 'Deepfen', kind: 'district', x: 51, y: 50 },
    ],
    routes: [
        { from: 'Ledgerford', to: 'Northledger Depot', kind: 'river', km: 40, name: 'ledgerford-river' },
        { from: 'Ledgerford', to: 'Northledger Depot', kind: 'bastion road', km: 40, name: 'ledgerford-bastion' },
    ],
    cast: [{ id: 'sir-lothar', name: 'Sir Lothar', kind: 'companion', protected: true, homeBase: 'Shackles City / Veil Market' }],
    list: [{ id: 'p', name: 'Ersveil' }],
};
const start = (minutes = DAY) => clockAt(makeState({ minutes }), minutes);
const run = (state, type, payload, options = {}) => runCommand(state, part.commands[type], payload, { cause: 'system', packs: PACKS, features: ON, ...options });
const set = (state, payload, options) => run(state, 'chronicle.condition.set', { by: 'director', why: 'test', ...payload }, options);
const clear = (state, payload, options) => run(state, 'chronicle.condition.clear', { by: 'narrator', why: 'calm', ...payload }, options);
const must = result => { assert.equal(result.ok, true, result.message); return result.state; };
const keys = state => Object.keys(state.domains.chronicle.conditions ?? {}).sort();
const at = (state, ref) => query(state, 'chronicle.conditions', { at: ref }, { packs: PACKS }).map(entry => entry.key);
const later = (state, minutes) => clockAt(state, minutes);

test('test 99 (runtime) and §1 ids: a ref is read as the condition\'s scope; ids, names, the realm and the Wilds resolve; a place ref on a region condition is refused', () => {
    assert.match(set(start(), { name: 'grain-dear', ref: 'highmark-capital' }).message, /not a region of this world \(a region condition takes a region\)/);
    assert.deepEqual(keys(must(set(start(), { name: 'unrest', ref: 'highmark-capital' }))), ['unrest@Highmark'], 'a place id finds the place, kept under its name');
    assert.deepEqual(keys(must(set(start(), { name: 'at-war', ref: 'highmark-empire' }))), ['at-war@Highmark Empire'], 'a realm id');
    assert.deepEqual(keys(must(set(start(), { name: 'at-war', ref: 'the Wilds' }))), ['at-war@the Wilds'], 'the Wilds is one realm');
    assert.match(set(start(), { name: 'at-war', ref: 'Valegard' }).message, /not a realm/, 'a region is not a realm (the old store took one)');
    assert.match(set(start(), { name: 'at-war', ref: 'Ersveil' }).message, /not a realm/, 'a pack name is not a realm');
});

test('test 72: two named routes between the same places; roads-closed on the bastion road is that route only; no corridor scope', () => {
    const s = must(set(start(), { name: 'roads-closed', ref: 'ledgerford-bastion' }));
    assert.deepEqual(keys(s), ['roads-closed@ledgerford-bastion']);
    assert.deepEqual(at(s, 'ledgerford-river'), []);
    assert.deepEqual(at(s, 'ledgerford-bastion'), ['roads-closed@ledgerford-bastion']);
});

test('tests 5, 24 and 71: the hierarchy read (`at`): a broader condition holds at a narrower ref, never the reverse; a city\'s placeStatus holds in its districts', () => {
    const war = must(set(start(), { name: 'at-war', ref: 'Highmark Empire' }));
    assert.deepEqual(at(war, 'Oakhollow'), ['at-war@Highmark Empire'], 'the realm\'s war holds at a place in Valegard');
    assert.deepEqual(at(war, 'Valegard'), ['at-war@Highmark Empire']);
    const dear = must(set(start(), { name: 'grain-dear', ref: 'The March' }));
    assert.deepEqual(at(dear, 'Highmark'), ['grain-dear@The March']);
    assert.deepEqual(at(dear, 'Highmark Empire'), [], 'test 24: a region\'s condition does not hold for its realm');
    assert.deepEqual(at(dear, 'Oakhollow'), [], 'nor in another region');
    const fallen = must(set(start(), { name: 'fallen', ref: 'Shackles City' }, { packs: { ...PACKS, cast: [] } }));
    assert.deepEqual(at(fallen, 'Shackles City / Veil Market'), ['fallen@Shackles City'], 'test 71: the district is covered');
    // A mask the daily step keeps (a local clear under a broader one) hides it there only.
    const masked = structuredClone(war);
    masked.domains.chronicle.daily = [{ seed: 'x', start: 1, day: 1, events: {}, anchors: {}, lastMajor: {}, cast: {}, standings: {}, facts: {}, masks: { 'at-war@Valegard': true }, minors: [], cooldowns: {} }];
    assert.deepEqual(at(masked, 'Oakhollow'), []);
    assert.deepEqual(at(masked, 'Highmark'), ['at-war@Highmark Empire']);
});

test('test 98 (store side): a region condition is cleared on its region and is gone for every place in it; places outside keep theirs', () => {
    let s = must(set(start(), { name: 'grain-dear', ref: 'The March' }));
    s = must(set(s, { name: 'grain-dear', ref: 'Valegard' }));
    assert.match(clear(s, { name: 'grain-dear', ref: 'Highmark' }).message, /not a region of this world/, 'a place ref on a region condition is refused (clearing scope)');
    s = must(clear(s, { name: 'grain-dear', ref: 'The March' }));
    assert.deepEqual([at(s, 'Highmark'), at(s, 'Ledgerford'), at(s, 'Oakhollow')], [[], [], ['grain-dear@Valegard']]);
});

test('test 7 (store side): a clear at a ref on day T is not undone by a set there on day T, by the world line or the daily step; the next day it may be set', () => {
    let s = must(set(start(), { name: 'unrest', ref: 'Highmark' }));
    s = must(clear(s, { name: 'unrest', ref: 'Highmark' }));
    assert.deepEqual(ledgerOf(s.domains.chronicle.ledger).tomb, { day: 1, keys: ['unrest@Highmark'] });
    const again = set(later(s, DAY + 600), { name: 'unrest', ref: 'Highmark' });
    assert.deepEqual([again.ok, again.code], [false, 'REFUSED']);
    assert.match(again.message, /cleared on Highmark today; a clear is not undone the same day/);
    assert.equal(set(later(s, DAY + 600), { name: 'unrest', ref: 'Ledgerford' }).ok, true, 'another ref is free');
    assert.equal(set(later(s, 2 * DAY + 1), { name: 'unrest', ref: 'Highmark' }).ok, true, 'the next day it may be set');
    // The world line asks first: the refusal is a note and the line stands.
    const options = { features: [WORLD_EVENTS], packs: PACKS, carrier: { sid: 'sid_a' }, call: (type, payload, ctx) => part.commands[type](ctx, payload) };
    const lined = line(later(s, DAY + 700), '+ world Riot — again | place: Highmark | conditions: +unrest', options);
    assert.equal(lined.ok, true);
    assert.match(lined.result.summary, /Not used: "unrest": unrest was cleared on Highmark today/);
    // The daily step reads the same tomb: an event that sets unrest at Highmark on day 1 does not set it there.
    const world = { ...PACKS, events: [{ id: 'riot', kind: 'one-off', certainty: 'set-in-motion', reach: 'local', where: ['Highmark'], window: { after: 'start', within: '1 day' }, effects: { set: ['unrest@Highmark: 5 days'] }, ends_when: 'instant', summary: 'A riot.' }] };
    const blocked = runDays({ world, today: 1, seed: 'a', marks: ledgerOf(s.domains.chronicle.ledger) });
    assert.equal('unrest@Highmark' in blocked.conditions, false);
    assert.deepEqual(blocked.report.tomb, ['unrest@Highmark'], 'today\'s tomb goes back to the ledger');
    assert.ok('unrest@Highmark' in runDays({ world, today: 1, seed: 'a' }).conditions, 'without the tomb the event sets it');
});

test('test 25 (world line part): a world line with no duration uses the condition\'s fades; a few hours is raised to a whole day', () => {
    const options = { features: [WORLD_EVENTS], packs: PACKS, carrier: { sid: 'sid_a' }, call: (type, payload, ctx) => part.commands[type](ctx, payload) };
    const lined = line(start(), '+ world Riot — crowds | place: Highmark | conditions: +unrest', options);
    assert.equal(lined.state.domains.chronicle.conditions['unrest@Highmark'].fadesAt, DAY + 10 * DAY);
    assert.equal(must(set(start(), { name: 'unrest', ref: 'Highmark', fades: '5 hours' })).domains.chronicle.conditions['unrest@Highmark'].fadesAt, 2 * DAY);
});

test('world line refs by scope: a realm condition takes the place\'s realm, a route condition needs name@route, an explicit ref is read as the scope', () => {
    const options = { features: [WORLD_EVENTS], packs: PACKS, carrier: { sid: 'sid_a' }, call: (type, payload, ctx) => part.commands[type](ctx, payload) };
    const war = line(start(), '+ world War — drums | place: Oakhollow | conditions: +at-war', options);
    assert.deepEqual(keys(war.state), ['at-war@Highmark Empire']);
    const road = line(start(), '+ world Slide — mud | place: Ledgerford | conditions: +roads-closed', options);
    assert.match(road.result.summary, /"roads-closed" is a route condition: write it as roads-closed@<route>/);
    const named = line(start(), '+ world Slide — mud | place: Ledgerford | conditions: +roads-closed@ledgerford-bastion', options);
    assert.deepEqual(keys(named.state), ['roads-closed@ledgerford-bastion']);
    const wild = line(start(), '+ world Raid — smoke | place: Shackles City | conditions: +at-war', options);
    assert.deepEqual(keys(wild.state), ['at-war@the Wilds'], 'a place in a region of no realm is in the Wilds');
});

test('protected people: a placeStatus where a protected person lives (or in a district under it) is refused for the narrator and the Director, taken from an authored event', () => {
    for (const ref of ['Shackles City', 'Shackles City / Veil Market']) {
        const r = set(start(), { name: 'fallen', ref });
        assert.deepEqual([r.ok, r.code], [false, 'REFUSED'], ref);
        assert.match(r.message, /Sir Lothar lives at .* and is protected; only an authored event may set fallen there/);
    }
    assert.deepEqual(keys(must(set(start(), { name: 'fallen', ref: 'Shackles City', by: 'event:siege' }))), ['fallen@Shackles City']);
    assert.equal(set(start(), { name: 'fallen', ref: 'Highmark' }).ok, true, 'nobody protected lives there');
    assert.equal(set(start(), { name: 'unrest', ref: 'Shackles City' }).ok, true, 'not a placeStatus condition');
});

test('E24: the anchors a world line or the Director makes go to the ledger, and the next daily step takes them into its permanent anchors (the first occurrence is kept)', () => {
    let s = must(set(start(), { name: 'unrest', ref: 'Highmark' }));
    s = must(clear(later(s, 3 * DAY), { name: 'unrest', ref: 'Highmark' }));
    const marks = ledgerOf(s.domains.chronicle.ledger);
    assert.deepEqual(marks.anchors, { 'set:unrest': [1], 'set:unrest@Highmark': [1], 'cleared:unrest': [3], 'cleared:unrest@Highmark': [3] });
    assert.deepEqual(validateChronicle(s.domains.chronicle), []);
    const out = runDays({ world: PACKS, today: 4, seed: 'a', marks });
    assert.deepEqual([out.daily.anchors['set:unrest'], out.daily.anchors['cleared:unrest@Highmark']], [[1], [3]]);
    const many = {};
    for (let day = 1; day <= 20; day += 1) recordAnchor(many, 'fired:famine', day);
    assert.deepEqual(many['fired:famine'], [1, 14, 15, 16, 17, 18, 19, 20], 'anchor_mode first still finds day 1');
    assert.deepEqual(validateLedger([{ anchors: { 'set:x': [1] }, tomb: { day: 2, keys: ['x@Y'] } }]), []);
    assert.equal(validateLedger([{ anchors: { 'set:x': 'one' } }]).length, 1);
    assert.equal(validateLedger([{ anchors: {}, extra: 1 }]).length, 1);
});
