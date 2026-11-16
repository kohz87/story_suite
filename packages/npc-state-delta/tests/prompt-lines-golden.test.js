import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

test('the lines builder is unwired: no runtime, core, src or *-parts file imports it', () => {
    const root = fileURLToPath(new URL('..', import.meta.url));
    const own = new Set(['core-prompts-lines.js', 'core-prompts-lines-parts/context.js', 'core-prompts-lines-parts/rules.js']);
    const importers = fs.readdirSync(root, { recursive: true })
        .map(name => String(name).split(path.sep).join('/'))
        .filter(name => name.endsWith('.js') && !name.startsWith('node_modules/') && !name.startsWith('tests/') && !own.has(name))
        .filter(name => /^(?:[^/]+|src\/.*|[a-z0-9-]+-parts\/.*)$/.test(name))
        .filter(name => fs.readFileSync(path.join(root, name), 'utf8').includes('core-prompts-lines'));
    assert.deepEqual(importers, []);
});
