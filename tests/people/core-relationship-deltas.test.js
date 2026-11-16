import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBehaviorGuidance,
    buildScannerPrompt,
    buildRelationshipPassPrompt,
    createNpcRecord,
    mergeScanResult,
    normalizeNpcRecord,
    normalizeRelationshipCaps,
    applyRelationshipDelta,
} from '../../modules/people/core/core.js';

test('creates new NPC from baseline, applies deltas, and preserves portrait through scanner updates', () => {
    const state = { npcs: [], turn: 3 };
    const first = mergeScanResult(state, { npcs: [{
        name: 'Yunyun', present: true, mood: 'flustered', relationshipImpact: 'meaningful',
        relationshipDelta: { trust: 2, affection: 2 }, relationshipEvidence: { trust: 'She confided a private secret and trusted the player with it.', affection: 'The shared vulnerability deepened her emotional bond.', desire: '', tension: '' }, relationshipChangeReason: 'She confided in the player and their bond deepened.',
    }] }, { maxNpcs: 4, turn: 3, sourceMessageId: 3 });
    assert.equal(first.state.npcs.length, 1);
    const npc = first.state.npcs[0];
    assert.equal(npc.relationship.trust, 2);
    assert.equal(npc.relationship.affection, 2);
    assert.equal(npc.lastRelationshipChange.impact, 'meaningful');
    assert.equal(npc.lastRelationshipChange.sourceMessageId, 3);
    npc.portrait = { dataUrl: 'data:image/webp;base64,abc' };
    npc.portraitSeed = 424242;
    const second = mergeScanResult(first.state, { npcs: [{
        id: npc.id, name: 'Yunyun', present: true, mood: 'determined', relationshipImpact: 'ordinary',
        relationshipDelta: { trust: 99, tension: -2 }, relationshipEvidence: { trust: 'The player again proved reliable in a new small matter.', affection: '', desire: '', tension: 'The new reassurance eased some pressure.' }, relationshipChangeReason: 'A new small exchange demonstrated reliability and reassurance.',
    }] }, { maxNpcs: 4, turn: 4, sourceMessageId: 4 });
    assert.equal(second.state.npcs.length, 1);
    assert.equal(second.state.npcs[0].mood, 'determined');
    assert.equal(second.state.npcs[0].relationship.trust, 3, 'ordinary delta is intentionally limited to a single +1 axis');
    assert.equal(second.state.npcs[0].relationship.tension, 0);
    assert.equal(second.state.npcs[0].lastRelationshipChange.delta.trust, 1);
    assert.equal(second.state.npcs[0].portrait.dataUrl, 'data:image/webp;base64,abc');
    assert.equal(second.state.npcs[0].portraitSeed, 424242, 'scanner updates must preserve manual portrait seed metadata');
});

test('zero relationship decisions preserve the last actual relationship change audit', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.relationship = { trust: 12, affection: 4, desire: 0, tension: 3 };
    npc.lastRelationshipChange = {
        impact: 'major',
        delta: { trust: -15, affection: -9, desire: 0, tension: 15 },
        evidence: { trust: '', affection: '', desire: '', tension: '' },
        reason: 'A severe betrayal changed how Myla sees the player.',
        sourceMessageId: 8,
    };
    const result = mergeScanResult({ npcs: [npc], turn: 9 }, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false,
        relationshipImpact: 'none',
        relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
    }] }, { turn: 10, sourceMessageId: 10 });
    assert.deepEqual(result.state.npcs[0].relationship, npc.relationship);
    assert.deepEqual(result.state.npcs[0].lastRelationshipChange, npc.lastRelationshipChange, 'a zero-decision scan must not erase the last actual change');
});

