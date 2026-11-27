// "Add NPC" with a dead person's name makes nobody: the message says it matched the dead person, never "created".
import test from 'node:test';
import { runEditorHostScenario } from './editor-host.mjs';

test('Add NPC with a dead person\'s name says whom it matched', () => {
    runEditorHostScenario('add-npc-dead', async () => {
        const check = (what, ok) => { if (!ok) throw new Error(what + ' ' + JSON.stringify(said)); };
        const runtime = globalThis.NPCStateDelta;
        const said = [];
        const hear = text => said.push(text);
        globalThis.toastr = { warning: hear, success: hear, info: hear, error: hear };
        const state = runtime.getState();
        state.npcs = [{ id: 'npc_tomas', name: 'Tomas', aliases: ['the ferryman'], lifeState: 'deceased', lifeStateCertainty: 'explicit', present: false }];
        await runtime.installState(state);
        for (const asked of ['Tomas', 'the ferryman']) {
            said.length = 0;
            await runtime.addNpc(asked);
            check('nobody new', runtime.getState().npcs.length === 1);
            check('says so', said.join('|') === 'NPC State: nobody new was added; that name matches Tomas, who has died.');
        }
        said.length = 0;
        await runtime.addNpc('Wenna');
        check('a new person is created', runtime.getState().npcs.length === 2 && /Wenna created\./.test(said.join()));
    });
});
