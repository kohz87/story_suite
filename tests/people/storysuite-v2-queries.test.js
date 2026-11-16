import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DOSSIER_FIELDS,
    dossierFields,
    portraitUrl,
    safeImageUrl,
} from '../../modules/people/storysuite-v2.js';
import { PNG, WEBP, hosted, portraitDelta } from './storysuite-v2.helpers.js';

// ---- queries ----

test('npc.present and npc.known return names from Delta\'s own data, as fresh copies', async () => {
    const { def, delta } = await hosted();
    const present = def.queries['npc.present']({}, {});
    const known = def.queries['npc.known']({}, {});
    assert.deepEqual(present, ['Mira']);
    assert.deepEqual(known, ['Mira', 'Oren'], 'archived NPCs are not listed');
    present.push('Intruder');
    known.length = 0;
    assert.deepEqual(def.queries['npc.present']({}, {}), ['Mira']);
    assert.deepEqual(def.queries['npc.known']({}, {}), ['Mira', 'Oren']);
    assert.notEqual(def.queries['npc.present'](), def.queries['npc.present']());
    delta.npcs[1].present = true;
    assert.deepEqual(def.queries['npc.present'](), ['Mira', 'Oren'], 'follows Delta, nothing cached');
});

test('npc.dossier returns the dossier fields as a plain copy, by name or alias; unknown and archived give null', async () => {
    const { def } = await hosted();
    const dossier = def.queries['npc.dossier']({}, { name: 'mira' });
    assert.equal(dossier.id, 'npc_mira');
    assert.equal(dossier.role, 'Blacksmith');
    assert.deepEqual(dossier.relationship, { trust: 12, affection: 3, desire: 0, tension: -4 });
    assert.deepEqual(dossier.customFields, { Rank: 'Master' });
    for (const hidden of ['portraitPromptPositive', 'profileEvidence', 'updatedAt', 'manualProfileFields']) {
        assert.equal(hidden in dossier, false, `${hidden} stays inside Delta`);
    }
    assert.ok(Object.keys(dossier).every(key => DOSSIER_FIELDS.includes(key)));
    assert.deepEqual(JSON.parse(JSON.stringify(dossier)), dossier, 'plain JSON only');
    assert.deepEqual(def.queries['npc.dossier']({}, { name: 'The Smith' }).id, 'npc_mira');
    dossier.memories.push('changed');
    dossier.relationship.trust = 100;
    const again = def.queries['npc.dossier']({}, { name: 'Mira' });
    assert.deepEqual(again.memories, ['Forged the gate']);
    assert.equal(again.relationship.trust, 12);
    assert.equal(def.queries['npc.dossier']({}, { name: 'Nobody' }), null);
    assert.equal(def.queries['npc.dossier']({}, { name: 'Kael' }), null);
    assert.equal(def.queries['npc.dossier']({}, {}), null);
    assert.equal(def.queries['npc.dossier']({}, undefined), null);
});

test('queries give nothing while Delta is off, and never throw when Delta fails', async () => {
    const { def, delta } = await hosted();
    delta.enabled = false;
    assert.deepEqual(def.queries['npc.present'](), []);
    assert.deepEqual(def.queries['npc.known'](), []);
    assert.equal(def.queries['npc.dossier']({}, { name: 'Mira' }), null);
    delta.enabled = true;
    delta.suiteApi.npcs = () => { throw new Error('not loaded'); };
    assert.deepEqual(def.queries['npc.present'](), []);
    assert.equal(def.queries['npc.dossier']({}, { name: 'Mira' }), null);
});

test('dossierFields copies only the listed fields', () => {
    assert.equal(dossierFields(null), null);
    const out = dossierFields({ name: 'A', relationship: { trust: '5', extra: 1 }, portrait: { dataUrl: 'data:x' }, aliases: ['B'] });
    assert.deepEqual(out, { name: 'A', aliases: ['B'], relationship: { trust: 5, affection: 0, desire: 0, tension: 0 } });
});

// ---- npc.portrait (MODULES §F11) ----

test('npc.portrait gives the portrait Delta shows, by name, alias or id; none, unknown or archived give null', async () => {
    const delta = portraitDelta();
    const { def } = await hosted({ delta });
    const portrait = def.queries['npc.portrait'];
    assert.equal(portrait({}, { name: 'Mira' }), PNG);
    assert.equal(portrait({}, { name: 'the smith' }), PNG, 'by alias, case-insensitive');
    assert.equal(portrait({}, { name: 'npc_mira' }), PNG, 'by id');
    assert.deepEqual(delta.formReads.at(-1), 'npc_mira', 'form images are read by the resolved id');
    assert.equal(portrait({}, { name: 'Oren' }), null, 'no portrait');
    assert.equal(portrait({}, { name: 'Kael' }), null, 'archived NPCs are not offered (as npc.dossier)');
    assert.equal(portrait({}, { name: 'Nobody' }), null);
    assert.equal(portrait({}, {}), null);
    assert.equal(portrait({}, undefined), null);
    assert.equal(portrait({}, { name: 42 }), null);
});

