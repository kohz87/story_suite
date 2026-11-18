// A pack the Studio exports goes into a whole host built by the testkit (testkit/host.js, the way core/boot wires it) and the host's
// install says what the Studio's check said: Ersveil installs with its cast, the world-pack fixture is refused with the same problems.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../../testkit/index.js';
import { readPackZip } from '../../../packs/bundle.js';
import { checkText } from '../../../studio/check.js';
import { exportZip } from '../../../studio/export.js';
import { openPicked } from '../../../studio/load.js';

const at = rel => new URL(`../../../${rel}`, import.meta.url);
const fileOf = (rel, type) => new File([readFileSync(at(rel))], rel.split('/').pop(), { type });

async function exportedAndInstalled(file) {
    const opened = await openPicked([file]);
    assert.equal(opened.ok, true);
    const back = await readPackZip(exportZip(opened).bytes);
    assert.equal(back.ok, true, back.message);
    const host = await createHost();
    try {
        const result = await host.packs.packs.install(back.text, { source: 'file', origin: 'studio-export.zip', files: back.files });
        return { opened, result, list: host.packs.packs.list() };
    } finally {
        await host.close?.();
    }
}

test('Ersveil, opened and exported by the Studio, installs in a testkit host with its twelve people', async () => {
    const { opened, result, list } = await exportedAndInstalled(fileOf('tests/fixtures/packs/ersveil-3/ersveil.zip', 'application/zip'));
    assert.equal(checkText(opened.text).ok, true);
    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.action, 'installed');
    assert.deepEqual(list.map(pack => [pack.id, pack.counts.cast]), [['ersveil', 12]]);
});

test('the world-pack fixture is refused by the testkit host with exactly the problems the Studio shows', async () => {
    const { opened, result, list } = await exportedAndInstalled(fileOf('tests/packs/studio/fixtures/world-mini.json', 'application/json'));
    const studio = checkText(opened.text);
    assert.equal(studio.ok, false);
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(e => [e.code, e.path]), studio.errors.map(e => [e.code, e.path]));
    assert.deepEqual(list, []);
});
