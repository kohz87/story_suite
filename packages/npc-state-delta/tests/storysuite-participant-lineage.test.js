import test from 'node:test';
import assert from 'node:assert/strict';
import { LINEAGE_ID, hydrateIdentity, memoryVault, restoredState, selectionBehind, selectionMaxBehind, storedTimeline, timelineOf } from '../src/storysuite-participant/index.js';
import { behindSetup, handleFor, names, npc, setup } from './storysuite-participant.helpers.js';

test('the query reads the ids from the chat\'s state: a state with its ids answers at once (a reload), one without hydrates behind the first ask', async () => {
    const { queries, live, timeline, hydrate } = setup();
    const ask = args => queries['npc.identity'](null, args);
    assert.equal(ask({ name: 'Mira' }), null, 'an old state with no ids: nothing yet');
    await new Promise(resolve => setTimeout(resolve, 5));
    const mira = timeline().identity.byKey.npc_mira;
    assert.ok(mira);
    assert.equal(ask({ name: 'Mira' }).id, mira);
    // A reload: the participant is new, the state (with its block) is what Delta loaded. The ids answer at once.
    const reloaded = setup({ state: structuredClone(live.state), chatKey: 'chat:avatar.png:one' });
    assert.equal(reloaded.queries['npc.identity'](null, { id: mira }).nativeKey, 'npc_mira');
    assert.equal(reloaded.queries['npc.identity'](null, { name: 'Old Tom' }).nativeKey, 'npc_tom');
    live.state.npcs.push(npc('npc_late', 'Late'));
    assert.equal(ask({ name: 'Late' }), null, 'a scan admitted a dossier: no np_ yet');
    assert.equal(ask({ name: 'Mira' }).id, mira, 'the others still answer');
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(ask({ name: 'Late' }).nativeKey, 'npc_late');
    live.chatKey = 'no-chat';
    assert.equal(ask({ name: 'Mira' }), null);
    void hydrate;
});

test('N1: the ids, the reserved ids and the applied deaths live in the chat\'s state with a lineage id: a rename keeps them, a save point made before it can still be prepared', async () => {
    const { participant, live, hydrate, timeline, queries } = setup({ chatKey: 'chat:avatar.png:one' });
    await hydrate();
    const block = timeline();
    assert.match(block.lineage, LINEAGE_ID);
    assert.equal(live.state.timeline.lineage, block.lineage, 'it is in the state itself');
    const mira = block.identity.byKey.npc_mira;
    const saved = await participant.checkpoint({ cursor: { sid: 'sr_1' }, headHash: 'a'.repeat(64) });
    // Delta renames the chat: it moves the state file; the key changes, the state is the same.
    live.chatKey = 'chat:avatar.png:renamed';
    await hydrate();
    assert.equal(timeline().identity.byKey.npc_mira, mira, 'the same np_ after the rename');
    assert.equal(timeline().lineage, block.lineage);
    assert.equal(queries['npc.identity'](null, { id: mira }).nativeKey, 'npc_mira');
    const prepared = await participant.prepare({ return: 'rt_00000009', checkpoint: saved.checkpoint, hash: saved.hash });
    assert.equal(prepared.ok, true, prepared.message);
    const activated = await participant.activate({ return: 'rt_00000009', prepared: prepared.prepared });
    assert.equal(activated.ok, true, activated.message);
    assert.equal(timeline().lineage, block.lineage);
});

