// The story's own moves become a person's base (switch story-director.world-events; spec v0.14.7 §8 Latest base wins, rulings 36-37;
// acceptance tests 114, 115, 117, the cast side): a dossier `where:` change, a party leave (stays) and a rejoin (cleared), what was
// seen kept in `told`; the planner's view and its moves against the base; the hook's step and the switch off.
import test from 'node:test';
import assert from 'node:assert/strict';

import { storyBases } from '../../../../modules/cast/cast/world-parts/story-bases.js';
import { basedView, keepsBase, pullsFree } from '../../../../modules/cast/cast/world-parts/bases.js';
import { story } from '../../../../modules/cast/cast/capture-parts/story-step.js';
import { createCastHooks } from '../../../../modules/cast/cast/hooks.js';
import { createPlans } from '../../../../modules/cast/cast/plan.js';
import { validateCast } from '../../../../modules/cast/cast/domain.js';

const person = (eid, more = {}) => ({ pack: 'ersveil', eid, name: eid[0].toUpperCase() + eid.slice(1), ver: '1', joined: 0, where: 'Gwenmar', doing: 'about', since: 0, alive: true, met: { on: 0, where: 'Harrow', why: 'place', reason: '', rev: 0 }, heard: null, rev: 0, ...more });
const npc = (key, location) => ({ name: key, location, castFrom: { key, id: key.split(':')[1] } });
const ctxFor = cast => ({ cause: 'system', rev: 3, time: () => 600, draft: () => cast, ifThere() {}, fail: (code, text) => { throw new Error(`${code}: ${text}`); } });

test('the first sight is only noted; a where: change later is a story base there (test 117)', () => {
    const slice = { people: { 'ersveil:durvald': person('durvald') }, notes: {} };
    const first = storyBases(slice, { npcs: { n1: npc('ersveil:durvald', 'Ledgerford') } });
    assert.deepEqual(first, { set: [], clear: [], told: [{ key: 'ersveil:durvald', where: 'Ledgerford', left: null }] });
    story(ctxFor(slice), first);
    assert.equal(storyBases(slice, { npcs: { n1: npc('ersveil:durvald', 'Ledgerford') } }), null, 'nothing changed: no step');
    const moved = storyBases(slice, { npcs: { n1: npc('ersveil:durvald', 'Northledger Depot') } });
    assert.deepEqual(moved.set, [{ key: 'ersveil:durvald', at: 'Northledger Depot', by: 'story', routine: 'staying at Northledger Depot' }]);
    story(ctxFor(slice), moved);
    const durvald = slice.people['ersveil:durvald'];
    assert.deepEqual(durvald.base, [{ at: 'Northledger Depot', since: 600, routine: 'staying at Northledger Depot', by: 'story' }]);
    assert.deepEqual([durvald.where, durvald.doing], ['Northledger Depot', 'staying at Northledger Depot']);
    assert.deepEqual(validateCast(slice), []);
});

test('a companion who leaves the party gets a stays record at the party\'s place; rejoining clears it; leaving elsewhere writes a new one (tests 114-115)', () => {
    const slice = { people: { 'ersveil:temiwa': person('temiwa') }, notes: {} };
    const npcs = { n1: npc('ersveil:temiwa', '') };
    const at = (left, place) => storyBases(slice, { npcs, party: [{ id: 'm1', name: 'Temiwa', level: 3, left }], place });
    story(ctxFor(slice), at(false, 'Ledgerford'));
    const leave = at(true, 'Ledgerford');
    assert.deepEqual(leave.set, [{ key: 'ersveil:temiwa', at: 'Ledgerford', by: 'stays', routine: 'waits for You at Ledgerford' }]);
    story(ctxFor(slice), leave);
    assert.equal(slice.people['ersveil:temiwa'].base[0].by, 'stays');
    const back = at(false, 'Shorn');
    assert.deepEqual(back.clear, ['ersveil:temiwa'], 'rejoining clears the record');
    story(ctxFor(slice), back);
    assert.equal(slice.people['ersveil:temiwa'].base, null);
    story(ctxFor(slice), at(true, 'Shorn'));
    assert.deepEqual([slice.people['ersveil:temiwa'].base[0].at, slice.people['ersveil:temiwa'].base[0].by], ['Shorn', 'stays'], 'a later leave at another place');
    assert.deepEqual(validateCast(slice), []);
});

test('the planner\'s view and moves against a base; off → as before', () => {
    const held = person('lothar', { base: [{ at: 'Gwenmar', since: 0, routine: 'attends the regent', by: 'event:summons' }] });
    const view = { ref: 'lothar', name: 'Lothar', goal: 'g', routine: 'drills', where: 'Kesh', doing: 'x', drawnTo: [], met: false, mayDie: false };
    assert.deepEqual(basedView(view, held, true), { ...view, where: 'Gwenmar', routine: 'attends the regent' });
    assert.equal(basedView(view, held, false), view, 'switch off: unchanged');
    assert.equal(keepsBase(held, { key: 'k', where: 'Kesh' }, true), false, 'away from the base: dropped');
    assert.equal(keepsBase(held, { key: 'k', where: 'gwenmar' }, true), true, 'at the base: kept');
    assert.equal(keepsBase(held, { key: 'k', where: 'Kesh' }, false), true, 'switch off: kept');
    const comes = [{ key: 'a', reason: 'r' }, { key: 'b', reason: 'r' }];
    assert.deepEqual(pullsFree(comes, { a: held, b: person('b') }, true), [{ key: 'b', reason: 'r' }], 'no goal pull for someone at a base (E1)');
    assert.equal(pullsFree(comes, { a: held }, false), comes);
});

test('the cast hook writes cast.story after the reply only with world events on', async () => {
    const hooks = createCastHooks({ plans: createPlans() });
    const state = { domains: { cast: { people: { 'ersveil:durvald': person('durvald') }, notes: {}, day: null, meeting: null }, people: { npcs: { n1: npc('ersveil:durvald', 'Ledgerford') } } } };
    const view = on => ({ state, feature: id => (id === 'story-director.cast' ? true : id === 'story-director.world-events' ? on : false), query: () => null, settings: () => ({}) });
    const out = hooks.afterCapture(view(true), { index: 4 });
    assert.deepEqual(out?.commands?.map(command => command.type), ['cast.story']);
    assert.equal(hooks.afterCapture(view(false), { index: 4 }), undefined, 'switch off: nothing');
});
