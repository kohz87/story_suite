// P6 gender and death, on the real NPC State adapter (peopleRig): a person whose gender the story stated and who later dies keeps it as stated (nothing is
// inferred, a later line or scan cannot change it); one never stated shows "not stated" and may be filled in once when the story states it outright.
// Replay equals live after a Re-read, a rewind and a reload. (No export of the old misgendered dead NPC exists; this pins that case.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleRig } from './helpers/people-rig.js';
import { mergeScanResult, normalizeNpcRecord } from '../../packages/npc-state-delta/core.js';
import { selectDossier } from '../../ui/select/dossier.js';

const settle = () => new Promise(resolve => setTimeout(resolve, 60));
const person = (rig, key) => rig.host.head().domains.people?.npcs?.[`npc_${key}`];
const headOf = async rig => (await rig.host.sdk.timeline.head({})).headHash;
const plain = value => JSON.parse(JSON.stringify(value));
const line = body => `\n\n<Changes>\n${body}\n</Changes>`;

async function kill(rig, key, event) {
    await rig.host.send('Go on.', 'The lethal reply.');
    const who = rig.host.sdk.query('npc.identity', { name: key.toUpperCase() });
    const out = await rig.adapter.confirmDeath({ event, npc: who.id, expectedHead: await headOf(rig) });
    assert.equal(out.ok, true, out.message);
    await settle();
}

test('a stated gender stays as stated after death: a later line cannot change it; an unstated one is filled once, then frozen', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    await settle();
    await rig.host.send('Next.', `Mira nods.${line('~ npc MIRA | gender: she')}`);
    await settle();
    assert.equal(person(rig, 'mira').gender, 'female', 'the story\'s "she" is stored as female');
    assert.equal(person(rig, 'tom').gender, undefined, 'nothing is inferred for the one never stated');

    await kill(rig, 'mira', 'de_death_mira');
    await kill(rig, 'tom', 'de_death_tom');
    assert.equal(person(rig, 'mira').lifeState, 'deceased');

    await rig.host.send('Later.', `They were remembered.${line('~ npc MIRA | gender: he\n~ npc TOM | gender: he')}`);
    await settle();
    assert.equal(person(rig, 'mira').gender, 'female', 'a stated gender is frozen at death');
    assert.equal(person(rig, 'tom').gender, 'male', 'one never stated is filled in once when the story states it outright');

    await rig.host.send('Again.', `Still remembered.${line('~ npc TOM | gender: she')}`);
    await settle();
    assert.equal(person(rig, 'tom').gender, 'male', 'once filled, it is stated and frozen too');

    const live = plain(rig.host.head());
    await rig.host.store.rebuild();
    assert.deepEqual(plain(rig.host.head()), live, 'rebuild equals live');
    const again = await rig.reload();
    assert.equal(await again.settle(), true);
    assert.equal(person(again, 'mira').gender, 'female', 'reload equals live');
});

test('an edited Re-read of the reply that stated the gender, and a rewind of it, keep replay equal to live', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    await settle();
    await rig.host.send('Next.', `Mira nods.${line('~ npc MIRA | gender: she')}`);
    await settle();
    const at = rig.host.store.headIndex();
    rig.host.ctx.chat[at].mes = `Mira nods.${line('~ npc MIRA | gender: he')}`;
    assert.equal((await rig.host.turn.reread(at)).ok, true);
    await settle();
    assert.equal(person(rig, 'mira').gender, 'male', 'the edited line applies (she was not yet stated for good)');
    const live = plain(rig.host.head());
    await rig.host.store.rebuild();
    assert.deepEqual(plain(rig.host.head()), live, 'rebuild equals live after the Re-read');
    await rig.host.st.deleteMessage(at);
    await settle();
    assert.equal(person(rig, 'mira').gender, undefined, 'a rewind takes the stated gender away; nothing is left behind');
});

test('a swipe, swiping back and a middle delete: the stated gender follows the selected reply, replay equals live', async t => {
    const rig = await peopleRig(t);
    await rig.reply('Mira is here.');
    await settle();
    await rig.host.send('Next.', `Mira nods.${line('~ npc MIRA | gender: she')}`);
    await settle();
    assert.equal(person(rig, 'mira').gender, 'female');
    await rig.host.swipe('Mira says nothing about herself.');
    await settle();
    assert.equal(person(rig, 'mira').gender, undefined, 'the other swipe never stated it');
    await rig.host.swipe('Mira nods.\n\n<Changes>\n~ npc MIRA | gender: she\n</Changes>');
    await settle();
    assert.equal(person(rig, 'mira').gender, 'female', 'a swipe that states it again');
    await rig.host.send('Later.', 'Another reply.');
    await settle();
    await rig.host.st.deleteMessage(rig.host.ctx.chat.length - 3);
    await settle();
    const live = plain(rig.host.head());
    await rig.host.store.rebuild();
    assert.deepEqual(plain(rig.host.head()), live, 'rebuild equals live after the middle delete');
});

test('the scan paths: a correction after death does not change a stated gender, a never-stated one is filled once; a Refresh replaces only while alive', () => {
    const dead = { lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Killed.' };
    const state = gender => ({ turn: 3, npcs: [normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', gender, ...dead }), normalizeNpcRecord({ id: 'npc_liv', name: 'Liv', gender: 'female' })], candidates: [] });
    const scan = (npc, extra) => mergeScanResult(state(npc.gender), { npcs: [{ id: npc.id, name: npc.name, ...extra }] }, { turn: 4, developmentContext: `${npc.name} is a man in the story.` }).state.npcs.find(item => item.id === npc.id);
    const mira = { id: 'npc_mira', name: 'Mira', gender: 'female' };
    assert.equal(scan(mira, { gender: 'male', genderState: 'correct', genderReason: 'The story says he.' }).gender, 'female', 'a correction does not change a stated gender after death');
    assert.equal(scan({ ...mira, gender: '' }, { gender: 'he' }).gender, 'male', 'never stated: filled once, in the story\'s own word');
    const refreshed = (id, name, gender) => mergeScanResult(state('female'), { npcs: [{ id, name }], profileUpdates: [{ id, name, gender }] }, { turn: 4, developmentContext: `${name} is a man.` }).state.npcs.find(item => item.id === id);
    assert.equal(refreshed('npc_liv', 'Liv', 'male').gender, 'male', 'a Refresh replaces a stated gender while the person lives');
    assert.equal(refreshed('npc_mira', 'Mira', 'male').gender, 'female', 'and not after death');
});

test('an unstated gender reads "not stated" in the dossier, never "unknown"', () => {
    const view = selectDossier({ dossier: { id: 'np_9', name: 'Tom', species: 'Human', gender: '' } });
    assert.equal(view.idLine, 'Human · gender not stated');
    assert.doesNotMatch(JSON.stringify(view), /gender unknown|Unknown · set it/i);
});