test('N1: a branch or an import of the state is the same story line: its ids are the same and its parent\'s checkpoints are its own; a state with another lineage is not', async () => {
    const vault = memoryVault();
    const parent = setup({ vault });
    await parent.hydrate();
    const saved = await parent.participant.checkpoint({});
    const branched = setup({ state: structuredClone(parent.live.state), chatKey: 'chat:avatar.png:branch', vault });
    await branched.hydrate();
    assert.deepEqual(branched.timeline().identity.byKey, parent.timeline().identity.byKey);
    assert.equal(branched.timeline().lineage, parent.timeline().lineage);
    const prepared = await branched.participant.prepare({ return: 'rt_00000010', checkpoint: saved.checkpoint, hash: saved.hash });
    assert.equal(prepared.ok, true, prepared.message);
    // A different story (its own lineage) is refused the first one\'s checkpoint.
    const other = setup({ vault, chatKey: 'chat:avatar.png:other' });
    await other.hydrate();
    assert.notEqual(other.timeline().lineage, parent.timeline().lineage);
    assert.equal((await other.participant.prepare({ return: 'rt_00000011', checkpoint: saved.checkpoint, hash: saved.hash })).code, 'CONFLICT');
});

test('restoredState: the saved state with its map and deaths, this lineage\'s id, and every np_ either timeline issued reserved', () => {
    const live = setup().live;
    const saved = { npcs: [], timeline: storedTimeline({ ...timelineOf(null), lineage: 'lg_aaaaaaaa', identity: hydrateIdentity(null, [npc('npc_a', 'A')], { seed: 'lg_aaaaaaaa' }).identity }) };
    const now = { npcs: [], timeline: storedTimeline({ ...timelineOf(null), lineage: 'lg_aaaaaaaa', identity: hydrateIdentity(null, [npc('npc_b', 'B')], { seed: 'lg_aaaaaaaa' }).identity, reserved: ['np_zzzzzzzz'] }) };
    const out = restoredState(saved, now);
    const ids = Object.keys(out.timeline.identity.map);
    assert.equal(ids.length, 1, 'the saved map');
    assert.ok(out.timeline.reserved.includes('np_zzzzzzzz') && out.timeline.reserved.includes(Object.keys(now.timeline.identity.map)[0]) && out.timeline.reserved.includes(ids[0]));
    void live;
});

test('N2: a checkpoint is quiet: it waits for a scan in flight, and when Delta will not be quiet it answers a retryable STALE, never a save that misses the scan', async () => {
    let scanning = true;
    let landed = false;
    const live = {};
    const idle = async () => { await new Promise(resolve => setTimeout(resolve, 5)); if (scanning) { scanning = false; live.state.npcs.push(npc('npc_vale', 'Vale')); landed = true; } return true; };
    const { participant, hydrate, live: l } = setup({ extra: { busy: () => scanning, idle } });
    Object.assign(live, l);
    live.state = l.state;
    Object.defineProperty(live, 'state', { get: () => l.state, set: value => { l.state = value; } });
    await hydrate();
    const saved = await participant.checkpoint({});
    assert.equal(saved.ok, true, saved.message);
    assert.equal(landed, true);
    const doc = await (async () => { const got = await participant.prepare({ return: 'rt_00000012', checkpoint: saved.checkpoint, hash: saved.hash }); return got; })();
    assert.equal(doc.ok, true);
    // A scan that never ends: STALE.
    const stuck = setup({ extra: { busy: () => true, idle: async () => false } });
    await stuck.hydrate();
    const refused = await stuck.participant.checkpoint({});
    assert.deepEqual([refused.ok, refused.code], [false, 'STALE']);
    // A state that keeps moving while the checkpoint is made: STALE too, after a few tries.
    let n = 0;
    const moving = setup({ extra: {} });
    const read = moving.port.readState;
    moving.port.readState = () => { const state = read(); state.turn = (n += 1); return state; };
    await moving.hydrate();
    assert.equal((await moving.participant.checkpoint({})).code, 'STALE');
});

test('N2: a deleted native key never gets its np_ back: the key that returns is a new person with a new id', async () => {
    const { live, hydrate, timeline } = setup();
    await hydrate();
    const tom = timeline().identity.byKey.npc_tom;
    live.state.npcs = live.state.npcs.filter(item => item.id !== 'npc_tom');
    await hydrate();
    live.state.npcs.push(npc('npc_tom', 'Old Tom'));
    await hydrate();
    assert.notEqual(timeline().identity.byKey.npc_tom, tom);
    assert.ok(timeline().reserved.includes(tom));
});

