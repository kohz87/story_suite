// The one-pass rules are not spliced into NPC State's own background requests: the guard matches the prompts' real words
// (Backfill, Refresh, Import, the relationship evaluator and the scanner), which still say "NPC State Delta's ...".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.__npcMock ??= { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
globalThis.__npcMock.context = { chat: [], setExtensionPrompt() {}, name1: 'Ari', name2: 'Narrator' };
const { createInjectionPart } = await import('../../modules/people/runtime/runtime-injection.js');
const { buildBackfillPrompt } = await import('../../modules/people/core/core-prompts-targeted-parts/backfill.js');
const { buildScannerPrompt } = await import('../../modules/people/core/core-prompts-scanner.js');

const literal = (file, word) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').match(new RegExp(`"(You are [^"]*${word}[^"]*)"`))?.[1];
const RULES = 'ONE-PASS RULES';

function guard() {
    const rt = { lastInjection: {}, sentCaptureRules: RULES };
    const part = createInjectionPart(rt, { PROMPT_KEY: 'a', CAPTURE_PROMPT_KEY: 'b', CAPTURE_RULES_KEY: 'c', CAPTURE_PROMPT_DEPTH: 0, LEGACY_PROMPT_KEYS: [] });
    return part.keepCaptureRules;
}
const run = content => {
    const chat = [{ role: 'system', content }, { role: 'user', content: 'hello' }];
    guard()({ chat });
    return chat;
};

test('NPC State\'s own requests get no one-pass rules spliced in', () => {
    const prompts = {
        backfill: buildBackfillPrompt({ transcript: 'Mira waves.', targetName: 'Mira' }),
        refresh: literal('modules/people/calls/runtime-targeted-refresh.js', 'reconciliation scanner'),
        import: literal('modules/people/calls/runtime-targeted.js', 'dossier importer'),
        evaluator: literal('modules/people/relationship/relationship-pass-parts/run.js', 'relationship evaluator') ?? 'x isolated relationship evaluator',
        scanner: buildScannerPrompt({ transcript: 'Mira waves.' }),
    };
    for (const [name, content] of Object.entries(prompts)) {
        assert.ok(content, `${name} prompt found`);
        assert.equal(run(content).length, 2, `${name}: nothing spliced in`);
    }
});

test('an ordinary chat request still gets the rules', () => {
    const chat = run('You are the narrator.');
    assert.equal(chat.length, 3);
    assert.ok(chat.some(message => message.content === RULES));
});
