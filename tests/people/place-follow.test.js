// SFF4 #5: `~ place Name | with: Rika` takes Rika's dossier place (NPC State's `location`) to the new place; when the scene then moves on without her
// her last known place is where she was left, not where she was met. Someone whose dossier already names the place (or a place inside it) is left as
// written. Only on a reply marked `placeFromMap` (every new reply with a place line). Replay == live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { followPlace } from '../../modules/scene/place-follow.js';

const records = () => ({
    npc_rika: { id: 'npc_rika', name: 'Rika', aliases: ['the mage'], present: false, memories: [], memoryStamps: {}, location: 'Auvoth / Pale Market', relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } },
    npc_oren: { id: 'npc_oren', name: 'Oren', aliases: [], present: false, memories: [], memoryStamps: {}, location: 'Highmark Capital / Crown Keep', relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } },
});
const where = (s, id) => s.host.head().domains.people.npcs[id].location;
const snap = s => JSON.stringify(s.host.head().domains.people);

test('a companion who came along is at the new place; left behind, that stays their last known place', async () => {
    const s = await suite({ records: records() });
    await s.say(['~ place Auvoth / Pale Market', '+ present Rika', '+ present Oren']);
    await s.say(['~ place Highmark Capital | with: Rika, Oren']);
    assert.equal(where(s, 'npc_rika'), 'Highmark Capital');
    assert.equal(where(s, 'npc_oren'), 'Highmark Capital / Crown Keep', 'a place inside the new one is kept as written');
    await s.say(['~ place Highmark Capital / Crown Keep']);
    assert.equal(where(s, 'npc_rika'), 'Highmark Capital', 'left behind: where she was left');
    const live = snap(s);
    s.host.store.rebuild();
    assert.equal(snap(s), live, 'a rebuild');
});

test('swipe, swipe back, an edited Re-read (grown and shrunk) and a middle delete agree', async () => {
    const s = await suite({ records: records() });
    await s.say(['~ place Auvoth / Pale Market', '+ present Rika']);
    await s.say(['~ place Highmark Capital | with: Rika']);
    const at = s.host.store.headIndex();
    const live = snap(s);
    await s.swipe(['~ place Highmark Capital']);
    assert.equal(where(s, 'npc_rika'), 'Auvoth / Pale Market', 'the swipe without her keeps the old place');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), live, 'swipe back');
    const reread = async lines => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; assert.equal((await s.host.sdk.reread(at)).ok, true); };
    await reread(['~ place Highmark Capital | with: Rika', '+ coin 5']);
    assert.equal(where(s, 'npc_rika'), 'Highmark Capital');
    await reread(['~ place Highmark Capital']);
    assert.equal(where(s, 'npc_rika'), 'Auvoth / Pale Market', 'shrunk');
    await reread(['~ place Highmark Capital | with: Rika']);
    assert.equal(snap(s), live, 'back to the first lines');
    await s.say(['~ place Crown Keep']);
    await s.host.st.deleteMessage(at);
    const after = snap(s);
    s.host.store.rebuild();
    assert.equal(snap(s), after, 'a middle delete, then a rebuild');
});

test('followPlace: a party member, the dead and an unknown name are not followed; without the people store nothing is written', () => {
    const calls = [];
    const ctx = rows => ({ query: name => (name === 'people.list' ? rows : name === 'party.actors' ? [{ name: 'Brann' }] : null), call: (type, payload) => calls.push([type, payload]) });
    const rows = [{ id: 'npc_brann', name: 'Brann', aliases: [], location: 'A' }, { id: 'npc_x', name: 'X', aliases: [], location: 'A', lifeState: 'deceased' }, { id: 'npc_y', name: 'Y', aliases: ['Why'], location: 'A' }];
    followPlace(ctx(rows), ['Brann', 'X', 'Nobody', 'why'], 'B');
    assert.deepEqual(calls, [['people.fields', { id: 'npc_y', fields: { location: 'B' } }]]);
    followPlace(ctx(null), ['Y'], 'B');
    assert.equal(calls.length, 1);
});