test('hydration looks at the chat again after every wait: a chat that changed while the block was written is left alone', async () => {
    const { live, port, participant, hydrate } = setup();
    const write = port.writeTimeline;
    port.writeTimeline = async block => { await write(block); live.chatKey = 'chat:avatar.png:other'; };
    const out = await hydrate();
    assert.equal(out.ok, false);
    assert.equal(participant.checkpoint !== undefined, true);
});

test('N2: a change Delta made and saved is published as a native mutation: the checkpoint the story stood on, then the state now; unchanged publishes nothing', async () => {
    const { participant, live, hydrate, noteChange, flush } = setup();
    const calls = [];
    participant.attach(handleFor(calls));
    await hydrate();
    assert.deepEqual(await flush(), { ok: true, unchanged: true }, 'nothing changed since the story stood here');
    const baseline = (await participant.status({ return: 'rt_x' })).code;
    assert.equal(baseline, 'NOT_FOUND');
    live.state.npcs.push(npc('npc_vale', 'Vale'));
    live.state.npcs[0].trust = 9;
    noteChange();
    const out = await flush();
    assert.equal(out.ok, true, out.message);
    assert.equal(calls.length, 1);
    const [{ made, input }] = calls;
    assert.equal(input.participant, 'npc-state-delta');
    assert.equal(input.source.ordinal, 0);
    assert.notEqual(made.before.checkpoint, made.after.checkpoint);
    // The host activates the after with its own transaction id; the live state is not overwritten.
    const installs = live.installs;
    const activated = await participant.activate({ return: 'nm_00000001', prepared: made.prepared });
    assert.equal(activated.ok, true, activated.message);
    assert.equal(live.installs, installs, 'a change that is already live is not installed over a newer one');
    assert.equal(live.state.npcs.length, 3);
    assert.deepEqual(await flush(), { ok: true, unchanged: true }, 'and it is now the state the story stands on');
});

test('N2: a host that gives no Source for the head cannot take the change yet (UNSUPPORTED, said once); STALE and RESTORE_PENDING are tried again', async () => {
    const told = [];
    const { participant, live, hydrate, flush } = setup({ extra: { warn: text => told.push(text) } });
    const calls = [];
    participant.attach(handleFor(calls, { source: null }));
    await hydrate();
    live.state.npcs[0].trust = 5;
    assert.equal((await flush()).code, 'UNSUPPORTED');
    assert.deepEqual(told, [], 'not an error to be told every time');
    const later = setup({ extra: { headSource: () => ({ sid: 'sr_00000002', swipeKey: 'sw_00000002', evidence: 'ev_00000002', ordinal: 1 }) } });
    const seen = [];
    later.participant.attach(handleFor(seen, { source: null, answers: [{ ok: false, code: 'STALE', message: 'The head moved.' }] }));
    await later.hydrate();
    later.live.state.npcs[0].trust = 6;
    const out = await later.flush();
    assert.equal(out.ok, true, out.message);
    assert.equal(seen.length, 2, 'the head was read again after STALE');
    assert.equal(seen[0].input.source.ordinal, 1, 'the port gave the Source');
});

