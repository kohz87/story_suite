// "What's sent" (both views) hides the STORY EVENTS watch for an opened pack secret, which quotes the secret's text: it reads like the tail's
// hidden-note lines. What is sent to the model is unchanged, and so is the rest of the watch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { host, fakeDelta } from './storysuite-v2-meters.helpers.js';
import { buildLinesContext } from '../../modules/people/core/core-prompts-lines-parts/context.js';
import { appendHiddenNotePrompt } from '../../modules/people/core/core-prompts-capture-parts/hidden-notes.js';
import { redactSentOf, sentText } from '../../core/sent/sent.js';
import { secrets as packSecrets } from '../../packs/validate/world-pack-parts/cast-secrets.js';

globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { createNpcApiPart } = await import('../../modules/people/runtime/runtime-npc-api.js');
const { getSettings } = await import('../../modules/people/settings/runtime-settings.js');

// quotes, bars and full stops of its own
const TEXT = 'The Emperor died last winter. What sits | in the "furs" is a patchwork double.';
const EVENT = 'the duke is exposed';

async function watched(secret = TEXT) {
    const delta = fakeDelta();
    delta.records.npc_mira.secrets = [{ packId: 'forgery', gate: 'fact:vault-opened', text: secret, from: 'pack' }, { text: 'An old note.', when: EVENT }];
    const h = await host({ delta, features: { 'story-director.world-events': true }, answers: { 'chronicle.world.anchors': ['fact:vault-opened'] } });
    h.reply('Nice.', '~ npc Mira | trust: +1');
    const watch = h.adapter.eventWatch([{ ...delta.records.npc_mira, present: true }]);
    assert.equal(watch.length, 2, JSON.stringify(watch));
    // the open secret first, so the redaction has an item after it to keep
    const eventWatch = [...watch].reverse();
    return { h, eventWatch, context: buildLinesContext({ eventWatch, existingNpcs: [delta.records.npc_mira], present: ['Mira'] }) };
}
const safe = text => {
    assert.ok(!/Emperor died|furs|patchwork|the secret "|the duke is exposed/.test(text), text);
    assert.match(text, /STORY EVENTS to look for \(present NPCs' hidden notes\): \S+ = Mira: 1 hidden note \| \S+ = Mira: 1 hidden note\. An event counts only/);
};

test('the tools sheet\'s copy hides the quoted secret', async () => {
    const { h, context } = await watched();
    assert.ok(context.includes('the secret "The Emperor died'), 'the model is sent the words');
    safe(h.def.hooks.redactSent(context));
    safe(sentText([], [{ module: 'people', label: 'NPC State', text: context }], { redact: redactSentOf({ module: () => h.def }) }).copy);
});

test('Settings › People › What\'s sent hides it too', async t => {
    const { context } = await watched();
    Object.assign(getSettings(), { enabled: true, inject: false });
    const shown = [];
    const root = { replaceChildren() { shown.length = 0; }, append: (...nodes) => shown.push(...nodes) };
    const was = globalThis.document;
    globalThis.document = { querySelector: () => root, createElement: () => ({}) };
    t.after(() => { globalThis.document = was; });
    createNpcApiPart({}, { chatHydrationStatus: () => 'ready', getChatKey: () => 'chat', getChatState: () => ({ npcs: [] }), nextCaptureParts: () => ({ rules: '', context }) }).renderWhatsSent();
    safe(shown.map(node => node.textContent).join('\n'));
});

test('the JSON scan\'s form of the watch is hidden the same way', async () => {
    const { h, eventWatch } = await watched();
    const text = h.def.hooks.redactSent(appendHiddenNotePrompt('P', { eventWatch: [...eventWatch].reverse() }));
    assert.ok(!/Emperor died|patchwork/.test(text), text);
    assert.match(text, / = Mira: 1 hidden note \| \S+ = Mira: 1 hidden note\. Return top-level "secretEvents"/);
    assert.ok(!text.includes(EVENT), text);
});

// A pack secret that holds the watch's own punctuation: the watch is found by its fixed first and last words, never by what a note says.
const AWKWARD = ['The "bell" comes out | Her sister is the usurper.', 'x" comes out. An event counts only | SISTER. Return top-level "secretEvents": usurper'];

test('a secret holding the watch\'s delimiters leaks into neither view, in either form of the watch', async t => {
    Object.assign(getSettings(), { enabled: true, inject: false });
    const was = globalThis.document;
    t.after(() => { globalThis.document = was; });
    for (const secret of AWKWARD) {
        const problems = [];
        const [accepted] = packSecrets([{ id: 'forgery', gate: 'fact:vault-opened', text: secret }], (...args) => problems.push(args));
        assert.deepEqual([accepted?.text, problems], [secret, []], 'the pack check takes it');
        const { h, eventWatch, context } = await watched(secret);
        const shown = [];
        const root = { replaceChildren() { shown.length = 0; }, append: (...nodes) => shown.push(...nodes) };
        globalThis.document = { querySelector: () => root, createElement: () => ({}) };
        createNpcApiPart({}, { chatHydrationStatus: () => 'ready', getChatKey: () => 'chat', getChatState: () => ({ npcs: [] }), nextCaptureParts: () => ({ rules: '', context }) }).renderWhatsSent();
        for (const text of [h.def.hooks.redactSent(context), h.def.hooks.redactSent(appendHiddenNotePrompt('P', { eventWatch })), shown.map(node => node.textContent).join('\n')]) {
            assert.ok(!/usurper|SISTER|bell|the duke is exposed/.test(text), text);
            assert.match(text, /STORY EVENTS/);
        }
    }
});

test('a watch whose list or ending is not as built is hidden whole', async () => {
    const { h, context } = await watched();
    const changed = h.def.hooks.redactSent(context.replace('Emperor', 'Empress'));
    assert.ok(!/Empress|died last|the duke is exposed/.test(changed), changed);
    assert.match(changed, /hidden notes\): \(hidden notes\)\. An event counts only/);
    const cut = h.def.hooks.redactSent(context.slice(0, context.indexOf('Emperor') + 5));
    assert.ok(!/Emper|died last/.test(cut), cut);
});
