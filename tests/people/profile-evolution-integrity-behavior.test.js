import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildProfileRefreshPrompt,
    buildScannerPrompt,
    createNpcRecord,
    durableProfileEvidenceAlreadyRepresented,
    mergeScanResult,
} from '../../modules/people/core/core.js';
import { merge, profileRow, state } from './profile-evolution-integrity.helpers.js';

test('grounded additive Behavioral Profile candidates recover safely when provider leaves state at keep', () => {
    const sora = createNpcRecord('Sora');
    sora.behaviorProfile = ['Disposition: Rapidly mimics and adapts to demonstrated behavior and language.'];
    const newRule = 'Care style: Uses bright, fatalistic banter and energetic optimism to distract wounded patients during painful surgeries.';
    const result = merge(sora, {
        behaviorProfile: [...sora.behaviorProfile, newRule],
        evidence: { behaviorProfile: ['uses cheerful, fatalistic banter to distract patients and ease panic during intense medical procedures'] },
        developmentScale: 'gradual',
    }, 'Sora uses cheerful, fatalistic banter and energetic optimism to distract wounded patients during painful surgeries.');

    const updated = result.state.npcs[0];
    assert.equal(updated.behaviorProfile[0], sora.behaviorProfile[0], 'keep recovery must preserve established rules verbatim');
    assert.ok(updated.behaviorProfile.some(entry => /fatalistic banter/i.test(entry)), 'grounded additive behavior should be recovered');
    assert.equal(profileRow(result, 'behaviorProfile')?.outcome, 'applied-recovered-refine');
});

test('Behavioral Profile keep recovery cannot retire established rules or admit unsupported additions', () => {
    const sora = createNpcRecord('Sora');
    sora.behaviorProfile = ['Disposition: Rapidly mimics and adapts to demonstrated behavior and language.'];
    const missingBaseline = merge(sora, {
        behaviorProfile: ['Care style: Uses bright banter to distract wounded patients during painful surgeries.'],
        evidence: { behaviorProfile: ['uses bright banter to distract wounded patients during painful surgeries'] },
    }, 'Sora uses bright banter to distract wounded patients during painful surgeries.');
    assert.deepEqual(missingBaseline.state.npcs[0].behaviorProfile, sora.behaviorProfile, 'keep cannot retire an omitted established rule');
    assert.ok((missingBaseline.state.npcs[0].profileEvidence?.behaviorProfile || []).length > 0, 'rejected evidence remains pending');

    const unsupported = merge(sora, {
        behaviorProfile: [...sora.behaviorProfile, 'Strategy: Silently maps every building before entering it.'],
        evidence: { behaviorProfile: ['uses bright banter to distract wounded patients during painful surgeries'] },
    }, 'Sora uses bright banter to distract wounded patients during painful surgeries.');
    assert.deepEqual(unsupported.state.npcs[0].behaviorProfile, sora.behaviorProfile, 'unrelated unsupported additions stay rejected');
});

test('scanner and targeted Refresh explicitly allow one scene to contribute evidence to multiple durable fields', () => {
    const sora = createNpcRecord('Sora');
    const scanner = buildScannerPrompt({ transcript: 'Sora speaks gently while joking to calm a patient.', existingNpcs: [sora] });
    const refresh = buildProfileRefreshPrompt({ transcript: '[m1] Sora speaks gently while joking to calm a patient.', targetNpc: sora });
    for (const prompt of [scanner, refresh]) {
        assert.match(prompt, /One scene may support multiple fields/i);
        assert.match(prompt, /speech\+behaviorProfile allowed/i);
        assert.match(prompt, /emit each grounded/i);
    }
});

