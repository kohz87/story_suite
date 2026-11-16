import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildInjection,
    buildNpcPortraitPrompts,
    buildScannerPrompt,
    createNpcRecord,
    mergeScanResult,
    normalizeNpcRecord,
    resolveNpcAppearance,
} from '../../modules/people/core/core.js';
import { merge, profileRow, state } from './profile-evolution-integrity.helpers.js';

test('scanner requires explicit current Appearance to survive alongside other profile fields', () => {
    const npc = createNpcRecord('Mira');
    npc.appearance = 'Dark hair and a weathered green dress.';
    const prompt = buildScannerPrompt({
        transcript: 'Mira washes clean; her hair is revealed as burnished bronze and she changes into a wool smock.',
        existingNpcs: [npc],
    });
    assert.match(prompt, /MUST emit appearance\/overallAppearance\+evidence\.appearance/i);
    assert.match(prompt, /even with other fields/i);
    assert.match(prompt, /"appearanceState":"refine"/i);
    assert.match(prompt, /"evidence":\{"appearance":\[/i);
});

test('Appearance diagnostics expose provider omission and find Appearance across ordinary/profile channels', () => {
    const npc = normalizeNpcRecord({
        ...createNpcRecord('Mira'),
        appearance: 'Dark hair and a weathered green dress.',
    });

    const omitted = mergeScanResult(
        state(npc),
        {
            npcs: [],
            profileUpdates: [{
                id: npc.id,
                evidence: { speech: ['Mira speaks softly.'] },
                speechState: 'refine',
                speech: 'Soft-spoken.',
            }],
        },
        { turn: 2, sourceMessageId: 2, developmentContext: 'Mira speaks softly.' },
    );
    const missingRow = profileRow(omitted, 'appearance');
    assert.equal(missingRow?.outcome, 'not-provided');
    assert.equal(missingRow?.providerFieldPresent, false);
    assert.equal(missingRow?.providerEvidencePresent, false);

    const context = 'Mira washes clean. Her hair is revealed as burnished bronze and she changes into a wool smock.';
    const updated = mergeScanResult(
        state(npc),
        {
            npcs: [{
                id: npc.id,
                name: npc.name,
                appearance: 'Burnished bronze hair; wears a wool smock.',
                appearanceState: 'change',
                appearanceReason: 'Her cleaned hair is revealed as burnished bronze and she changes into a wool smock.',
                present: true,
            }],
            profileUpdates: [{
                id: npc.id,
                evidence: { speech: ['Mira answers in a soft voice.'] },
                speechState: 'refine',
                speech: 'Soft-spoken.',
            }],
        },
        { turn: 2, sourceMessageId: 2, developmentContext: context },
    );
    const row = profileRow(updated, 'appearance');
    assert.equal(row?.providerFieldPresent, true);
    assert.equal(row?.outcome, 'applied-change');
    assert.match(row?.candidate || '', /burnished bronze/i);
    assert.match(resolveNpcAppearance(updated.state.npcs[0]), /burnished bronze/i);
    assert.match(resolveNpcAppearance(updated.state.npcs[0]), /wool smock/i);
});

test('accepted flat current appearance updates the selected canonical form and every projection', () => {
    const npc = normalizeNpcRecord({
        ...createNpcRecord('Mira'),
        appearanceModelVersion: 1,
        overallAppearance: 'Silver hair and blue eyes.',
        currentForm: 'Human',
        appearanceForms: [
            { name: 'Human', appearance: 'Silver hair and blue eyes. Wears a green dress.' },
            { name: 'Dragon', appearance: 'Mirror-steel scales, silver wings, and a long tail.' },
        ],
    });
    const context = 'Mira has silver hair and blue eyes. She changes into a red coat with brass buttons.';
    const changed = merge(npc, {
        appearance: 'Silver hair and blue eyes; wears a red coat with brass buttons.',
        appearanceState: 'refine',
        evidence: { appearance: ['Mira wears a red coat with brass buttons.'] },
    }, context);
    const current = changed.state.npcs[0];
    const human = current.appearanceForms.find(form => form.name === 'Human');
    const dragon = current.appearanceForms.find(form => form.name === 'Dragon');

    assert.match(human.appearance, /red coat with brass buttons/i);
    assert.doesNotMatch(human.appearance, /green dress/i);
    assert.match(dragon.appearance, /silver wings/i);
    assert.match(resolveNpcAppearance(current), /red coat with brass buttons/i);
    assert.doesNotMatch(resolveNpcAppearance(current), /green dress/i);
    const injection = buildInjection([{ ...current, present: true }], 'Mira is here.', 2, 3, undefined, 2000);
    const portrait = buildNpcPortraitPrompts(current).positive;
    assert.match(injection, /red coat with brass buttons/i);
    assert.doesNotMatch(injection, /green dress/i);
    assert.match(portrait, /red coat with brass buttons/i);
    assert.doesNotMatch(portrait, /green dress/i);
    assert.equal(changed.report.profileUpdateStats.applied, 1);
});

test('unsupported appearance proposal is rejected across dossier, injection, portrait, and update stats', () => {
    const npc = normalizeNpcRecord({
        ...createNpcRecord('Mira'),
        appearanceModelVersion: 1,
        overallAppearance: 'Silver hair and blue eyes.',
        currentForm: 'Human',
        appearanceForms: [
            { name: 'Human', appearance: 'Silver hair and blue eyes. Wears a green dress.' },
            { name: 'Dragon', appearance: 'Mirror-steel scales, silver wings, and a long tail.' },
        ],
    });
    const context = 'Mira pours a cup of tea for her guests and smiles warmly.';
    const rejected = merge(npc, {
        appearance: 'Silver hair and blue eyes. Wears a green dress; has curved obsidian horns and bat wings.',
        appearanceState: 'refine',
        evidence: { appearance: ['Mira pours a cup of tea.'] },
    }, context);
    const current = rejected.state.npcs[0];
    const human = current.appearanceForms.find(form => form.name === 'Human');

    assert.doesNotMatch(human.appearance, /horns|wings/i);
    assert.doesNotMatch(resolveNpcAppearance(current), /horns|wings/i);
    const injection = buildInjection([{ ...current, present: true }], 'Mira is here.', 2, 3, undefined, 2000);
    const portrait = buildNpcPortraitPrompts(current).positive;
    assert.doesNotMatch(injection, /horns|wings/i);
    assert.doesNotMatch(portrait, /horns|wings/i);
    assert.equal(rejected.report.profileUpdateStats.applied, 0);
});

test('simultaneous form selection cannot carry rejected flat anatomy into the selected form', () => {
    const npc = normalizeNpcRecord({
        ...createNpcRecord('Mira'),
        appearanceModelVersion: 1,
        currentForm: 'Human',
        appearanceForms: [
            { name: 'Human', appearance: 'Silver hair and blue eyes; wears a green dress.' },
            { name: 'Travel', appearance: 'Silver hair and blue eyes; wears a brown cloak.' },
        ],
    });
    const rejected = merge(npc, {
        currentForm: 'Travel',
        currentFormState: 'select',
        appearance: 'Silver hair and blue eyes; wears a brown cloak; obsidian horns and jeweled wings.',
        appearanceState: 'refine',
        evidence: { appearance: ['Mira pulls her brown cloak tighter and continues down the road.'] },
    }, 'Mira pulls her brown cloak tighter and continues down the road.');
    const current = rejected.state.npcs[0];
    assert.equal(current.currentForm, 'Travel');
    assert.doesNotMatch(resolveNpcAppearance(current), /horns|wings/i);
    assert.doesNotMatch(current.appearanceForms.find(form => form.name === 'Travel').appearance, /horns|wings/i);
});

test('form selection and flat appearance update target the newly selected form without old-form leakage', () => {
    const npc = normalizeNpcRecord({
        ...createNpcRecord('Mira'),
        appearanceModelVersion: 1,
        currentForm: 'Human',
        appearanceForms: [
            { name: 'Human', appearance: 'Silver hair, blue eyes, and a green dress.' },
            { name: 'Dragon', appearance: 'Mirror-steel scales, silver wings, and a long tail.' },
        ],
    });
    const changed = merge(npc, {
        currentForm: 'Dragon',
        currentFormState: 'select',
        appearance: 'Mirror-steel scales, silver wings, a long tail, and a crimson mantle.',
        appearanceState: 'refine',
        evidence: { appearance: ['Her Dragon form wears a crimson mantle over mirror-steel scales and silver wings.'] },
    }, 'Mira changes into her Dragon form. Mirror-steel scales and silver wings frame a crimson mantle.');
    const current = changed.state.npcs[0];
    assert.equal(current.currentForm, 'Dragon');
    assert.match(resolveNpcAppearance(current), /crimson mantle/i);
    assert.doesNotMatch(resolveNpcAppearance(current), /green dress/i);
    assert.match(current.appearanceForms.find(form => form.name === 'Human').appearance, /green dress/i);
    assert.match(current.appearanceForms.find(form => form.name === 'Dragon').appearance, /crimson mantle/i);
});

test('Shared appearance is deduplicated at clause boundaries in resolved, injection, and portrait text', () => {
    const npc = normalizeNpcRecord({
        ...createNpcRecord('Mira'),
        appearanceModelVersion: 1,
        overallAppearance: 'Silver hair and blue eyes.',
        currentForm: 'Human',
        appearanceForms: [{ name: 'Human', appearance: 'Silver hair and blue eyes. Wears a green dress.' }],
    });
    const resolved = resolveNpcAppearance(npc);
    const injection = buildInjection([{ ...npc, present: true }], 'Mira is here.', 2, 3, undefined, 2000);
    const portrait = buildNpcPortraitPrompts(npc).positive;
    for (const value of [resolved, injection, portrait]) {
        assert.equal((value.match(/silver hair and blue eyes/gi) || []).length, 1);
        assert.match(value, /green dress/i);
    }

    const distinct = normalizeNpcRecord({
        ...createNpcRecord('Vera'),
        appearanceModelVersion: 1,
        overallAppearance: 'Silver hair and blue eyes.',
        currentForm: 'Veiled',
        appearanceForms: [{ name: 'Veiled', appearance: 'Her blue eyes are not visible beneath an opaque black veil.' }],
    });
    const distinctResolved = resolveNpcAppearance(distinct);
    assert.match(distinctResolved, /Silver hair and blue eyes/i);
    assert.match(distinctResolved, /not visible beneath an opaque black veil/i);
    assert.equal(resolveNpcAppearance(normalizeNpcRecord(distinct)), distinctResolved);

    const veiledPrefix = normalizeNpcRecord({
        ...createNpcRecord('Vera'),
        appearanceModelVersion: 1,
        overallAppearance: 'Silver hair and blue eyes.',
        currentForm: 'Veiled',
        appearanceForms: [{ name: 'Veiled', appearance: 'Silver hair and blue eyes are not visible beneath an opaque black veil.' }],
    });
    const veiledResolved = resolveNpcAppearance(veiledPrefix);
    assert.equal(veiledResolved, 'Silver hair and blue eyes are not visible beneath an opaque black veil.');
    assert.doesNotMatch(veiledResolved, /;\s*are not visible/i);
    assert.equal((veiledResolved.match(/silver hair and blue eyes/gi) || []).length, 1);
});
