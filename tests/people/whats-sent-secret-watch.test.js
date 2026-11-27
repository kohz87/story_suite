// "What's sent" (both views) hides the STORY EVENTS watch for an opened pack secret, which quotes the secret's text: it reads like the tail's
// hidden-note lines. What is sent to the model is unchanged, and so is the rest of the watch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { host, fakeDelta } from './storysuite-v2-meters.helpers.js';
import { buildLinesContext } from '../../modules/people/core/core-prompts-lines-parts/context.js';
import { appendHiddenNotePrompt } from '../../modules/people/core/core-prompts-capture-parts/hidden-notes.js';
import { redactSentOf, sentText } from '../../core/sent/sent.js';

globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { createNpcApiPart } = await import('../../modules/people/runtime/runtime-npc-api.js');
const { getSettings } = await import('../../modules/people/settings/runtime-settings.js');

// quotes, bars and full stops of its own
const TEXT = 'The Emperor died last winter. What sits | in the "furs" is a patchwork double.';
const EVENT = 'the duke is exposed';

async function watched() {
    const delta = fakeDelta();
    delta.records.npc_mira.secrets = [{ packId: 'forgery', gate: 'fact:vault-opened', text: TEXT, from: 'pack' }, { text: 'An old note.', when: EVENT }];
    const h = await host({ delta, features: { 'story-director.world-events': true }, answers: { 'chronicle.world.anchors': ['fact:vault-opened'] } });
    h.reply('Nice.', '~ npc Mira | trust: +1');
    const watch = h.adapter.eventWatch([{ ...delta.records.npc_mira, present: true }]);
    assert.equal(watch.length, 2, JSON.stringify(watch));
    // the open secret first, so the redaction has an item after it to keep
    const eventWatch = [...watch].reverse();
    return { h, eventWatch, context: buildLinesContext({ eventWatch, existingNpcs: [delta.records.npc_mira], present: ['Mira'] }) };
}
const safe = text => {
    assert.ok(!/Emperor died|furs|patchwork|the secret "/.test(text), text);
    assert.match(text, /STORY EVENTS to look for \(present NPCs' hidden notes\): \S+ = Mira: 1 hidden note \| /);
    assert.ok(text.includes(`= Mira: ${EVENT}. An event counts only`), text);
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
    assert.match(text, / = Mira: 1 hidden note\. Return top-level "secretEvents"/);
});
