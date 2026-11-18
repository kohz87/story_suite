import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { standInTree } from './helpers/temp-tree.js';
import { oldSource } from './helpers/old-source.js';
import { createNpcPart, validateNpcSlice } from '../../modules/people/meters/npc-meters.js';

import { runtimeSource } from './helpers/runtime-source.js';

import { storyMinuteText } from '../../modules/people/calendar/calendar.js';
import { eventSummary } from '../../modules/people/meters/npc-meters-pacing.js';
import { LOOSE, SHUT, STORED, eventOf, pacedSuite, rowOf, suite } from './storysuite-v2-meters-ladder.helpers.js';
import { tempDir } from '../../scripts/temp-dir.mjs';

// ---- 7. the dossier's "Last relationship change" is the meters' own net change (hosted; read time only) ----

test('net change card: the open-panel token covers the host views, so a changed card refreshes the panel', async () => {
    const s = await suite();
    const before = JSON.stringify(s.adapter.dossierMeters(Object.values(s.delta.records)));
    await s.say(['~ npc Mira | trust: +5']);
    assert.notEqual(JSON.stringify(s.adapter.dossierMeters(Object.values(s.delta.records))), before);
    assert.match(runtimeSource(), /dossierHostViews\(state\)\]\);/, 'dossierViewToken ends with the host views');
});

// ---- 8. the card's event details: the tier, "Held" and "Asked", and the story date (the reply's own record, written whole) ----

// The two replay cases of the old panel's "event card" tests, kept on the engine's own view (adapter.dossierMeters → relChange; B4-5).
test('last change: replay equals live, and the meters match a chat that never had the deleted reply (middle delete, rebuild)', async () => {
    const lines = [['~ npc Mira | trust: +3'], ['~ npc Mira | affection: +2'], ['~ npc Mira | trust: +1 | tension: +1']];
    const a = await pacedSuite(LOOSE);
    await a.say(['~ npc Mira | trust: +1']);
    for (const set of lines) await a.say(set);
    const gone = a.host.store.headIndex() - 2;   // the second of the three
    await a.host.st.deleteMessage(gone);
    await a.host.st.deleteMessage(gone - 1);
    assert.deepEqual(a.host.store.problems(), [], 'nothing was skipped');
    const b = await pacedSuite(LOOSE);
    await b.say(['~ npc Mira | trust: +1']);
    for (const set of [lines[0], lines[2]]) await b.say(set);
    assert.equal(JSON.stringify(a.npc('Mira').meters), JSON.stringify(b.npc('Mira').meters), 'the meters are the same');
    assert.deepEqual(validateNpcSlice(a.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
    assert.deepEqual(eventOf(a).events, eventOf(b).events, 'the surviving reply\'s event');
    assert.equal(eventOf(a).date, eventOf(b).date);
    assert.ok(a.host.store.headIndex() < a.npc('Mira').reply, 'the window names a reply that is gone');
    const head = JSON.stringify(a.host.head());
    a.host.store.rebuild();
    assert.equal(JSON.stringify(a.host.head()), head, 'replay equals the live state');
});

test('last change: a swipe falls back to the earlier reply\'s change; a regenerate and a delete follow their own reply', async () => {
    const s = await pacedSuite(LOOSE);
    await s.say(['~ npc Mira | trust: +1']);
    const first = s.host.store.headIndex();
    await s.say(['~ npc Mira | affection: +1']);
    await s.swipe([]);
    const swiped = rowOf(s, 'npc_mira').shown;
    assert.equal(swiped.message, first, 'the swiped reply made no event: the earlier reply\'s change');
    assert.equal(swiped.delta?.affection ?? 0, 0);
    await s.regenerate(['~ npc Mira | trust: +2']);
    assert.equal(rowOf(s, 'npc_mira').shown.tier, 'ordinary');
    assert.equal(rowOf(s, 'npc_mira').shown.delta?.trust, 1, 'asked +2, the ordinary tier moved +1');
    await s.host.st.deleteMessage(s.host.store.headIndex());
    await s.host.st.deleteMessage(s.host.store.headIndex());
    assert.deepEqual(s.host.store.problems(), []);
    assert.deepEqual(validateNpcSlice(s.host.head().domains.people?.bonds ?? { npcs: {}, problems: [] }), []);
});