test('unsupported durable meaning cannot ride through refine while directly grounded clarification still can', () => {
    const npc = createNpcRecord('Mira');
    npc.personality = 'Kind, curious and independent; careful and methodical in public.';
    npc.speech = 'Soft, melodic speech with measured cadence in public.';

    const rejected = merge(npc, {
        personalityState: 'refine',
        personality: `${npc.personality}; enjoys inflicting pain on strangers.`,
        speechState: 'refine',
        speech: `${npc.speech}; fluent in an extinct celestial language.`,
        evidence: {
            personality: ['Mira pours a cup of tea.'],
            speech: ['Mira says hello.'],
        },
    }, 'Mira pours a cup of tea and says hello.');

    assert.equal(rejected.state.npcs[0].personality, npc.personality);
    assert.equal(rejected.state.npcs[0].speech, npc.speech);
    assert.ok(rejected.state.npcs[0].profileEvidence.personality.some(item => /tea/i.test(item)));
    assert.ok(rejected.state.npcs[0].profileEvidence.speech.some(item => /hello/i.test(item)));

    const grounded = merge(npc, {
        personalityState: 'refine',
        personality: `${npc.personality}; carefully prepares tea for nervous guests.`,
        speechState: 'refine',
        speech: `${npc.speech}; greets elders with the formal phrase Good evening.`,
        evidence: {
            personality: ['Mira carefully prepares tea for nervous guests.'],
            speech: ['Mira greets an elder with the formal phrase Good evening.'],
        },
    }, 'Mira carefully prepares tea for nervous guests, then greets an elder with the formal phrase Good evening.');

    assert.match(grounded.state.npcs[0].personality, /prepares tea for nervous guests/i);
    assert.match(grounded.state.npcs[0].speech, /formal phrase Good evening/i);

    const mixed = merge(npc, {
        personalityState: 'refine',
        personality: `${npc.personality}; carefully prepares tea for nervous guests; secretly delights in torture and pain.`,
        evidence: { personality: ['Mira carefully prepares tea for nervous guests.'] },
    }, 'Mira carefully prepares tea for nervous guests.');
    assert.equal(mixed.state.npcs[0].personality, npc.personality);

    const mixedSpeech = merge(npc, {
        speechState: 'refine',
        speech: `${npc.speech}; uses formal honorifics and precise salutations; fluent in ancient Celestial.`,
        evidence: { speech: ['Mira uses formal honorifics and precise salutations when greeting visitors.'] },
    }, 'Mira uses formal honorifics and precise salutations when greeting visitors.');
    assert.equal(mixedSpeech.state.npcs[0].speech, npc.speech);

    const mixedSpeechSingleClause = merge(npc, {
        speechState: 'refine',
        speech: `${npc.speech}; uses formal honorifics, precise salutations, and is fluent in ancient Celestial.`,
        evidence: { speech: ['Mira uses formal honorifics and precise salutations when greeting visitors.'] },
    }, 'Mira uses formal honorifics and precise salutations when greeting visitors.');
    assert.equal(mixedSpeechSingleClause.state.npcs[0].speech, npc.speech);

    const crossSpeech = mergeScanResult(
        state(npc, createNpcRecord('Bram')),
        {
            npcs: [],
            profileUpdates: [{
                id: npc.id,
                speechState: 'refine',
                speech: `${npc.speech}; fluent in ancient Celestial.`,
            }],
        },
        { turn: 2, sourceMessageId: 2, developmentContext: 'Bram is fluent in ancient Celestial. Mira says hello softly.' },
    );
    assert.equal(crossSpeech.state.npcs[0].speech, npc.speech);

    const mislabeledEvidence = merge(npc, {
        speechState: 'refine',
        speech: `${npc.speech}; fluent in ancient Celestial.`,
        evidence: { speech: ['Bram: fluent in ancient Celestial.'] },
    }, 'Mira says hello softly while Bram watches.');
    assert.equal(mislabeledEvidence.state.npcs[0].speech, npc.speech);

    const crossNpc = mergeScanResult(
        state(npc, createNpcRecord('Lucien')),
        {
            npcs: [],
            profileUpdates: [{
                id: npc.id,
                personalityState: 'refine',
                personality: `${npc.personality}; shoots targets with lethal precision.`,
                evidence: { personality: ['Lucien shoots targets with lethal precision.'] },
            }],
        },
        { turn: 2, sourceMessageId: 2, developmentContext: 'Lucien practices archery and shoots targets with lethal precision. Mira watches quietly.' },
    );
    assert.equal(crossNpc.state.npcs[0].personality, npc.personality);
});

