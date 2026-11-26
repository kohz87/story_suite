// The real dossier editor and the real injection with a marked `toward:` sentence: a Save that leaves the text alone keeps it and its mark, even when a
// meter moved; a Save that edits the text drops the mark. The marked record comes in through the dossier import.
import test from 'node:test';
import { runEditorHostScenario } from './editor-host.mjs';

test('editor Save and the sent injection keep an untouched toward sentence word for word and unmark an edited one', () => {
    runEditorHostScenario('toward-mark', async () => {
        const runtime = globalThis.NPCStateDelta;
        const bundle = await import(pathToFileURL(path.resolve(here, '../../modules/people/bundle/bundle.js')).href);
        const PARTNER = 'Her chosen partner, the man she wants beside her.';
        mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'adventurer', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'The guild hall is quiet.' });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is at the gate?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Yunyun, the adventurer, waits at the gate.', swipe_id: 0, swipes: ['Yunyun, the adventurer, waits at the gate.'] });
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(2)));
        await sleep(200);
        const yunyun = () => runtime.getDossierState().npcs.find(npc => npc.name === 'Yunyun');
        const id = yunyun().id;
        const decoded = bundle.decodeNpcStateBundle(await runtime.exportBytes());
        Object.assign(decoded.state.npcs.find(npc => npc.id === id), { relationshipSummary: PARTNER, relationshipSummarySource: 'line', present: true });
        await runtime.importBytes(bundle.encodeNpcStateBundle(decoded.state, { chatKey: decoded.metadata.sourceChatKey }));
        await sleep(100);
        const mark = () => [yunyun().relationshipSummary, yunyun().relationshipSummarySource];
        const sent = () => runtime.injectionPreview().text;
        const expect = (why, summary, source) => assert.deepEqual(mark(), [summary, source], why);
        expect('imported', PARTNER, 'line');
        if (!sent().includes(`TOWARD PLAYER (secondary): ${PARTNER}`)) throw new Error(`not sent as written: ${sent()}`);
        await editNpc(id, { trust: '12' });
        expect('a meter moved, the text untouched', PARTNER, 'line');
        if (!sent().includes(`TOWARD PLAYER (secondary): ${PARTNER}`)) throw new Error(`not sent as written after Save: ${sent()}`);
        await editNpc(id, { relationship_summary: 'A man she wants beside her.' });
        expect('the reader edited the text', 'A man she wants beside her.', undefined);
    });
});
