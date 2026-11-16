import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createNpcRecord,
    mergeScanResult,
} from '../core.js';

test('v0.2.5 gradual identity evolution requires evidence carried across scans', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Reserved, kind, and reluctant to draw attention.';
    const first = mergeScanResult({ npcs: [npc], candidates: [], turn: 1 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            evidence: { personality: [
                'outspokenness: initiates a conversation with unfamiliar travelers without prompting.',
                'outspokenness: openly disagrees with a senior officer during one tense council scene.',
            ] },
            personalityState: 'evolve',
            personality: 'Confident, outspoken, kind, and socially proactive.',
            personalityReason: 'Her behavior appears less reserved.',
            developmentScale: 'gradual',
            developmentReason: 'Recent scenes suggest a possible long-term change.',
        }],
    }, { turn: 2 });
    assert.equal(first.state.npcs[0].personality, 'Reserved, kind, and reluctant to draw attention.', 'multiple observations from one scan must not rewrite slow identity');
    assert.ok(first.state.npcs[0].profileEvidence.personality.length >= 1);

    const second = mergeScanResult(first.state, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            evidence: { personality: ['outspokenness: weeks later, independently takes the floor at a public meeting and leads the discussion.'] },
            personalityState: 'evolve',
            personality: 'Confident, outspoken, kind, and socially proactive.',
            personalityReason: 'The less-reserved behavior has become a recurring pattern.',
            developmentScale: 'gradual',
            developmentReason: 'Independent later evidence confirms sustained change.',
        }],
    }, { turn: 3 });
    assert.match(second.state.npcs[0].personality, /Confident, outspoken/i);
    assert.deepEqual(second.state.npcs[0].profileEvidence.personality, []);
});

test('v0.2.5 time passage alone cannot batch-rewrite identity but summarized development can', () => {
    const npc = createNpcRecord('Astra');
    npc.personality = 'Lively, impulsive, and informal.';
    const bareSkip = mergeScanResult({ npcs: [npc], candidates: [], turn: 10 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'evolve',
            personality: 'Gentle, composed, and soft-spoken.',
            personalityReason: 'Time has passed.',
            developmentScale: 'batch',
            developmentReason: 'Three years passed.',
        }],
    }, { turn: 11 });
    assert.equal(bareSkip.state.npcs[0].personality, 'Lively, impulsive, and informal.');

    const developedSkip = mergeScanResult(bareSkip.state, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'evolve',
            personality: 'Gentler, more composed, and deliberately soft-spoken while retaining flashes of liveliness.',
            personalityReason: 'Her consciously practiced gentleness became habitual over the skipped period.',
            developmentScale: 'batch',
            developmentReason: 'Over three years, narration explicitly says she repeatedly practiced Talia\'s gentler manner until it became almost second nature.',
        }],
    }, { turn: 12 });
    assert.match(developedSkip.state.npcs[0].personality, /Gentler, more composed/i);
});

test('v0.2.5 ordinary NPC delta path cannot bypass gradual identity evidence gate', () => {
    const npc = createNpcRecord('Falia');
    npc.personality = 'Restrained, kind, and formal.';
    npc.behaviorProfile = ['Expressiveness: Low.', 'Disposition: Broadly kind.'];
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 4 }, {
        npcs: [{
            id: npc.id,
            name: 'Falia',
            present: true,
            personalityState: 'evolve',
            personality: 'Highly expressive, impulsive, and informal.',
            personalityReason: 'She became animated in this scene.',
            behaviorProfileState: 'evolve',
            behaviorProfile: ['Expressiveness: Very high.', 'Disposition: Player-focused.'],
            behaviorProfileReason: 'She was openly affectionate with the player.',
            developmentScale: 'gradual',
            developmentReason: 'One emotionally intense scene.',
        }],
    }, { turn: 5 });
    assert.equal(result.state.npcs[0].personality, 'Restrained, kind, and formal.');
    assert.deepEqual(result.state.npcs[0].behaviorProfile, ['Expressiveness: Low.', 'Disposition: Broadly kind.']);
});

