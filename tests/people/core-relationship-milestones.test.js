import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_RELATIONSHIP_CAPS,
    createNpcRecord,
    mergeScanResult,
    normalizeRelationshipCaps,
    normalizeRelationshipProgress,
    normalizeRelationshipMilestones,
    inferManualRelationshipMilestones,
    relationshipMilestoneUnlocked,
    applyRelationshipDelta,
} from '../../modules/people/core/core.js';

// (relationship pacing: the stock points per event are 1 / 2 / 3 / 6 now; the engine tests below that need the old 5 / 10 pass them.)
const OLD_CAPS = { ordinary: 1, meaningful: 2, major: 5, extreme: 10 };
test('v0.2.10 stock relationship progression uses 1/2/3/6 raw weights and axis limits', () => {
    assert.deepEqual(DEFAULT_RELATIONSHIP_CAPS, { ordinary: 1, meaningful: 2, major: 3, extreme: 6 });
    assert.deepEqual(normalizeRelationshipCaps({}), { ordinary: 1, meaningful: 2, major: 3, extreme: 6 });

    const ordinary = applyRelationshipDelta(
        { trust: 0, affection: 0, desire: 0, tension: 0 },
        { trust: 100, affection: 99, desire: 99, tension: 99 },
        'ordinary',
    );
    assert.deepEqual(ordinary.appliedDelta, { trust: 1, affection: 0, desire: 0, tension: 0 }, 'ordinary affects at most one axis');

    const meaningful = applyRelationshipDelta(
        { trust: 0, affection: 0, desire: 0, tension: 0 },
        { trust: 9, affection: 8, desire: 7, tension: 6 },
        'meaningful',
    );
    assert.deepEqual(meaningful.appliedDelta, { trust: 2, affection: 2, desire: 0, tension: 0 }, 'meaningful affects at most two axes');
});

test('v0.2.10 relationship weight accumulates fractionally and makes extremes progressively harder', () => {
    let relationship = { trust: 85, affection: 0, desire: 0, tension: 0 };
    let progress = normalizeRelationshipProgress();
    for (let i = 0; i < 4; i += 1) {
        const step = applyRelationshipDelta(relationship, { trust: 1 }, 'ordinary', DEFAULT_RELATIONSHIP_CAPS, progress);
        relationship = step.relationship;
        progress = step.relationshipProgress;
        assert.equal(step.appliedDelta.trust, 0, 'high-score ordinary evidence should accumulate without forcing a visible point');
    }
    const fifth = applyRelationshipDelta(relationship, { trust: 1 }, 'ordinary', DEFAULT_RELATIONSHIP_CAPS, progress);
    assert.equal(fifth.appliedDelta.trust, 1, 'five valid +1 beats at 85 should finally produce one visible point');
    assert.equal(fifth.relationship.trust, 86);

    const extreme = applyRelationshipDelta(
        { trust: 90, affection: 0, desire: 0, tension: 0 },
        { trust: 10 },
        'extreme',
        OLD_CAPS,
    );
    assert.equal(extreme.appliedDelta.trust, 2, 'extreme +10 is raw evidence before high-score resistance');

    const minorSetback = applyRelationshipDelta(
        { trust: 90, affection: 0, desire: 0, tension: 0 },
        { trust: -1 },
        'ordinary',
    );
    assert.equal(minorSetback.appliedDelta.trust, 0, 'a minor setback should not instantly shave a point from very high trust');
    assert.equal(minorSetback.relationshipProgress.trust, -0.4);

    const catastrophic = applyRelationshipDelta(
        { trust: 90, affection: 0, desire: 0, tension: 0 },
        { trust: -10 },
        'extreme',
        OLD_CAPS,
    );
    assert.equal(catastrophic.appliedDelta.trust, -10, 'extreme contrary evidence can punch through established resilience');
});

