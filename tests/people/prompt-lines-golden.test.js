import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildLinesParts } from '../../modules/people/core/core-prompts-lines.js';
import { linesMeterText } from '../../modules/people/meters/npc-meters-prompt-parts/lines-text.js';

// The one-pass lines builder (sent since N7) is pinned at its settings variants (default; layered secrets on; notes and stages off; the held NSD3 mood text on) and a
// separate meters-paragraph entry per feature combination (NSD2 + the G2 clauses). Each item changes this golden on purpose, in its own reviewed diff.
// N7: NSD1 (rules header), NSD14 (context). N6: NSD13 (rules).
// N5: NSD8 (rules) and NSD12 (the context's event paragraph, joined as G8 says).
// N3: NSD4, NSD5, NSD9 (rules), NSD3 (rules, off by default) and NSD2 (linesMeterText, never in the rules).
const GOLDEN = new URL('./fixtures/prompt-lines.golden.json', import.meta.url);
const VARIANTS = {
    default: {},
    layered_secrets: { layeredSecrets: true },
    notes_and_stages_off: { notes: false, stages: false },
    mood_word_on: { moodWord: true },
    level_on: { levelOn: true },
    people_list: { existingNpcs: [{ id: 'mira', name: 'Mira Tolk', aliases: ['Mira'], present: true }, { id: 'old', name: 'Old Tam', aliases: [], archived: true }, { id: 'gone', name: 'Gone', aliases: [], lastSeenTurn: 1 }, { id: 'dead', name: 'Dead', aliases: [], lifeState: 'deceased', lifeStateCertainty: 'confirmed' }], turn: 100, dormantAfter: 30, namedNpcIds: ['dead'] },
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

test('the lines builder is what the runtime sends: runtime-injection imports it and the meters static text is the paragraph', () => {
    const injection = fs.readFileSync(fileURLToPath(new URL('../../modules/people/runtime/runtime-injection.js', import.meta.url)), 'utf8');
    assert.ok(injection.includes("core-prompts-lines.js") && /storySuiteV2Meters\(\)\s*\n?\s*\/\/ Hosted[^\n]*\n\s*\? buildLinesParts/.test(injection), 'hosted one-pass sends the lines builder (the JSON prompt only without a host)');
    const prompt = fs.readFileSync(fileURLToPath(new URL('../../modules/people/meters/npc-meters-prompt.js', import.meta.url)), 'utf8');
    assert.ok(prompt.includes('linesMeterText'), 'staticText returns the NSD2 paragraph');
    assert.ok(built.default.rules.startsWith('NPC CHANGES. Write your complete in-character reply first'), 'the approved NSD1 header opens the rules');
});

test('caps on, custom meters and the per-day limit add no text to the paragraph; the golden shows only via and Meter rules differ', () => {
    assert.equal(built.metersParagraph.caps_on, built.metersParagraph.default);
    assert.ok(built.metersParagraph.default.includes(' Add | via: '));
    assert.ok(!built.metersParagraph.anti_lever_off.includes('via:'));
    assert.ok(built.metersParagraph.presets_with_meter_rules.endsWith('Meter rules: warmth how friendly they are to you; fear how afraid they are of you.'));
    assert.ok(!/major a day|moves it at most|-100\.\.100/.test(built.metersParagraph.default));
});