test('v0.2.6 omitted developmentScale defaults to gradual and cannot bypass durable evolution', () => {
    const npc = createNpcRecord('Falia');
    npc.personality = 'Kind, restrained, and formal.';
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 1 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            evidence: { personality: ['expressiveness: becomes animated during one intimate exchange'] },
            personalityState: 'evolve',
            personality: 'Highly expressive, impulsive, and informal.',
            personalityReason: 'She was animated with the player.',
            developmentReason: 'She was animated with the player.',
        }],
    }, { turn: 2 });
    assert.equal(result.state.npcs[0].personality, 'Kind, restrained, and formal.');
});

test('v0.2.6 unrelated old evidence cannot unlock a different gradual personality change', () => {
    const npc = createNpcRecord('Falia');
    npc.personality = 'Kind, reserved, and cautious.';
    npc.profileEvidence.personality = ['kindness: repeatedly helps injured strangers without reward'];
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 2 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            evidence: { personality: ['outspokenness: takes the floor at a public meeting'] },
            personalityState: 'evolve',
            personality: 'Kind, outspoken, and socially proactive.',
            personalityReason: 'She appears less reserved.',
            developmentScale: 'gradual',
            developmentReason: 'A possible recurring change.',
        }],
    }, { turn: 3 });
    assert.equal(result.state.npcs[0].personality, 'Kind, reserved, and cautious.');
    assert.ok(result.state.npcs[0].profileEvidence.personality.some(item => /kindness:/i.test(item)));
    assert.ok(result.state.npcs[0].profileEvidence.personality.some(item => /outspokenness:/i.test(item)));
});

test('v0.2.6 one-scene gestures do not become mannerisms but explicitly recurring habits may refine', () => {
    const npc = createNpcRecord('Toris');
    npc.mannerisms = ['Habitually scratches his beard before answering.'];
    const oneOff = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, present: true, mannerismState: 'refine', mannerisms: ['Slams his fist on the table in anger.'],
    }] }, { turn: 2 });
    assert.deepEqual(oneOff.state.npcs[0].mannerisms, npc.mannerisms);
    const recurring = mergeScanResult(oneOff.state, { npcs: [{
        id: npc.id, present: true, mannerismState: 'refine', mannerisms: ['Habitually squares his shoulders before delivering bad news.'],
    }] }, { turn: 3 });
    assert.ok(recurring.state.npcs[0].mannerisms.some(item => /Habitually squares/i.test(item)));
});

test('v0.2.6 batch development must be grounded in the actual narrated time-skip context', () => {
    const npc = createNpcRecord('Astra');
    npc.personality = 'Lively, impulsive, and informal.';
    const hallucinated = mergeScanResult({ npcs: [npc], candidates: [], turn: 8 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'evolve',
            personality: 'Gentle, composed, and soft-spoken.',
            personalityReason: 'Her gentleness became habitual.',
            developmentScale: 'batch',
            developmentReason: 'Over three years she repeatedly practiced a gentler manner until it became habitual.',
        }],
    }, { turn: 9, developmentContext: 'Three years passed.' });
    assert.equal(hallucinated.state.npcs[0].personality, 'Lively, impulsive, and informal.');

    const grounded = mergeScanResult(hallucinated.state, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'evolve',
            personality: 'Gentler, more composed, and deliberately soft-spoken while retaining flashes of liveliness.',
            personalityReason: 'Her gentleness became habitual.',
            developmentScale: 'batch',
            developmentReason: 'Over three years she repeatedly practiced a gentler manner until it became habitual.',
        }],
    }, { turn: 10, developmentContext: "Over three years, Astra repeatedly practiced Talia's gentler manner until it became habitual and almost second nature." });
    assert.match(grounded.state.npcs[0].personality, /Gentler, more composed/i);
});

