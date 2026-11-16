import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SUITE_ID,
    announceNpcStateDelta,
    NARRATION_CAPTURE_OUTPUT_ESTIMATE_CHARS,
    SUITE_SHOWS,
    copyTokenEstimate,
    injectionSections,
    replyTokenEstimate,
    replyPreview,
    buildManageApi,
} from '../../modules/people/legacy/suite-handshake.js';
import { fresh, runHostScenario } from './v120-story-suite.helpers.js';

test('v1.2.2 Delta announces shows: [\'chatter\'] while enabled, never while off', () => {
    const suite = fresh();
    const api = { npcs: () => [], manage: buildManageApi({ setEnabled: () => {} }) };
    assert.deepEqual(SUITE_SHOWS, ['chatter']);
    announceNpcStateDelta({ enabled: true, version: '1.2.2', api, shows: SUITE_SHOWS }, suite);
    assert.deepEqual(suite.providers().find(item => item.id === SUITE_ID).shows, ['chatter']);
    announceNpcStateDelta({ enabled: false, version: '1.2.2', api, shows: SUITE_SHOWS }, suite);
    const off = suite.providers().find(item => item.id === SUITE_ID);
    assert.equal(off.enabled, false);
    assert.equal('shows' in off, false, 'the enabled: false announcement carries no shows');
    announceNpcStateDelta({ enabled: true, version: '1.2.2', api }, suite);
    assert.equal('shows' in suite.providers().find(item => item.id === SUITE_ID), false, 'without shows, none is announced');
});

test('v1.2.2 tokens(): the injection by section plus one-pass capture, about four characters a token', () => {
    const injection = [
        'NPC STATE DELTA DOSSIER. Only confirmed-present NPCs are included.', // 66
        'IDENTITY FIRST / DOMINATES: personality sets identity.', // 54
        '- Yunyun: personality: shy; speech: polite', // 42
        '- Wiz: personality: kind', // 24
        'MENTIONED, NOT PRESENT: NPCs the recent story names.', // 52
        '- Megumin (mentioned, not present; archwizard)', // 46
        'DECEASED, REFERENCED ONLY: these NPCs are dead.', // 47
        '- Old Brenn (deceased)', // 22
        'RELATIONSHIP-TO-BEHAVIOR RUBRIC: trust permits candor.', // 54
    ].join('\n');
    assert.deepEqual(injectionSections(injection), [
        { label: 'Dossier instructions', chars: 66 + 1 + 54 },
        { label: 'Present NPC cards', chars: 43 + 25 },
        { label: 'Mentioned NPCs', chars: 53 + 47 },
        { label: 'Deceased references', chars: 48 + 23 },
        { label: 'Relationship rubric', chars: 55 },
    ]);
    const estimate = replyTokenEstimate({ injection });
    assert.deepEqual(estimate.parts.map(part => [part.label, part.input, part.output]), [
        ['Dossier instructions', 31, 0], ['Present NPC cards', 17, 0], ['Mentioned NPCs', 25, 0], ['Deceased references', 18, 0], ['Relationship rubric', 14, 0],
    ]);
    assert.deepEqual([estimate.input, estimate.output], [105, 0], 'output stays 0: the injection asks for nothing in the reply');
    assert.ok(Math.abs(estimate.input - injection.length / 4) <= estimate.parts.length, 'about four characters a token');

    const capture = replyTokenEstimate({ injection, captureChars: 7998, captureOutputChars: NARRATION_CAPTURE_OUTPUT_ESTIMATE_CHARS });
    assert.deepEqual(capture.parts.slice(-2), [
        { label: 'One-pass capture instruction', input: 2000, output: 0 },
        { label: 'One-pass capture block', input: 0, output: 300 },
    ]);
    assert.deepEqual([capture.input, capture.output], [2105, 300]);
    assert.deepEqual(replyTokenEstimate(), { input: 0, output: 0, parts: [] });
    assert.deepEqual(replyTokenEstimate({ injection: '', captureChars: 400, captureOutputChars: 80 }), { input: 100, output: 20, parts: [
        { label: 'One-pass capture instruction', input: 100, output: 0 }, { label: 'One-pass capture block', input: 0, output: 20 },
    ] });
    assert.deepEqual(copyTokenEstimate({ input: 999, parts: [{ label: 'x', input: '3.4', output: -2 }, null] }), { input: 3, output: 0, parts: [{ label: 'x', input: 3, output: 0 }] });
    const manage = buildManageApi({ tokens: () => { throw new Error('boom'); } });
    const warn = console.warn;
    console.warn = () => {};
    try {
        assert.deepEqual(manage.tokens(), { input: 0, output: 0, parts: [] }, 'never throws');
    } finally {
        console.warn = warn;
    }
    assert.deepEqual(buildManageApi().tokens(), { input: 0, output: 0, parts: [] });
});

