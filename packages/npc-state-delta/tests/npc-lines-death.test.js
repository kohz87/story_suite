import test from 'node:test';
import assert from 'node:assert/strict';
import { suite, dossiers } from './helpers/pacing-suite.js';
import { peopleState } from '../src/people/view.js';
import { isTerminalNpcDeath } from '../terminal-lifecycle.js';

// N6 death (NSD13): `~ npc Name | died | how: …` marks the person dead and frozen, by the reply's own write; swipe, edited Re-read, middle delete, rewind and reload decide it the same way.
const blank = { trust: 0, affection: 0, desire: 0, tension: 0 };
const records = () => ({ ...dossiers(), npc_kit: { id: 'npc_kit', name: 'Kit', aliases: [], present: false, archived: false, memories: [], memoryStamps: {}, relationship: { ...blank }, gender: 'female', location: 'the keep' } });
const DIED = '~ npc Oren | died | how: struck down by the duke\'s guard at the gate';
const person = (s, id = 'npc_oren') => s.host.head().domains.people.npcs[id];
const snap = s => JSON.stringify(s.host.head().domains.people);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const reply = (story, lines) => `${story}${lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`;
const say = async (s, lines, story = 'The gate fell.') => { await quiet(async () => { await s.host.send('And then?', reply(story, lines)); await s.adapter.ticked(); }); return s.host.store.headIndex(); };
const reread = async (s, at) => assert.equal((await quiet(() => s.host.sdk.reread(at))).ok, true);
const dead = record => record?.lifeState === 'deceased';

test('died marks the person dead and frozen; a later where: and the frozen fields are refused', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, [DIED]);
    assert.equal(dead(person(s)), true);
    assert.equal(person(s).lifeStateCertainty, 'explicit');
    assert.match(person(s).lifeStateReason, /struck down/);
    assert.equal(person(s).archived, true);
    assert.equal(person(s).archiveReason, 'deceased');
    assert.equal(person(s).present, false);
    assert.equal(dead(person(s, 'npc_temiwa')), false, 'nobody else');
    same(s, 'replay equals live');
    await say(s, ['~ npc Oren | where: the hall | goal: revenge | gender: male']);
    assert.equal(person(s).location, undefined);
    assert.equal(person(s).goal, undefined);
    assert.match(JSON.stringify(s.host.head().domains.people.bonds.problems), /Oren has died; where is not changed/);
    same(s, 'replay equals live after the refused line');
});

test('a stated gender is frozen by the death; one never stated may still be filled once (P6)', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, ['~ npc Kit | died | how: drowned', '~ npc Kit | gender: male', '~ npc Oren | died', '~ npc Oren | gender: male']);
    assert.equal(person(s, 'npc_kit').gender, 'female');
    assert.equal(person(s).gender, 'male');
    assert.equal(person(s).lifeStateReason, 'Died in the story.', 'no how: gets the fixed reason');
    same(s, 'replay equals live');
});

test('a second died, an unknown person, and a not-listed name are refused; nothing else changes', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, [DIED]);
    const before = snap(s);
    await say(s, ['~ npc Oren | died | how: again', '~ npc Nobody | died | how: gone']);
    assert.equal(person(s).lifeStateReason.includes('again'), false);
    assert.equal(Object.keys(s.host.head().domains.people.npcs).some(id => /nobody/.test(id)), false);
    assert.notEqual(snap(s), '', before);
    same(s, 'replay equals live');
});

test('the Director\'s read sees deceased: the stored record, restored into NPC State\'s cache, is a terminal death, archived (pinned by id and not pinned alike)', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, [DIED]);
    const cache = peopleState(s.host.head().domains.people).npcs;
    const oren = cache.find(item => item.id === 'npc_oren');
    assert.equal(oren.lifeState, 'deceased');
    assert.equal(isTerminalNpcDeath(oren), true, 'the same test confirmDeath\'s records pass');
    assert.equal(oren.archived, true, 'so npc.known leaves them out and npc.dossier answers by id with lifeState deceased');
    assert.equal(isTerminalNpcDeath(cache.find(item => item.id === 'npc_temiwa')), false);
    assert.equal(oren.present, false);
});

test('a swipe brings them back and swiping back kills them; edited Re-read (grown, shrunk), reload, rewind and middle delete equal live', async () => {
    const s = await suite({ lines: true, records: records() });
    const at = await say(s, [DIED]);
    const first = snap(s);
    await quiet(async () => { await s.host.swipe(reply('Another way.', [])); await s.adapter.ticked(); });
    assert.equal(dead(person(s)), false, 'the swipe has no death: alive again');
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(at, 0);
    assert.equal(snap(s), first);
    await reread(s, at);
    await reread(s, at);
    assert.equal(dead(person(s)), true);
    s.host.ctx.chat[at].mes = reply('Nothing happened.', []);
    await reread(s, at);
    assert.equal(dead(person(s)), false, 'an edit that takes the line out: alive');
    same(s, 'shrunk Re-read replay equals live');
    s.host.ctx.chat[at].mes = reply('The gate fell.', [DIED, '~ npc Temiwa | trust: +1']);
    await reread(s, at);
    assert.equal(dead(person(s)), true);
    same(s, 'grown Re-read replay equals live');
    await say(s, []);
    await s.host.turn.onChatChanged();
    same(s, 'reload equals live');
    await quiet(async () => { const head = s.host.store.headIndex(); await s.host.st.deleteMessage(head); await s.host.st.deleteMessage(head - 1); });
    assert.equal(dead(person(s)), true, 'a rewind of a later reply keeps the death');
    same(s, 'rewind equals live');
    await quiet(async () => { await s.host.st.deleteMessage(at); await s.host.st.deleteMessage(at - 1); });
    assert.equal(dead(person(s)), false, 'a middle delete of the lethal reply: alive again');
    same(s, 'middle delete replay equals live');
});

test('switch off: died is an ordinary ~ npc line and kills nobody (byte-identical to main)', async () => {
    const s = await suite({ lines: false, records: records() });
    await say(s, [DIED]);
    assert.equal(dead(person(s)), false);
    assert.equal(person(s).archived, false);
});

test('With Story Director\'s own `- key | died` untouched: the lines-mode kind list gains no other writer', async () => {
    const s = await suite({ lines: true, records: records() });
    await say(s, ['~ npc Oren | trust: +1', '~ npc Oren | died not really']);
    assert.equal(dead(person(s)), false, 'only the one word died is a death');
});
