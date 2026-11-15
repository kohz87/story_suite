import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildInjection,
    DEFAULT_MEMORY_CRITERIA,
    IMPORTANT_MEMORY_LIMIT,
    KEY_RELATIONSHIP_LIMIT,
    buildScannerPrompt,
    createNpcRecord,
    mergeScanResult,
    normalizeNpcRecord,
    extractExplicitKeyRelationshipEdges,
} from '../core.js';

test('key relationships are durable social continuity and evolution never erases unrelated bonds by omission', () => {
    const npc = createNpcRecord('Marris');
    npc.keyRelationships = [
        'Elena — older sister | close but frequently argumentative',
        'Rook — mentor | trusted adviser',
    ];

    const casual = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, present: true,
        keyRelationships: ['Elena — older sister | angry after today\'s argument'],
    }] }, { turn: 2 });
    assert.deepEqual(casual.state.npcs[0].keyRelationships, npc.keyRelationships, 'temporary social beats must not rewrite durable ties');

    const evolved = mergeScanResult(casual.state, { npcs: [{
        id: npc.id, present: true,
        keyRelationshipsState: 'evolve',
        keyRelationshipsReason: 'Rook died and Marris permanently reconciled with Elena after the funeral.',
        keyRelationships: [
            'Elena — older sister | reconciled and mutually protective',
            'Rook — deceased mentor | mourned and still influential',
        ],
    }] }, { turn: 3 });
    assert.deepEqual(evolved.state.npcs[0].keyRelationships, [
        'Elena — older sister | reconciled and mutually protective',
        'Rook — deceased mentor | mourned and still influential',
    ]);
    assert.equal(evolved.state.npcs[0].keyRelationships.length <= KEY_RELATIONSHIP_LIMIT, true);
});

test('key relationships update merges newly established ties without erasing existing people', () => {
    const npc = createNpcRecord('Marris');
    npc.keyRelationships = ['Rook — mentor | trusted adviser'];
    const updated = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id,
        keyRelationshipsState: 'update',
        keyRelationshipsReason: "Elena was explicitly identified as Marris's older sister.",
        keyRelationships: ['Elena — older sister | protective but blunt'],
    }] }, { turn: 2 });
    assert.deepEqual(updated.state.npcs[0].keyRelationships, [
        'Rook — mentor | trusted adviser',
        'Elena — older sister | protective but blunt',
    ]);
});

test('key relationships update refines the same counterpart in place without requiring social evolution', () => {
    const npc = createNpcRecord('Marris');
    npc.keyRelationships = [
        'Elena — companion | longstanding familiarity',
        'Rook — mentor | trusted adviser',
    ];
    const updated = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id,
        keyRelationshipsState: 'refine',
        keyRelationshipsReason: "The scene explicitly establishes that Elena is Marris's older sister.",
        keyRelationships: ['Elena — older sister | longstanding familiarity'],
    }] }, { turn: 2 });
    assert.deepEqual(updated.state.npcs[0].keyRelationships, [
        'Elena — older sister | longstanding familiarity',
        'Rook — mentor | trusted adviser',
    ]);
});


test('unmarked scanner extraction can recover only a newly established counterpart', () => {
    const npc = createNpcRecord('Marris');
    npc.keyRelationships = ['Rook — mentor | trusted adviser'];
    const recovered = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id,
        keyRelationships: [
            'Rook — mentor | irritated today',
            'Elena — older sister | protective but blunt',
        ],
    }] }, { turn: 2 });
    assert.deepEqual(recovered.state.npcs[0].keyRelationships, [
        'Rook — mentor | trusted adviser',
        'Elena — older sister | protective but blunt',
    ], 'recovery may append a new counterpart but must not rewrite an existing one without lifecycle state');
});
test('key relationships evolution still requires a reason while explicit discovery update does not', () => {
    const npc = createNpcRecord('Toris');
    npc.keyRelationships = ['Myla — patrol partner | close professional trust'];
    const missingReason = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, keyRelationshipsState: 'evolve', keyRelationships: ['Myla — former partner | estranged'],
    }] }, { turn: 2 });
    assert.deepEqual(missingReason.state.npcs[0].keyRelationships, npc.keyRelationships);

    const discovery = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, keyRelationshipsState: 'update', keyRelationships: ['Kera — younger sister | newly established family tie'],
    }] }, { turn: 2 });
    assert.deepEqual(discovery.state.npcs[0].keyRelationships, [
        'Myla — patrol partner | close professional trust',
        'Kera — younger sister | newly established family tie',
    ]);

    npc.manualProfileFields = ['keyRelationships'];
    const locked = mergeScanResult({ npcs: [npc], turn: 2 }, { npcs: [{
        id: npc.id, keyRelationshipsState: 'evolve', keyRelationshipsReason: 'They permanently separated.',
        keyRelationships: ['Myla — former partner | estranged'],
    }] }, { turn: 3 });
    assert.deepEqual(locked.state.npcs[0].keyRelationships, npc.keyRelationships);
});

