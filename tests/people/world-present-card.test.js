// World → Here's present card (storysuite-v2.js): no meters on the card (they stay on the Dossiers screen),
// and the side copy of the now lines goes. Checked on the source, as the other layout tests here are.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/adapter/cast-ui/cast-render.js'), 'utf8');

test('World → Here draws the present card without meters, and no side copy under it', () => {
    assert.match(source, /const world = track === false;/);
    assert.match(source, /if \(text && !world\) \{[\s\S]*ppl-present-card-bars/);
    assert.match(source, /const apart = world \? \[\] : meters\.shown\.filter/);
    assert.match(source, /node\.classList\?\.contains\?\.\('ppl-present-side'\)\) node\.remove/);
});