test('v0.2.11 directional relationship milestones gate deeper bands instead of allowing repetition to grind through', () => {
    const locked25 = applyRelationshipDelta(
        { trust: 25, affection: 0, desire: 0, tension: 0 },
        { trust: 1 },
        'ordinary',
        DEFAULT_RELATIONSHIP_CAPS,
        { trust: 0.8 },
        [],
    );
    assert.equal(locked25.relationship.trust, 25);
    assert.equal(locked25.relationshipProgress.trust, 0, 'outward hidden progress cannot bank behind a locked checkpoint');
    assert.deepEqual(locked25.milestoneBlocks.map(item => item.threshold), [25]);

    const opened25 = applyRelationshipDelta(
        { trust: 25, affection: 0, desire: 0, tension: 0 },
        { trust: 1 },
        'meaningful',
        DEFAULT_RELATIONSHIP_CAPS,
        normalizeRelationshipProgress(),
        [],
    );
    assert.equal(opened25.relationship.trust, 26);
    assert.ok(opened25.milestoneCrossings.some(item => item.axis === 'trust' && item.polarity === 1 && item.threshold === 25));

    const locked50 = applyRelationshipDelta(
        { trust: 50, affection: 0, desire: 0, tension: 0 },
        { trust: 2 },
        'meaningful',
        DEFAULT_RELATIONSHIP_CAPS,
        normalizeRelationshipProgress(),
        [{ axis: 'trust', polarity: 1, threshold: 25, reason: 'Earlier trust breakthrough.' }],
    );
    assert.equal(locked50.relationship.trust, 50);
    assert.equal(locked50.relationshipProgress.trust, 0);
    assert.ok(locked50.milestoneBlocks.some(item => item.threshold === 50 && item.requiredImpact === 'major'));

    const opened50 = applyRelationshipDelta(
        { trust: 50, affection: 0, desire: 0, tension: 0 },
        { trust: 5 },
        'major',
        DEFAULT_RELATIONSHIP_CAPS,
        normalizeRelationshipProgress(),
        [{ axis: 'trust', polarity: 1, threshold: 25, reason: 'Earlier trust breakthrough.' }],
    );
    assert.ok(opened50.relationship.trust > 50);
    assert.ok(opened50.milestoneCrossings.some(item => item.threshold === 50));

    const locked75 = applyRelationshipDelta(
        { trust: 75, affection: 0, desire: 0, tension: 0 },
        { trust: 5 },
        'major',
        DEFAULT_RELATIONSHIP_CAPS,
        normalizeRelationshipProgress(),
        [
            { axis: 'trust', polarity: 1, threshold: 25, reason: 'Earlier.' },
            { axis: 'trust', polarity: 1, threshold: 50, reason: 'Earlier.' },
        ],
    );
    assert.equal(locked75.relationship.trust, 75);
    assert.ok(locked75.milestoneBlocks.some(item => item.threshold === 75 && item.requiredImpact === 'extreme'));

    const opened75 = applyRelationshipDelta(
        { trust: 75, affection: 0, desire: 0, tension: 0 },
        { trust: 10 },
        'extreme',
        DEFAULT_RELATIONSHIP_CAPS,
        normalizeRelationshipProgress(),
        [
            { axis: 'trust', polarity: 1, threshold: 25, reason: 'Earlier.' },
            { axis: 'trust', polarity: 1, threshold: 50, reason: 'Earlier.' },
        ],
    );
    assert.ok(opened75.relationship.trust > 75);
    assert.ok(opened75.milestoneCrossings.some(item => item.threshold === 75));

    const locked90 = applyRelationshipDelta(
        { trust: 90, affection: 0, desire: 0, tension: 0 },
        { trust: 5 },
        'major',
        DEFAULT_RELATIONSHIP_CAPS,
        normalizeRelationshipProgress(),
        [
            { axis: 'trust', polarity: 1, threshold: 25, reason: 'Earlier.' },
            { axis: 'trust', polarity: 1, threshold: 50, reason: 'Earlier.' },
            { axis: 'trust', polarity: 1, threshold: 75, reason: 'Earlier.' },
        ],
    );
    assert.equal(locked90.relationship.trust, 90);
    assert.ok(locked90.milestoneBlocks.some(item => item.threshold === 90 && item.requiredImpact === 'extreme'));

    const mislabeledTinyExtreme = applyRelationshipDelta(
        { trust: 90, affection: 0, desire: 0, tension: 0 },
        { trust: 1 },
        'extreme',
        DEFAULT_RELATIONSHIP_CAPS,
        normalizeRelationshipProgress(),
        [
            { axis: 'trust', polarity: 1, threshold: 25, reason: 'Earlier.' },
            { axis: 'trust', polarity: 1, threshold: 50, reason: 'Earlier.' },
            { axis: 'trust', polarity: 1, threshold: 75, reason: 'Earlier.' },
        ],
    );
    assert.equal(mislabeledTinyExtreme.relationship.trust, 90);
    assert.equal(mislabeledTinyExtreme.milestoneCrossings.length, 0, 'an extreme label alone cannot unlock 90 with trivial raw evidence');
    assert.ok(mislabeledTinyExtreme.milestoneBlocks.some(item => item.threshold === 90 && item.requiredRaw === 6), 'the raw weight the 90 gate asks for is held to the extreme points (6)');
});