test('v1.2.2 the runtime: tokens() measures the live injection, shows: chatter, now lines and chatter bubbles', () => {
    runHostScenario('present-scene', async () => {
        const suite = globalThis.StorySuite;
        const own = () => suite.providers().find(item => item.id === 'npc-state-delta');
        assert.deepEqual(own().shows, ['chatter'], 'shows chatter while enabled');
        const manage = own().api.manage;
        assert.deepEqual(manage.tokens(), { input: 0, output: 0, parts: [] }, 'nothing before a scene');

        const worldState = '**👥 NPCs Present:**\n**Yunyun:**\n* *Outfit:* red ribbon\n* *Mood:* flustered';
        const chatter = '**Yunyun:** <i>Did he see?</i>\nWiz: Such a nice couple.\nMegumin: Boring.';
        const reply = `Yunyun waves from the gate while Wiz minds her shop.\n<World_State>${worldState}</World_State>\n<NPC_Inner_Chatter>${chatter}</NPC_Inner_Chatter>`;
        const reads = [];
        globalThis.StoryBlock = {
            listBlocks: () => [
                { tag: 'World_State', display: 'scene', enabled: true },
                { tag: 'NPC_Inner_Chatter', display: 'chatter', enabled: true },
            ],
            blockInText: (text, tag) => {
                reads.push(tag);
                const found = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(String(text));
                return found ? { tag, text: found[1], messageIndex: null } : null;
            },
        };
        mockState.quietResponder = async () => JSON.stringify({ npcs: [
            { name: 'Yunyun', present: true, role: 'adventurer', mood: 'nervous', status: 'healthy', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named companion', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } },
            { name: 'Wiz', present: true, role: 'shopkeeper', mood: 'cheerful', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named shopkeeper', directInteraction: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } },
        ] });
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'Who is here?' });
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: reply, swipe_id: 0, swipes: [reply] });
        const id = mockState.context.chat.length - 1;
        await Promise.all((mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        // Wait on the real conditions (the tail prompt is sent, the in-chat cards mounted on their debounce), not on time.
        const tailSent = () => mockState.prompts.some(args => args[0] === 'story_suite_tail_4_npc_state_delta');
        const bubblesMounted = () => /npc-state-delta-present-cell-chatter/.test(inlineAnchors[0]?.innerHTML || '');
        assert.ok(await waitFor(() => tailSent() && bubblesMounted(), { timeout: 20000 }), 'tail prompt sent and bubbles mounted');

        // tokens(): the same injection Delta sends, split by section; no request is made for it.
        const requests = mockState.rawCalls.length;
        const sent = mockState.prompts.filter(args => args[0] === 'story_suite_tail_4_npc_state_delta').at(-1)?.[1] || '';
        assert.ok(sent.length > 0);
        const tokens = manage.tokens();
        assert.ok(tokens.parts.some(part => part.label === 'Present NPC cards' && part.input > 0));
        assert.equal(tokens.output, 0);
        assert.equal(tokens.input, tokens.parts.reduce((total, part) => total + part.input, 0));
        assert.ok(Math.abs(tokens.input - sent.length / 4) <= tokens.parts.length, `${tokens.input} ≈ ${sent.length} / 4`);
        assert.equal(mockState.rawCalls.length, requests, 'no model request');

        // Alone: the now line is Delta's own; chatter bubbles beside the speakers; a speaker card for Megumin.
        const alone = globalThis.NPCStateDelta.presentCastHtml();
        assert.match(alone, /data-delta-scene="/);
        assert.match(alone, /class="npc-state-delta-present-now"><span class="npc-state-delta-present-now-part npc-state-delta-present-now-mood" data-delta-title="\d+"><span class="npc-state-delta-present-now-label">Mood:<\/span> <span class="npc-state-delta-present-now-text" data-delta-text/);
        assert.doesNotMatch(alone, /present-now-world/, 'without Story Block keeping the scene, Delta\'s own now line');
        // 1.2.4: both have chatter, so the right half of each row is the bubble, not the now lines.
        assert.equal((alone.match(/class="npc-state-delta-present-cell npc-state-delta-present-cell-chatter"/g) || []).length, 2);
        assert.doesNotMatch(alone, /npc-state-delta-present-side/);
        assert.match(alone, /npc-state-delta-present-cell-chatter[\s\S]*npc-state-delta-chatter-speech/);
        // 1.2.7: Megumin speaks without a present card, so she gets a speaker card, not Others.
        assert.equal((alone.match(/npc-state-delta-present-cell-speaker/g) || []).length, 1);
        assert.doesNotMatch(alone, /npc-state-delta-chatter-others/);
        assert.doesNotMatch(alone, /<i>Did he see|Such a nice couple|Boring|flustered/, 'story text never enters the markup');
        assert.ok(reads.includes('NPC_Inner_Chatter'));
        assert.match(inlineAnchors[0]?.innerHTML || '', /npc-state-delta-present-cell-chatter/, 'the in-chat cards show the bubbles too');

        // Story Block keeps the scene: the now line comes from its World State.
        suite.announce({ id: 'story-block', name: 'Story Block', version: '0.9.1', owns: ['scene'] });
        const worldNow = () => /npc-state-delta-present-now npc-state-delta-present-now-world/.test(globalThis.NPCStateDelta.presentCastHtml());
        await waitFor(worldNow, { timeout: 20000 });
        assert.ok(worldNow(), 'the now line comes from Story Block');
        assert.equal(mockState.rawCalls.length, requests, 'display only: still no request');
        const state = JSON.stringify(globalThis.NPCStateDelta.getState());
        globalThis.NPCStateDelta.presentCastHtml();
        globalThis.NPCStateDelta.renderInline();
        assert.equal(JSON.stringify(globalThis.NPCStateDelta.getState()), state, 'no data change');

        const enable = uiHandlers.get('change.npcStateDelta|#npc_state_delta_enabled');
        enable.call({ checked: false });
        assert.equal(own().enabled, false);
        assert.equal('shows' in own(), false, 'off: no shows, so Story Block keeps its own Chatter tab');
        assert.deepEqual(own().api.manage.tokens(), { input: 0, output: 0, parts: [] }, 'off: Delta adds nothing');
        enable.call({ checked: true });
        assert.deepEqual(own().shows, ['chatter']);
        delete globalThis.StoryBlock;
    });
});

test('v1.2.13 manage.preview(): what the next reply gets, each part with its size, never throws', () => {
    const manage = buildManageApi({ preview: () => ({ injection: 'NPC STATE DELTA DOSSIER.\n- Elke: IDENTITY …', capture: 'One-pass capture: write …' }) });
    const preview = manage.preview();
    assert.equal(preview.label, 'NPC State Delta');
    assert.deepEqual(preview.parts.map(part => part.label), ['Live dossier', 'One-pass capture instruction (end of the prompt)']);
    assert.equal(preview.parts[0].tokens, Math.ceil(preview.parts[0].text.length / 4));
    assert.equal(preview.text, `${preview.parts[0].text}\n\n${preview.parts[1].text}`);
    assert.deepEqual(replyPreview({ injection: '', capture: '' }), { label: 'NPC State Delta', text: '', parts: [] });
    assert.deepEqual(buildManageApi({ preview: () => { throw new Error('boom'); } }).preview(), { label: 'NPC State Delta', text: '', parts: [] });
    assert.deepEqual(buildManageApi().preview().parts, []);
});