test('non-zero relationship deltas survive contradictory none impact as ordinary changes', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.relationship = { trust: 10, affection: 0, desire: 0, tension: 0 };

    const result = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: 'npc_myla',
        present: true,
        worldActive: false,
        relationshipImpact: 'none',
        relationshipDelta: { trust: 6 },
        relationshipEvidence: { trust: 'The player proved reliable and earned trust.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'The scanner supplied a real trust event but contradicted it with impact none.',
    }] }, { turn: 2, relationshipCaps: { ordinary: 4, meaningful: 8, major: 15, extreme: 25 } });

    assert.equal(result.state.npcs[0].relationship.trust, 14, 'non-zero delta must not be clamped to zero by contradictory impact none');
    assert.equal(result.state.npcs[0].lastRelationshipChange.impact, 'ordinary');
    assert.equal(result.state.npcs[0].lastRelationshipChange.delta.trust, 4);
});

test('recovers absolute relationship output when compact scanner omits relationshipDelta', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.relationship = { trust: 20, affection: 5, desire: -3, tension: 2 };

    const recovered = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: 'npc_myla',
        present: true,
        worldActive: false,
        relationshipImpact: 'meaningful',
        relationship: { trust: 28, affection: 1 },
        relationshipEvidence: { trust: 'The player proved reliable and increased her trust.', affection: 'A hurtful rejection reduced her affection.', desire: '', tension: '' },
        relationshipChangeReason: 'A reliable act increased trust while a hurtful rejection reduced affection.',
    }] }, { turn: 2, relationshipCaps: { ordinary: 4, meaningful: 8, major: 15, extreme: 25 } });

    assert.deepEqual(recovered.state.npcs[0].relationship, { trust: 28, affection: 1, desire: -3, tension: 2 });
    assert.deepEqual(recovered.state.npcs[0].lastRelationshipChange.delta, { trust: 8, affection: -4, desire: 0, tension: 0 });

    const explicitDeltaWins = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: 'npc_myla',
        present: true,
        worldActive: false,
        relationshipImpact: 'none',
        relationshipDelta: { trust: 0 },
        relationship: { trust: 80 },
    }] }, { turn: 2 });

    assert.equal(explicitDeltaWins.state.npcs[0].relationship.trust, 20, 'an explicit relationshipDelta field must win over absolute-output recovery');
});

test('focused relationship pass requires one full four-axis decision per target', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    npc.relationship = { trust: 25, affection: 12, desire: 0, tension: -4 };
    npc.relationshipSummary = 'She trusts the player but remains wary of promises.';
    const prompt = buildRelationshipPassPrompt({
        transcript: 'Aris knowingly betrays Myla to the guildmaster, exposing the secret she trusted him to protect.',
        targets: [npc],
        userName: 'Aris',
        relationshipCaps: { ordinary: 4, meaningful: 8, major: 15, extreme: 25 },
    });
    assert.match(prompt, /focused relationship evaluator/i);
    assert.match(prompt, /exactly one result for EACH target id/i);
    assert.match(prompt, /ALL FOUR numeric keys/i);
    assert.match(prompt, /relationshipEvidence is REQUIRED with ALL FOUR string keys/i);
    assert.match(prompt, /actions and consequences, not just dialogue/i);
    assert.match(prompt, /Raw maxima are ordinary 4 \/ meaningful 8 \/ major 15 \/ extreme 25/i);
    assert.match(prompt, /Most events move 0-1 axes/i);
    assert.match(prompt, /relationshipSummary is REQUIRED/i);
    assert.match(prompt, /COPY IT EXACTLY/i);
    assert.match(prompt, /major\/extreme turning point MUST rewrite an old summary/i);
    assert.match(prompt, /durable prose Relationship field/i);
    assert.match(prompt, /"currentRelationship":\{"trust":25,"affection":12,"desire":0,"tension":-4\}/);
    assert.match(prompt, /"relationshipSummary":"She trusts the player but remains wary of promises\."/);
    assert.match(prompt, /Current exchange:/i);
});