test('top-level social edges update tracked dossiers even when no NPC delta object is returned', () => {
    const marris = createNpcRecord('Marris');
    marris.keyRelationships = ['Rook — mentor | trusted adviser'];
    const elena = createNpcRecord('Elena');
    const state = { npcs: [marris, elena], candidates: [], dismissed: [], turn: 7 };
    const result = mergeScanResult(state, {
        npcs: [],
        keyRelationshipEdges: [{
            aId: marris.id, a: 'Marris', bId: elena.id, b: 'Elena',
            aToB: 'older sister', bToA: 'younger sibling',
            reason: 'The story explicitly establishes that Elena is Marris\'s older sister.',
        }],
    }, { turn: 7 });
    const updatedMarris = result.state.npcs.find(npc => npc.id === marris.id);
    const updatedElena = result.state.npcs.find(npc => npc.id === elena.id);
    assert.deepEqual(updatedMarris.keyRelationships, [
        'Rook — mentor | trusted adviser',
        'Elena — older sister',
    ]);
    assert.deepEqual(updatedElena.keyRelationships, ['Marris — younger sibling']);
    assert.ok(result.report.updated.includes(marris.id));
    assert.ok(result.report.updated.includes(elena.id));
});

test('explicit possessive relationship statements have a local fallback independent of scanner JSON', () => {
    const marris = createNpcRecord('Marris');
    const elena = createNpcRecord('Elena');
    const edges = extractExplicitKeyRelationshipEdges(
        "Narrator: Elena is Marris's older sister. They have not spoken in years.",
        [marris, elena],
        ['Kazuma'],
    );
    assert.equal(edges.length, 1);
    assert.equal(edges[0].aId, marris.id);
    assert.equal(edges[0].bId, elena.id);
    assert.equal(edges[0].aToB, 'older sister');
    assert.equal(edges[0].bToA, 'younger sibling');
});

test('top-level social edges respect manual Key Relationships locks', () => {
    const marris = createNpcRecord('Marris');
    marris.keyRelationships = ['Rook — mentor'];
    marris.manualProfileFields = ['keyRelationships'];
    const state = { npcs: [marris], candidates: [], dismissed: [], turn: 2 };
    const result = mergeScanResult(state, {
        npcs: [],
        keyRelationshipEdges: [{ aId: marris.id, a: 'Marris', b: 'Elena', aToB: 'older sister' }],
    }, { turn: 2 });
    assert.deepEqual(result.state.npcs[0].keyRelationships, ['Rook — mentor']);
});

test('important memory criteria are explicit, configurable, and existing memories are supplied for dedupe', () => {
    const npc = createNpcRecord('Myla Fenn');
    npc.id = 'npc_myla';
    npc.memories = [
        'Aris returned the tags of two dead adventurers, forcing Myla to confront the consequences of the guild quota system.',
        'Myla offered unlogged emergency funds to buy Aris\'s silence and avoid arrest.',
    ];
    const prompt = buildScannerPrompt({
        transcript: 'Myla thanks Aris for keeping the tags private and promises to warn future recruits.',
        existingNpcs: [npc],
        memoryCriteria: 'CUSTOM MEMORY: persist promises and consequential discoveries; reject routine greetings.',
    });
    assert.match(prompt, /Memory criteria:/i);
    assert.match(prompt, /CUSTOM MEMORY: persist promises/i);
    assert.match(prompt, /no duplicate\/paraphrased memories/i);
    assert.match(prompt, /Aris returned the tags of two dead adventurers/);
    assert.match(prompt, /cap5/i);
    assert.match(prompt, /memoryRetention/i);
    assert.match(prompt, /consequential\/durable/i);
    assert.match(prompt, /recency=tiebreak only/i);

    const defaultPrompt = buildScannerPrompt({ transcript: 'Marris makes a consequential promise.', memoryCriteria: DEFAULT_MEMORY_CRITERIA });
    assert.match(defaultPrompt, /durable story-relevant events/i);
    assert.match(defaultPrompt, /Reject routine dialogue\/transactions/i);
});

