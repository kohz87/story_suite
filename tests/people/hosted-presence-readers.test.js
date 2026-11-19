// Hosted, who is present comes from Story Block's scene at read time and is never written into the saved dossier. Each reader below is run with the
// scene and the stored `present` disagreeing (stored: here; scene: nobody), and again standalone, where the stored value stands.
// Runtime part: Delta's real index.js on the synthetic host (helpers/host-scenario.js), a fake Story Block whose `scene.present` the scenario moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runHostScenario } from './helpers/host-scenario.js';
import fs from 'node:fs';

const scenario = async () => {
    const api = globalThis.NPCStateDelta;
    const suiteApi = (await import('__HANDLES__')).pageHandles.suiteApi;
    mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
    mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
    mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun waves from the gate.', swipe_id: 0, swipes: ['Yunyun waves from the gate.'] });
    const id = mockState.context.chat.length - 1;
    await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
    await sleep(400);
    const read = () => ({
        stored: api.getState().npcs[0].present,
        dossier: api.getDossierState(),
        token: api.dossierViewToken(),
        profile: suiteApi ? suiteApi.npcProfiles()[0]?.present : null,
    });
    mockState.scene = ['Yunyun'];
    const here = read();
    mockState.scene = [];
    const away = read();
    // The player's pending message names her: with the scene saying she is away, she is "called in" and her dossier is in the prompt.
    mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Yunyun, come here.' });
    const named = api.injectionPreview().text;
    console.log('RESULT ' + JSON.stringify({ here, away, named, hosted: globalThis.__handles.hosted ? '1' : null }));
};
const hostedPrelude = async () => {
    const sdk = { registered: [], sent: [], registerModule(def) { sdk.registered.push(def); }, command: async (type, payload) => { sdk.sent.push({ type, payload }); return { ok: true }; }, query: name => (name === 'scene.present' ? mockState.scene : []), settings: () => ({}) };
    mockState.sdk = sdk;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(sdk), sdk };
};
const resultOf = output => JSON.parse(output.split('\n').find(line => line.startsWith('RESULT ')).slice(7));

test('hosted: the dossier state, the token and npcProfiles follow the scene; the stored dossier is untouched', () => {
    const { here, away, hosted } = resultOf(runHostScenario('presence-hosted', hostedPrelude, scenario));
    assert.equal(hosted, '1');
    assert.equal(here.dossier.npcs[0].present, true);
    assert.equal(away.stored, true, 'the saved dossier still says present');
    assert.equal(away.dossier.npcs[0].present, false, 'the panel\'s state follows the scene');
    assert.notEqual(away.token, here.token, 'the panel redraws when only the scene moved');
    assert.equal(here.profile, true, 'npcProfiles follows the scene');
    assert.equal(away.profile, false, 'npcProfiles follows the scene when it moves away');
});

test('hosted: the person the reader names, whom the scene leaves out, keeps her dossier in the prompt; standalone the same text', () => {
    const hosted = resultOf(runHostScenario('presence-named-hosted', hostedPrelude, scenario));
    const alone = resultOf(runHostScenario('presence-named-alone', async () => {}, scenario));
    assert.match(hosted.named, /Yunyun: IDENTITY[^\n]*role: adventurer/);
    assert.equal(hosted.named, alone.named, 'the prompt is the same text either way here (the check itself is pinned below)');
});

test('npcProfiles and the called-in check read the scene\'s presence through scenePresenceView ', () => {
    const suite = fs.readFileSync(new URL('../../modules/people/runtime/runtime-npc-api.js', import.meta.url), 'utf8');
    assert.match(suite, /buildNpcProfiles\(scenePresenceView\(getChatState\(key\)\.npcs \|\| \[\]\)/);
    const injection = fs.readFileSync(new URL('../../modules/people/runtime/runtime-injection.js', import.meta.url), 'utf8');
    assert.match(injection, /return \(scenePresenceView\(state\?\.npcs \|\| \[\]\)\)\n\s*\.filter\(npc => npc && !npc\.present/);
});

test('standalone: the stored presence stands for every reader', () => {
    const alone = resultOf(runHostScenario('presence-alone', async () => {}, scenario));
    assert.equal(alone.hosted, null);
    assert.equal(alone.here.dossier.npcs[0].present, true);
    assert.equal(alone.away.dossier.npcs[0].present, true, 'no scene to ask');
    assert.equal(alone.away.profile, true);
    assert.equal(alone.away.token, alone.here.token, 'the token is unchanged standalone');
});

// World → Here: a person the scene lists gets their card even when Delta's own stored flag says away, and the other way round.
const castScenario = async () => {
    const api = globalThis.NPCStateDelta;
    mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high' }], profileUpdates: [], keyRelationshipEdges: [] });
    mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
    mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun waves from the gate.', swipe_id: 0, swipes: ['Yunyun waves from the gate.'] });
    const id = mockState.context.chat.length - 1;
    await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
    await sleep(400);
    // Who the people list shows as here (the suite api's npcs(), the view's source), read through the scene.
    const cards = () => (globalThis.__handles?.suiteApi?.npcs?.() ?? []).filter(npc => npc.present).length;
    const storedHere = api.getState().npcs[0].present;
    mockState.scene = ['Yunyun'];
    const sceneHereStoredHere = cards();
    mockState.scene = [];
    const sceneAwayStoredHere = cards();
    // A later scan of a reply she has left: Delta's own stored flag goes to away, while the scene (the story's list) still has her.
    mockState.quietResponder = async () => JSON.stringify({ npcs: [{ id: api.getState().npcs[0].id, name: 'Yunyun', present: false, presenceConfidence: 1 }], profileUpdates: [], keyRelationshipEdges: [] });
    mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Where did she go?' });
    mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun has left for the city, far away. The gate is empty.', swipe_id: 0, swipes: ['Yunyun has left for the city, far away. The gate is empty.'] });
    await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(mockState.context.chat.length - 1)));
    await sleep(400);
    const injected = api.getState().npcs[0].present;
    mockState.scene = ['Yunyun'];
    const sceneHereStoredAway = cards();
    console.log('RESULT ' + JSON.stringify({ storedHere, sceneHereStoredHere, sceneAwayStoredHere, sceneHereStoredAway, injected }));
};

test('hosted: who is present follows the scene, not the stored flag (World → Here drew chips while the stored flag said away)', () => {
    const out = resultOf(runHostScenario('presence-cards-hosted', hostedPrelude, castScenario));
    assert.equal(out.storedHere, true);
    assert.ok(out.sceneHereStoredHere > 0, 'scene and flag agree: present');
    assert.equal(out.sceneAwayStoredHere, 0, 'the scene says away: not present');
    assert.ok(out.sceneHereStoredAway > 0, 'the scene says here and the stored flag says away: still present');
    assert.equal(out.injected, false, 'the stored dossier is not written');
});
