import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildInjection,
    estimateInjectionTokens,
    buildBehaviorGuidance,
    DEFAULT_BEHAVIOR_CRITERIA,
    createNpcRecord,
    selectRelevantNpcs,
    scoreNpcRelevance,
} from '../../modules/people/core/core.js';

test('selects recently relevant NPCs but injection is strictly presence-gated', () => {
    const yunyun = createNpcRecord('Yunyun'); yunyun.lastSeenTurn = 10; yunyun.mood = 'embarrassed'; yunyun.present = true; yunyun.personality = 'proud but earnest'; yunyun.speech = 'formal when nervous'; yunyun.mannerisms = ['boasts when embarrassed']; yunyun.keyRelationships = ['Megumin — friend / rival | competitive but loyal'];
    const wiz = createNpcRecord('Wiz'); wiz.lastSeenTurn = 2; wiz.present = false;
    const selected = selectRelevantNpcs([wiz, yunyun], 'Yunyun enters the guild.', 10, 1);
    assert.equal(selected[0].name, 'Yunyun');
    const injection = buildInjection([wiz, yunyun], 'Yunyun enters the guild.', 10, 3, 'CUSTOM BEHAVIOR RUBRIC');
    assert.match(injection, /Yunyun/);
    assert.match(injection, /personality: proud but earnest/);
    assert.match(injection, /speech: formal when nervous/);
    assert.match(injection, /mannerisms: boasts when embarrassed/);
    assert.match(injection, /bonds: Megumin — friend \/ rival \| competitive but loyal/);
    assert.match(injection, /CUSTOM BEHAVIOR RUBRIC/);
    assert.match(injection, /TOWARD PLAYER \(secondary\):/);
    assert.doesNotMatch(injection, /Wiz:/);
    yunyun.present = false;
    // Since 1.1.7 a mentioned absent NPC gets one reference line, never a dossier block.
    const offScreen = buildInjection([wiz, yunyun], 'Yunyun is mentioned off-screen.', 10, 3);
    assert.doesNotMatch(offScreen, /Yunyun: IDENTITY/);
    assert.match(offScreen, /- Yunyun \(mentioned, not present/);
});

test('behavior guidance interprets combinations rather than raw numbers alone', () => {
    const npc = createNpcRecord('Luna');
    npc.relationship = { trust: 75, affection: 70, desire: 65, tension: 72 };
    const guidance = buildBehaviorGuidance(npc);
    assert.match(guidance, /familiarity and strain coexist/);
    assert.match(guidance, /strong unresolved pressure/);
    assert.match(guidance, /strong trust/);
});

test('generation injection obeys approximate token budget and keeps identity/current state ahead of secondary relationship context', () => {
    const makeVerbose = (name) => {
        const npc = createNpcRecord(name);
        npc.present = true;
        npc.lastSeenTurn = 20;
        npc.role = 'adventurer '.repeat(30);
        npc.personality = 'proud earnest cautious warm competitive '.repeat(40);
        npc.speech = 'formal when nervous and clipped when defensive '.repeat(35);
        npc.mannerisms = Array.from({ length: 20 }, (_, i) => `habit-${i}-${'x'.repeat(30)}`);
        npc.relationshipSummary = 'long relationship context '.repeat(50);
        npc.goal = 'goal '.repeat(50);
        npc.status = 'status '.repeat(50);
        npc.location = 'location '.repeat(50);
        return npc;
    };
    const npcs = [makeVerbose('Yunyun'), makeVerbose('Wiz'), makeVerbose('Luna')];
    const budget = 700;
    const injection = buildInjection(npcs, 'Yunyun Wiz Luna are all in the room.', 20, 3, DEFAULT_BEHAVIOR_CRITERIA, budget);
    assert.ok(estimateInjectionTokens(injection) <= budget, `estimated injection should stay <= ${budget} tokens`);
    assert.match(injection, /TOWARD PLAYER \(secondary\):/);
    assert.match(injection, /Yunyun/);
});

test('very small injection budget drops lower-ranked present NPCs before corrupting top NPC essentials', () => {
    const yunyun = createNpcRecord('Yunyun'); yunyun.present = true; yunyun.lastSeenTurn = 10;
    const wiz = createNpcRecord('Wiz'); wiz.present = true; wiz.lastSeenTurn = 1;
    const injection = buildInjection([yunyun, wiz], 'Yunyun enters. Wiz follows.', 10, 2, DEFAULT_BEHAVIOR_CRITERIA, 512);
    assert.match(injection, /Yunyun/);
    assert.ok(estimateInjectionTokens(injection) <= 512);
});

test('v0.2.5 injection keeps identity ahead of high relationship scores and preserves target-general kindness', () => {
    const npc = createNpcRecord('Falia');
    npc.present = true;
    npc.lastSeenTurn = 9;
    npc.personality = 'Kind-hearted, rational, restrained, pragmatic, and independent.';
    npc.speech = 'Soft, measured, courteous, and concise under pressure.';
    npc.mannerisms = ['Makes small economical gestures.', 'Pauses briefly before difficult answers.'];
    npc.behaviorProfile = [
        'Disposition: Broadly considerate; avoids needless suffering.',
        'Expressiveness: Low; emotion alters attention and wording before overt display.',
        'Independence: High; keeps duties, boundaries, and personal judgment.',
        'Care: Practical and understated.',
    ];
    npc.relationship = { trust: 95, affection: 96, desire: 82, tension: 71 };
    const injection = buildInjection([npc], 'Falia', 10, 1, DEFAULT_BEHAVIOR_CRITERIA, 1800);
    assert.match(injection, /Personality sets identity/i);
    assert.match(injection, /Kind-hearted, rational, restrained/i);
    assert.match(injection, /Disposition: Broadly considerate/i);
    assert.match(injection, /cruelty to others/i);
    assert.match(injection, /tsundere/i);
    assert.ok(injection.indexOf('IDENTITY:') < injection.indexOf('TOWARD PLAYER (secondary):'), 'identity must constrain relationship interpretation, not follow it');
    assert.ok(estimateInjectionTokens(injection) <= 1800);
});

test('v0.2.6 minimum injection budget preserves every established identity channel plus agency', () => {
    const npc = createNpcRecord('Falia');
    npc.present = true;
    npc.lastSeenTurn = 20;
    npc.role = 'Hedge knight and scout';
    npc.goal = 'Protect the caravan while honoring her oath.';
    npc.keyRelationships = ['Talia — trusted friend | loyal', 'Rin — younger sister | deeply loved'];
    npc.personality = 'Kind-hearted, restrained, pragmatic, independent, and observant.';
    npc.behaviorProfile = ['Disposition: Broadly kind; avoids needless suffering.', 'Expressiveness: Low.', 'Independence: High.'];
    npc.speech = 'Soft, measured, courteous, and concise under pressure.';
    npc.mannerisms = ['Habitually pauses before difficult answers.', 'Usually makes small economical gestures.'];
    npc.relationship = { trust: 95, affection: 96, desire: 82, tension: 71 };
    const injection = buildInjection([npc], 'Falia', 20, 1, DEFAULT_BEHAVIOR_CRITERIA, 512);
    assert.ok(estimateInjectionTokens(injection) <= 512);
    for (const required of [/personality:/i, /behavioral profile:/i, /speech:/i, /mannerisms:/i, /role:/i, /goal:/i, /bonds:/i]) {
        assert.match(injection, required);
    }
    assert.ok(injection.indexOf('IDENTITY:') < injection.indexOf('TOWARD PLAYER (secondary):'));
});

test('v0.2.6 minimum injection compacts verbose behavior rules without starving cruelty and agency categories', () => {
    const npc = createNpcRecord('Falia Rendel');
    Object.assign(npc, {
        present: true,
        importance: 100,
        personality: 'Kind-hearted, rational, restrained, pragmatic, observant, independent, and duty-conscious.',
        speech: 'Soft, measured, courteous, and precise even under pressure.',
        mannerisms: ['Uses economical gestures', 'Pauses before difficult answers'],
        role: 'Hedge knight',
        goal: 'Protect the caravan without abandoning her other obligations.',
        keyRelationships: ['Mira: younger sister', 'Talia: trusted companion'],
        behaviorProfile: [
            'Disposition: broadly considerate toward strangers and allies; avoids needless humiliation.',
            'Cruelty: low; necessary force is acceptable, suffering for its own sake is not.',
            'Independence: high; affection does not become obedience or abandonment of duty.',
            'Care: practical and quiet; acts before verbal reassurance.',
            'Expressiveness: low; strong feelings first alter attention and wording.',
            'Conflict: controlled; disagreement remains courteous until force is necessary.',
        ],
        relationship: { trust: 92, affection: 96, desire: 71, tension: 68 },
    });
    const prompt = buildInjection([npc], 'Falia remains beside the player.', 100, 3, undefined, 512);
    assert.ok(estimateInjectionTokens(prompt) <= 512);
    assert.match(prompt, /Disposition:/i);
    assert.match(prompt, /Cruelty: low/i);
    assert.match(prompt, /Independence: high/i);
    assert.match(prompt, /speech:/i);
    assert.match(prompt, /mannerisms:/i);
    assert.match(prompt, /goal:/i);
    assert.match(prompt, /bonds:/i);
});

test('v0.2.7 short NPC names require whole normalized phrase matches for relevance', () => {
    const may = createNpcRecord('May');
    may.lastSeenTurn = 0;
    const falseScore = scoreNpcRelevance(may, 'Maybe the caravan should wait.', 10);
    const exactScore = scoreNpcRelevance(may, 'May tells the caravan to wait.', 10);
    assert.equal(exactScore - falseScore, 8, 'exact canonical name mention should receive the mention bonus');
    assert.equal(scoreNpcRelevance(may, 'Perhaps the caravan should wait.', 10), falseScore, 'substring text must not add any mention bonus');
});

test('v0.2.9 runtime injection makes identity and live state dominant over high relationship scores', () => {
    const npc = createNpcRecord('Falia Rendel');
    Object.assign(npc, {
        present: true,
        personality: 'Reserved, duty-bound, kind-hearted, pragmatic, and independent.',
        speech: 'Measured, formal, and concise.',
        behaviorProfile: ['Disposition: broadly kind.', 'Independence: high.', 'Conflict: controlled.'],
        mannerisms: ['Habitually pauses before difficult answers.'],
        goal: 'Protect the caravan even when doing so conflicts with personal wishes.',
        keyRelationships: ['Rin — younger sister | deeply loved'],
        mood: 'furious',
        status: 'wounded but functional',
        relationship: { trust: 95, affection: 96, desire: 82, tension: 71 },
    });
    const injection = buildInjection([npc], 'Falia refuses to leave the caravan.', 20, 1, DEFAULT_BEHAVIOR_CRITERIA, 900);
    assert.match(injection, /Personality sets identity/i);
    assert.match(injection, /Reserved, duty-bound, kind-hearted/i);
    assert.match(injection, /goal: Protect the caravan/i);
    assert.match(injection, /STATE: mood: furious; status: wounded but functional/i);
    assert.match(injection, /TOWARD PLAYER \(secondary\)/i);
    assert.ok(injection.indexOf('IDENTITY:') < injection.indexOf('TOWARD PLAYER (secondary):'));
    assert.ok(injection.indexOf('STATE:') < injection.indexOf('TOWARD PLAYER (secondary):'));
    assert.match(injection, /High scores never mean.*jealousy.*tsundere/i);
    assert.doesNotMatch(buildBehaviorGuidance(npc), /blush|stammer|possessive|tsundere/i);
});

test('v0.2.9 low relationship values do not occupy runtime space with four neutral axis explanations', () => {
    const npc = createNpcRecord('Marris Vale');
    npc.present = true;
    npc.personality = 'Quiet and observant.';
    npc.relationship = { trust: 12, affection: 8, desire: 0, tension: -5 };
    const injection = buildInjection([npc], 'Marris watches the road.', 5, 1, DEFAULT_BEHAVIOR_CRITERIA, 700);
    assert.match(injection, /mostly neutral or unsettled/i);
    assert.doesNotMatch(injection, /trust \+12|affection \+8|desire 0|tension -5/i);
});

test('v0.2.9 relevance recognizes a grounded first-name reference without restoring relationship-score salience', () => {
    const falia = createNpcRecord('Falia Rendel');
    falia.present = true;
    falia.lastSeenTurn = 1;
    falia.relationship = { trust: 0, affection: 0, desire: 0, tension: 0 };
    const selected = selectRelevantNpcs([falia], 'Falia steps between the caravan and the roadblock.', 100, 1);
    assert.equal(selected[0]?.id, falia.id);
});

test('v0.2.10 RP injection exposes one qualitative relationship lens and no raw meter numbers', () => {
    const npc = createNpcRecord('Falia Rendel');
    Object.assign(npc, {
        present: true,
        personality: 'Reserved, duty-bound, kind, and independent.',
        goal: 'Protect the caravan.',
        relationship: { trust: 92, affection: 90, desire: 72, tension: 35 },
        relationshipSummary: 'She cares deeply for the player but remains restrained and duty-bound.',
    });
    const injection = buildInjection([npc], 'Falia watches the caravan road.', 20, 1, DEFAULT_BEHAVIOR_CRITERIA, 900);
    assert.doesNotMatch(injection, /trust\s*[+-]?\d+|affection\s*[+-]?\d+|desire\s*[+-]?\d+|tension\s*[+-]?\d+/i);
    assert.equal((injection.match(/She cares deeply for the player but remains restrained and duty-bound\./g) || []).length, 1);
});

test('v0.2.12 hidden social graph affects salience but never leaks graph machinery or unresolved slots into RP injection', async () => {
    const { normalizeSocialGraph } = await import('../../modules/people/social/social.js');
    const brina = createNpcRecord('Brina');
    const liza = createNpcRecord('Liza', [brina.id]);
    brina.present = true;
    liza.present = false;
    const graph = normalizeSocialGraph({
        edges: [{ aId: brina.id, bId: liza.id, aToB: 'daughter', bToA: 'parent', confidence: 'explicit' }],
        unresolved: [{ ownerId: brina.id, relation: 'daughter', descriptor: 'younger', groupId: 'family_brina', confidence: 'explicit' }],
    });
    const injection = buildInjection([brina, liza], 'Liza is missing.', 10, 1, DEFAULT_BEHAVIOR_CRITERIA, 900, graph);
    assert.match(injection, /Brina/);
    assert.doesNotMatch(injection, /socialGraph|unresolved|groupId|slot_|family_brina/i);
});
