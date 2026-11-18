// Packs for the tests: the riverside-starter fixture and small hand-made ones. `sample` / `sampleText` are the frozen format 3 copy (tests/fixtures/packs/riverside-starter-3.json), read by the
// format 3 tests until X1; its format 4 conversion is tests/packs/fixtures/riverside-starter.json and .game.json (read by riverside-format4.test.js).
import { readFileSync } from 'node:fs';

const here = new URL('../../fixtures/packs/riverside-starter-3.json', import.meta.url);
export const sampleText = readFileSync(here, 'utf8');
export const sample = () => JSON.parse(sampleText);

/** A minimal valid format 4 world pack; `extra` is merged over it. */
export function pack(extra = {}) {
    return { id: 'mini', format: 4, kind: 'world', version: '1.0.0', requires: { suite: '^0.1' }, content: {}, ...extra };
}

/** A pack with items, for resolution tests. */
export function itemsPack(id, items, extra = {}) {
    return pack({ id, content: { items }, ...extra });
}
