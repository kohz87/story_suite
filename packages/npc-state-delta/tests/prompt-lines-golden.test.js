import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLinesParts } from '../core-prompts-lines.js';
import { linesMeterText } from '../src/npc-meters-prompt-parts/lines-text.js';

// The unwired one-pass lines builder is pinned at its settings variants (default; layered secrets on; notes and stages off; the held NSD3 mood text on) and a
// separate meters-paragraph entry per feature combination (NSD2 + the G2 clauses). Each item changes this golden on purpose, in its own reviewed diff.
// N6: NSD13 (rules).
// N5: NSD8 (rules) and NSD12 (the context's event paragraph, joined as G8 says).
// N3: NSD4, NSD5, NSD9 (rules), NSD3 (rules, off by default) and NSD2 (linesMeterText, never in the rules).
const GOLDEN = new URL('./fixtures/prompt-lines.golden.json', import.meta.url);
const VARIANTS = {
    default: {},
    layered_secrets: { layeredSecrets: true },
    notes_and_stages_off: { notes: false, stages: false },
    mood_word_on: { moodWord: true },
    event_watch: { eventWatch: [{ key: 'sec_0aaa1111', name: 'Mira', event: 'The duke is exposed as a traitor' }, { key: 'sec_0bbb2222', name: 'Oren', event: 'the seal is shown' }] },
};
// G2: default (anti-lever on, so `via:`), anti-lever off, caps on (the same text as default: code enforces the caps), presets with Meter rules.
const PARAGRAPHS = {
    default: {},
    anti_lever_off: { via: false },
    caps_on: {},
    presets_with_meter_rules: { rules: ['warmth how friendly they are to you', 'fear how afraid they are of you'] },
};

const built = { ...Object.fromEntries(Object.entries(VARIANTS).map(([name, options]) => [name, buildLinesParts(options)])), metersParagraph: Object.fromEntries(Object.entries(PARAGRAPHS).map(([name, options]) => [name, linesMeterText(options)])) };

test('the lines builder output matches its golden at every settings variant', () => {
    if (process.env.WRITE_GOLDEN === '1') fs.writeFileSync(GOLDEN, `${JSON.stringify(built, null, 2)}\n`);
    assert.deepEqual(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')), built);
});

test('the lines builder is unwired: no runtime, core, src or *-parts file imports it', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const own = new Set(['core-prompts-lines.js', 'core-prompts-lines-parts/context.js', 'core-prompts-lines-parts/rules.js', 'src/npc-meters-prompt-parts/lines-text.js']);
    const importers = fs.readdirSync(root, { recursive: true })
        .map(name => String(name).split(path.sep).join('/'))
        .filter(name => name.endsWith('.js') && !name.startsWith('node_modules/') && !name.startsWith('tests/') && !own.has(name))
        .filter(name => /^(?:[^/]+|src\/.*|[a-z0-9-]+-parts\/.*)$/.test(name))
        .filter(name => fs.readFileSync(path.join(root, name), 'utf8').includes('core-prompts-lines'));
    assert.deepEqual(importers, []);
    const text = fs.readdirSync(root, { recursive: true }).map(name => String(name).split(path.sep).join('/'))
        .filter(name => name.endsWith('.js') && !name.startsWith('node_modules/') && !name.startsWith('tests/') && !own.has(name))
        .filter(name => fs.readFileSync(path.join(root, name), 'utf8').includes('lines-text'));
    assert.deepEqual(text, [], 'nothing imports linesMeterText until N7');
});

test('caps on, custom meters and the per-day limit add no text to the paragraph; the golden shows only via and Meter rules differ', () => {
    assert.equal(built.metersParagraph.caps_on, built.metersParagraph.default);
    assert.ok(built.metersParagraph.default.includes(' Add | via: '));
    assert.ok(!built.metersParagraph.anti_lever_off.includes('via:'));
    assert.ok(built.metersParagraph.presets_with_meter_rules.endsWith('Meter rules: warmth how friendly they are to you; fear how afraid they are of you.'));
    assert.ok(!/major a day|moves it at most|-100\.\.100/.test(built.metersParagraph.default));
});
