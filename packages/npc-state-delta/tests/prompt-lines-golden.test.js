import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildLinesParts } from '../core-prompts-lines.js';

// N0: the unwired one-pass lines builder is pinned at three settings variants (default; layered secrets on; notes and stages off) and a separate
// meters-paragraph entry, all empty until the builder is filled in. Each later item changes this golden on purpose, in its own reviewed diff.
const GOLDEN = new URL('./fixtures/prompt-lines.golden.json', import.meta.url);
const VARIANTS = {
    default: {},
    layered_secrets: { layeredSecrets: true },
    notes_and_stages_off: { notes: false, stages: false },
};

const built = { ...Object.fromEntries(Object.entries(VARIANTS).map(([name, options]) => [name, buildLinesParts(options)])), metersParagraph: '' };

test('the lines builder output matches its golden at every settings variant', () => {
    if (process.env.WRITE_GOLDEN === '1') fs.writeFileSync(GOLDEN, `${JSON.stringify(built, null, 2)}\n`);
    assert.deepEqual(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')), built);
});

test('the lines builder is unwired: no runtime or core file imports it', () => {
    const importers = fs.readdirSync(new URL('..', import.meta.url)).filter(file => file.endsWith('.js') && file !== 'core-prompts-lines.js'
        && fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').includes('core-prompts-lines'));
    assert.deepEqual(importers, []);
});
