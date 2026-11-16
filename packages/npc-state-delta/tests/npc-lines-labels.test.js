import test from 'node:test';
import assert from 'node:assert/strict';
import { readLeaf } from '../src/npc-meters-config.js';
import { suite, dossiers } from './helpers/pacing-suite.js';

const withWren = () => ({ ...dossiers(), npc_wren: { id: 'npc_wren', name: 'Wren', aliases: [], present: false, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } } });

// N3: the `~ npc` line in words (labels accepted from now on, taught at N7): up / down priced by the impact word, dossier labels, unknown labels.
const bonds = (s, id = 'npc_oren') => s.host.head().domains.people.bonds.npcs[id];
const dossier = (s, id = 'npc_oren') => s.host.head().domains.people.npcs[id];

test('up and down are priced by the impact word; no impact is ordinary; the old +N form still parses', async () => {
    const s = await suite();
    await s.say(['~ npc Oren | trust: up | tension: down']);
    assert.deepEqual([bonds(s).meters.trust, bonds(s).meters.tension], [1, -1]);
    await s.say(['~ npc Oren | trust: up | impact: meaningful']);
    assert.equal(bonds(s).meters.trust, 3);
    await s.say(['~ npc Oren | trust: up | impact: major']);
    assert.equal(bonds(s).meters.trust, 6);
    await s.say(['~ npc Oren | affection: down | impact: extreme']);
    assert.equal(bonds(s).meters.affection, -6, 'extreme is the caps setting\'s extreme, held to the reply\'s cap of 6');
    await s.say(['~ npc Oren | desire: +3']);
    assert.equal(bonds(s).meters.desire, 1);
});

test('the per-reply cap clamps word moves across two lines of one reply', async () => {
    const s = await suite({ settings: { changeCap: 4 } });
    await s.say(['~ npc Oren | trust: up | impact: major', '~ npc Oren | trust: up | impact: major']);
    assert.ok(bonds(s).meters.trust <= 4, `the reply's cap held it: ${bonds(s).meters.trust}`);
});

test('an unknown label is a problem on the card and the line\'s other labels still apply', async () => {
    const s = await suite();
    await s.say(['~ npc Oren | trust: up | smell: awful']);
    assert.equal(bonds(s).meters.trust, 1);
    assert.match(JSON.stringify(s.host.head().domains.people.bonds.problems), /smell/);
});

test('goal, status, where, look and facts go to the dossier; clear removes goal and status; a fact is written once', async () => {
    const s = await suite({ records: withWren() });
    await s.say(['~ npc Wren | goal: find the courier | status: limping | where: the harbour office | look: a torn blue coat and a bandaged hand | gender: female | age: 30 | birthday: Goldwane 4']);
    assert.deepEqual(['goal', 'status', 'location', 'appearance', 'gender', 'age', 'birthday'].map(key => dossier(s, 'npc_wren')[key]),
        ['find the courier', 'limping', 'the harbour office', 'a torn blue coat and a bandaged hand', 'female', '30', 'Goldwane 4']);
    await s.say(['~ npc Wren | goal: clear | status: clear | gender: male | age: 31']);
    assert.equal(dossier(s, 'npc_wren').goal, undefined);
    assert.equal(dossier(s, 'npc_wren').status, undefined);
    assert.equal(dossier(s, 'npc_wren').gender, 'female', 'a stated fact is not changed by a line');
    assert.match(JSON.stringify(s.host.head().domains.people.bonds.problems), /gender is already set/);
});

test('where for a person in the scene is refused; "Unknown" is never written', async () => {
    const s = await suite({ records: withWren() });
    await s.say(['+ present Oren', '~ npc Oren | trust: up | where: the market | goal: Unknown']);
    assert.equal(dossier(s, 'npc_oren').location, undefined);
    assert.equal(dossier(s, 'npc_oren').goal, undefined);
    assert.equal(bonds(s).meters.trust, 1, 'the line\'s meters still apply');
    assert.match(JSON.stringify(s.host.head().domains.people.bonds.problems), /this person is here/);
});

test('a mood word becomes the fixed list\'s numbers; an unknown word is refused', async () => {
    const s = await suite();
    await s.say(['~ npc Oren | mood: furious']);
    const mood = readLeaf(bonds(s).mood);
    assert.ok(mood && [mood.v, mood.a, mood.d].every(Number.isInteger));
    assert.ok(mood.v < 0, 'furious is unpleasant');
    await s.say(['~ npc Oren | mood: zzzxq']);
    assert.match(JSON.stringify(s.host.head().domains.people.bonds.problems), /not a mood word/);
});

// Apply order (a live change): NPC State's `~ npc` runs after the reply's time, present and place lines, so a person the reply brings into the scene
// is present when their `where:` is read, whichever order the lines were written in.
const ORDER = ['~ npc Wren | trust: up | where: the harbour office', '+ present Wren'];
const snapshot = s => JSON.stringify([s.host.head().domains.people.bonds, s.host.head().domains.people.npcs.npc_wren, s.host.head().domains.core?.scene ?? null]);

test('apply order: a + present line applies before the ~ npc line of the same reply, live and on replay', async t => {
    const s = await suite({ records: withWren() });
    const first = await s.say(ORDER);
    const refused = () => assert.equal(dossier(s, 'npc_wren').location, undefined, 'present first: where is refused for someone now in the scene');
    refused();
    assert.equal(bonds(s, 'npc_wren').meters.trust, 1);
    assert.match(JSON.stringify(s.host.head().domains.people.bonds.problems), /this person is here/);
    const live = snapshot(s);
    s.host.store.rebuild();
    assert.equal(snapshot(s), live, 'rebuild equals live');
    await s.swipe(ORDER);
    refused();
    await s.swipe(['~ npc Wren | trust: down']);
    assert.equal(bonds(s, 'npc_wren').meters.trust, -1);
    await s.say([]);
    await s.host.st.deleteMessage(first);
    await s.host.st.deleteMessage(first - 1);
    assert.equal(bonds(s, 'npc_wren')?.meters.trust, undefined, 'a middle delete takes the reply\'s lines away');
    assert.deepEqual(s.host.store.problems(), []);
    const after = snapshot(s);
    s.host.store.rebuild();
    assert.equal(snapshot(s), after, 'replay equals live after the delete');
});

test('an edited Re-read (grown and shrunk) gives what a live write of the edited reply gives', async () => {
    const s = await suite({ records: withWren() });
    const at = await s.say(['~ npc Wren | goal: find the courier | trust: up']);
    const edit = lines => { s.host.ctx.chat[at].mes = `The story goes on.\n\n<Changes>\n${lines.join('\n')}\n</Changes>`; };
    edit(['~ npc Wren | goal: find the courier | trust: up', '~ npc Wren | status: limping | tension: up | impact: major']);
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.deepEqual([dossier(s, 'npc_wren').goal, dossier(s, 'npc_wren').status, bonds(s, 'npc_wren').meters.tension], ['find the courier', 'limping', 3]);
    const grown = snapshot(s);
    s.host.store.rebuild();
    assert.equal(snapshot(s), grown, 'grown: replay equals live');
    edit(['~ npc Wren | goal: clear']);
    assert.equal((await s.host.sdk.reread(at)).ok, true);
    assert.deepEqual([dossier(s, 'npc_wren').goal, dossier(s, 'npc_wren').status, bonds(s, 'npc_wren').meters.trust, bonds(s, 'npc_wren').meters.tension], [undefined, undefined, 0, 0]);
    const shrunk = snapshot(s);
    s.host.store.rebuild();
    assert.equal(snapshot(s), shrunk, 'shrunk: replay equals live');
});
