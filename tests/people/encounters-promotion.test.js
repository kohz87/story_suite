// Encounters with the real NPC State (lines mode) on the shipped Ersveil pair: a backdrop ferryman at a place the story made, a `+ npc Oskar | ferryman`
// dossier, and the seeded roll that lands on the ferryman: the reply that shows him and names Oskar binds the backdrop to Oskar's dossier. Rebuild == live,
// and a swipe of that reply that names no one takes the binding back. At a place where the cast part meets someone, the encounter steps aside.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ersveilLines } from './helpers/ersveil-lines.js';
import { overrideBackdrops } from '../../modules/world/encounters/index.js';

const ON = { 'story-director.encounters': true };
const ledger = s => s.host.head().domains.director.encounters?.[0] ?? null;
const steps = s => s.host.sdk.receipts().filter(entry => entry.receipt.type.startsWith('director.encounter')).map(entry => entry.receipt);
const quiet = t => t.mock.method(console, 'warn', () => {});

test('a named ferryman is bound to his NPC State dossier; rebuild agrees; a swipe that names no one takes it back', async t => {
    quiet(t);
    const undo = overrideBackdrops(() => [{ id: 'ferryman', who: 'the ferryman', at: ['old jetty'], weight: 10 }]);
    const s = await ersveilLines({ features: ON, liveChat: true });
    try {
        await s.say('Rain at the Old Jetty.', ['~ place Old Jetty']);
        // The fixed seed (World events off), the story days and the parts of the day: three quiet rolls, then the ferryman.
        for (let i = 0; i < 4; i += 1) await s.say('"Oskar," the ferryman says.', ['! time +3h', '+ npc Oskar | ferryman | lean, grey']);
        assert.equal(s.person('Oskar')?.role, 'ferryman', 'NPC State made his dossier from the line');
        assert.equal(ledger(s).results.at(-1).ref, 'ferryman');
        assert.deepEqual(Object.keys(ledger(s).bound), ['ferryman']);
        assert.equal(ledger(s).bound.ferryman.key, s.person('Oskar').id);
        assert.equal(steps(s).at(-1).summary, 'Oskar is now in People (was the ferryman).');
        const live = JSON.stringify(s.host.head().domains);
        s.host.store.rebuild();
        assert.equal(JSON.stringify(s.host.head().domains), live, 'rebuild equals live');
        await s.swipe('The ferryman only nods.', ['! time +3h']);
        assert.deepEqual(ledger(s).bound, {}, 'the swipe names no one');
    } finally { s.close(); undo(); }
});

test('at a place where the cast part meets someone this reply, no encounter is rolled beside it', async t => {
    quiet(t);
    const undo = overrideBackdrops(() => [{ id: 'ferryman', who: 'the ferryman', at: ['bluewatch village'], weight: 10 }]);
    const s = await ersveilLines({ features: ON, liveChat: true });
    try {
        await s.say('Rain at Bluewatch Village.', ['~ place Bluewatch Village']);
        await s.say('The square is busy.', ['! time +3h']);
        assert.equal(s.host.head().domains.cast.meeting?.[0]?.at, s.host.store.headIndex(), 'the cast part made a meeting for this reply');
        assert.equal(steps(s).at(-1).data.skipped, 'meeting');
    } finally { s.close(); undo(); }
});