test('scanner relationship contract requires independent multi-axis deltas', () => {
    const promptNpc = createNpcRecord('Myla');
    promptNpc.id = 'npc_myla';
    promptNpc.relationship = { trust: 20, affection: 5, desire: 0, tension: 7 };
    const prompt = buildScannerPrompt({
        transcript: 'Myla learns the player protected her, reassures her, and admits caring about her.',
        existingNpcs: [promptNpc],
        relationshipCriteria: undefined,
        impactCriteria: undefined,
    });
    assert.match(prompt, /relationshipDelta\+relationshipEvidence \(all 4 keys\)/i);
    assert.match(prompt, /axis max 1\/2\/3\/4/i);
    assert.match(prompt, /EVERY non-zero axis needs grounded evidence from the CURRENT exchange/i);
    assert.match(prompt, /DELTA-ONLY/i);
    assert.match(prompt, /currentRelationship read-only/i);
    assert.match(prompt, /Desire needs explicit attraction/i);
    assert.match(prompt, /"currentRelationship":\{"trust":20,"affection":5,"desire":0,"tension":7\}/);
    assert.match(prompt, /"trust":-2,"affection":0,"desire":0,"tension":2/);

    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    const merged = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: 'npc_myla', present: true, worldActive: false,
        relationshipImpact: 'meaningful',
        relationshipDelta: { trust: 6, affection: 4, desire: 2, tension: -5 },
        relationshipEvidence: { trust: 'The player protected Myla, proving reliable.', affection: 'His care deepened their emotional bond.', desire: 'Myla explicitly admitted romantic attraction.', tension: 'The reassurance eased her fear and tension.' },
        relationshipChangeReason: 'Protection, bonding, explicit attraction, and reduced fear all occur in the same event.',
    }] }, { turn: 2, relationshipCaps: { ordinary: 4, meaningful: 8, major: 15, extreme: 25 } });
    assert.deepEqual(merged.state.npcs[0].relationship, { trust: 6, affection: 0, desire: 0, tension: -5 }, 'custom legacy-sized caps remain user-authoritative, but meaningful still affects at most two axes');
    assert.deepEqual(merged.state.npcs[0].lastRelationshipChange.delta, { trust: 6, affection: 0, desire: 0, tension: -5 });
});

test('relationship schema is trust affection desire tension and legacy respect is not reinterpreted as desire', () => {
    const migrated = normalizeNpcRecord({ name: 'Yunyun', relationship: { trust: 61, affection: 33, respect: 88, tension: 14 } });
    assert.deepEqual(migrated.relationship, { trust: 61, affection: 33, desire: 0, tension: 14 });
    assert.equal('respect' in migrated.relationship, false);
});


test('relationship delta engine enforces tier caps, score bounds, and normalized cap ordering', () => {
    assert.deepEqual(normalizeRelationshipCaps({ ordinary: 6, meaningful: 2, major: 10, extreme: 9 }), {
        ordinary: 6, meaningful: 6, major: 10, extreme: 10,
    });
    const up = applyRelationshipDelta(
        { trust: 98, affection: 20, desire: 5, tension: 10 },
        { trust: 40, affection: -30, desire: 9, tension: -99 },
        'meaningful',
        { ordinary: 4, meaningful: 8, major: 15, extreme: 25 },
    );
    assert.deepEqual(up.appliedDelta, { trust: 0, affection: 0, desire: 0, tension: -8 }, 'meaningful events affect at most two axes while +98 trust accumulates fractional evidence');
    assert.deepEqual(up.relationship, { trust: 98, affection: 20, desire: 5, tension: 2 });
    assert.equal(up.relationshipProgress.trust, 0.8);
    const none = applyRelationshipDelta({ trust: 50, affection: 20, desire: 0, tension: 10 }, { trust: 50 }, 'none');
    assert.equal(none.relationship.trust, 50);
    assert.equal(none.appliedDelta.trust, 0);
    const down = applyRelationshipDelta(
        { trust: -98, affection: -95, desire: -99, tension: -97 },
        { trust: -40, affection: -40, desire: -40, tension: -40 },
        'meaningful',
        { ordinary: 4, meaningful: 8, major: 15, extreme: 25 },
    );
    assert.deepEqual(down.relationship, { trust: -98, affection: -95, desire: -99, tension: -97 }, 'ambiguous equal-sized excess axes are rejected instead of biased by fixed key order');
});

