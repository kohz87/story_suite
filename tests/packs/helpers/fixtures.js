// Packs for the tests: the riverside-starter fixture and small hand-made ones. `sample` / `sampleText` are the frozen format 3 copy (tests/fixtures/packs/riverside-starter-3.json), read by the
// format 3 tests until X1; `sampleWorldText` and `sampleGameText` are its format 4 conversion (job C2: the world and the game pack).
import { readFileSync } from 'node:fs';

const here = new URL('../../fixtures/packs/riverside-starter-3.json', import.meta.url);
export const sampleText = readFileSync(here, 'utf8');
export const sampleWorldText = readFileSync(new URL('../fixtures/riverside-starter.json', import.meta.url), 'utf8');
export const sampleGameText = readFileSync(new URL('../fixtures/riverside-starter.game.json', import.meta.url), 'utf8');
export const sample = () => JSON.parse(sampleText);

/** A minimal valid pack; `extra` is merged over it. */
export function pack(extra = {}) {
    return { id: 'mini', version: '1.0.0', requires: { storyBlock: '^2' }, content: {}, ...extra };
}

/** A pack with items, for resolution tests. */
export function itemsPack(id, items, extra = {}) {
    return pack({ id, content: { items }, ...extra });
}