test('important memories cap at five and semantic retention can keep older defining events', () => {
    assert.equal(IMPORTANT_MEMORY_LIMIT, 5);
    const npc = createNpcRecord('Myla Fenn');
    npc.id = 'npc_myla';
    npc.memories = [
        'Aris saved Myla from a lethal ambush.',
        'Myla learned Aris dislikes bitter tea.',
        "Aris kept Myla's secret from the guildmaster.",
        'Myla promised to warn Aris about future quota changes.',
        "Aris returned the dead adventurers' tags to their families.",
    ];
    const result = mergeScanResult({ npcs: [npc], turn: 5 }, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false,
        memories: ['Myla discovered the guildmaster forged the quota ledger.'],
        memoryRetention: [
            'Aris saved Myla from a lethal ambush.',
            'Myla discovered the guildmaster forged the quota ledger.',
            "Aris kept Myla's secret from the guildmaster.",
            'Myla promised to warn Aris about future quota changes.',
            "Aris returned the dead adventurers' tags to their families.",
        ],
    }] }, { turn: 6 });
    assert.deepEqual(result.state.npcs[0].memories, [
        'Aris saved Myla from a lethal ambush.',
        'Myla discovered the guildmaster forged the quota ledger.',
        "Aris kept Myla's secret from the guildmaster.",
        'Myla promised to warn Aris about future quota changes.',
        "Aris returned the dead adventurers' tags to their families.",
    ]);
    assert.doesNotMatch(result.state.npcs[0].memories.join(' '), /bitter tea/i);
});

test('full important-memory lists admit new memories even if the scanner omits retention', () => {
    const npc = createNpcRecord('Marris');
    npc.id = 'npc_marris';
    npc.memories = ['old-1', 'old-2', 'old-3', 'old-4', 'old-5'];
    const result = mergeScanResult({ npcs: [npc], turn: 3 }, { npcs: [{
        id: 'npc_marris', present: true, worldActive: false, memories: ['new-6'],
    }] }, { turn: 4 });
    assert.deepEqual(result.state.npcs[0].memories, ['old-2', 'old-3', 'old-4', 'old-5', 'new-6']);
});

test('legacy stored memory overflow normalizes to the most recent five', () => {
    const npc = normalizeNpcRecord({ name: 'Luna', memories: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'] });
    assert.deepEqual(npc.memories, ['m4', 'm5', 'm6', 'm7', 'm8']);
});

test('generation injection includes the retained Important Memories as high-priority continuity', () => {
    const npc = createNpcRecord('Myla Fenn');
    npc.present = true;
    npc.lastSeenTurn = 10;
    npc.memories = [
        'Aris saved Myla from a lethal ambush.',
        "Aris kept Myla's secret from the guildmaster.",
        'Myla promised to warn Aris about future quota changes.',
        "Aris returned the dead adventurers' tags to their families.",
        'Myla discovered the guildmaster forged the quota ledger.',
    ];
    const injection = buildInjection([npc], 'Myla Fenn enters the room.', 10, 1, 'CUSTOM BEHAVIOR RUBRIC', 1800);
    assert.match(injection, /memories:/i);
    for (const memory of npc.memories) assert.ok(injection.includes(memory), `missing injected memory: ${memory}`);
});

test('v0.2.7 key-relationship evolution updates named counterparts without deleting omitted bonds', () => {
    const npc = createNpcRecord('Marris');
    npc.keyRelationships = [
        'Elena — older sister | close but argumentative',
        'Rook — mentor | trusted adviser',
        'Talia — friend | dependable companion',
    ];
    const result = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id,
        keyRelationshipsState: 'evolve',
        keyRelationshipsReason: 'Marris and Elena permanently reconciled.',
        keyRelationships: ['Elena — older sister | reconciled and mutually protective'],
    }] }, { turn: 2 });
    assert.deepEqual(result.state.npcs[0].keyRelationships, [
        'Elena — older sister | reconciled and mutually protective',
        'Rook — mentor | trusted adviser',
        'Talia — friend | dependable companion',
    ]);
});

test('v0.2.8 ambiguous deceased Key Relationship wording is rewritten with an explicit subject', () => {
    const jonas = normalizeNpcRecord({
        name: 'Jonas Hael',
        keyRelationships: ['Brina Hael — Widow and mother of his daughters (deceased).'],
    });
    assert.deepEqual(jonas.keyRelationships, ['Brina Hael — Surviving widow and mother of his daughters']);

    const living = normalizeNpcRecord({ name: 'Marris', keyRelationships: ['Rook — mentor (deceased)'] });
    assert.deepEqual(living.keyRelationships, ['Rook — mentor | deceased'], 'legacy deceased wording should migrate into the canonical relation | dynamic shape');
});

test('explicit key-relationship edges: a 400+ character run with no space is skipped, so a pasted blob costs nothing and the prose around it still counts (BH2)', () => {
    const roster = [{ id: 'npc_mira', name: 'Mira', aliases: [] }, { id: 'npc_sera', name: 'Sera', aliases: [] }];
    const blob = 'A'.repeat(30000);
    const started = Date.now();
    const edges = extractExplicitKeyRelationshipEdges(`${blob}\nSera is Mira's sister. ${blob}`, roster, []);
    assert.ok(Date.now() - started < 2000, 'no quadratic scan of the blob');
    assert.ok(edges.some(edge => edge.a === 'Mira' && edge.b === 'Sera' && edge.aToB === 'sister'), JSON.stringify(edges));
    assert.deepEqual(extractExplicitKeyRelationshipEdges('Sera is Mira\'s sister.', roster, []).map(edge => edge.aToB), ['sister']);
});