test('Behavioral Profile refinement is atomic and rejects unsupported new agency', () => {
    const npc = createNpcRecord('Mira');
    npc.behaviorProfile = [
        'Analytical Style: Records careful botanical observations.',
        'Care/Warmth: Serves warm tea to visitors.',
    ];
    const unsupported = merge(npc, {
        behaviorProfileState: 'refine',
        behaviorProfile: [
            ...npc.behaviorProfile,
            'Drive/Ambition: Commands a fleet of airships and negotiates intercontinental treaties.',
        ],
        evidence: { behaviorProfile: ['Mira serves warm tea to visitors.'] },
    }, 'Mira serves warm tea to visitors.');
    assert.deepEqual(unsupported.state.npcs[0].behaviorProfile, npc.behaviorProfile);
    assert.equal(profileRow(unsupported, 'behaviorProfile')?.candidateGrounded, false);

    const grounded = merge(npc, {
        behaviorProfileState: 'refine',
        behaviorProfile: [
            ...npc.behaviorProfile,
            'Threat Sensitivity: cautious - Records symptoms before suggesting simple remedies.',
        ],
        evidence: { behaviorProfile: ['Triage: Records symptoms before suggesting simple remedies.'] },
    }, 'Mira records symptoms before suggesting simple remedies.');
    assert.ok(grounded.state.npcs[0].behaviorProfile.some(item => /^Threat Sensitivity:/i.test(item)));
});

test('collection reorder and partial refinement retain only evidence not represented by final canon', () => {
    const behavior = createNpcRecord('Mira');
    behavior.behaviorProfile = [
        'Analytical Style: Records careful botanical observations.',
        'Care/Warmth: Serves warm tea to visitors.',
    ];
    const reordered = merge(behavior, {
        behaviorProfileState: 'refine',
        behaviorProfile: [...behavior.behaviorProfile].reverse(),
        evidence: { behaviorProfile: ['[m2] clinical diagnosis: independently diagnoses complex illnesses and prescribes treatment'] },
    }, 'Mira independently diagnoses complex illnesses and prescribes treatment.');
    assert.deepEqual(reordered.state.npcs[0].behaviorProfile, behavior.behaviorProfile);
    assert.equal(reordered.state.npcs[0].profileEvidence.behaviorProfile.length, 1);
    const behaviorRow = profileRow(reordered, 'behaviorProfile');
    assert.equal(behaviorRow.candidateChanged, false);
    assert.equal(behaviorRow.evidenceAlreadyRepresented, false);
    assert.equal(behaviorRow.evidenceResolved, false);
    assert.equal(behaviorRow.outcome, 'waiting-for-revised-candidate');

    const manner = createNpcRecord('Lina');
    manner.mannerisms = ['Taps a pencil while thinking.', 'Folds her hands before greeting visitors.'];
    const reorderedManner = merge(manner, {
        mannerismState: 'refine',
        mannerisms: [...manner.mannerisms].reverse(),
        evidence: { mannerisms: ['[m2] diagnosis: checks a patient pulse before speaking'] },
    }, 'Lina checks a patient pulse before speaking.');
    assert.deepEqual(reorderedManner.state.npcs[0].mannerisms, manner.mannerisms);
    assert.equal(reorderedManner.state.npcs[0].profileEvidence.mannerisms.length, 1);
    const mannerRow = profileRow(reorderedManner, 'mannerisms');
    assert.equal(mannerRow.candidateChanged, false);
    assert.equal(mannerRow.evidenceResolved, false);

    const partialManner = merge(manner, {
        mannerismState: 'refine',
        mannerisms: [
            'Taps a pencil twice while thinking through difficult diagnoses.',
            manner.mannerisms[1],
        ],
        evidence: { mannerisms: [
            '[m2] habit: Taps a pencil twice while thinking through difficult diagnoses.',
            '[m2] pulse check: checks a patient pulse before speaking.',
        ] },
    }, 'Lina taps a pencil twice while thinking through difficult diagnoses. She also checks a patient pulse before speaking.');
    assert.match(partialManner.state.npcs[0].mannerisms[0], /twice while thinking/i);
    assert.equal(partialManner.state.npcs[0].profileEvidence.mannerisms.length, 1);
    assert.match(partialManner.state.npcs[0].profileEvidence.mannerisms[0], /patient pulse/i);

    const partial = merge(behavior, {
        behaviorProfileState: 'refine',
        behaviorProfile: [
            'Analytical Style: Records careful botanical observations and dates each specimen.',
            behavior.behaviorProfile[1],
        ],
        evidence: { behaviorProfile: [
            '[m2] Study: Records careful botanical observations and dates each specimen.',
            '[m2] clinical diagnosis: independently diagnoses complex illnesses and prescribes treatment.',
        ] },
    }, 'Mira records careful botanical observations and dates each specimen. Separately, she independently diagnoses complex illnesses and prescribes treatment.');
    assert.match(partial.state.npcs[0].behaviorProfile[0], /dates each specimen/i);
    assert.equal(partial.state.npcs[0].profileEvidence.behaviorProfile.length, 1);
    assert.match(partial.state.npcs[0].profileEvidence.behaviorProfile[0], /diagnoses complex illnesses/i);
});