test('opening a chat, a reply or a scan hydrates nothing and writes nothing; the first save point or npc.identity question makes the story line', async () => {
    const empty = setup({ state: { npcs: [], socialGraph: { edges: [] }, checkpoints: [], lineage: [], turn: 0 } });
    assert.equal(empty.prime, undefined, 'nothing primes a chat at open');
    assert.equal(empty.live.writes, 0, 'a new chat has no file until it is saved');
    assert.equal(empty.queries['npc.identity'](null, { name: 'Mira' }), null);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(empty.live.writes, 0, 'and asking about a person nobody has met does not make one');
    // The first thing that needs a line makes it: a save point.
    const saved = await empty.participant.checkpoint({});
    assert.equal(saved.ok, true);
    assert.equal(empty.live.writes, 1);
    assert.match(empty.timeline().lineage, LINEAGE_ID);

    // A populated chat that never asks is untouched: no lineage, no ids, no checkpoint, no vault file, however its dossiers change.
    const full = setup();
    const plain = structuredClone(full.live.state);
    full.participant.attach({ head: async () => ({ ok: false, code: 'RESTORE_PENDING' }), nativeMutation: async () => { throw new Error('published'); } });
    full.noteChange();
    full.live.state.npcs[0].trust = 5;
    full.noteChange();
    assert.equal((await full.flush()).unchanged, true, 'nothing to publish for a chat that does not use the timeline');
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(full.live.writes, 0);
    assert.equal(full.live.installs, 0);
    assert.equal(full.vault.docs.size, 0);
    assert.equal(full.vault.indexes.size, 0);
    assert.equal(Object.hasOwn(full.live.state, 'timeline'), false);
    full.live.state.npcs[0].trust = plain.npcs[0].trust;
    assert.deepEqual(full.live.state, plain);

    // The first question to npc.identity is a use: the ids are made behind it, and the next ask finds them.
    assert.equal(full.queries['npc.identity'](null, { name: 'Mira' }), null);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.match(full.timeline().lineage, LINEAGE_ID);
    assert.equal(full.queries['npc.identity'](null, { name: 'Mira' }).nativeKey, 'npc_mira');
});

test('selectionBehind: the swiped reply and its turn are as expected, a state many messages behind where the dossiers and the chat part is told', () => {
    const live = names(13);
    const chat = [...names(12), 'swiped'];
    assert.equal(selectionBehind({ saved: names(11), live, chat, max: 4 }), null, 'the exact parent (the reader\'s turn is not in it)');
    assert.equal(selectionBehind({ saved: names(9), live, chat, max: 4 }), null, 'one exchange further back');
    assert.deepEqual(selectionBehind({ saved: names(3), live, chat, max: 4 }), { behind: 9, at: 12 });
    assert.deepEqual(selectionBehind({ saved: names(3), live: names(13), chat: names(8), max: 4 }), { behind: 5, at: 8 }, 'a chat shortened by a delete: it ends where the chat does');
    for (const missing of [{ live: [] }, { chat: [] }, { saved: null }, { chat: null }]) assert.equal(selectionBehind({ saved: names(3), live, chat, max: 4, ...missing }), null, 'too little known to say');
});

test('selectionMaxBehind: at least 4, and wider with a longer "Scan every"', () => {
    assert.deepEqual([undefined, 1, 5, 20, 'x'].map(selectionMaxBehind), [12, 4, 12, 42, 12]);
});

test('a head selection far behind the swipe is installed all the same, and told: the answer carries a Problem line, nothing is refused', async () => {
    const { participant, live, told, first } = await behindSetup({ scanEvery: () => 1 });
    const prepared = await participant.prepare({ return: 'hs_00000001', checkpoint: first.checkpoint, hash: first.hash });
    assert.equal(prepared.ok, true);
    const answer = await participant.activate({ return: 'hs_00000001', prepared: prepared.prepared });
    assert.deepEqual({ ...answer, older: typeof answer.older }, { ok: true, checkpoint: first.checkpoint, hash: first.hash, older: 'string' });
    assert.match(answer.older, /^Restored an older dossier state than expected: 8 messages back/);
    assert.equal(answer.kept, undefined);
    assert.equal(live.installs, 1, 'installed: a legitimate older selection is never refused');
    assert.equal(live.state.npcs.some(item => item.id === 'npc_late'), false, 'the selected state is what is live');
    assert.deepEqual(told, [answer.older]);
    assert.equal((await participant.status({ return: 'hs_00000001' })).status, 'active');
});

