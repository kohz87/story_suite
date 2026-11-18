// Packs for the tests: the riverside-starter fixture and small hand-made ones. `sample` / `sampleText` are the frozen format 3 copy (tests/fixtures/packs/riverside-starter-3.json), read by the
// format 3 tests until X1; its format 4 conversion is tests/packs/fixtures/riverside-starter.json and .game.json (read by riverside-format4.test.js).
import { readFileSync } from 'node:fs';

const here = new URL('../../fixtures/packs/riverside-starter-3.json', import.meta.url);
export const sampleText = readFileSync(here, 'utf8');
export const sample = () => JSON.parse(sampleText);

/** A minimal valid pack; `extra` is merged over it. */
export function pack(extra = {}) {
    return { id: 'mini', version: '1.0.0', requires: { storyBlock: '^2' }, content: {}, ...extra };
}

/** A pack with items, for resolution tests. */
export function itemsPack(id, items, extra = {}) {
    return pack({ id, content: { items }, ...extra });
}