test('evidence coverage requires the claim body and polarity rather than a matching concept label', () => {
    const currentBehavior = ['Analytical Style: Records careful botanical observations.'];
    assert.equal(durableProfileEvidenceAlreadyRepresented('behaviorProfile', currentBehavior, [
        '[m2] Study: Independently diagnoses complex illnesses and prescribes treatment.',
    ]), false);
    assert.equal(durableProfileEvidenceAlreadyRepresented('behaviorProfile', currentBehavior, [
        '[m2] Study: Does not record careful botanical observations.',
    ]), false);
    assert.equal(durableProfileEvidenceAlreadyRepresented('behaviorProfile', currentBehavior, [
        '[m2] Study: Records careful botanical observations.',
    ]), true);
    assert.equal(durableProfileEvidenceAlreadyRepresented('speech', 'Soft, melodic speech in public.', [
        '[m2] melodic: speaks fluent medical Ardessian with complex diagnostic explanations',
    ]), false);
    assert.equal(durableProfileEvidenceAlreadyRepresented('personality', 'Kind and compassionate.', [
        '[m2] kind: abandons compassion and delights in cruelty',
    ]), false);
    assert.equal(durableProfileEvidenceAlreadyRepresented('personality', 'Kind and gentle.', [
        '[m2] kind: kind to animals while actively poisoning rivals and plotting murders',
    ]), false);
    assert.equal(durableProfileEvidenceAlreadyRepresented('personality', 'Honest and dependable in public.', [
        '[m2] honest: not honest with colleagues and hides critical information',
    ]), false);
    assert.equal(durableProfileEvidenceAlreadyRepresented('personality', 'Never cruel in conflict.', [
        '[m2] cruel: overtly cruel to prisoners during interrogation',
    ]), false);
    assert.equal(durableProfileEvidenceAlreadyRepresented('personality', 'Not cruel and avoids violence.', [
        '[m2] peaceful: avoids violence in disputes',
    ]), true);
    assert.equal(durableProfileEvidenceAlreadyRepresented('speech', 'Speaks softly with measured cadence in public.', [
        '[m2] cadence: Speaks softly with measured cadence in public and uses archaic honorifics.',
    ]), false);
});

