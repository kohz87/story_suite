// B4-13 close-out 1: Tools › "What's sent" (the in-page api's manage.preview, which the adapter's ownPrompt also counts) shows the one-pass
// lines a hosted reply really carries: the rules and the context updateInjection sends under NPC State's own prompt keys, built by the same
// function. Without a host nothing is asked for, so no one-pass part is shown. (Before, it showed the JSON one-pass prompt nothing sent.)
import test from 'node:test';
import assert from 'node:assert/strict';

const sent = new Map();
globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
globalThis.__npcMock.context = { chat: [], setExtensionPrompt: (key, value) => sent.set(key, value), name1: 'Ari', name2: 'Narrator' };
const { normalizeNpcRecord } = await import('../../modules/people/core/core.js');
const { createInjectionPart } = await import('../../modules/people/runtime/runtime-injection.js');
const { createNpcApiPart } = await import('../../modules/people/runtime/runtime-npc-api.js');
const { getSettings } = await import('../../modules/people/settings/runtime-settings.js');

const KEYS = { PROMPT_KEY: 'npc_dossier', CAPTURE_PROMPT_KEY: 'npc_capture', CAPTURE_RULES_KEY: 'story_suite_static_people', CAPTURE_PROMPT_DEPTH: 0, LEGACY_PROMPT_KEYS: [] };
const state = { npcs: [normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', present: true, role: 'Ferrywoman', personality: 'Calm.' })], turn: 3 };

function rig({ hosted }) {
    sent.clear();
    const rt = { lastInjection: {}, narrationCaptureArmed: null, captureRulesWithheld: false };
    const common = { chatHydrationStatus: () => 'ready', getChatKey: () => 'chat', getChatState: () => state, scenePresenceView: npcs => npcs };
    const injection = createInjectionPart(rt, {
        ...KEYS, ...common, hostedMeterView: npcs => npcs, awayReturnNotes: () => [],
        hostedNotePromptOptions: () => (hosted ? { layeredSecrets: true } : {}), adapterMeters: () => (hosted ? {} : null),
    });
    const api = createNpcApiPart(rt, { ...common, liveInjectionText: injection.liveInjectionText, nextCaptureParts: injection.nextCaptureParts, queueCastRefresh() {}, renderDossier() {}, updateInjection() {} });
    return { rt, injection, preview: () => api.SUITE_API.manage.preview() };
}

test('hosted: What\'s sent shows the rules and the context the armed reply is sent, word for word', () => {
    const settings = getSettings();
    Object.assign(settings, { enabled: true, inject: true, narrationCapture: true, fullScanEveryTurn: false });
    const { rt, injection, preview } = rig({ hosted: true });
    rt.narrationCaptureArmed = 'chat';
    injection.updateInjection();
    const rules = sent.get(KEYS.CAPTURE_RULES_KEY);
    const context = sent.get(KEYS.CAPTURE_PROMPT_KEY);
    assert.ok(rules && context, 'an armed hosted reply carries both');
    const shown = Object.fromEntries(preview().parts.map(part => [part.label, part.text]));
    assert.equal(shown['One-pass rules (system prompt)'], rules);
    assert.equal(shown['One-pass capture instruction (end of the prompt)'], context);
    assert.equal(shown['Live dossier'], sent.get(KEYS.PROMPT_KEY));
    assert.doesNotMatch(JSON.stringify(shown), /npc_state_delta \{valid JSON\}|ONE-PASS CAPTURE/, 'no JSON block is asked for');
});

test('without a host: no one-pass part, only the dossier', () => {
    const settings = getSettings();
    Object.assign(settings, { enabled: true, inject: true, narrationCapture: true, fullScanEveryTurn: false });
    const { preview } = rig({ hosted: false });
    assert.deepEqual(preview().parts.map(part => part.label), ['Live dossier']);
});

test('one-pass off: no one-pass part even when hosted', () => {
    const settings = getSettings();
    Object.assign(settings, { enabled: true, inject: true, narrationCapture: false });
    const { preview } = rig({ hosted: true });
    assert.deepEqual(preview().parts.map(part => part.label), ['Live dossier']);
    settings.narrationCapture = true;
});

test('hosted: the context ends with the reminder naming who is here and who the player\'s message calls; the dead never', () => {
    const settings = getSettings();
    Object.assign(settings, { enabled: true, inject: true, narrationCapture: true, fullScanEveryTurn: false });
    const extra = [normalizeNpcRecord({ id: 'npc_oren', name: 'Oren', present: false, role: 'Smith' }), normalizeNpcRecord({ id: 'npc_tam', name: 'Tam', present: false, lifeState: 'deceased', lifeStateCertainty: 'explicit' }), normalizeNpcRecord({ id: 'npc_lio', name: 'Lio', present: false })];
    state.npcs.push(...extra);
    globalThis.__npcMock.context.chat = [{ is_user: true, mes: 'I ask Mira to fetch Oren and Tam from the forge.' }];
    try {
        const { rt, injection } = rig({ hosted: true });
        rt.narrationCaptureArmed = 'chat';
        injection.updateInjection();
        const context = sent.get(KEYS.CAPTURE_PROMPT_KEY);
        assert.ok(context.endsWith('\nPeople in this scene: Mira, Oren. For each person in this reply (anyone who arrives too) who did or saw something that mattered, write their memory:, and status: and goal: if they changed (someone who arrives is always doing something new). If what happened changed how they feel about Astra, write that meter line too.'), context);
    } finally {
        state.npcs.splice(1);
        globalThis.__npcMock.context.chat = [];
    }
});

test('hosted: the rules\' {{user}} is shown as the reader\'s name, as SillyTavern sends it', t => {
    const settings = getSettings();
    Object.assign(settings, { enabled: true, inject: true, narrationCapture: true, fullScanEveryTurn: false });
    const named = text => String(text).replace(/\{\{user\}\}/gi, 'Ari');
    globalThis.__npcMock.context.substituteParams = named;
    t.after(() => { delete globalThis.__npcMock.context.substituteParams; });
    const { rt, injection, preview } = rig({ hosted: true });
    rt.narrationCaptureArmed = 'chat';
    injection.updateInjection();
    const shown = preview().parts.find(part => part.label === 'One-pass rules (system prompt)').text;
    assert.equal(shown, named(sent.get(KEYS.CAPTURE_RULES_KEY)));
    assert.match(shown, /How they see Ari: when this reply changes what a person thinks of Ari /);
    assert.doesNotMatch(shown, /\{\{user\}\}/);
});
