// Chronicle part: `chronicle.lasting` keep-in-mind, replay, and the Journal.
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_KEPT, keptEvents, validateChronicle } from '../../../../modules/world/chronicle/domain.js';
import { TAIL_HEADER, chronicleTail } from '../../../../modules/world/chronicle/note.js';
import { pickEvents, tailPick } from '../../../../modules/world/chronicle/pick.js';
import { entryOf } from '../../../../modules/world/chronicle/days.js';
import { clockAt, command, eventNamed, line, lines, makeState, replay, runCommand, viewOf } from './helpers/fake-ctx.js';
import { part } from '../../../../modules/world/chronicle/index.js';
import { BY, DAY, SEAL, crowd, lasting, must, shown } from './lasting.helpers.js';

// ---- keep in mind ----------------------------------------------------------------------------------

test('keep: the two most recently updated kept open entries take seats first, within the three; a resolved one is not kept', () => {
    let state = crowd(6);
    // Three kept entries, updated on different days: only the newest two are held.
    for (const [i, name] of ['Seal A', 'Seal B', 'Seal C'].entries()) {
        state = clockAt(state, (2 + i) * DAY);
        state = must(lasting(state, { name, state: 'ongoing', keep: true, summary: `kept ${name}` }, { seed: 20 + i })).state;
    }
    assert.equal(MAX_KEPT, 2);
    assert.deepEqual(keptEvents(state.domains.chronicle).map(event => event.name), ['Seal C', 'Seal B']);
    // Many more open than seats: every pick has both kept entries, and the third seat is the best of the rest.
    for (let round = 0; round < 20; round += 1) {
        const ids = pickEvents(state.domains.chronicle, { round, jitter: id => (id.charCodeAt(5) % 10) / 10 });
        assert.equal(ids.length, 3);
        assert.deepEqual(ids.slice(0, 2).map(id => state.domains.chronicle.events[id].name), ['Seal C', 'Seal B']);
    }
    const tail = chronicleTail(viewOf(state));
    assert.equal(tail.lines[0], TAIL_HEADER);
    assert.deepEqual(shown(tail).slice(0, 2), ['Seal C', 'Seal B']);
    assert.equal(tail.lines.length, 4, 'header and three events at most');
    // The oldest kept one keeps nothing: it is a plain open entry among the rest.
    assert.equal(keptEvents(state.domains.chronicle).some(event => event.name === 'Seal A'), false);

    // A kept entry that resolves is not held; the next most recent takes its seat.
    state = clockAt(state, 9 * DAY);
    state = must(lasting(state, { name: 'Seal C', state: 'resolved' }, { seed: 30 })).state;
    assert.deepEqual(keptEvents(state.domains.chronicle).map(event => event.name), ['Seal B', 'Seal A']);
    assert.equal(eventNamed(state, 'Seal C').keep, true, 'the flag stays; a resolved entry is simply not in the tail');
    assert.equal(shown(chronicleTail(viewOf(state))).includes('Seal C'), false);
});

test('keep: with three or fewer open, all are shown, the kept ones first; an entry the reader un-keeps loses its seat', () => {
    let state = lines(makeState({ minutes: DAY }), '+ world Border War — raids\n+ world Red Plague — coughing').state;
    state = clockAt(state, 3 * DAY);
    state = must(lasting(state, SEAL)).state;
    assert.deepEqual(shown(chronicleTail(viewOf(state)))[0], 'Seventh seal failed');
    assert.equal(shown(chronicleTail(viewOf(state))).length, 3);
    const id = eventNamed(state, 'Seventh seal failed').id;
    state = clockAt(state, 4 * DAY);
    state = must(command(state, 'chronicle.edit', { id, keep: false })).state;
    assert.deepEqual(keptEvents(state.domains.chronicle), []);
});

