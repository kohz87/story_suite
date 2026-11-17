import test from 'node:test';
import assert from 'node:assert/strict';
import { host, fakeDelta } from './storysuite-v2-meters.helpers.js';

// Final review M2 and L6 (F6). A pack's spec secrets whose gates are open (world-events switch) send "(may come out)" lines: at most one a person
// (the first open one in the pack's own order) and two in all (people in key order), so five open gates for one person no longer fill NPC State's
// room. And a gate's `of <id>` names the owner: `of <someone else>` stays shut, `of <the owner>` reads the owner's own value (revealable.js passes
// the owners to the gate reader).
const ON = { 'story-director.world-events': true };
const ONCE = 'Lines marked (may come out) are secrets the story has now earned: you may let one come out in this reply, once, only if it fits the scene; never force it.';
const gated = (name, letters) => letters.map(letter => ({ packId: `${name}-${letter}`, gate: `fact:${letter}`, text: `${name} secret ${letter.toUpperCase()}.`, from: 'pack' }));
const delta = () => {
    const d = fakeDelta();
    d.records.npc_mira.secrets = gated('Mira', ['a', 'b', 'c', 'd', 'e']);
    d.records.npc_oren = { ...d.records.npc_oren, present: true, secrets: gated('Oren', ['a', 'b']) };
    d.records.npc_zed = { id: 'npc_zed', name: 'Zed', aliases: [], present: true, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 }, secrets: gated('Zed', ['a']) };
    return d;
};
const ready = h => { const out = h.def.context.tail(h.view()); return [...out.lines, ...out.optional].filter(line => typeof line === 'string' && line.includes('(may come out)')); };

test('one "(may come out)" line a person, the first open one in pack order, and two in all', async () => {
    const answers = { 'chronicle.world.anchors': ['fact:a', 'fact:b', 'fact:c', 'fact:d', 'fact:e'] };
    const h = await host({ delta: delta(), features: ON, answers });
    h.reply('Nice.', '~ npc Mira | trust: +1\n~ npc Oren | trust: +1\n~ npc Zed | trust: +1');
    assert.deepEqual(ready(h), [`${ONCE}\nMira (may come out): Mira secret A.`, 'Oren (may come out): Oren secret A.'], 'Zed, third in key order, gets none');
    const watched = h.adapter.eventWatch(Object.values(h.delta.records)).map(item => `${item.name}: ${item.event}`);
    assert.deepEqual(watched, ['Mira: the secret "Mira secret A." comes out', 'Oren: the secret "Oren secret A." comes out'], 'the reveal watch lists only the offered ones');
    answers['chronicle.world.anchors'] = ['fact:c', 'fact:e'];
    assert.deepEqual(ready(h), [`${ONCE}\nMira (may come out): Mira secret C.`], 'the first OPEN one; Oren and Zed have none open');
    answers['chronicle.world.anchors'] = [];
    assert.deepEqual(ready(h), [], 'all closed: nothing');
});

test('switch off: no "(may come out)" line at all', async () => {
    const h = await host({ delta: delta(), features: {}, answers: { 'chronicle.world.anchors': ['fact:a'] } });
    h.reply('Nice.', '~ npc Mira | trust: +1');
    assert.deepEqual(ready(h), []);
});

test('a gate\'s "of <id>": another person\'s id stays shut, the owner\'s own id opens', async () => {
    const d = fakeDelta();
    d.records.npc_mira.castFrom = { id: 'mira' };
    d.records.npc_mira.relationship.trust = 50;
    d.records.npc_mira.secrets = [{ packId: 'other', gate: 'meter trust of oren >= 20', text: 'Not hers to tell.', from: 'pack' }, { packId: 'own', gate: 'meter trust of mira >= 20', text: 'Hers to tell.', from: 'pack' }];
    const h = await host({ delta: d, features: ON, answers: { 'chronicle.world.anchors': [] } });
    h.reply('Nice.', '~ npc Mira | trust: +1');
    assert.deepEqual(ready(h), [`${ONCE}\nMira (may come out): Hers to tell.`]);
});