test('v0.2.6 explicit evolution requires an actual lasting-change or correction cue in source narration', () => {
    const npc = createNpcRecord('Selene');
    npc.personality = 'Reserved, skeptical, and emotionally guarded.';
    const oneOff = mergeScanResult({ npcs: [npc], candidates: [], turn: 1 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'evolve',
            personality: 'Warm, trusting, and openly affectionate.',
            personalityReason: 'She became warmer and more trusting.',
            developmentScale: 'explicit',
            developmentReason: 'Selene became warmer and more trusting.',
        }],
    }, { developmentContext: 'Selene was unexpectedly warm to the wounded courier and trusted his directions.' });
    assert.match(oneOff.state.npcs[0].personality, /Reserved, skeptical/i);

    const explicit = mergeScanResult({ npcs: [npc], candidates: [], turn: 2 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'evolve',
            personality: 'Warmer, more trusting, while still somewhat reserved.',
            personalityReason: 'She had become warmer and more trusting after the ordeal.',
            developmentScale: 'explicit',
            developmentReason: 'After the ordeal Selene had become warmer and more trusting.',
        }],
    }, { developmentContext: 'After the ordeal, Selene had become noticeably warmer and more trusting, though some reserve remained.' });
    assert.match(explicit.state.npcs[0].personality, /Warmer, more trusting/i);
});

test('v0.2.6 batch evolution cannot borrow unrelated present-day evidence from elsewhere in transcript', () => {
    const npc = createNpcRecord('Astra');
    npc.personality = 'Abrupt, energetic, and rough-edged.';
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 1 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'evolve',
            personality: 'Gentle, patient, and soft-spoken.',
            personalityReason: 'Over three years she gradually became gentle and patient.',
            developmentScale: 'batch',
            developmentReason: 'Over three years she gradually became gentle and patient.',
        }],
    }, { developmentContext: 'Three years passed. The city changed beyond recognition. Today Astra gently helped a frightened child and patiently waited beside her.' });
    assert.match(result.state.npcs[0].personality, /Abrupt, energetic/i);
});

test('v0.2.6 scanner cannot invent habitual frequency from a one-off mannerism when source context is available', () => {
    const npc = createNpcRecord('Toris');
    npc.mannerisms = ['Habitually scratches his beard before answering.'];
    const result = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id,
        present: true,
        mannerismState: 'refine',
        mannerisms: ['Habitually squares his shoulders before delivering bad news.'],
    }] }, {
        turn: 2,
        developmentContext: 'Toris squared his shoulders once, then delivered the bad news to the captain.',
    });
    assert.deepEqual(result.state.npcs[0].mannerisms, npc.mannerisms);
});

test('v0.2.6 transition language cannot disguise personality or speech evolution as refinement', () => {
    const npc = createNpcRecord('Marris');
    npc.personality = 'Reserved, cautious, and kind.';
    npc.speech = 'Soft, formal, and measured.';
    npc.behaviorProfile = ['Expressiveness: Low; feelings are shown subtly.'];
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 5 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'refine',
            personality: 'No longer reserved or cautious; now outspoken, reckless, and kind.',
            speechState: 'refine',
            speech: 'No longer formal; now blunt, loud, and colloquial.',
            behaviorProfileState: 'refine',
            behaviorProfile: ['Expressiveness: No longer low; now highly expressive.'],
        }],
    }, { turn: 6 });
    assert.equal(result.state.npcs[0].personality, 'Reserved, cautious, and kind.');
    assert.equal(result.state.npcs[0].speech, 'Soft, formal, and measured.');
    assert.deepEqual(result.state.npcs[0].behaviorProfile, ['Expressiveness: Low; feelings are shown subtly.']);
});

