// NPC State's stored map and dossier-look settings: their normalizers, kept in settings/ when the old dossier panel (its Map view and
// its three looks) was removed at B4-5. The stored keys and defaults read exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRelationshipMapSettings } from '../../modules/people/settings/runtime-settings-parts/map-settings.js';
import { DOSSIER_SKIN_DEFAULT, normalizeDossierSkin } from '../../modules/people/settings/runtime-settings-parts/dossier-look.js';

test('map settings normalize on read and fall back to defaults', () => {
    assert.deepEqual(normalizeRelationshipMapSettings(undefined), { enabled: true, defaultLens: 'warmth' });
    assert.deepEqual(normalizeRelationshipMapSettings({ enabled: false, defaultLens: 'tension' }), { enabled: false, defaultLens: 'tension' });
    for (const lens of ['warmth', 'trust', 'affection', 'desire', 'tension']) assert.equal(normalizeRelationshipMapSettings({ defaultLens: lens }).defaultLens, lens);
    assert.deepEqual(normalizeRelationshipMapSettings({ enabled: 'no', defaultLens: 'love', showPast: true, bondLines: 'all' }), { enabled: true, defaultLens: 'warmth' }, 'unknown and retired keys are dropped');
});

test('the dossier look reads as one of the three stored values, Neutral otherwise', () => {
    assert.equal(DOSSIER_SKIN_DEFAULT, 'neutral');
    assert.equal(normalizeDossierSkin(' Fantasy '), 'fantasy');
    assert.equal(normalizeDossierSkin('MODERN'), 'modern');
    for (const other of [undefined, null, '', 'gothic', 3]) assert.equal(normalizeDossierSkin(other), 'neutral');
});
