import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DURABLE_PROFILE_LIMITS,
    createNpcRecord,
    mergeScanResult,
    resolveInterimIdentityPromotions,
    normalizeNpcRecord,
    normalizeRelationshipCaps,
    normalizeRelationshipBaseline,
    normalizeScanNpc,
} from '../core.js';

test('v0.2.5 behavior profile stays compact, labeled, and category-stable', () => {
    const npc = normalizeNpcRecord({
        name: 'Falia',
        behaviorProfile: [
            'Disposition: Kind-hearted and broadly considerate.',
            'Expressiveness: Low; strong feelings show through small changes first.',
            'Disposition: Kind but pragmatic; avoids needless suffering.',
            'Independence: High; affection does not create obedience.',
            'Care: Practical and understated.',
            'Conflict: Controlled and direct.',
            'Cruelty-Social: Low; necessary force is not an excuse for humiliation.',
            'Vulnerability: Private and deliberate.',
        ],
    });
    assert.equal(npc.behaviorProfile.length, 6);
    assert.equal(npc.behaviorProfile.filter(item => /^Disposition:/i.test(item)).length, 1);
    assert.match(npc.behaviorProfile[0], /Kind but pragmatic/i, 'newer same-category rule should replace the older wording');
    assert.ok(npc.behaviorProfile.every(item => item.length <= DURABLE_PROFILE_LIMITS.behaviorProfile));
});

test('v0.2.6 refine cannot smuggle cruelty into an established kind disposition', () => {
    const npc = createNpcRecord('Falia');
    npc.personality = 'Kind-hearted, restrained, pragmatic, and independent.';
    npc.behaviorProfile = ['Disposition: Broadly kind; avoids needless suffering.', 'Expressiveness: Low.'];
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 4 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            personalityState: 'refine',
            personality: 'Kind-hearted, restrained, pragmatic, independent, and cruel toward strangers who inconvenience her.',
            behaviorProfileState: 'refine',
            behaviorProfile: ['Cruelty-Social: Cruel and merciless toward outsiders.'],
        }],
    }, { turn: 5 });
    assert.equal(result.state.npcs[0].personality, 'Kind-hearted, restrained, pragmatic, and independent.');
    assert.deepEqual(result.state.npcs[0].behaviorProfile, ['Disposition: Broadly kind; avoids needless suffering.', 'Expressiveness: Low.']);
});

test('v0.2.6 first-pass behavior profile cannot contradict an established kind personality with generic cruelty', () => {
    const result = mergeScanResult({ npcs: [], candidates: [], turn: 0 }, { npcs: [{
        name: 'Selene Voss',
        identityKind: 'proper_name',
        dossierSignal: 'meaningful',
        present: true,
        personality: 'Kind-hearted, pragmatic, restrained, and compassionate.',
        behaviorProfile: [
            'Disposition: Broadly kind; avoids needless suffering.',
            'Cruelty-Social: Cruel and merciless toward people who are not close to her.',
            'Independence: High; keeps her own judgment.',
        ],
    }] }, { turn: 1 });
    assert.equal(result.state.npcs.length, 1);
    assert.ok(result.state.npcs[0].behaviorProfile.some(item => /Disposition: Broadly kind/i.test(item)));
    assert.ok(result.state.npcs[0].behaviorProfile.some(item => /Independence: High/i.test(item)));
    assert.ok(!result.state.npcs[0].behaviorProfile.some(item => /Cruel and merciless/i.test(item)));
});


test('v0.2.7 scanner boolean coercion treats string false as false instead of JavaScript truthy', () => {
    const existing = createNpcRecord('Marris');
    existing.id = 'npc_marris';
    const result = mergeScanResult({ npcs: [existing], candidates: [], turn: 1 }, { npcs: [{
        id: existing.id,
        present: 'false',
        worldActive: 'false',
        directInteraction: 'false',
        relationshipImpact: 'none',
        relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
    }] }, { turn: 2 });
    assert.equal(result.state.npcs[0].present, false);
    assert.equal(result.state.npcs[0].worldActive, false);

    const role = createNpcRecord('Gate Clerk');
    role.id = 'npc_gate_clerk';
    role.identityKind = 'role_label';
    const resolved = resolveInterimIdentityPromotions({ npcs: [{
        name: 'May Rill', identityKind: 'proper_name', sameIndividual: 'false',
    }] }, [role], []);
    assert.equal(resolved.npcs[0].sameIndividual, 'false', 'resolver preserves raw scanner payload; normalization owns coercion');
    const fused = mergeScanResult({ npcs: [role], candidates: [], turn: 1 }, resolved, { turn: 2 });
    assert.equal(fused.state.npcs.some(npc => npc.id === role.id && npc.name === 'May Rill'), false, 'string false must not authorize identity fusion');
});

