// The daily step and the cast store (cast-tie.js; spec v0.14.5-v0.14.9 §8; seam audit E1, E5, E9, E10): who is with You (the party's
// members who have not left, and the scene's present people, by name or alias), each pack person's place and latest base, who has been
// met; and the step's moves, releases and deaths written into the cast store (a move clears a journey; a release clears only its own base).
import test from 'node:test';
import assert from 'node:assert/strict';

import { mirrorCast, tickInputs } from '../../../../modules/world/chronicle/world-daily/cast-tie.js';

const person = (eid, more = {}) => ({ pack: 'ersveil', eid, name: eid[0].toUpperCase() + eid.slice(1), where: 'Kesh', doing: 'about', since: 0, alive: true, met: null, ...more });
const ctxWith = answers => ({ query: name => answers[name] ?? null, ifThere() {} });

test('tickInputs: party (not left) and scene present → with You by name or alias; positions with the base; met', () => {
    const cast = { people: {
        'ersveil:temiwa': person('temiwa', { aliases: ['the archivist'], met: { on: 0 } }),
        'ersveil:oren': person('oren', { base: [{ at: 'Shorn', since: 5, routine: 'r', by: 'story' }], where: 'Shorn' }),
        'ersveil:durvald': person('durvald'),
        'other:durvald': person('durvald', { pack: 'other', where: 'Elsewhere' }),
    } };
    const ctx = ctxWith({ 'party.levels': [{ name: 'Temiwa', left: false }, { name: 'Durvald', left: true }], 'scene.present': ['The Archivist', { name: 'Oren' }] });
    const out = tickInputs(ctx, cast, [{ id: 'sir-lothar', name: 'Sir Lothar', aliases: ['the Grey Knight'] }]);
    assert.deepEqual(out.withYou, ['oren', 'temiwa'], 'Durvald left the party; Oren is in the scene');
    assert.deepEqual(out.positions.oren, { at: 'Shorn', base: 'Shorn' });
    assert.deepEqual(out.positions.durvald, { at: 'Kesh', base: null }, 'two packs share an id: the first key (sorted) is the one');
    assert.deepEqual(out.met, ['temiwa']);
    const lothar = tickInputs(ctxWith({ 'scene.present': ['the grey knight'] }), { people: {} }, [{ id: 'sir-lothar', name: 'Sir Lothar', aliases: ['the Grey Knight'] }]);
    assert.deepEqual(lothar.withYou, ['sir-lothar'], 'a person not yet in the cast store is found by the world cast\'s names');
});

test('mirrorCast: a move sets where, doing, base and since and clears a journey; a release clears only its own base; an unmet death', () => {
    const cast = { people: {
        'ersveil:lothar': person('lothar', { coming: [{ from: 'Kesh', to: 'Harrow', start: 0, arrive: 99, reason: 'r', rev: 0 }], known: [{ where: 'Kesh', since: 0 }] }),
        'ersveil:oren': person('oren', { base: [{ at: 'Shorn', since: 5, routine: 'r', by: 'story' }] }),
        'ersveil:brom': person('brom'),
        'ersveil:mira': person('mira', { met: { on: 0 } }),
    } };
    const keys = new Map(Object.keys(cast.people).map(key => [key.split(':')[1], key]));
    mirrorCast(ctxWith({}), cast, { moves: [{ id: 'lothar', to: 'Gwenmar', by: 'summons', until: 'end', routine: 'attends the regent' }], deaths: [{ id: 'brom' }, { id: 'mira' }] }, keys, 1440);
    const lothar = cast.people['ersveil:lothar'];
    assert.deepEqual([lothar.where, lothar.doing, lothar.since, lothar.coming, lothar.known], ['Gwenmar', 'attends the regent', 1440, null, null]);
    assert.deepEqual(lothar.base, [{ at: 'Gwenmar', since: 1440, routine: 'attends the regent', by: 'event:summons' }]);
    assert.equal(cast.people['ersveil:brom'].alive, false, 'an unmet death is mirrored');
    assert.equal(cast.people['ersveil:mira'].alive, true, 'a met death is NPC State\'s (never written here)');
    mirrorCast(ctxWith({}), cast, { released: [{ id: 'oren', by: 'summons', to: 'Shorn' }, { id: 'lothar', by: 'summons', to: 'Gwenmar' }] }, keys, 2880);
    assert.equal(cast.people['ersveil:lothar'].base, null, 'the event\'s own base is released');
    assert.equal(cast.people['ersveil:oren'].base[0].by, 'story', 'a story base is not the event\'s to release');
});

test('mirrorCast: the world\'s must-happen death (cue: true) is written even for someone met, who is with You', () => {
    const cast = { people: { 'ersveil:mira': person('mira', { met: { on: 0 } }), 'ersveil:oren': person('oren', { met: { on: 0 } }) } };
    const keys = new Map(Object.keys(cast.people).map(key => [key.split(':')[1], key]));
    mirrorCast(ctxWith({}), cast, { deaths: [{ id: 'mira', cue: true }, { id: 'oren' }] }, keys, 1440);
    assert.equal(cast.people['ersveil:mira'].alive, false, 'a cue death reaches the cast store');
    assert.equal(cast.people['ersveil:oren'].alive, true, 'any other met death stays NPC State\'s');
});