test('copied Speech candidate keeps novel directional evidence pending while unrelated negation does not block redundancy', () => {
    const speaker = createNpcRecord('Mira');
    speaker.speech = 'Soft, melodic speech in public.';
    const novelEvidence = '[m2] cadence: Soft, melodic speech in public, fluent in ancient Celestial and precise legal terminology.';
    const novel = merge(speaker, {
        speech: speaker.speech,
        speechState: 'refine',
        developmentScale: 'batch',
        developmentReason: 'Over three months Mira studied ancient Celestial and precise legal terminology.',
        evidence: { speech: [novelEvidence] },
    }, '[m1] Over three months Mira studied ancient Celestial and legal terminology. [m2] Mira uses soft melodic speech in public, fluent in ancient Celestial and precise legal terminology.', { allowTargetedDurableSeed: true });
    const novelRow = profileRow(novel, 'speech');
    assert.equal(novelRow.outcome, 'waiting-for-revised-candidate');
    assert.equal(novelRow.evidenceAlreadyRepresented, false);
    assert.ok(novel.state.npcs[0].speechDevelopment.concepts.some(concept =>
        concept.evidenceSamples.some(sample => /ancient Celestial|legal terminology/i.test(sample))));

    assert.equal(durableProfileEvidenceAlreadyRepresented(
        'speech',
        'Soft, melodic speech in public, fluent in ancient Celestial and precise legal terminology.',
        ['[m2] cadence: Soft melodic public speech; fluent in ancient Celestial with precise legal terminology.'],
    ), true);
    assert.equal(durableProfileEvidenceAlreadyRepresented(
        'speech',
        'Soft, melodic speech in public.',
        [novelEvidence],
    ), false);

    const polite = createNpcRecord('Vera');
    polite.speech = 'Speaks softly with measured cadence; never swears.';
    const redundant = merge(polite, {
        speech: polite.speech,
        speechState: 'refine',
        developmentScale: 'batch',
        developmentReason: 'Over three months Vera practiced measured public delivery.',
        evidence: { speech: ['[m2] delivery: Speaks softly with measured cadence.'] },
    }, 'Over three months Vera practiced measured public delivery. Vera speaks softly with measured cadence.', { allowTargetedDurableSeed: true });
    const redundantRow = profileRow(redundant, 'speech');
    assert.equal(redundantRow.outcome, 'evidence-already-reflected');
    assert.equal(redundantRow.evidenceAlreadyRepresented, true);
    assert.equal(redundant.state.npcs[0].speechDevelopment.concepts.length, 0);

    assert.equal(durableProfileEvidenceAlreadyRepresented(
        'speech',
        'Speaks softly; never swears.',
        ['Never speaks softly; swears freely.'],
    ), false);
});

test('Speech copied-candidate negative control still retains novel body and waits for a revised candidate', () => {
    const speaker = createNpcRecord('Mira');
    speaker.speech = 'Soft, melodic speech in public.';
    const result = merge(speaker, {
        speech: speaker.speech,
        speechState: 'refine',
        developmentScale: 'batch',
        developmentReason: 'Over three months Mira studied medicine and learned fluent medical Ardessian.',
        evidence: { speech: ['[m2] melodic: speaks fluent medical Ardessian with complex diagnostic explanations'] },
    }, '[m1] Over three months Mira studied medicine. [m2] Mira speaks fluent medical Ardessian with complex diagnostic explanations.', { allowTargetedDurableSeed: true });
    const row = profileRow(result, 'speech');
    assert.equal(row.outcome, 'waiting-for-revised-candidate');
    assert.equal(row.evidenceAlreadyRepresented, false);
    assert.ok(result.state.npcs[0].profileEvidence.speech.some(item => /medical Ardessian/i.test(item)));
});
