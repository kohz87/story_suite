import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord, mergeScanResult } from '../../modules/people/core/core.js';
import { reconcileSocialState } from '../../modules/people/social/social.js';
import { state } from './profile-evolution-integrity.helpers.js';

test('fully proven collective bonds retire into named members while partial groups and unrelated unresolved bonds remain', () => {
    const parent = createNpcRecord('Mira Hest');
    parent.background = 'Mother of two twin daughters.';
    parent.keyRelationships = [
        'Twin Daughters — daughters | Raising and supervising her two twelve-year-old daughters.',
        'Late Husband — deceased spouse | Died in a scree fall during the previous winter.',
    ];
    let family = reconcileSocialState(state(parent), { provenance: 'scanner' }).state;
    const elda = createNpcRecord('Elda Hest');
    family.npcs.push(elda);
    family.npcs[0].keyRelationships.push('Elda Hest — daughter');
    family = reconcileSocialState(family, { provenance: 'scanner' }).state;
    assert.ok(family.npcs[0].keyRelationships.some(item => item.startsWith('Twin Daughters')));
    assert.ok(family.npcs[0].keyRelationships.some(item => item.startsWith('Late Husband')));
    assert.equal(family.socialGraph.unresolved.length, 1);

    const tessa = createNpcRecord('Tessa Hest');
    family.npcs.push(tessa);
    family.npcs[0].keyRelationships.push('Tessa Hest — daughter');
    family = reconcileSocialState(family, { provenance: 'scanner' }).state;
    const bonds = family.npcs[0].keyRelationships;
    assert.equal(family.socialGraph.unresolved.length, 0);
    assert.equal(bonds.some(item => item.startsWith('Twin Daughters')), false);
    assert.ok(bonds.some(item => /^Elda Hest — daughter/i.test(item)));
    assert.ok(bonds.some(item => /^Tessa Hest — daughter/i.test(item)));
    assert.ok(bonds.some(item => item.startsWith('Late Husband')));
    assert.ok(bonds.filter(item => /Elda Hest|Tessa Hest/.test(item)).every(item => /Raising and supervising/i.test(item)));
    assert.ok(family.socialGraph.edges.some(edge => edge.aToB === 'twin sibling' || edge.bToA === 'twin sibling'));
    const stable = structuredClone(family.npcs[0].keyRelationships);
    family = reconcileSocialState(family, { provenance: 'scanner' }).state;
    assert.deepEqual(family.npcs[0].keyRelationships, stable);

    const ambigParent = createNpcRecord('Mira Hest');
    ambigParent.background = 'Mother of two twin daughters.';
    ambigParent.keyRelationships = [
        'Twin Daughters — daughters | Raising and supervising her two twelve-year-old daughters.',
    ];
    let ambigFamily = state(ambigParent);
    ambigFamily.npcs.push(createNpcRecord('Elda Hest'), createNpcRecord('Tessa Hest'), createNpcRecord('Jane Hest'));
    ambigFamily.npcs[0].keyRelationships.push('Elda Hest — daughter', 'Tessa Hest — daughter', 'Jane Hest — daughter');
    ambigFamily = reconcileSocialState(ambigFamily, { provenance: 'scanner' }).state;
    assert.equal(ambigFamily.socialGraph.edges.some(edge => edge.aToB === 'twin sibling' || edge.bToA === 'twin sibling'), false);
});

test('collective twin label alone does not assign already-known daughters to the twin group', () => {
    const parent = createNpcRecord('Mira Hest');
    const elda = createNpcRecord('Elda Hest');
    const tessa = createNpcRecord('Tessa Hest');
    parent.keyRelationships = [
        'Twin Daughters — daughters | Raising and supervising her twins.',
        'Elda Hest — daughter',
        'Tessa Hest — daughter',
    ];

    const family = reconcileSocialState(state(parent, elda, tessa), {
        provenance: 'scanner',
        transcript: '',
    }).state;
    const parentBonds = family.npcs.find(npc => npc.id === parent.id).keyRelationships;
    assert.ok(parentBonds.some(item => item.startsWith('Twin Daughters')));
    const childEdges = family.socialGraph.edges.filter(edge => {
        const ids = new Set([edge.aId, edge.bId]);
        return ids.has(parent.id) && (ids.has(elda.id) || ids.has(tessa.id));
    });
    assert.equal(childEdges.length, 2);
    assert.ok(childEdges.every(edge => !edge.groupId && !edge.sharedDescriptor));
    assert.equal(family.socialGraph.edges.some(edge =>
        [elda.id, tessa.id].includes(edge.aId)
        && [elda.id, tessa.id].includes(edge.bId)
        && /twin sibling/i.test(`${edge.aToB} ${edge.bToA}`)), false);
});

