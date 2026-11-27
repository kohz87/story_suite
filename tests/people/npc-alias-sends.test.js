// What NPC State sends about a dossier it holds goes out under that dossier's id (namesakes, a dead one beside a living one); the public paths after a
// rename or a merge; and the pack secret offered to each of two namesakes. The real adapter, with lines mode on.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { standInTree } from './helpers/temp-tree.js';
import { tempDir } from '../../scripts/temp-dir.mjs';
import { ID, cast, castWith, note, person } from './npc-alias-lines.helpers.js';
import { FEATURE_MOOD_PULL, FEATURE_NOTES } from '../../modules/people/meters/npc-meters-config.js';

const publicOf = (h, name, field = 'trust') => h.publicPaths[0].get(`npc.${name}.${field}`);

test('public paths: after a rename that drops the old name, the current name has the real meters', async () => {
    const h = await cast(person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.change('npc_ana', { name: 'Annie', aliases: [] });
    assert.deepEqual([publicOf(h, 'Annie'), publicOf(h, 'Annie', 'present'), publicOf(h, 'Ana')], [15, true, undefined]);
});

test('public paths: a rename that keeps the old name as an alias publishes the old name, as before', async () => {
    const h = await cast(person('npc_ana', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.change('npc_ana', { name: 'Annie', aliases: ['Ana'] });
    assert.deepEqual([publicOf(h, 'Ana'), publicOf(h, 'Annie')], [15, undefined]);
});

test('public paths: a merged-away person\'s left-over entry is present when the dossier that took the name is, its meters unchanged', async () => {
    const h = await cast(person('npc_kesh', 'Kesh'), person('npc_lorne', 'Lorne'));
    h.line('~ npc Kesh | trust: +1');
    h.line('~ npc Lorne | trust: +2');
    delete h.delta.records.npc_lorne;
    await h.change('npc_kesh', { aliases: ['Lorne'] });
    assert.deepEqual([publicOf(h, 'Lorne'), publicOf(h, 'Lorne', 'present'), publicOf(h, 'Kesh')], [12, true, 11]);
    await h.change('npc_kesh', { present: false });
    assert.equal(publicOf(h, 'Lorne', 'present'), false);
});

const ON = { commandFeatures: true, features: { [FEATURE_NOTES]: true, [FEATURE_MOOD_PULL]: true }, answers: { 'director.time': 1440 } };

// Two living Guards: the first has an entry made by a story line (no mood, no drives), the second none.
async function twoGuards(extra = {}) {
    const h = await castWith(ON, person('npc_g1', 'Guard'), person('npc_g2', 'Guard', [], extra));
    h.line('~ npc Guard | trust: +1');
    assert.deepEqual(Object.keys(h.bonds()), ['npc_g1']);
    return h;
}

test('every command about the second Guard goes to him and leaves the first one\'s entry as it was', async () => {
    const h = await twoGuards({ secrets: [note('Second')] });
    const first = JSON.stringify(h.bonds().npc_g1);
    const reply = h.store.headIndex();
    const who = { id: 'npc_g2', name: 'Guard' };
    const kept = async (label, send) => {
        const out = await send();
        assert.equal(out?.ok, true, `${label}: ${JSON.stringify(out)}`);
        assert.equal(JSON.stringify(h.bonds().npc_g1), first, `${label} left the first Guard alone`);
    };
    await kept('meet', () => h.adapter.meet({ ...who, personality: 'greedy, loyal to family and friends, loves comfort', about: 'a gate guard', reply }));
    assert.ok(h.bonds().npc_g2?.drives, JSON.stringify(h.bonds()));
    await kept('adjust', () => h.adapter.adjust({ ...who, meters: { trust: 3 }, reply }));
    await kept('mood', () => h.adapter.mood({ ...who, word: 'furious', vad: { v: -2, a: 3, d: 1 }, reply }));
    await h.adapter.drives({ ...who, texts: ['made a friend at the inn'] });   // (past its gate on his entry; the rule may find nothing to grow)
    assert.deepEqual([h.sent.at(-1).type, h.sent.at(-1).payload.name], ['npc.drives', 'npc_g2']);
    assert.equal(JSON.stringify(h.bonds().npc_g1), first, 'drives left the first Guard alone');
    await kept('flag', () => h.adapter.flag({ ...who, lock: true, reply }));
    await kept('taste', () => h.adapter.tastes({ ...who, tastes: [{ sign: '+', item: 'strong tea', from: 'said so' }], reply }));
    await kept('set', () => h.adapter.setMeters({ ...who, meters: { trust: 40 } }));
    await h.adapter.applyEditor(who, { milestones: { add: ['kept watch'], remove: [] } });   // (its last step, npc.refresh, is refused when nothing is left to settle)
    assert.equal(JSON.stringify(h.bonds().npc_g1), first, 'the editor left the first Guard alone');
    await kept('story event', () => h.adapter.openByEvent({ ...who, ids: [ID] }));
    const mine = h.bonds().npc_g2;
    assert.deepEqual([mine.meters.trust, mine.unlocked, Object.keys(mine.milestones).length], [40, [ID], 1]);
    assert.match(mine.tastes, /strong tea/);
    const live = structuredClone(h.bonds());
    h.store.rebuild();
    assert.deepEqual(h.bonds(), live);
});

test('the drift wording keeps the person\'s name, not the id', async () => {
    const h = await twoGuards();
    await h.adapter.flag({ id: 'npc_g1', name: 'Guard', drift: { before: 'tall, grey eyes', incoming: 'short, brown eyes' }, reply: h.store.headIndex() });
    const { name, text, cue } = h.sent.at(-1).payload;
    assert.equal(name, 'npc_g1');
    assert.match(`${text} ${cue}`, /Guard/);
    assert.doesNotMatch(`${text} ${cue}`, /npc_g1/);
});

test('an id neither the stored nor the live dossiers have goes out as the name', async () => {
    const h = await cast(person('npc_ana', 'Ana'));
    await h.adapter.meet({ id: 'npc_gone', name: 'Wren', reply: h.store.headIndex() });
    assert.equal(h.sent.at(-1).payload.name, 'Wren');
    assert.equal(h.bonds().npc_gone, undefined);
});

test('a dead "Ana" beside a living one: the editor\'s save and a flag by her id reach her own entry', async () => {
    const h = await castWith(ON, person('npc_a1', 'Ana'));
    h.line('~ npc Ana | trust: +5');
    await h.add(person('npc_a2', 'Ana'));
    await h.die('npc_a1');
    h.line('~ npc Ana | trust: +2');
    const living = JSON.stringify(h.bonds().npc_a2);
    const dead = { id: 'npc_a1', name: 'Ana' };
    assert.equal((await h.adapter.setMeters({ ...dead, meters: { trust: 33 } }))?.ok, true);
    await h.adapter.applyEditor(dead, { milestones: { add: ['said goodbye'], remove: [] } });
    assert.equal((await h.adapter.flag({ ...dead, lock: true, reply: h.store.headIndex() }))?.ok, true, 'the send gate accepts a dead owner');
    assert.equal(h.adapter.meters('npc_a1')?.key, 'npc_a1');
    assert.deepEqual([h.bonds().npc_a1.meters.trust, Object.keys(h.bonds().npc_a1.milestones).length], [33, 1]);
    assert.equal(JSON.stringify(h.bonds().npc_a2), living);
});

// The scan's own sends, through runtime-hosted.js (as a committed scan calls them), into the real adapter.
async function hostedPart(adapter) {
    const temp = tempDir('delta-alias-sends-');
    const ext = path.join(temp, 'a', 'b', 'ext');
    fs.mkdirSync(ext, { recursive: true });
    standInTree(ext);
    globalThis.__npcMock = { extensionSettings: {}, context: { chat: [] }, saveSettingsCalls: 0 };
    globalThis.document = { documentElement: { dataset: {} } }; globalThis.__handles.hosted = true;
    const { createHostedPart } = await import(pathToFileURL(path.join(ext, 'runtime-hosted.js')).href);
    const deps = { chatHydrationStatus: () => ({}), getChatKey: () => 'k', getChatState: () => ({}), latestMessageId: () => 0, latestReplyIndex: () => 0 };
    return createHostedPart({ peopleAdapter: adapter }, deps);
}
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('a scan that touches the second Guard meets him, and two Guards\' story events stay apart', async () => {
    const event = who => note(who, { id: ID });
    const h = await castWith(ON, person('npc_g1', 'Guard', [], { secrets: [event('First')] }), person('npc_g2', 'Guard', [], { secrets: [event('Second')] }));
    h.line('~ npc Guard | trust: +1');
    const first = JSON.stringify(h.bonds().npc_g1);
    const part = await hostedPart(h.adapter);
    const records = Object.values(h.delta.records);
    const before = records.map(record => ({ ...record, updatedAt: 1 }));
    const after = before.map(record => (record.id === 'npc_g2' ? { ...record, updatedAt: 2, personality: 'greedy, loyal to family and friends, loves comfort', mood: 'glad' } : record));
    part.forwardRelationshipChangesToHost(before, after, h.store.headIndex(), null);
    await settle();
    assert.equal(JSON.stringify(h.bonds().npc_g1), first);
    assert.ok(h.bonds().npc_g2?.drives, JSON.stringify([h.bonds(), h.sent]));
    const watched = [{ key: 's1', id: 'npc_g1', name: 'Guard', note: ID }, { key: 's2', id: 'npc_g2', name: 'Guard', note: ID }];
    part.forwardSecretEventsToHost(watched, ['s2'], null);
    await settle();
    assert.deepEqual([h.bonds().npc_g1.unlocked, h.bonds().npc_g2.unlocked], [[], [ID]]);
    h.sent.length = 0;
    part.forwardSecretEventsToHost(watched, ['s1', 's2'], null);
    await settle();
    assert.deepEqual(h.sent.map(item => [item.type, item.payload.name, item.payload.open]), [['npc.open', 'npc_g1', [ID]], ['npc.open', 'npc_g2', [ID]]]);
});

test('two Guards with a stage-gated pack secret: the event watch offers the one the tail offers', async () => {
    const stage = { stages: [{ name: 'Known', needs: 'trust 5' }] };
    const gated = { secrets: [{ id: ID, gate: 'stage >= 1', packId: 'oar', text: 'A spare oar lies under the bench.', from: 'pack' }] };
    const h = await castWith({ commandFeatures: true, features: { 'story-director.world-events': true } }, person('npc_g1', 'Guard', [], { ...gated, castFrom: { id: 'g1', ...stage } }), person('npc_g2', 'Guard', [], { present: false }));
    h.line('~ npc Guard | trust: +1');
    const watch = () => h.adapter.eventWatch(Object.values(h.delta.records)).filter(row => row.note === ID).map(row => row.id);
    await h.change('npc_g2', { present: true });
    assert.deepEqual(watch(), ['npc_g1']);
    const tail = JSON.stringify(h.def.context.tail({ state: h.store.head(), chat: { length: h.chat.length, lastUser: '' }, settings: {} }));
    assert.match(tail, /may come out/, tail);
});