test('v0.2.11 milestone history is directional and legacy depth infers only thresholds already passed', () => {
    const legacy = normalizeRelationshipMilestones(undefined, { trust: 63, affection: 0, desire: 0, tension: 0 });
    assert.equal(relationshipMilestoneUnlocked(legacy, 'trust', 1, 25), true);
    assert.equal(relationshipMilestoneUnlocked(legacy, 'trust', 1, 50), true);
    assert.equal(relationshipMilestoneUnlocked(legacy, 'trust', 1, 75), false);
    assert.equal(relationshipMilestoneUnlocked(legacy, 'trust', -1, 25), false, 'deep trust never unlocks deep distrust');

    const manual = inferManualRelationshipMilestones([], { trust: -75, affection: 0, desire: 0, tension: 0 });
    assert.equal(relationshipMilestoneUnlocked(manual, 'trust', -1, 25), true);
    assert.equal(relationshipMilestoneUnlocked(manual, 'trust', -1, 50), true);
    assert.equal(relationshipMilestoneUnlocked(manual, 'trust', -1, 75), true, 'manual authority may establish the checkpoint itself');
    assert.equal(relationshipMilestoneUnlocked(manual, 'trust', 1, 25), false);
});

test('v0.2.11 movement toward neutral is never milestone-blocked and opposing evidence cancels hidden progress first', () => {
    const setback = applyRelationshipDelta(
        { trust: 75, affection: 0, desire: 0, tension: 0 },
        { trust: -2 },
        'meaningful',
        DEFAULT_RELATIONSHIP_CAPS,
        { trust: 0.7 },
        [
            { axis: 'trust', polarity: 1, threshold: 25, reason: 'Earlier.' },
            { axis: 'trust', polarity: 1, threshold: 50, reason: 'Earlier.' },
        ],
    );
    assert.equal(setback.milestoneBlocks.length, 0);
    assert.ok(setback.relationship.trust <= 75);
    assert.ok(setback.relationshipProgress.trust <= 0.7, 'contrary evidence consumes the old outward remainder before building the opposite direction');
});

test('v0.2.11 checkpoint-blocked evidence is retained for dedupe without replacing the last actual relationship change', () => {
    const npc = createNpcRecord('Myla');
    npc.relationship.trust = 25;
    npc.relationshipProgress.trust = 0;
    npc.relationshipMilestones = [];
    npc.lastRelationshipChange = {
        impact: 'meaningful',
        delta: { trust: 2, affection: 0, desire: 0, tension: 0 },
        evidence: { trust: 'Myla deliberately entrusted the player with her medicine.', affection: '', desire: '', tension: '' },
        reason: 'Myla entrusted the player with her medicine after he kept his earlier promise.',
        sourceMessageId: 8,
        turn: 4,
    };
    const previousLastChange = structuredClone(npc.lastRelationshipChange);
    const result = mergeScanResult({ npcs: [npc], turn: 5 }, { npcs: [{
        id: npc.id,
        name: 'Myla',
        present: true,
        relationshipImpact: 'ordinary',
        relationshipDelta: { trust: 1, affection: 0, desire: 0, tension: 0 },
        relationshipEvidence: { trust: 'The player again arrived exactly when promised.', affection: '', desire: '', tension: '' },
        relationshipChangeReason: 'The player again arrived exactly when promised.',
        relationshipSummary: 'Myla now treats the player as unquestionably central to her deepest trust.',
    }] }, {
        turn: 6,
        sourceMessageId: 12,
        developmentContext: 'The player again arrived exactly when promised, and Myla acknowledged his punctuality.',
    });
    const merged = result.state.npcs[0];
    assert.equal(merged.relationship.trust, 25);
    assert.equal(merged.relationshipProgress.trust, 0, 'blocked outward evidence must not bank behind the milestone');
    assert.deepEqual(merged.lastRelationshipChange, previousLastChange, 'blocked evidence is not an actual relationship change');
    assert.equal(merged.relationshipEventHistory.length, 1, 'blocked but valid evidence is still retained for replay dedupe');
    assert.match(merged.relationshipEventHistory[0].reason, /arrived exactly when promised/i);
    assert.doesNotMatch(merged.relationshipSummary, /unquestionably central|deepest trust/i, 'blocked evidence cannot advance relationship prose');
});