test('keep: a pick already made for this reply still holds the kept entries, even one marked after it', () => {
    let state = crowd(5);
    const surface = runCommand(state, part.commands['chronicle.surface'], { at: 10 }, { cause: 'system' });
    state = surface.state;
    const picked = state.domains.chronicle.surfaced[0]?.ids ?? state.domains.chronicle.surfaced.ids;
    state = clockAt(state, 2 * DAY);
    const left = Object.values(state.domains.chronicle.events).find(event => !picked.includes(event.id));
    state = must(command(state, 'chronicle.edit', { id: left.id, keep: true })).state;
    const ids = tailPick(state.domains.chronicle, { at: 10, rev: 1 });
    assert.equal(ids.length, 3);
    assert.equal(ids[0], left.id);
});

test('without keep a pick is exactly what it was: the same ids, in the same order, for the same seeds', () => {
    const state = crowd(7);
    const before = pickEvents(state.domains.chronicle, { round: 3, jitter: id => (id.charCodeAt(6) % 10) / 10 });
    const withLasting = must(lasting(state, { name: 'Plain change', state: 'resolved' })).state;
    assert.deepEqual(pickEvents(withLasting.domains.chronicle, { round: 3, jitter: id => (id.charCodeAt(6) % 10) / 10 }), before);
    assert.deepEqual(keptEvents(withLasting.domains.chronicle), []);
});

// ---- replay -----------------------------------------------------------------------------------------

test('replay of the ops equals the state they built (create, update, world line held, reader edit)', () => {
    const initial = makeState({ minutes: DAY });
    const runs = [];
    let state = initial;
    const step = run => { must(run); runs.push(run); state = run.state; };
    step(lasting(state, SEAL));
    step(line(state, '~ world Seventh seal failed | state: resolved — the Guild mended it', { seed: 9 }));
    step(lasting(clockAt(state, 3 * DAY), { name: 'Seventh seal failed', state: 'resolved', keep: false }, { caller: 'event:the-seal-is-mended', seed: 11 }));
    step(command(state, 'chronicle.edit', { id: eventNamed(state, 'Seventh seal failed').id, state: 'looming', locked: false }));
    const rebuilt = replay(initial, runs);
    assert.deepEqual(rebuilt.domains.chronicle, state.domains.chronicle);
    assert.deepEqual(validateChronicle(rebuilt.domains.chronicle), []);
});

// ---- the Journal ------------------------------------------------------------------------------------

test('the Journal\'s world line of a day: a pack event\'s lasting change is told like a world line of that reply', () => {
    const state = must(lasting(makeState({ minutes: DAY }), SEAL, { seed: 4 })).state;
    const fire = { rev: 1, type: 'events.fire', cause: 'system', narrate: true, summary: 'The seventh seal has failed.', data: { event: 'the-seventh-seal-fails', then: ['chronicle.lasting'] } };
    const rev = state.domains.chronicle.events[eventNamed(state, 'Seventh seal failed').id].rev;
    assert.equal(rev, 1);
    // Through the query the note reads: the entry the event wrote at that revision, by that event.
    const noted = part.queries['chronicle.noteFacts'](state, { after: 0, minutes: DAY }, { receipts: () => [{ index: 0, receipt: fire }] });
    assert.deepEqual(noted.entries[0].entry.world, [{ id: eventNamed(state, 'Seventh seal failed').id, text: 'World: Seventh seal failed (Auvoth) is ongoing — The seal over Auvoth has failed.' }]);
    const facts = entryOf([fire], 1, { lasting: r => (r === 1 ? [{ id: 'ev_x', by: BY, text: 'World: Seventh seal failed (Auvoth) is ongoing — The seal over Auvoth has failed.' }] : []) });
    assert.deepEqual(facts.world, [{ id: 'ev_x', text: 'World: Seventh seal failed (Auvoth) is ongoing — The seal over Auvoth has failed.' }]);
    assert.deepEqual(facts.happened, [{ text: 'The seventh seal has failed.', told: true, type: 'events.fire' }], 'the cue is still a thing that happened');
    // Not for another event's step, nor without the lasting step, nor for a receipt of another revision.
    const other = { ...fire, data: { event: 'another', then: ['chronicle.lasting'] } };
    assert.deepEqual(entryOf([other], 1, { lasting: () => [{ id: 'ev_x', by: BY, text: 'x' }] }).world, []);
    const without = { ...fire, data: { event: 'the-seventh-seal-fails', then: ['wallet.receive'] } };
    assert.deepEqual(entryOf([without], 1, { lasting: () => [{ id: 'ev_x', by: BY, text: 'x' }] }).world, []);
    assert.deepEqual(entryOf([fire], 1).world, [], 'no lasting reader, as before');
});

