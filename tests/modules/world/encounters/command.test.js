// Encounters, the roll command on a stand-in ctx: refused from a click; skipped with no clock, in a fight, beside the pulse's person cue or
// the cast's meeting for the same reply, with no place, and once told for the place and part of the day; the promotion command's checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encounterCommand, promoteCommand, ledgerOf } from '../../../../modules/world/encounters/index.js';

const MORNING = 1440 * 10 + 9 * 60;
function ctxOf({ cause = 'system', minutes = MORNING, pulse = null, meeting = null, fight = false, place = 'Bluewatch Village', director = null } = {}) {
    const slice = director ?? { time: { minutes }, ...(pulse ? { pulse: [{ results: [pulse] }] } : {}) };
    const answers = { 'scene.place': place ? { name: place, kind: 'village' } : null, ...(fight ? { 'combat.session': { status: 'active' } } : {}) };
    return {
        cause, slice,
        draft: () => slice,
        read: name => (name === 'cast' ? (meeting ? { meeting: [meeting] } : {}) : null),
        query: name => answers[name] ?? null,
        feature: () => true,
        fail: (code, message) => ({ ok: false, code, message }),
    };
}

test('the roll: refused from a click, skipped for its reasons, recorded once for the place and part of the day', () => {
    assert.equal(encounterCommand(ctxOf({ cause: 'ui' }), { at: 4 }).code, 'REFUSED');
    assert.equal(encounterCommand(ctxOf(), { at: -1 }).code, 'INVALID');
    assert.equal(encounterCommand(ctxOf({ minutes: null }), { at: 4 }).data.skipped, 'no clock');
    assert.equal(encounterCommand(ctxOf({ fight: true }), { at: 4 }).data.skipped, 'fight');
    assert.equal(encounterCommand(ctxOf({ pulse: { at: 4, kind: 'CHANCE_MEETING', text: '' } }), { at: 4 }).data.skipped, 'pulse');
    assert.notEqual(encounterCommand(ctxOf({ pulse: { at: 2, kind: 'CHANCE_MEETING', text: '' } }), { at: 4 }).data.skipped, 'pulse', 'another reply\'s pulse');
    assert.equal(encounterCommand(ctxOf({ meeting: { at: 4, keys: ['temiwa'] } }), { at: 4 }).data.skipped, 'meeting');
    assert.equal(encounterCommand(ctxOf({ place: null }), { at: 4 }).data.skipped, 'no place');
    const ctx = ctxOf();
    const first = encounterCommand(ctx, { at: 4 });
    assert.equal(first.data.skipped, undefined);
    const entry = ledgerOf(ctx.slice).results.at(-1);
    assert.equal(entry.at, 4);
    assert.equal(entry.key, 'encounter|bluewatch village|morning');
    assert.equal(first.narrate, entry.kind !== 'quiet');
    assert.equal(encounterCommand(ctx, { at: 6 }).data.skipped, 'told', 'the same place and morning');
    const again = encounterCommand(ctx, { at: 4 });
    assert.equal(again.data.skipped, undefined, 'the same reply again (a Re-read) rolls, the same way');
    assert.deepEqual(ledgerOf(ctx.slice).results, [entry]);
});

test('the promotion: refused from a click, needs its fields, binds the backdrop', () => {
    const ctx = ctxOf();
    assert.equal(promoteCommand(ctxOf({ cause: 'ui' }), { at: 4, ref: 'ferryman', key: 'npc_oskar', name: 'Oskar' }).code, 'REFUSED');
    assert.equal(promoteCommand(ctx, { at: 4, ref: 'ferryman', key: '', name: 'Oskar' }).code, 'INVALID');
    const done = promoteCommand(ctx, { at: 4, ref: 'ferryman', key: 'npc_oskar', name: 'Oskar' });
    assert.equal(done.summary, 'Oskar is now in People (was ferryman).');
    assert.deepEqual(ledgerOf(ctx.slice).bound, { ferryman: { key: 'npc_oskar', name: 'Oskar', at: 4 } });
});