test('new NPC relationship baseline is neutral zero and legacy audit entries never produce NaN deltas', () => {
    assert.deepEqual(createNpcRecord('Neutral').relationship, { trust: 0, affection: 0, desire: 0, tension: 0 });
    const legacy = normalizeNpcRecord({
        name: 'Legacy',
        relationship: { trust: 50, affection: 20, desire: 0, tension: 10 },
        lastRelationshipChange: { impact: 'ordinary' },
    });
    assert.deepEqual(legacy.relationship, { trust: 50, affection: 20, desire: 0, tension: 10 }, 'legacy live scores should be preserved rather than reinterpreted');
    assert.deepEqual(legacy.lastRelationshipChange.delta, { trust: 0, affection: 0, desire: 0, tension: 0 });
    assert.ok(Object.values(legacy.lastRelationshipChange.delta).every(Number.isFinite));
});

test('negative relationship values produce opposite behavioral meaning instead of low-positive semantics', () => {
    const npc = createNpcRecord('Luna');
    npc.relationship = { trust: -70, affection: -45, desire: -65, tension: -55 };
    const guidance = buildBehaviorGuidance(npc);
    assert.match(guidance, /strong distrust/);
    assert.match(guidance, /dislike|resentment/);
    assert.match(guidance, /aversion to intimate\/romantic closeness/);
    assert.match(guidance, /noticeable ease/);
    assert.match(guidance, /strong distrust/);
});

test('custom relationship baseline is used only when a new NPC record is created', () => {
    const baseline = { trust: 24, affection: 5, desire: 1, tension: 30 };
    const result = mergeScanResult({ npcs: [], turn: 1 }, { npcs: [{
        name: 'Luna', present: true, relationshipImpact: 'ordinary', relationshipDelta: { trust: 2 }, relationshipEvidence: { trust: 'Luna relied on the player and found them dependable.', affection: '', desire: '', tension: '' }, relationshipChangeReason: 'Luna relied on the player during the exchange.',
    }] }, { maxNpcs: 40, turn: 1, relationshipBaseline: baseline });
    assert.deepEqual(result.state.npcs[0].relationship, { trust: 25, affection: 5, desire: 1, tension: 30 });
});

test('v0.2.6 focused relationship evaluator receives identity, current goals, and non-player bonds', () => {
    const npc = createNpcRecord('Falia');
    npc.id = 'npc_falia';
    npc.personality = 'Kind-hearted, restrained, pragmatic, and independent.';
    npc.behaviorProfile = ['Disposition: Broadly kind.', 'Independence: High.'];
    npc.goal = 'Keep the caravan alive and uphold her oath.';
    npc.keyRelationships = ['Talia — trusted friend | loyal', 'Rin — younger sister | deeply loved'];
    const prompt = buildRelationshipPassPrompt({ transcript: 'The player asks her to abandon the caravan.', targets: [npc], userName: 'Aris' });
    assert.match(prompt, /Kind-hearted, restrained, pragmatic/i);
    assert.match(prompt, /Keep the caravan alive/i);
    assert.match(prompt, /Talia .*trusted friend/i);
    assert.match(prompt, /player is not their only motive or relationship/i);
});

test('v0.2.8 manual relationship audit remains valid even without a generated evidence reason', () => {
    const npc = normalizeNpcRecord({
        name: 'Iria',
        lastRelationshipChange: { impact: 'manual', delta: { trust: 5 }, reason: '' },
    });
    assert.equal(npc.lastRelationshipChange.impact, 'manual');
    assert.equal(npc.lastRelationshipChange.delta.trust, 5);
});