test('npc.portrait follows the current appearance form when that form has its own image', async () => {
    const delta = portraitDelta({ mira: { currentForm: 'raven' } });
    const { def } = await hosted({ delta });
    assert.equal(def.queries['npc.portrait']({}, { name: 'Mira' }), WEBP, 'form names match case-insensitively');
    delta.records.npc_mira.currentForm = 'Human';
    assert.equal(def.queries['npc.portrait']({}, { name: 'Mira' }), PNG, 'a form without its own image shows the main portrait');
    delta.api.formPortraits = () => { throw new Error('not loaded'); };
    delta.records.npc_mira.currentForm = 'Raven';
    assert.equal(def.queries['npc.portrait']({}, { name: 'Mira' }), PNG, 'form images failing falls back to the main portrait');
});

test('npc.portrait never hands out an unsafe URL', async () => {
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=',
        'data:text/html;base64,PGI+', 'data:image/png,<svg onload=x>', 'http://example.com/a.png', '//evil.example/a.png',
        '/\\evil.example/a.png', 'blob:https://example.com/1', 'vbscript:x', 'https:evil.example', '?a', '#a', '', '   ']) {
        const delta = portraitDelta({ mira: { portrait: { dataUrl: bad, url: bad, src: bad } }, forms: { Raven: { dataUrl: bad } } });
        delta.records.npc_mira.currentForm = 'Raven';
        const { def } = await hosted({ delta });
        assert.equal(def.queries['npc.portrait']({}, { name: 'Mira' }), null, `${JSON.stringify(bad)} is refused`);
    }
    // An unsafe image gives way to the next safe one: form image, then dataUrl, url, src.
    const delta = portraitDelta({ mira: { currentForm: 'Raven', portrait: { dataUrl: 'javascript:x', url: '/user/images/Mira.png' } }, forms: { Raven: { dataUrl: 'javascript:y' } } });
    const { def } = await hosted({ delta });
    assert.equal(def.queries['npc.portrait']({}, { name: 'Mira' }), '/user/images/Mira.png');
});

test('safeImageUrl keeps data: images, https: and same-origin paths only; portraitUrl reads Delta\'s fields', () => {
    for (const good of [PNG, WEBP, 'data:image/jpeg;base64,/9j/4AAQ', 'https://cdn.example.com/m.png', '/user/images/Mira.png', 'user/images/Mira.png', '../img/a.png']) {
        assert.equal(safeImageUrl(good), good, good);
    }
    assert.equal(safeImageUrl('  /user/images/Mira.png \n'), '/user/images/Mira.png', 'trimmed');
    for (const bad of [null, undefined, 3, {}, 'javascript:alert(1)', 'data:image/svg+xml;base64,AA', 'http://x/a.png', '//x/a.png', 'file:///etc/passwd', 'a\u0000b.png']) {
        assert.equal(safeImageUrl(bad), null, String(bad));
    }
    assert.equal(portraitUrl(null), null);
    assert.equal(portraitUrl({}), null);
    assert.equal(portraitUrl({ portrait: { dataUrl: PNG } }), PNG);
    assert.equal(portraitUrl({ portrait: { url: 'https://cdn.example.com/m.png' } }), 'https://cdn.example.com/m.png');
    assert.equal(portraitUrl({ portrait: { src: '/user/images/m.png' } }), '/user/images/m.png');
    assert.equal(portraitUrl({ currentForm: ' Raven ', portrait: { dataUrl: PNG } }, { raven: { dataUrl: WEBP } }), WEBP);
    assert.equal(portraitUrl({ currentForm: 'Raven', portrait: 'not-an-object' }, null), null);
});

test('npc.portrait gives nothing while Delta is off, and never throws when Delta fails', async () => {
    const delta = portraitDelta();
    const { def, warnings } = await hosted({ delta });
    delta.enabled = false;
    assert.equal(def.queries['npc.portrait']({}, { name: 'Mira' }), null);
    delta.enabled = true;
    delta.api.getNpc = () => { throw new Error('broken'); };
    assert.equal(def.queries['npc.portrait']({}, { name: 'Mira' }), null);
    assert.ok(warnings.some(args => /portrait query failed/.test(args[0])));
});
