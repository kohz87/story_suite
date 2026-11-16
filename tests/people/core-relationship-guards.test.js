import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_RELATIONSHIP_CAPS,
    createNpcRecord,
    mergeScanResult,
    normalizeNpcRecord,
    normalizeRelationshipProgress,
    applyRelationshipDelta,
    relationshipChangeLooksDuplicate,
    relationshipHistoryLooksDuplicate,
    relationshipAxisEvidenceGrounded,
    relationshipSummaryConsistent,
} from '../core.js';

test('v0.2.8 Noctis-style relationship summary is calibrated and unexplained audit deltas are discarded', () => {
    const npc = normalizeNpcRecord({
        name: 'Brina Hael',
        relationship: { trust: 18, affection: 14, desire: 16, tension: -1 },
        relationshipSummary: 'Views Lucien as an indispensable source of physical comfort and survival.',
        lastRelationshipChange: { impact: 'ordinary', delta: { trust: 2, affection: 1, desire: 0, tension: 2 }, reason: '' },
    });
    assert.doesNotMatch(npc.relationshipSummary, /indispensable/i);
    assert.match(npc.relationshipSummary, /growing source of practical support and comfort/i);
    assert.deepEqual(npc.lastRelationshipChange.delta, { trust: 0, affection: 0, desire: 0, tension: 0 });
    assert.equal(npc.lastRelationshipChange.impact, 'none');
});

test('v0.2.8 scanner relationship deltas require a reason grounded in the scanned story when context is available', () => {
    const npc = createNpcRecord('Brina');
    const unrelated = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Brina', present: true,
        relationshipImpact: 'ordinary', relationshipDelta: { trust: 4 },
        relationshipEvidence: { trust: 'Lucien proved dependable by giving Brina food and shelter.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'Lucien gave Brina food and shelter.',
    }] }, { turn: 2, developmentContext: 'Rain struck the shutters while Brina counted her remaining thread.' });
    assert.equal(unrelated.state.npcs[0].relationship.trust, 0);

    const grounded = mergeScanResult({ npcs: [npc], turn: 1 }, { npcs: [{
        id: npc.id, name: 'Brina', present: true,
        relationshipImpact: 'ordinary', relationshipDelta: { trust: 4 },
        relationshipEvidence: { trust: 'Lucien proved dependable by giving Brina food and shelter.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'Lucien gave Brina food and shelter.',
    }] }, { turn: 2, developmentContext: 'Lucien gave Brina food and shelter after learning her household had run short.' });
    assert.equal(grounded.state.npcs[0].relationship.trust, 1);
    assert.match(grounded.state.npcs[0].lastRelationshipChange.reason, /food and shelter/i);
});