test('v0.2.7 negated cruelty wording does not neutralize established kind-personality protection', () => {
    const npc = createNpcRecord('Falia');
    npc.personality = 'Kind-hearted, pragmatic, restrained, and never cruel.';
    npc.behaviorProfile = ['Disposition: Broadly kind; avoids needless suffering.', 'Cruelty-Social: Not cruel; avoids unnecessary suffering.'];
    const result = mergeScanResult({ npcs: [npc], candidates: [], turn: 1 }, {
        npcs: [],
        profileUpdates: [{
            id: npc.id,
            behaviorProfileState: 'refine',
            behaviorProfile: ['Cruelty-Social: Cruel and merciless toward outsiders.'],
        }],
    }, { turn: 2 });
    assert.ok(result.state.npcs[0].behaviorProfile.some(item => /Not cruel|avoids unnecessary suffering/i.test(item)));
    assert.ok(!result.state.npcs[0].behaviorProfile.some(item => /Cruel and merciless/i.test(item)));
});

test('v0.2.7 quoted false legacy scanner flags do not clear or evolve state', () => {
    const normalized = normalizeScanNpc({
        name: 'Marris',
        clearMood: 'false', clearLocation: 'false', clearGoal: 'false', clearStatus: 'false',
        evolvePersonality: 'false', evolveSpeech: 'false', evolveMannerisms: 'false', evolveKeyRelationships: 'false',
    });
    assert.equal(normalized.moodState, '');
    assert.equal(normalized.locationState, '');
    assert.equal(normalized.goalState, '');
    assert.equal(normalized.statusState, '');
    assert.equal(normalized.personalityState, 'keep');
    assert.equal(normalized.speechState, 'keep');
    assert.equal(normalized.mannerismState, 'keep');
    assert.equal(normalized.keyRelationshipsState, 'keep');
});

test('v0.2.7 malformed relationship scores and caps fall back safely instead of becoming negative extremes', () => {
    assert.deepEqual(normalizeRelationshipBaseline({ trust: 'high', affection: null, desire: 'NaN', tension: undefined }), {
        trust: 0, affection: 0, desire: 0, tension: 0,
    });
    assert.deepEqual(normalizeRelationshipCaps({ ordinary: 'many', meaningful: NaN, major: 'huge', extreme: null }), {
        ordinary: 1, meaningful: 2, major: 3, extreme: 6,
    });

    const stored = normalizeNpcRecord({ name: 'Falia', relationship: { trust: 'high' }, importance: 'important', manual: true });
    assert.equal(stored.relationship.trust, 0);
    assert.equal(Object.prototype.hasOwnProperty.call(stored, 'importance'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(stored, 'manual'), false);

    const existing = createNpcRecord('Falia');
    existing.importance = 77;
    existing.manual = true;
    const merged = mergeScanResult({ npcs: [existing], turn: 1 }, { npcs: [{ id: existing.id, importance: 100 }] }, { turn: 2 });
    assert.equal(Object.prototype.hasOwnProperty.call(merged.state.npcs[0], 'importance'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(merged.state.npcs[0], 'manual'), false);
});

test('v0.2.8 player-specific or intimacy-specific incidents cannot become global Behavioral Profile canon', () => {
    const npc = normalizeNpcRecord({
        name: 'Brina Hael',
        personality: 'Pragmatic, composed, and maternal.',
        behaviorProfile: [
            'Family First: Sacrifices personal pride and works tirelessly to feed, shelter, and clothe her twin daughters.',
            'Frontier Pragmatism: Treats business and private intimacy with Lucien transactionally when it benefits her household.',
        ],
    });
    assert.equal(npc.behaviorProfile.length, 1);
    assert.match(npc.behaviorProfile[0], /Family First/i);
    assert.doesNotMatch(npc.behaviorProfile.join(' '), /intimacy|Lucien/i);
});

test('v0.2.8 Behavioral Profile compacts overlapping conflict rules into one reusable pattern', () => {
    const npc = normalizeNpcRecord({
        name: 'Maren Rost',
        behaviorProfile: [
            'Conflict: controlled and restrained.',
            'Anger: remains composed rather than explosive.',
            'Composure: becomes quieter and firmer when irritated.',
        ],
    });
    assert.equal(npc.behaviorProfile.length, 1);
    assert.match(npc.behaviorProfile[0], /controlled/i);
    assert.match(npc.behaviorProfile[0], /quieter and firmer/i);
});