test('already-identified same-scan twins recover collective membership and retire the generic bond', () => {
    const parent = createNpcRecord('Mira Hest');
    const elda = createNpcRecord('Elda Hest');
    const tessa = createNpcRecord('Tessa Hest');
    parent.background = 'Mother of two twin daughters.';
    parent.keyRelationships = [
        'Twin Daughters — daughters | Raising and supervising her two daughters.',
        'Elda Hest — daughter',
        'Tessa Hest — daughter',
        'Late Husband — deceased spouse | Died in a scree fall during the previous winter.',
    ];

    let family = mergeScanResult(state(parent, elda, tessa), {
        npcs: [],
        keyRelationshipEdges: [
            {
                aId: parent.id,
                bId: elda.id,
                aToB: 'daughter',
                bToA: 'mother',
                reason: "Elda is one of Mira Hest's twin daughters.",
            },
            {
                aId: parent.id,
                bId: tessa.id,
                aToB: 'daughter',
                bToA: 'mother',
                reason: "Tessa is one of Mira Hest's twin daughters.",
            },
        ],
    }, {
        turn: 2,
        sourceMessageId: 2,
        developmentContext: 'Mira Hest has two twin daughters. They are Elda Hest and Tessa Hest.',
    }).state;
    family = reconcileSocialState(family, {
        provenance: 'scanner',
        transcript: 'Mira Hest has two twin daughters. They are Elda Hest and Tessa Hest.',
    }).state;

    const parentBonds = family.npcs.find(npc => npc.id === parent.id).keyRelationships;
    assert.equal(parentBonds.some(item => item.startsWith('Twin Daughters')), false);
    assert.ok(parentBonds.some(item => /^Elda Hest — daughter/i.test(item)));
    assert.ok(parentBonds.some(item => /^Tessa Hest — daughter/i.test(item)));
    assert.ok(parentBonds.some(item => item.startsWith('Late Husband')));

    const childEdges = family.socialGraph.edges.filter(edge => edge.aId === parent.id || edge.bId === parent.id);
    const namedChildEdges = childEdges.filter(edge => [elda.id, tessa.id].includes(edge.aId) || [elda.id, tessa.id].includes(edge.bId));
    assert.equal(namedChildEdges.length, 2);
    assert.ok(namedChildEdges.every(edge => edge.groupId));
    assert.ok(namedChildEdges.every(edge => /twin/i.test(edge.sharedDescriptor)));
    assert.ok(family.socialGraph.edges.some(edge =>
        [elda.id, tessa.id].includes(edge.aId)
        && [elda.id, tessa.id].includes(edge.bId)
        && /twin sibling/i.test(`${edge.aToB} ${edge.bToA}`)));

    const stableBonds = structuredClone(parentBonds);
    const stableGraph = structuredClone(family.socialGraph);
    family = reconcileSocialState(family, {
        provenance: 'scanner',
        transcript: 'Mira Hest has two twin daughters. They are Elda Hest and Tessa Hest.',
    }).state;
    assert.deepEqual(family.npcs.find(npc => npc.id === parent.id).keyRelationships, stableBonds);
    assert.deepEqual(family.socialGraph, stableGraph);
});

test('explicit scanner edges still correct mother/daughter direction', () => {
    const parent = createNpcRecord('Mira Hest');
    const daughter = createNpcRecord('Elda Hest');
    parent.keyRelationships = ['Elda Hest — mother'];
    const corrected = mergeScanResult(state(parent, daughter), {
        npcs: [],
        keyRelationshipEdges: [{
            aId: parent.id,
            bId: daughter.id,
            aToB: 'daughter',
            bToA: 'mother',
            reason: "Elda is Mira Hest's daughter.",
        }],
    }, { turn: 2, sourceMessageId: 2, developmentContext: "Elda is Mira Hest's daughter." });
    assert.match(corrected.state.npcs[0].keyRelationships[0], /daughter/i);
    assert.match(corrected.state.npcs[1].keyRelationships[0], /mother/i);
});
