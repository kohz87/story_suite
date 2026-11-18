import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';

// SFP1: the new line rules (short names, aka, ties with a known person, the dead) decide the same way on every path: swipe and swipe back, an edited Re-read
// (grown and shrunk), a middle delete, a rewind, a reload.
const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
const rec = (id, name, extra = {}) => ({ id, name, aliases: [], present: false, memories: [], memoryStamps: {}, relationship: { ...blank }, ...extra });
const records = () => ({ npc_hesk_dalla: rec('npc_hesk_dalla', 'Hesk Dalla', { role: 'the Watch-Captain' }), npc_wenna_coll: rec('npc_wenna_coll', 'Wenna Coll') });
const people = s => s.host.head().domains.people;
const snap = s => JSON.stringify(s.host.head().domains);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const reply = (story, lines) => `${story}${lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`;
const say = async (s, lines, story = 'The watch changed.') => { await quiet(async () => { await s.host.send('And then?', reply(story, lines)); await s.adapter.ticked(); }); return s.host.store.headIndex(); };
const reread = async (s, at) => assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
const trust = (s, id) => people(s).bonds?.npcs?.[id]?.meters?.trust ?? 0;

test('short names, aka and ties: swipe, swipe back, edited Re-read grown and shrunk, rewind and reload equal live', async () => {
    const s = await suite({ lines: true, records: records() });
    const lines = ['~ npc Hesk | trust: +1', '~ npc Wenna Coll | aka: Old Wen', '~ tie Old Wen | with: Hesk | tag: +friend'];
    const at = await say(s, lines);
    const first = snap(s);
    assert.equal(trust(s, 'npc_hesk_dalla'), 1);
    assert.deepEqual(people(s).npcs.npc_wenna_coll.aliases, ['Old Wen']);
    assert.deepEqual(JSON.parse(people(s).bonds.npcs.npc_wenna_coll.ties), { 'hesk-dalla': ['friend'] });
    await quiet(async () => { await s.host.swipe(reply('Another way.', [])); await s.adapter.ticked(); });
    assert.equal(trust(s, 'npc_hesk_dalla'), 0, 'the swipe has none of it');
    assert.deepEqual(people(s).npcs.npc_wenna_coll.aliases, []);
    same(s, 'swipe equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), first, 'swipe back');
    s.host.ctx.chat[at].mes = reply('Edited.', [lines[0]]);
    await reread(s, at);
    assert.deepEqual(people(s).npcs.npc_wenna_coll.aliases, [], 'shrunk Re-read');
    same(s, 'shrunk Re-read equals live');
    s.host.ctx.chat[at].mes = reply('Edited again.', [...lines, '~ npc Captain Dalla | affection: +1']);
    await reread(s, at);
    assert.equal(people(s).bonds.npcs.npc_hesk_dalla.meters.affection, 1, 'grown Re-read');
    same(s, 'grown Re-read equals live');
    await say(s, ['~ npc Old Wen | trust: +1']);
    assert.equal(trust(s, 'npc_wenna_coll'), 1, 'the alias finds her on a later reply');
    await s.host.turn.onChatChanged();
    same(s, 'reload equals live');
    await quiet(async () => { const head = s.host.store.headIndex(); await s.host.st.deleteMessage(head); await s.host.st.deleteMessage(head - 1); });
    assert.equal(trust(s, 'npc_wenna_coll'), 0, 'rewind takes the later reply back');
    assert.deepEqual(people(s).npcs.npc_wenna_coll.aliases, ['Old Wen'], 'and keeps the earlier alias');
    same(s, 'rewind equals live');
});
