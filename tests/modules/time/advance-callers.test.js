// The chronicle's day walk steps the clock by its receipts and treats a settle as a checkpoint only (days-parts/clock-step.js), so
// every clock write must leave a clock receipt. A `director.advance` called through another command's ctx.call has none: this pins
// that only the time part itself names the command (the grep covers all three packages' source).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const packages = join(repo, 'packages');
const walk = dir => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.js') ? [path] : [];
});

test('no module calls director.advance through ctx.call or commits it: only the time part and the receipt readers name it', () => {
    const named = [];
    const scan = dir => { for (const file of walk(dir)) if (/director\.advance|\bADVANCE\b/.test(readFileSync(file, 'utf8'))) named.push(relative(repo, file)); };
    for (const pack of readdirSync(packages)) {
        const src = join(packages, pack, 'src');
        try { if (!statSync(src).isDirectory()) continue; } catch { continue; }
        scan(src);
    }
    for (const root of ['core', 'modules', 'ui']) scan(join(repo, root));
    const readers = ['core/timeline/boundary-parts/marker.js', 'modules/world/chronicle/days-parts/clock-step.js', 'modules/world/chronicle/days-parts/receipt-classify.js', 'modules/world/chronicle/days.js', 'modules/time/tracker/clock-set.js'];
    const isOwn = file => file.startsWith('modules/time/') && !file.startsWith('modules/time/tracker/');
    assert.ok(named.filter(isOwn).length > 0, 'the time part defines it');
    assert.deepEqual(named.filter(file => !isOwn(file)).sort(), readers.sort());
});
