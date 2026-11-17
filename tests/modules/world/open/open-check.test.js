// The checks on a Director's answer (spec §5): menu bounds, protection, authored refs refused unless `open: true`, ladder direction and step,
// cast picks, facts only through writes_facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeWs } from '../../../../modules/world/daily/step.js';
import { checkOpen } from '../../../../modules/world/daily/open-check.js';
import { readOpen } from '../../../../modules/world/daily/open-read.js';
import { MENU, WORLD, open } from './open-host.helpers.js';

const LADDER = { of: ['unrest', 'riots', 'uprising'], step: 1, direction: 'up' };
const world = {
    ...WORLD,
    conditions: [...WORLD.conditions, { name: 'riots', scope: 'place', fades: '5 days', open: true }, { name: 'uprising', scope: 'place', fades: '5 days', open: true }, { name: 'fallen', scope: 'place', fades: 'until cleared', placeStatus: true, open: true }, { name: 'ward', scope: 'place', fades: '5 days' }],
    events: [{ id: 'siege', kind: 'one-off', certainty: 'possible', ends_when: 'instant', requires: ['ward@Highmark'], summary: 's' }],
    cast: [...WORLD.cast, { id: 'bard', name: 'Bard', kind: 'figure', start: { place: 'Bluewatch' } }],
};
const bind = { place: 'Highmark', region: 'The March', realm: 'March Realm' };
const def = (menu = MENU, extra = {}) => ({ ...readOpen({ ...open('t'), open: { menu, writes_facts: ['incident-noted'] } }), id: 't', ...extra });
const ctx = () => makeWs({ world, today: 5, seed: 'abc' }).ws;
const run = (answer, menu) => { const ws = ctx(); const d = readOpen({ ...open('t'), open: { menu: menu ?? MENU, writes_facts: ['incident-noted'] } }); return checkOpen(ws, { ...d, id: 't' }, bind, { name: 'N', summary: 'S', people: [], ...answer }, 5); };

test('a valid answer inside the menu produces the effects block', () => {
    const out = run({ people: ['warden'], effects: { powers: { crown: 5 }, set: [{ condition: 'unrest', for: '5 days' }], cast: [{ id: 'warden', to: 'Bluewatch' }], fact: 'incident-noted' } });
    assert.deepEqual(out.errors, []);
    assert.deepEqual(out.block.set, ['unrest@place: 5 days']);
    assert.deepEqual(out.block.cast, [{ who: 'warden', location: 'Bluewatch' }]);
    assert.deepEqual(out.block.powers, { crown: 5 });
});

test('menu bounds: counts, ids, delta, duration, scope, facts and keys outside the menu are refused (all listed)', () => {
    const bad = (effects, pattern) => assert.match(run({ effects }).errors.join(' '), pattern);
    bad({ powers: { crown: 6 } }, /whole number from -5 to 5/);
    bad({ powers: { crown: 1, other: 1 } }, /at most 1|not in this world/);
    bad({ powers: { crown: 1.5 } }, /whole number/);
    bad({ scores: { unity: 1 } }, /not in this template's menu/);
    bad({ set: [{ condition: 'unrest', for: '9 days' }] }, /longer than the menu/);
    bad({ set: [{ condition: 'riots', for: '1 day' }] }, /not in the set menu/);
    bad({ set: [{ condition: 'unrest' }, { condition: 'closed-gates' }] }, /at most 1/);
    bad({ clear: ['unrest'] }, /not in this template's menu/);
    bad({ fact: 'made-up' }, /not in writes_facts/);
    bad({ kill: ['warden'] }, /not something a template can do/);
    bad({ cast: [{ id: 'warden', to: 'Atlantis' }] }, /not a place in The March/);
    assert.match(run({ name: '', effects: {} }).errors.join(' '), /name and a summary/);
});

test('protection: a protected person is never named or moved, a figure outside the menu is refused', () => {
    assert.match(run({ people: ['queen'], effects: {} }).errors.join(' '), /may not name|not a person/);
    assert.match(run({ effects: { cast: [{ id: 'queen', to: 'Bluewatch' }] } }).errors.join(' '), /not a figure the menu lets move/);
    assert.match(run({ effects: { cast: [{ id: 'bard', to: 'Bluewatch' }] } }, { cast: { pick: 1, of: ['warden'], move: '@region' } }).errors.join(' '), /not a figure/);
    const status = run({ effects: { set: [{ condition: 'fallen' }] } }, { set: { pick: 1, of: ['fallen'], at: '@place', for: '5 days' } });
    assert.match(status.errors.join(' '), /protected person lives/, 'no placeStatus where a protected person lives');
});

test('authored refs are refused unless the condition is marked open: true', () => {
    const menu = { set: { pick: 1, of: ['ward', 'unrest'], at: '@place', for: '5 days' }, clear: { pick: 1, of: ['ward'] } };
    assert.match(run({ effects: { set: [{ condition: 'ward' }] } }, menu).errors.join(' '), /read by an authored event/);
    assert.match(run({ effects: { clear: ['ward'] } }, menu).errors.join(' '), /read by an authored event/);
    assert.deepEqual(run({ effects: { set: [{ condition: 'unrest' }] } }, menu).errors, [], 'an open condition may be written');
    // a lore gate and a secret gate count too
    const gated = { ...world, lore: [{ title: 'L', gate: 'set:closed-gates' }] };
    const ws = makeWs({ world: gated, today: 5, seed: 'abc' }).ws;
    const d = { ...readOpen({ ...open('t'), open: { menu: { set: { pick: 1, of: ['closed-gates'], at: '@place', for: '5 days' } } } }), id: 't' };
    assert.match(checkOpen(ws, d, bind, { name: 'N', summary: 'S', effects: { set: [{ condition: 'closed-gates' }] } }, 5).errors.join(' '), /authored event/);
});

test('a ladder moves at most its step, in its direction, never a jump', () => {
    const menu = { ladder: LADDER };
    const ok = run({ effects: { ladder: { direction: 'up', steps: 1 } } }, menu);
    assert.deepEqual(ok.errors, []);
    assert.deepEqual(ok.block.set, ['unrest@place'], 'from nothing: the first rung');
    assert.match(run({ effects: { ladder: { direction: 'down', steps: 1 } } }, menu).errors.join(' '), /moves up/, 'the wrong direction is refused');
    assert.match(run({ effects: { ladder: { direction: 'up', steps: 2 } } }, menu).errors.join(' '), /never a jump/);
    assert.match(run({ effects: { ladder: { direction: 'sideways' } } }, { ladder: { ...LADDER, direction: 'either' } }).errors.join(' '), /up or down/);
});

test('the menu reader refuses what it cannot read (delta outside -10..10, a set at a bad placeholder)', () => {
    assert.ok(readOpen({ open: { menu: { powers: { pick: 1, of: 'any', delta: [-11, 5] } } } }).why);
    assert.ok(readOpen({ open: { menu: { set: { pick: 1, of: ['unrest'], at: '@nowhere', for: '5 days' } } } }).why);
    assert.ok(readOpen({ open: { menu: {} }, per: 'sometimes' }).why);
    assert.equal(readOpen({ summary: 'x' }).none, true);
});
