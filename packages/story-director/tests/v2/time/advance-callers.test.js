// The chronicle's day walk steps the clock by its receipts and treats a settle as a checkpoint only (days-parts/clock-step.js), so
// every clock write must leave a clock receipt. A `director.advance` called through another command's ctx.call has none: this pins
// that only the time part itself names the command (the grep covers all three packages' source).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packages = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const walk = dir => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.js') ? [path] : [];
});

test('no module calls director.advance through ctx.call or commits it: only the time part and the receipt readers name it', () => {
    const named = [];
    for (const pack of readdirSync(packages)) {
        const src = join(packages, pack, 'src');
        try { if (!statSync(src).isDirectory()) continue; } catch { continue; }
        for (const file of walk(src)) if (/director\.advance|\bADVANCE\b/.test(readFileSync(file, 'utf8'))) named.push(relative(packages, file));
    }
    const readers = ['story-block/src/v2/timeline/boundary-parts/marker.js', 'story-director/src/v2/chronicle/days-parts/clock-step.js', 'story-director/src/v2/chronicle/days-parts/receipt-classify.js', 'story-director/src/v2/chronicle/days.js', 'story-director/src/v2/tracker/clock-set.js'];
    const own = named.filter(file => file.startsWith('story-director/src/v2/time/'));
    assert.ok(own.length > 0, 'the time part defines it');
    assert.deepEqual(named.filter(file => !file.startsWith('story-director/src/v2/time/')).sort(), readers.sort());
});
