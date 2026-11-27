// DOSSFIX2 N1: a person a `+ npc` line made and no scan ever touched had no "changed at reply" stamps container, and a line never makes one, so their goal,
// mood or look lines never moved the dossier's last change. A stub now starts with an empty container (kept through the runtime's write like memoryStamps).
import test from 'node:test';
import assert from 'node:assert/strict';
import { suite } from './helpers/pacing-suite.js';
import { normalizeNpcRecord } from '../../modules/people/core/core.js';
import { peopleView, peopleState } from '../../modules/people/view.js';
import { keepStampContainers } from '../../modules/people/keep-containers.js';
import { createPeopleSync } from '../../modules/people/adapter/people-sync.js';
import { hashJson } from '../../modules/people/adapter/hash.js';
import { selectDossier } from '../../ui/select/dossier.js';

const people = s => s.host.head().domains.people;
const marta = s => people(s).npcs.npc_marta ?? {};
const snap = s => JSON.stringify(s.host.head().domains);
const same = (s, why) => { const live = snap(s); s.host.store.rebuild(); assert.equal(snap(s), live, why); };
const quiet = async run => { const original = console.warn; console.warn = () => {}; try { return await run(); } finally { console.warn = original; } };
const lastReply = s => selectDossier({ dossier: s.host.sdk.query('people.dossier', { id: 'npc_marta' }), meters: s.npc('Marta') }).lastReply;

test('a person a line made moves their last change with their next lines; swipe, Re-read, middle delete and reload equal live', async () => {
    const s = await suite({ lines: true });
    await s.say(['+ npc Marta | clerk | a braid']);
    assert.deepEqual(marta(s).fieldChangeMessages, {}, 'the stub starts with an empty container');
    const goal = await s.say(['~ npc Marta | goal: balance the ledger']);
    assert.equal(marta(s).fieldChangeMessages.goal, goal);
    assert.equal(lastReply(s), goal);
    const mood = await s.say(['~ npc Marta | mood: tense | where: the counting house']);
    assert.equal(lastReply(s), mood);
    assert.equal(marta(s).fieldChangeMessages.goal, goal, 'a field the reply did not change keeps its stamp');
    const live = snap(s);
    await s.swipe(['~ npc Marta | goal: close the books']);
    assert.equal(marta(s).fieldChangeMessages.goal, mood);
    same(s, 'swipe replay equals live');
    await s.host.st.swipeTo(mood, 0);
    assert.equal(snap(s), live, 'swipe back restores exactly');
    assert.equal((await s.host.sdk.reread(mood)).ok, true);
    assert.equal(snap(s), live, 'a Re-read decides the same');
    await quiet(async () => { await s.host.st.deleteMessage(goal); await s.host.st.deleteMessage(goal - 1); });
    assert.deepEqual(s.host.store.problems?.() ?? [], []);
    assert.equal(marta(s).goal, '', 'the deleted reply\'s goal is gone');
    // (a stamp keeps the reply index it was written at, as every stamp and memory stamp does; a middle delete does not renumber them)
    assert.equal(lastReply(s), mood, 'the later reply\'s stamp stays the last change');
    same(s, 'middle delete replay equals live');
    const head = snap(s);
    await s.host.turn.onChatChanged();
    assert.equal(snap(s), head, 'reload equals live');
});

test('the runtime\'s write keeps a stub\'s empty stamps container, so a later line still stamps and a middle delete stays whole', async () => {
    const s = await suite({ lines: true });
    const state = { current: null };
    const sync = createPeopleSync({
        sdk: () => s.host.sdk, view: peopleView, restore: peopleState, hash: hashJson, readState: () => state.current,
        install: keys => { state.current = { ...keys, npcs: keys.npcs.map(record => normalizeNpcRecord(structuredClone(record))) }; return true; },
        keep: keepStampContainers,
    });
    await s.say(['+ npc Marta | clerk | a braid']);
    await sync.hydrate();
    assert.equal('fieldChangeMessages' in state.current.npcs.find(record => record.id === 'npc_marta'), false, 'the runtime\'s normalizer dropped the empty container');
    state.current.turn += 1;   // a change of the runtime's own (a scan, a fill-in)
    assert.equal((await sync.commit(state.current)).sent, true);
    assert.deepEqual(marta(s).fieldChangeMessages, {}, 'the stored container is kept');
    const a = await s.say(['~ npc Marta | goal: balance the ledger']);
    const b = await s.say(['~ npc Marta | look: ink on her fingers']);
    assert.equal(lastReply(s), b);
    await quiet(async () => { await s.host.st.deleteMessage(a); await s.host.st.deleteMessage(a - 1); });
    assert.deepEqual(s.host.store.problems?.() ?? [], []);
    assert.equal(lastReply(s), b, 'the later reply\'s stamp stays');
    assert.equal(marta(s).fieldChangeMessages.goal, undefined, 'the deleted reply\'s stamp is gone');
    same(s, 'middle delete replay equals live');
});

test('keepStampContainers restores an empty fieldChangeMessages the stored record has, and leaves one the view has alone', () => {
    const view = { npcs: { a: { id: 'a' }, b: { id: 'b', fieldChangeMessages: { goal: 4 } }, c: { id: 'c' } } };
    keepStampContainers(view, { npcs: { a: { fieldChangeMessages: {}, memoryStamps: {} }, b: { fieldChangeMessages: {} } } });
    assert.deepEqual(view.npcs, { a: { id: 'a', memoryStamps: {}, fieldChangeMessages: {} }, b: { id: 'b', fieldChangeMessages: { goal: 4 } }, c: { id: 'c' } });
});

// A pack person a line brings in (cast-first, ./npc-lines-cast-first.test.js): their dossier is made from the pack inside the line's step and gets the container too.
const ENTRY = { id: 'torka', name: 'Torka', kind: 'person', about: 'frontier berserker', look: 'Broad, scarred.', start: { goal: 'Clear the orc camps.' } };
const castModule = {
    id: 'story-director', name: 'Story Director stand-in (cast)',
    queries: {
        'director.cast': (state, args, tools) => {
            const scene = (() => { try { return tools.query('scene.present', {}); } catch { return []; } })();
            const here = (Array.isArray(scene) ? scene : []).some(name => String(name?.name ?? name).toLowerCase() === 'torka');
            if (!(args?.present === true && here)) return [];
            return [{ key: 'ersveil:torka', pack: 'ersveil', id: 'torka', name: 'Torka', aliases: [], met: null, alive: true, entry: structuredClone(ENTRY) }];
        },
    },
};

test('a pack person a line brings in starts with the container, so their next line moves their last change', async () => {
    const s = await suite({ lines: true, modules: [castModule], records: {} });
    await s.say(['+ present Torka', '~ npc Torka | trust: +1']);
    const torka = () => Object.values(people(s).npcs).find(npc => npc.name === 'Torka');
    assert.ok(torka()?.castFrom, 'made from the pack');
    assert.ok(torka().fieldChangeMessages, 'the container is there');
    const goal = await s.say(['~ npc Torka | goal: bring the convoy dead home']);
    assert.equal(torka().fieldChangeMessages.goal, goal);
    same(s, 'replay equals live');
});
