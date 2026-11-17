// N8: the three call-site wirings of a Refresh, through the real handlers on the synthetic host (hosted): each test fails when its wiring is removed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runCalls } from './onepass-host-run.mjs';

/* global ZERO */
// The scenarios run in the child process (ZERO is defined there), so each builds the first reply's row itself.

test('a hidden (/hide) reply reaches the Refresh prompt', () => {
    const result = runCalls('refresh-hidden-wiring', true, async ({ reply, mockState }) => {
        const YUNYUN = { npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] };
        await reply('Yunyun waves from the gate.', YUNYUN);
        mockState.context.chat.splice(1, 0, { is_user: false, is_system: true, name: 'Megumin', mes: 'Yunyun keeps a brass compass from her father.', swipe_id: 0, swipes: [] });
        const prompts = [];
        const inner = mockState.quietResponder;
        mockState.quietResponder = async args => { if (/reconciliation scanner/i.test(String(args?.systemPrompt || ''))) prompts.push(String(args.prompt)); return inner(args); };
        await globalThis.NPCStateDelta.refreshFromChat('Yunyun');
        return { prompts };
    });
    assert.equal(result.prompts.length, 1);
    assert.match(result.prompts[0], /brass compass from her father/);
});

test('a Refresh answer with a background and no grounded quote does not store it (npcs row and profile row)', () => {
    const result = runCalls('refresh-background-wiring', true, async ({ reply, mockState }) => {
        const YUNYUN = { npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] };
        await reply('Yunyun, who grew up in the salt flats and jokes about being a former smuggler, waves from the gate.', YUNYUN);
        const id = globalThis.NPCStateDelta.getState().npcs.find(item => item.name === 'Yunyun').id;
        const inner = mockState.quietResponder;
        const answer = (globalThis.ANSWERS = []);
        mockState.quietResponder = async args => (/reconciliation scanner/i.test(String(args?.systemPrompt || '')) ? JSON.stringify(answer.shift()) : inner(args));
        const bg = { background: 'Raised in the salt flats.', backgroundState: 'update', backgroundReason: 'told' };
        answer.push({ npcs: [{ name: 'Yunyun', ...bg }], profileUpdates: [{ name: 'Yunyun', evidence: { background: ['grew up in the salt flats'] } }] });
        await globalThis.NPCStateDelta.refreshFromChat('Yunyun');
        const stored = globalThis.NPCStateDelta.getNpc(id).background;
        const lie = { background: 'A former smuggler.', backgroundState: 'update', backgroundReason: 'invented' };
        answer.push({ npcs: [{ name: 'Yunyun', mood: 'warm', ...lie }], profileUpdates: [{ name: 'Yunyun', ...lie }] });
        await globalThis.NPCStateDelta.refreshFromChat('Yunyun');
        const npc = globalThis.NPCStateDelta.getNpc(id);
        return { stored, background: npc.background, mood: npc.mood };
    });
    assert.equal(result.stored, 'Raised in the salt flats.', 'a grounded background is kept');
    assert.equal(result.background, 'Raised in the salt flats.', 'an ungrounded one changes nothing');
    assert.equal(result.mood, 'warm', 'the rest of the answer still applies');
});

async function manualThenReply({ reply, settings, mockState }) {
    settings.narrationCaptureCatchUp = 2;
    const YUNYUN = { npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'persistent', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO }] };
    await reply('Yunyun waves from the gate.', YUNYUN);
    const inner = mockState.quietResponder;
    mockState.quietResponder = async args => (/reconciliation scanner/i.test(String(args?.systemPrompt || ''))
        ? (globalThis.CHANGED_ANSWER ? JSON.stringify({ npcs: [{ name: 'Yunyun', mood: 'warm' }] }) : '{"npcs":[]}') : inner(args));
    await globalThis.NPCStateDelta.refreshFromChat('Yunyun');
    const second = await reply('Yunyun smiles at Kazuma.', { npcs: [{ name: 'Yunyun', present: true, relationshipImpact: 'none', relationshipDelta: ZERO }] });
    return { refresh: second.all.refresh };
}
const withChanged = changed => ({ toString: () => `(async (args) => { globalThis.CHANGED_ANSWER = ${changed}; return (${manualThenReply.toString()})(args); })` });

for (const changed of [true, false]) {
    test(`a manual Refresh (${changed ? 'changed' : 'unchanged'}) delays the next catch-up Refresh`, () => {
        assert.equal(runCalls(`refresh-manual-wiring-${changed}`, true, withChanged(changed)).refresh, 0);
    });
}