test('a quiet stretch inside the "Scan every" reach is installed without a line', async () => {
    const { participant, live, told, first } = await behindSetup({ scanEvery: () => 5 });
    const prepared = await participant.prepare({ return: 'hs_00000005', checkpoint: first.checkpoint, hash: first.hash });
    const answer = await participant.activate({ return: 'hs_00000005', prepared: prepared.prepared });
    // 8 messages back is within 2*5+2
    assert.equal(answer.older, undefined);
    assert.deepEqual([live.installs, told], [1, []]);
});

test('a head selection at the exact parent installs; a reader\'s restore far back installs; a port that cannot read the chat installs', async () => {
    const parentCase = await behindSetup();
    const prepared = await parentCase.participant.prepare({ return: 'hs_00000002', checkpoint: parentCase.parent.checkpoint, hash: parentCase.parent.hash });
    assert.equal((await parentCase.participant.activate({ return: 'hs_00000002', prepared: prepared.prepared })).ok, true);
    assert.deepEqual([parentCase.live.installs, parentCase.live.state.npcs.some(item => item.id === 'npc_late'), parentCase.told], [1, false, []]);

    const restoreCase = await behindSetup();
    const restore = await restoreCase.participant.prepare({ return: 'rt_00000001', checkpoint: restoreCase.first.checkpoint, hash: restoreCase.first.hash });
    assert.equal((await restoreCase.participant.activate({ return: 'rt_00000001', prepared: restore.prepared })).ok, true);
    assert.deepEqual([restoreCase.live.installs, restoreCase.told], [1, []], 'a save point is exact and chosen by the reader');

    // (the host walked back to this one because the checkpoints nearer were gone, and reads the replies it missed: that is its design, not asked)
    const walked = await behindSetup();
    const back = await walked.participant.prepare({ return: 'hs_00000004', fallback: true, checkpoint: walked.first.checkpoint, hash: walked.first.hash });
    assert.equal((await walked.participant.activate({ return: 'hs_00000004', prepared: back.prepared })).older, undefined);
    assert.deepEqual([walked.live.installs, walked.told], [1, []]);

    const blind = await behindSetup({ chatLineage: undefined });
    const head = await blind.participant.prepare({ return: 'hs_00000003', checkpoint: blind.first.checkpoint, hash: blind.first.hash });
    assert.equal((await blind.participant.activate({ return: 'hs_00000003', prepared: head.prepared })).ok, true);
    assert.equal(blind.live.installs, 1, 'without the chat nothing is judged');
});

test('the run data: the first reply\'s checkpoint is told for the swipe of the sixth reply, the fifth reply\'s is not (when the run data is here)', async t => {
    const { readFile } = await import('node:fs/promises');
    const { chatLineage } = await import('../branch.js');
    const dir = process.env.SWIPECHK_FILES;
    if (!dir) { t.skip('SWIPECHK_FILES (the run data folder) is not set'); return; }
    let chat; let first; let fifth; let live;
    try {
        chat = (await readFile(`${dir}/chat.jsonl`, 'utf8')).trim().split('\n').map(line => JSON.parse(line)).slice(1);
        const doc = async id => JSON.parse(await readFile(`${dir}/npc-state-delta-checkpoint-${id}.json`, 'utf8'));
        [first, fifth, live] = [await doc('nk_tqmebnch'), await doc('nk_835f94jp'), await doc('nk_nlfx09ia')];
    } catch { t.skip('the run data is not here'); return; }
    // (the chat in the file is the one after the swipe and the replies that followed: its first 12 messages are the ones before the swiped reply)
    const now = chatLineage(chat.slice(0, 13));
    const dossiers = [...now.slice(0, 12), 'the swiped reply as it was'];
    assert.equal(selectionBehind({ saved: first.state.lineage, live: dossiers, chat: now, max: 4 })?.behind > 4, true);
    assert.equal(selectionBehind({ saved: fifth.state.lineage, live: dossiers, chat: now, max: 4 }), null);
    assert.equal(first.state.lineage.every((entry, at) => entry === now[at]), true, 'the stored fingerprints are the chat\'s own, so the comparison reads real lineage');
    assert.ok(live.state.lineage.length > 11);
});
