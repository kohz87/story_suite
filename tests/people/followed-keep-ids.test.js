// The stale pass archives, never deletes, a followed person (the Follow star's `followed` flag; it was the Key people list before B4-9).
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };   // the host stubs read it when the hosted part's imports load
const { createHostedPart } = await import('../../modules/people/runtime/runtime-hosted.js');

const part = () => createHostedPart({}, { chatHydrationStatus: () => 'ready', getChatKey: () => 'chat', getChatState: () => ({ npcs: [] }), latestMessageId: () => 0 });

test('keyKeepIds names exactly the followed dossiers', () => {
    const { keyKeepIds } = part();
    const state = { npcs: [{ id: 'npc_a', name: 'Ann', followed: true }, { id: 'npc_b', name: 'Bo' }, { id: 'npc_c', name: 'Cy', followed: false }, { id: 'npc_d', name: 'Di', followed: true }] };
    assert.deepEqual(keyKeepIds(state), ['npc_a', 'npc_d']);
    assert.deepEqual(keyKeepIds({ npcs: [] }), []);
    assert.deepEqual(keyKeepIds(null), []);
});

// A chat saved while Key people existed holds the memory `keyAway` in the NPC meters slice: it is read by nothing now and must not make the slice invalid.
test('a stored keyAway memory from before B4-9 does not make the NPC meters slice invalid', async () => {
    const { validateNpcSlice } = await import('../../modules/people/meters/npc-meters.js');
    const old = { npcs: {}, problems: [], keyAway: { ren: { name: 'Ren', aliases: [], away: { doing: 'scouting', since: '1', back: '2', steps: [] }, returnedAt: null, presentReplies: 0 } } };
    assert.deepEqual(validateNpcSlice(old), []);
    assert.notDeepEqual(validateNpcSlice({ npcs: {}, problems: [], whatever: 1 }), [], 'other unknown fields are still refused');
});
