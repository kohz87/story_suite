import test from 'node:test';
import { runEditorHostScenario } from './editor-host.mjs';

// The reader's hand edit in the dossier editor is never blocked by the death freeze: gender can be set, and changed, after death.
test('the dossier editor changes a dead person\'s gender, unstated or stated', () => {
    runEditorHostScenario('gender-after-death', async () => {
        const runtime = globalThis.NPCStateDelta;
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', mood: 'calm', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun waits at the gate.', swipe_id: 0, swipes: ['Yunyun waits at the gate.'] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        await sleep(200);
        const yunyun = () => runtime.getDossierState().npcs.find(npc => npc.name === 'Yunyun');
        const npcId = yunyun().id;
        if (yunyun().gender) throw new Error('expected no gender before the edit');
        if (await runtime.updateLifeState(npcId, 'deceased', { chatKey: runtime.uiStatus().chatKey }) !== true) throw new Error('death not set');
        if (yunyun().lifeState !== 'deceased') throw new Error('not deceased');
        await editNpc(npcId, { gender: 'female' });
        if (yunyun().gender !== 'female') throw new Error('unstated gender after death: ' + yunyun().gender);
        await editNpc(npcId, { gender: 'male' });
        if (yunyun().gender !== 'male') throw new Error('stated gender after death: ' + yunyun().gender);
        if (yunyun().lifeState !== 'deceased') throw new Error('edit undid the death');
    });
});