test('v0.2.10 recent relationship event history rejects duplicate awards beyond only the last event', () => {
    const previous = {
        impact: 'meaningful',
        delta: { trust: 3, affection: 2, desire: 0, tension: 0 },
        evidence: { trust: 'The rescue proved the player reliable.', affection: '', desire: '', tension: '' },
        reason: 'The player rescued Myla from the collapsing bridge.',
        sourceMessageId: 20,
        turn: 10,
    };
    assert.equal(relationshipChangeLooksDuplicate(previous, 'The player rescued Myla from the collapsing bridge.', { sourceMessageId: 22, turn: 11 }), true);
    assert.equal(relationshipChangeLooksDuplicate(previous, 'The player kept a new promise weeks later.', { sourceMessageId: 40, turn: 25 }), false);

    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla';
    const first = mergeScanResult({ npcs: [npc], turn: 9 }, { npcs: [{
        id: npc.id, present: true, relationshipImpact: 'ordinary', relationshipDelta: { trust: 1 },
        relationshipEvidence: { trust: 'Returning the medicine proved the player dependable.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'The player returned Myla\'s lost medicine.',
    }] }, { turn: 10, sourceMessageId: 20, developmentContext: 'The player returned Myla\'s lost medicine.' });
    const second = mergeScanResult(first.state, { npcs: [{
        id: npc.id, present: true, relationshipImpact: 'ordinary', relationshipDelta: { trust: 1 },
        relationshipEvidence: { trust: 'Returning the medicine proved the player dependable.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'The player returned Myla\'s lost medicine.',
    }] }, { turn: 11, sourceMessageId: 22, developmentContext: 'Myla continues thanking the player for returning her lost medicine.' });
    assert.equal(second.state.npcs[0].relationship.trust, 1, 'the same event must not be re-awarded on its immediate aftermath');
});

test('v0.2.10 Desire requires attraction evidence in both axis explanation and narration', () => {
    const rescueEvidence = 'Myla felt sexually attracted to the player after the rescue.';
    assert.equal(
        relationshipAxisEvidenceGrounded('desire', rescueEvidence, 'The player pulled Myla from the river and saved her life.'),
        false,
        'a model cannot manufacture Desire by adding attraction words to a non-romantic rescue',
    );
    assert.equal(
        relationshipAxisEvidenceGrounded('desire', 'Myla explicitly admitted romantic attraction and wanted intimate closeness.', 'Myla admitted she was romantically attracted to the player and asked to kiss them.'),
        true,
        'explicit attraction in the narration can ground Desire',
    );
});

test('v0.2.10 event history catches A-B-A replay instead of remembering only the last award', () => {
    const history = [
        {
            impact: 'ordinary', reason: 'The player returned Myla\'s lost medicine.',
            evidence: { trust: 'Returning the medicine proved the player dependable.', affection: '', desire: '', tension: '' },
            sourceMessageId: 20, turn: 10,
        },
        {
            impact: 'ordinary', reason: 'The player later respected Myla\'s request for privacy.',
            evidence: { trust: 'Respecting the boundary reinforced that the player was reliable.', affection: '', desire: '', tension: '' },
            sourceMessageId: 22, turn: 11,
        },
    ];
    assert.equal(relationshipHistoryLooksDuplicate(
        history,
        'The player returned Myla\'s lost medicine.',
        { sourceMessageId: 24, turn: 12, evidence: { trust: 'Returning the medicine proved the player dependable.' } },
    ), true);
});

test('v0.2.10 a rejected duplicate relationship event cannot rewrite durable relationship prose', () => {
    const npc = createNpcRecord('Myla');
    npc.id = 'npc_myla_summary_gate';
    npc.relationship = { trust: 35, affection: 15, desire: 0, tension: 0 };
    npc.relationshipSummary = 'She cautiously appreciates the player as a dependable ally.';
    npc.relationshipEventHistory = [{
        impact: 'meaningful', reason: 'The player returned Myla\'s stolen medicine.',
        evidence: { trust: 'Returning the stolen medicine proved the player dependable.', affection: '', desire: '', tension: '' },
        sourceMessageId: 30, turn: 20,
    }];
    const result = mergeScanResult({ npcs: [npc], turn: 20 }, { npcs: [{
        id: npc.id,
        present: true,
        relationshipImpact: 'meaningful',
        relationshipDelta: { trust: 2, affection: 0, desire: 0, tension: 0 },
        relationshipEvidence: { trust: 'Returning the stolen medicine proved the player dependable.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'The player returned Myla\'s stolen medicine.',
        relationshipSummary: 'She now regards the player as one of her closest and most trusted companions.',
    }] }, {
        turn: 21,
        sourceMessageId: 32,
        developmentContext: 'Myla again thanks the player for returning her stolen medicine earlier.',
    });
    assert.equal(result.state.npcs[0].relationshipSummary, npc.relationshipSummary);
    assert.equal(result.state.npcs[0].relationship.trust, 35);
});

test('v0.2.10 relationship summaries reject unsupported romance and possessive archetype claims', () => {
    const poisoned = 'She is madly in love, sexually attracted, possessive, and would kill anyone who threatens the player.';
    assert.equal(relationshipSummaryConsistent(poisoned, { trust: 20, affection: 20, desire: 0, tension: 0 }), false);
    assert.equal(relationshipSummaryConsistent('She increasingly trusts the player as a dependable ally.', { trust: 35, affection: 10, desire: 0, tension: 0 }), true);
});

test('v0.2.10 the 95+ band needs ten ordinary evidence beats for one visible point', () => {
    let relationship = { trust: 95, affection: 0, desire: 0, tension: 0 };
    let progress = normalizeRelationshipProgress();
    for (let i = 0; i < 9; i += 1) {
        const step = applyRelationshipDelta(relationship, { trust: 1 }, 'ordinary', DEFAULT_RELATIONSHIP_CAPS, progress);
        relationship = step.relationship;
        progress = step.relationshipProgress;
        assert.equal(step.appliedDelta.trust, 0);
    }
    const tenth = applyRelationshipDelta(relationship, { trust: 1 }, 'ordinary', DEFAULT_RELATIONSHIP_CAPS, progress);
    assert.equal(tenth.appliedDelta.trust, 1);
    assert.equal(tenth.relationship.trust, 96);
});

test('v0.2.10 ambiguous equal multi-axis overflow is rejected instead of favoring Trust and Affection', () => {
    const result = applyRelationshipDelta(
        { trust: 0, affection: 0, desire: 0, tension: 0 },
        { trust: 2, affection: 2, desire: 2, tension: 0 },
        'meaningful',
    );
    assert.deepEqual(result.appliedDelta, { trust: 0, affection: 0, desire: 0, tension: 0 });
    assert.deepEqual(result.evidenceDelta, { trust: 0, affection: 0, desire: 0, tension: 0 });
});

test('v0.2.10 relationship event history is bounded to six recent evidence events', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({
        impact: 'ordinary',
        reason: `Distinct relationship event ${i}`,
        evidence: { trust: `Trust evidence event ${i}`, affection: '', desire: '', tension: '' },
        sourceMessageId: i,
        turn: i,
    }));
    const normalized = normalizeNpcRecord({ name: 'Myla', relationshipEventHistory: history }).relationshipEventHistory;
    assert.equal(normalized.length, 6);
    assert.match(normalized[0].reason, /event 3$/);
    assert.match(normalized[5].reason, /event 8$/);
});