test('v0.2.7 blank durable identity fields require grounded source narration before first seed', () => {
    const npc = createNpcRecord('Mira');
    npc.manual = false;
    npc.present = true;
    npc.seenCount = 3;
    const state = { turn: 3, npcs: [npc], candidates: [] };

    const inferred = mergeScanResult(state, { npcs: [{
        id: npc.id,
        name: 'Mira',
        present: true,
        personality: 'kind and playful',
        speech: 'soft and teasing',
    }] }, {
        turn: 4,
        developmentContext: 'Mira smiled at the player, handed them a cup, and made a joke about the rain.',
    }).state.npcs[0];

    assert.equal(inferred.personality, '');
    assert.equal(inferred.speech, '');

    const grounded = mergeScanResult({ turn: 4, npcs: [inferred], candidates: [] }, { npcs: [{
        id: npc.id,
        name: 'Mira',
        present: true,
        personality: 'kind and reserved',
        speech: 'soft and measured',
    }] }, {
        turn: 5,
        developmentContext: 'Mira is kind and reserved by nature. Her speech is soft and measured even when annoyed.',
    }).state.npcs[0];

    assert.match(grounded.personality, /kind/i);
    assert.match(grounded.personality, /reserved/i);
    assert.match(grounded.speech, /soft/i);
    assert.match(grounded.speech, /measured/i);
});

test('v0.2.7 a first one-off gesture cannot seed mannerisms but explicit recurrence can', () => {
    const npc = createNpcRecord('Nera');
    npc.manual = false;
    npc.seenCount = 2;
    const once = mergeScanResult({ turn: 2, npcs: [npc], candidates: [] }, { npcs: [{
        id: npc.id,
        name: 'Nera',
        present: true,
        mannerisms: ['taps two fingers against her bracer before answering'],
        mannerismState: 'refine',
    }] }, {
        turn: 3,
        developmentContext: 'Nera tapped two fingers against her bracer before answering the question.',
    }).state.npcs[0];
    assert.deepEqual(once.mannerisms, []);

    const recurring = mergeScanResult({ turn: 3, npcs: [once], candidates: [] }, { npcs: [{
        id: npc.id,
        name: 'Nera',
        present: true,
        mannerisms: ['taps two fingers against her bracer before answering'],
        mannerismState: 'refine',
    }] }, {
        turn: 4,
        developmentContext: 'Nera habitually taps two fingers against her bracer before answering difficult questions.',
    }).state.npcs[0];
    assert.equal(recurring.mannerisms.length, 1);
    assert.match(recurring.mannerisms[0], /two fingers/i);
});

test('v0.2.7 repeated evidence can seed an empty trait only when it supports the proposed trait', () => {
    const npc = createNpcRecord('Iria');
    npc.manual = false;
    npc.seenCount = 4;
    const base = { turn: 4, npcs: [npc], candidates: [] };
    const first = mergeScanResult(base, { npcs: [{ id: npc.id, name: 'Iria', present: true }], profileUpdates: [{
        id: npc.id,
        evidence: { personality: ['Kindness: treats a frightened stranger gently'] },
        personalityState: 'refine',
        personality: 'kind',
    }] }, { turn: 5, developmentContext: 'Iria gave the frightened stranger water and tended his scraped hands.' }).state.npcs[0];
    assert.equal(first.personality, '');

    const mismatch = mergeScanResult({ turn: 5, npcs: [first], candidates: [] }, { npcs: [{ id: npc.id, name: 'Iria', present: true }], profileUpdates: [{
        id: npc.id,
        evidence: { personality: ['Kindness: spares an exhausted opponent who surrendered'] },
        personalityState: 'refine',
        personality: 'sadistic',
    }] }, { turn: 6, developmentContext: 'Iria lowered her weapon after the exhausted opponent surrendered and let him leave.' }).state.npcs[0];
    assert.equal(mismatch.personality, '', 'related evidence labels must not authorize an unrelated proposed personality');

    const supported = mergeScanResult({ turn: 6, npcs: [mismatch], candidates: [] }, { npcs: [{ id: npc.id, name: 'Iria', present: true }], profileUpdates: [{
        id: npc.id,
        evidence: { personality: ['Kindness: helps an injured traveler without demanding payment'] },
        personalityState: 'refine',
        personality: 'kind',
    }] }, { turn: 7, developmentContext: 'Iria bound the traveler\'s wound and refused payment.' }).state.npcs[0];
    assert.equal(supported.personality, 'kind');
});