test('the Journal finds a lasting change by the receipt that fired it, not by the entry\'s current revision', () => {
    const name = 'Seventh seal failed';
    const fire = { rev: 1, type: 'events.fire', cause: 'system', narrate: true, summary: 'The seventh seal has failed.', data: { event: 'the-seventh-seal-fails', then: ['chronicle.lasting'] } };
    const noted = state => part.queries['chronicle.noteFacts'](state, { after: 0, minutes: DAY }, { receipts: () => [{ index: 0, receipt: fire }] }).entries[0].entry.world;
    let state = must(lasting(makeState({ minutes: DAY }), SEAL, { seed: 4 })).state;
    assert.deepEqual(eventNamed(state, name).fire, { rev: 1, by: BY });
    assert.equal(noted(state).length, 1);

    // The story's own world line in the same reply adds to the summary: the entry's rev moves on, the fire is still found.
    state = must(line(state, `~ world ${name} — a second crack`, { seed: 5 })).state;
    assert.equal(eventNamed(state, name).rev, 2);
    assert.deepEqual(eventNamed(state, name).fire, { rev: 1, by: BY }, 'a world line is not a fire');
    assert.equal(noted(state).length, 1);
    assert.match(noted(state)[0].text, /^World: Seventh seal failed \(Auvoth\) is ongoing — /);

    // So does a change by the reader, even one that clears the lock (the `by` of the entry itself).
    state = must(command(state, 'chronicle.edit', { id: eventNamed(state, name).id, summary: 'Mended by hand.' })).state;
    assert.equal(noted(state).length, 1);
    assert.match(noted(state)[0].text, /Mended by hand/, 'the line tells the entry as it stands');
    state = must(command(state, 'chronicle.edit', { id: eventNamed(state, name).id, locked: false })).state;
    assert.equal(eventNamed(state, name).by, undefined);
    assert.equal(noted(state).length, 1);

    // Another event\'s fire is the entry\'s fire now: the first receipt is not attributed to it, the second is.
    state = must(lasting(clockAt(state, 2 * DAY), { name, state: 'resolved' }, { caller: 'event:the-seal-is-mended', seed: 6 })).state;
    assert.deepEqual(eventNamed(state, name).fire, { rev: state.meta.rev, by: 'event:the-seal-is-mended' });
    assert.equal(noted(state).length, 0);
    const mended = { ...fire, rev: state.meta.rev, data: { event: 'the-seal-is-mended', then: ['chronicle.lasting'] } };
    assert.equal(part.queries['chronicle.noteFacts'](state, { after: 0, minutes: DAY }, { receipts: () => [{ index: 1, receipt: mended }] }).entries[0].entry.world.length, 1);

    // An unchanged repeat is not a fire.
    const same = must(lasting(clockAt(state, 3 * DAY), { name, state: 'resolved' }, { caller: 'event:the-seal-is-mended', seed: 7 }));
    assert.deepEqual(eventNamed(same.state, name).fire, eventNamed(state, name).fire);
    assert.deepEqual(validateChronicle(state.domains.chronicle), []);

    // An entry written by hand without one is found by the revision it was last changed at, by the event that locked it.
    const old = structuredClone(must(lasting(makeState({ minutes: DAY }), SEAL)).state);
    delete old.domains.chronicle.events[eventNamed(old, name).id].fire;
    assert.equal(noted(old).length, 1);
});
