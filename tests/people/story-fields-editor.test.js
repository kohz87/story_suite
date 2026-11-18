// Pack format 4, N1: the dossier editor's rows for Abilities and Keepsakes (and Level while RPG is on), through the synthetic host.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runEditorHostScenario } from './editor-host.mjs';

test('the editor draws Abilities and Keepsakes, saves them as pairs, keeps them on an untouched Save, and draws no Level row with RPG off', () => {
    runEditorHostScenario('story-fields', async () => {
        const runtime = globalThis.NPCStateDelta;
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'The guild hall is quiet.' });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun, the adventurer, waits at the gate.', swipe_id: 0, swipes: ['Yunyun, the adventurer, waits at the gate.'] });
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(2)));
        await sleep(200);
        const yunyun = () => runtime.getDossierState().npcs.find(npc => npc.name === 'Yunyun');
        const id = yunyun().id;
        let form = await openEditorForm(id);
        assert.ok(form.controls.has('npc_state_delta_edit_abilities'), 'Abilities row');
        assert.ok(form.controls.has('npc_state_delta_edit_keepsakes'), 'Keepsakes row');
        assert.equal(form.controls.has('npc_state_delta_edit_level'), false, 'no Level row with RPG off');
        await saveEditorForm(form, { abilities: 'Mending — closes small wounds\nWard\nmending — a second one', keepsakes: 'Brass compass — her father\'s' });
        assert.deepEqual(yunyun().abilities, [{ name: 'Mending', description: 'closes small wounds' }, { name: 'Ward', description: '' }]);
        assert.deepEqual(yunyun().keepsakes, [{ name: 'Brass compass', description: 'her father\'s' }]);
        // A Save that touches another field keeps all three as stored.
        form = await openEditorForm(id);
        await saveEditorForm(form, { goal: 'Find the lost grimoire.' });
        assert.equal(yunyun().goal, 'Find the lost grimoire.');
        assert.equal(yunyun().abilities.length, 2);
        assert.equal(yunyun().keepsakes.length, 1);
        assert.equal(Object.hasOwn(yunyun(), 'level'), false, 'a Save with the Level row not drawn invents no Level');
        // Clearing the lines removes the keys.
        form = await openEditorForm(id);
        await saveEditorForm(form, { abilities: '', keepsakes: '' });
        assert.equal(Object.hasOwn(yunyun(), 'abilities') || Object.hasOwn(yunyun(), 'keepsakes'), false);
    });
});
