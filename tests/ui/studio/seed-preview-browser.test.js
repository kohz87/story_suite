import test from 'node:test';
import assert from 'node:assert/strict';
import { serve } from './serve.js';

// The Studio's seed preview in a real browser page (it was in tests/packs/studio/seed-preview.test.js; the ui job has the browser).
const ENTRY = {
    kind: 'companion', id: 'fenna', name: 'Fenna', role: 'Runs the night ferry.', species: 'Elf', look: 'Tall and weathered.', homeBase: 'Bluewatch docks', status: 'Grieving',
    level: 7, abilities: [{ name: 'Weirsight', description: 'Reads water.' }], keepsakes: [{ name: 'Oar', description: 'Her father\'s.' }],
    ties: [{ with: 'orrin', tag: 'kin' }], keyRelationships: [{ id: 'orrin', text: 'her late husband\'s brother' }],
    meters: { preset: 'companion', trust: 10 }, secrets: [{ title: 'The weir', text: 'She saw who opened it.' }],
    start: { place: 'docks', goal: 'Find who opened the weir' },
};

test('the preview module loads in a real browser page with no settings', async t => {
    let browser = null;
    let server = null;
    try {
        const { chromium } = await import('playwright');
        browser = await chromium.launch();
        ({ server } = await serve());
    } catch (err) {
        if (process.env.CI === 'true') throw err;
        t.skip(`Playwright browser unavailable: ${String(err.message).split('\n')[0]}`);
        return;
    }
    try {
        const port = server.address().port;
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        await page.goto(`http://127.0.0.1:${port}/studio/index.html`);
        const result = await page.evaluate(async entry => {
            const { previewSeed } = await import('/studio/model/seed-preview.js');
            const preview = previewSeed(entry, { cast: [] });
            return { ok: preview.ok, level: preview.fields.find(f => f.field === 'level')?.value };
        }, ENTRY);
        assert.deepEqual(result, { ok: true, level: 7 });
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
        await new Promise(done => server.close(done));
    }
});
