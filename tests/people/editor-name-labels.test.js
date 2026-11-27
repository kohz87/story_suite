// The dossier editor and names: a save is refused only for a name or nickname it ADDS. A person's own unchanged name never blocks their save, even when
// another record has it too (namesakes are allowed); a new alias that is another stored person's own name, dead or alive, is refused (the next scan
// would fold the two into one record).
import test from 'node:test';
import { runEditorHostScenario } from './editor-host.mjs';

test('namesakes and shared labels do not block a save; another person\'s own name is refused as a nickname', () => {
    runEditorHostScenario('editor-name-labels', async () => {
        const check = (what, ok) => { if (!ok) throw new Error(what + ' ' + JSON.stringify(warned)); };
        const runtime = globalThis.NPCStateDelta;
        const warned = [];
        globalThis.toastr = { warning: text => warned.push(text), success() {}, info() {}, error() {} };
        const state = runtime.getState();
        const row = (id, name, aliases = [], extra = {}) => ({ id, name, aliases, role: 'watch', relationship: { trust: 0, affection: 0, desire: 0, tension: 0 }, ...extra });
        state.npcs = [row('npc_tomas', 'Tomas'), row('npc_tomas-2', 'Tomas'), row('npc_tam', 'Tam', ['Tomas']),
            row('npc_wenna', 'Wenna', [], { lifeState: 'deceased', lifeStateCertainty: 'explicit', present: false }), row('npc_bo', 'Bo', ['Cap'])];
        await runtime.installState(state);
        const npc = id => runtime.getNpc(id);
        const save = async (id, changes) => { warned.length = 0; await editNpc(id, changes); };
        // Opus 1: the unchanged own name is another's name and alias: the nickname, and a plain text edit, are saved.
        await save('npc_tomas', { aliases: 'the ferryman' });
        check('a namesake gets a nickname', npc('npc_tomas').aliases.join() === 'the ferryman' && !warned.length);
        await save('npc_tomas-2', { mood: 'gruff', trust: '7' });
        check('a namesake\'s meter edit is saved', npc('npc_tomas-2').mood === 'gruff' && npc('npc_tomas-2').relationship.trust === 7);
        await save('npc_tam', { mood: 'calm' });
        check('an old alias that is another\'s name does not block', npc('npc_tam').mood === 'calm' && npc('npc_tam').aliases.join() === 'Tomas');
        // Opus 2: an added alias that is another person's own name, living or dead.
        for (const [id, other] of [['npc_bo', 'Wenna'], ['npc_bo', 'tam']]) {
            await save(id, { aliases: 'Cap\n' + other, mood: 'sly' });
            check('refused ' + other, npc(id).aliases.join() === 'Cap' && npc(id).mood !== 'sly');
            check('plainly ' + other, warned.includes(`NPC State: ${other} is another person's name; pick a nickname only this person has.`));
        }
        await save('npc_wenna', { aliases: 'Cap' });
        check('an alias another person also has is allowed', npc('npc_wenna').aliases.join() === 'Cap');
        // A rename to a name someone else answers to is still refused; a namesake renamed away keeps no alias that is the other's name.
        await save('npc_bo', { name: 'Wenna' });
        check('rename to a taken name', npc('npc_bo').name === 'Bo' && warned.some(text => /another dossier already matches Wenna/.test(text)));
        await save('npc_tomas-2', { name: 'Aldo' });
        check('renamed namesake', npc('npc_tomas-2').name === 'Aldo' && !npc('npc_tomas-2').aliases.includes('Tomas'));
        await save('npc_bo', { name: 'Bram' });
        check('a unique old name is kept as an alias', npc('npc_bo').name === 'Bram' && npc('npc_bo').aliases.includes('Bo'));
    });
});
