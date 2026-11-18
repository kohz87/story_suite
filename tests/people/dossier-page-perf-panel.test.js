import test from 'node:test';
import assert from 'node:assert/strict';

import { runHostScenario } from './helpers/host-scenario.js';

// The dossier page at a long chat's scale: portraits reach the panel by reference (never escaped into its markup or copied by the
// runtime's read), and a focus or a settings-panel mutation draws again only when something the panel shows changed.

const picture = tag => `data:image/jpeg;base64,${Buffer.from(`${tag}:${'x'.repeat(3000)}`).toString('base64')}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 320));   // past the refresh debounce
const flush = () => new Promise(resolve => setImmediate(resolve));

// Images in markup the stub DOM was given, as the browser would hold them: keyed ones with no src until the controller sets it.
function imagesIn(html) {
    return [...String(html).matchAll(/<img class="([^"]+)" (?:data-delta-portrait="(\d+)"|src="([^"]*)")/g)].map(([, className, key, src]) => {
        const img = { className, dataset: key ? { deltaPortrait: key } : {}, src: src ?? null };
        img.hasAttribute = name => name === 'src' && img.src !== null;
        return img;
    });
}
function stubNode(extra = {}) {
    const node = { html: '', images: [], scrollLeft: 0, scrollTop: 0, dataset: {}, children: [], lastElementChild: null, ...extra };
    Object.defineProperty(node, 'innerHTML', { get: () => node.html, set: value => { node.html = String(value); node.images = imagesIn(value); } });
    node.querySelectorAll = selector => (selector === 'img[data-delta-portrait]' ? node.images.filter(img => img.dataset.deltaPortrait) : []);
    node.querySelector = () => null;
    return node;
}

test('runtime: getDossierState copies no portrait picture; dossierViewToken holds still until something the panel shows changes; dossierViewStatus is the load state only', () => {
    const output = runHostScenario('dossier-page-perf', async () => {}, async () => {
        const api = globalThis.NPCStateDelta;
        await sleep(300);
        const mechanics = await import(pathToFileURL(path.join(extRoot, 'core-mechanics.js')).href);
        const png = `data:image/png;base64,${Buffer.from('p'.repeat(60000)).toString('base64')}`;
        const state = api.getState();
        const mira = mechanics.createNpcRecord('Mira', []);
        mira.portrait = { dataUrl: png, mime: 'image/png', updatedAt: 1, appearanceFingerprint: 'a2:x' };
        const oren = mechanics.createNpcRecord('Oren', [mira.id]);
        state.npcs = [mira, oren];
        await api.installState(state);
        await api.flush();
        await sleep(200);
        const out = {};
        // Every structuredClone the read makes, by whether a picture went through it.
        const plainClone = globalThis.structuredClone;
        let picturesCloned = 0;
        globalThis.structuredClone = (value, options) => { if (JSON.stringify(value ?? null).includes('data:image')) picturesCloned += 1; return plainClone(value, options); };
        let view;
        try { view = api.getDossierState(); } finally { globalThis.structuredClone = plainClone; }
        out.picturesCloned = picturesCloned;
        const shown = view.npcs.find(npc => npc.name === 'Mira');
        out.pictureShown = shown.portrait.dataUrl === png;
        out.recordKept = { mime: shown.portrait.mime, fingerprint: shown.portrait.appearanceFingerprint };
        shown.portrait.mime = 'changed';
        shown.portrait.dataUrl = 'changed';
        shown.name = 'changed';
        const live = api.getState().npcs.find(npc => npc.id === mira.id);
        out.liveUntouched = live.portrait.mime === 'image/png' && live.portrait.dataUrl === png && live.name === 'Mira';

        out.status = api.dossierViewStatus();
        const first = api.dossierViewToken();
        out.tokenStable = api.dossierViewToken() === first && (api.getDossierState(), api.uiStatus(), api.dossierViewToken()) === first;
        globalThis.__npcMock.extensionSettings.storySuite.modules['npc-state-delta'].customFieldNames = ['Level'];
        const afterSettings = api.dossierViewToken();
        out.tokenMovesOnSettings = afterSettings !== first;
        const next = api.getState();
        next.npcs.find(npc => npc.name === 'Oren').mood = 'Wary';
        await api.installState(next);
        await sleep(50);
        out.tokenMovesOnWrite = api.dossierViewToken() !== afterSettings;
        console.log('RESULT ' + JSON.stringify(out));
    });
    const out = JSON.parse(String(output).split('\n').find(line => line.startsWith('RESULT ')).slice(7));
    assert.equal(out.picturesCloned, 0, 'no picture goes through structuredClone');
    assert.equal(out.pictureShown, true);
    assert.deepEqual(out.recordKept, { mime: 'image/png', fingerprint: 'a2:x' });
    assert.equal(out.liveUntouched, true, 'the view is still a copy: changing it changes nothing stored');
    assert.deepEqual(Object.keys(out.status).sort(), ['chatKey', 'hydrationError', 'hydrationStatus']);
    assert.equal(out.status.hydrationStatus, 'ready');
    assert.equal(out.tokenStable, true, 'reads do not move the token');
    assert.equal(out.tokenMovesOnSettings, true, 'the configured fields are part of it');
    assert.equal(out.tokenMovesOnWrite, true, 'a state write moves it');
});
