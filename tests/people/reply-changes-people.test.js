// F31: the reply's changes (the This reply card, the ✦ menu) name the feelings a `~ npc` line moved, not only items, coin and places.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { ON } from './npc-notes-kinds.helpers.js';

test('reply.changes lists a person\'s feeling move, and a swipe and a rebuild give the same card', async () => {
    const s = await suite({ allowance: null, features: ON });
    await s.setDay(1);
    await s.say(['~ npc Oren | trust: +1']);
    const card = async () => (await s.host.sdk.query('reply.changes', {}))?.lines.map(item => item.line);
    assert.deepEqual(await card(), ['Oren: trust 0 → 1']);
    await s.swipe(['~ npc Oren | affection: +1']);
    assert.deepEqual(await card(), ['Oren: affection 0 → 1'], 'the swipe replaces the move, never adds to it');
});
