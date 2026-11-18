import test from 'node:test';
import assert from 'node:assert/strict';
import { runCalls } from './onepass-host-run.mjs';

// SOAKPEOPLE F7, F23, F45: with one-pass lines on no scan runs on an ordinary reply, so nobody was ever marked present: every record kept present false,
// lastSeenTurn 0 and its old place, and the catch-up Refresh (which takes the people in the scene) never had anyone. Now the scene's own list stamps them.

/* global ZERO */
test('hosted one-pass: the scene marks who is here, when last seen and clears an arrival\'s old place; the catch-up then has someone to Refresh', () => {
    const result = runCalls('hosted-scene-presence', true, async ({ reply, settings, mockState }) => {
        settings.narrationCaptureCatchUp = 2;
        await reply('Yunyun left for the quay.', { npcs: [{ name: 'Yunyun', present: false, worldActive: true, location: 'the inspection quay', role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] });
        const yun = () => globalThis.NPCStateDelta.getState().npcs.find(npc => npc.name === 'Yunyun');
        const before = { present: yun()?.present, location: yun()?.location };
        mockState.sdk.query = name => (name === 'scene.present' ? ['Yunyun'] : null);
        const second = await reply('Back at the inn, the fire is low.', null);
        const after = { present: yun().present, location: yun().location, lastSeenTurn: yun().lastSeenTurn, seenCount: yun().seenCount, turn: globalThis.NPCStateDelta.getState().turn };
        const third = await reply('Rain on the shutters.', null);
        mockState.sdk.query = name => (name === 'scene.present' ? [] : null);
        await reply('The common room empties.', null);
        return { before, after, refreshes: second.all.refresh + third.all.refresh, gone: yun().present, seenLast: yun().lastSeenTurn, turnNow: globalThis.NPCStateDelta.getState().turn };
    });
    assert.deepEqual(result.before, { present: false, location: 'the inspection quay' }, 'the rig: she starts away, with a place');
    assert.equal(result.after.present, true, 'the scene lists her: present');
    assert.equal(result.after.location, '', 'arrived: the old away place is cleared');
    assert.equal(result.after.lastSeenTurn, result.after.turn, 'last seen at this reply');
    assert.ok(result.after.seenCount >= 1);
    assert.ok(result.refreshes >= 1, 'the catch-up Refresh ran for the person in the scene');
    assert.equal(result.gone, false, 'the scene no longer lists her: not present');
    assert.ok(result.turnNow > result.seenLast, 'last seen stays at the last reply she was in');
});

test('F45: people.list follows the reader\'s "Dormant after" (NPC State\'s setting through npc.dormantAfter), held to 10-999', async () => {
    const { peopleQueries } = await import('../../modules/people/domain/queries.js');
    const list = peopleQueries('people')['people.list'];
    const state = { domains: { people: { v: 1, order: ['npc_a', 'npc_b'], turn: 40, npcs: {
        npc_a: { id: 'npc_a', name: 'A', lastSeenTurn: 25 },
        npc_b: { id: 'npc_b', name: 'B', lastSeenTurn: 38 },
    } } } };
    const tools = after => ({ hasQuery: name => name === 'npc.dormantAfter', query: () => after });
    const dormant = answer => answer.map(row => row.dormant);
    assert.deepEqual(dormant(list(state, {}, tools(12))), [true, false], 'the setting 12: unseen 15 is dormant');
    assert.deepEqual(dormant(list(state, {}, tools(null))), [false, false], 'no setting: 30');
    assert.deepEqual(dormant(list(state, {}, tools(1))), [true, false], 'held to the setting\'s 10');
    assert.deepEqual(dormant(list(state, { dormantAfter: 999 }, tools(12))), [false, false], 'an asked value comes first');
});

// F7 on the store's own read (whatever NPC State's cache has stamped yet): someone the reply's scene lists is here and shows no old "away" place;
// pure over the state, so a swipe, a Re-read, a delete and a reload answer the same.
test('F7: people.list and people.dossier read who is here from the same state\'s scene; the old away place is not shown while they are', async () => {
    const { suite } = await import('./helpers/pacing-suite.js');
    const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
    const records = { npc_marrit: { id: 'npc_marrit', name: 'Marrit', aliases: [], present: false, memories: [], memoryStamps: {}, relationship: { ...blank } } };
    const s = await suite({ lines: true, records });
    const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
    const say = lines => quiet(async () => { await s.host.send('And then?', `The tide turned.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`); await s.adapter.ticked(); });
    const row = () => s.host.sdk.query('people.list', {}).find(item => item.id === 'npc_marrit');
    await say(['+ present Marrit']);
    await say(['- present Marrit', '~ npc Marrit | where: the inspection quay']);
    assert.deepEqual([row().present, row().location], [false, 'the inspection quay'], 'away, with her place');
    await say(['+ present Marrit']);
    assert.deepEqual([row().present, row().location], [true, null], 'back: here, no old place');
    assert.equal(s.host.sdk.query('people.dossier', { id: 'npc_marrit' }).location, undefined);
    const live = JSON.stringify(s.host.sdk.query('people.list', {}));
    s.host.store.rebuild();
    assert.equal(JSON.stringify(s.host.sdk.query('people.list', {})), live, 'replay equals live');
    await quiet(async () => { await s.host.swipe('She is still out on the quay.'); await s.adapter.ticked(); });
    assert.deepEqual([row().present, row().location], [false, 'the inspection quay'], 'a swipe without her arrival');
});
