import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord } from '../core.js';
import {
    addUserDismissedGroup,
    clearUserDismissedGroupsFor,
    chatLineage,
    lineageCheckpointKey,
    lineageCheckpointKeys,
    ensureBranchParentAnchor,
    pruneBranchCheckpoints,
    recordBranchCheckpoint,
    reconcileBranchState,
    snapshotBranchState,
} from '../branch.js';
import { normalizeSocialGraph } from '../social.js';
import { readAheadOf } from '../scan-context.js';
import { skippedExchangesWindow, useTranscriptSource } from '../src/transcript.js';
import { assistant, baseState, user } from './branch.helpers.js';

test('v0.2.10 branch rollback restores fractional relationship progress and recent evidence history', () => {
    const chat = [user('Stay careful.'), assistant('Myla nods.', 0)];
    const state = baseState();
    const myla = createNpcRecord('Myla');
    myla.relationship.trust = 95;
    myla.relationshipProgress.trust = 0.7;
    myla.relationshipEventHistory = [{
        impact: 'ordinary', reason: 'The player returned Myla\'s medicine.',
        evidence: { trust: 'Returning the medicine proved the player dependable.', affection: '', desire: '', tension: '' },
        sourceMessageId: 0, turn: 1,
    }];
    state.npcs = [myla];
    recordBranchCheckpoint(state, chat, 0, 'scan');

    state.npcs[0].relationshipProgress.trust = 0.2;
    state.npcs[0].relationshipEventHistory.push({
        impact: 'ordinary', reason: 'A later unrelated promise.',
        evidence: { trust: 'The later promise was kept.', affection: '', desire: '', tension: '' },
        sourceMessageId: 1, turn: 2,
    });
    recordBranchCheckpoint(state, chat, 1, 'scan');

    const swiped = structuredClone(chat);
    swiped[1] = assistant('Myla refuses.', 1);
    const result = reconcileBranchState(state, swiped, { explicitDivergence: 1 });
    assert.equal(result.state.npcs[0].relationshipProgress.trust, 0.7);
    assert.equal(result.state.npcs[0].relationshipEventHistory.length, 1);
    assert.match(result.state.npcs[0].relationshipEventHistory[0].reason, /medicine/i);
});

test('v0.2.11 first-message sibling swipes restore from a clean root anchor and later revisit exact state', () => {
    const swipeA = [assistant('Myla smiles and offers her hand.', 0)];
    const stateA = baseState();
    ensureBranchParentAnchor(stateA, swipeA, 0, 'pre-first-swipe');
    const myla = createNpcRecord('Myla');
    myla.relationship.trust = 25;
    myla.relationshipProgress.trust = 0.4;
    stateA.npcs = [myla];
    stateA.turn = 1;
    recordBranchCheckpoint(stateA, swipeA, 0, 'scan-a');

    const swipeB = [assistant('Myla recoils and shuts the door.', 1)];
    const toB = reconcileBranchState(stateA, swipeB, { explicitDivergence: 0 });
    assert.equal(toB.exactRestored, false);
    assert.equal(toB.restoredFromRoot, true);
    assert.equal(toB.state.npcs.length, 0, 'unseen first-message sibling must not inherit narrative effects from swipe A');

    const stateB = toB.state;
    const mylaB = createNpcRecord('Myla');
    mylaB.relationship.trust = -3;
    stateB.npcs = [mylaB];
    stateB.turn = 1;
    recordBranchCheckpoint(stateB, swipeB, 0, 'scan-b');

    const backToA = reconcileBranchState(stateB, swipeA, { explicitDivergence: 0 });
    assert.equal(backToA.exactRestored, true);
    assert.equal(backToA.state.npcs[0].relationship.trust, 25);
    assert.equal(backToA.state.npcs[0].relationshipProgress.trust, 0.4);
});


test('v0.2.11 checkpoint pruning keeps a safe active anchor, recent active state, and recent sibling heads', () => {
    const activeChat = Array.from({ length: 30 }, (_, index) => index % 2 === 0
        ? user(`User line ${index}`)
        : assistant(`Assistant line ${index}`));
    const activeLineage = chatLineage(activeChat);
    const activeKeys = lineageCheckpointKeys(activeLineage);
    const snapshot = snapshotBranchState(baseState());
    const checkpoints = activeKeys.map((lineageKey, messageId) => ({
        messageId,
        fingerprint: activeLineage[messageId],
        lineageKey,
        parentLineageKey: messageId > 0 ? activeKeys[messageId - 1] : 'root',
        reason: 'active',
        createdAt: messageId + 1,
        snapshot,
    }));
    const siblingKeys = [];
    for (let i = 0; i < 20; i += 1) {
        const siblingChat = structuredClone(activeChat);
        siblingChat[29] = assistant(`Sibling ending ${i}`, i);
        const siblingLineage = chatLineage(siblingChat);
        const siblingKey = lineageCheckpointKey(siblingLineage, 29);
        siblingKeys.push(siblingKey);
        checkpoints.push({
            messageId: 29,
            fingerprint: siblingLineage[29],
            lineageKey: siblingKey,
            parentLineageKey: lineageCheckpointKey(siblingLineage, 28),
            reason: 'sibling',
            createdAt: 1000 + i,
            snapshot,
        });
    }

    const pruned = pruneBranchCheckpoints(checkpoints, activeLineage, 16);
    const kept = new Set(pruned.map(item => item.lineageKey));
    assert.equal(pruned.length, 16);
    assert.ok(kept.has(activeKeys[0]), 'oldest active anchor must survive bounded pruning');
    assert.ok(kept.has(activeKeys.at(-1)), 'latest active checkpoint must survive bounded pruning');
    for (const siblingKey of siblingKeys.slice(-4)) assert.ok(kept.has(siblingKey), 'newest sibling heads should retain a bounded exact-restore cache');
});

test('v0.2.11 permanent UI deletion suppression survives exact sibling restore and explicit re-add can lift the whole alias group', () => {
    const chat = [user('Enter.'), assistant('The innkeeper Brina greets you.')];
    const state = baseState();
    const brina = createNpcRecord('Brina Hael');
    brina.aliases = ['the innkeeper', 'Brina'];
    state.npcs = [brina];
    recordBranchCheckpoint(state, chat, 1, 'scan');

    state.userDismissedGroups = addUserDismissedGroup([], brina);
    state.npcs = [];
    state.dismissed = ['brina hael', 'the innkeeper', 'brina'];
    const restored = reconcileBranchState(state, chat, { explicitDivergence: 1, operation: 'swipe' });
    assert.equal(restored.exactRestored, false, 'identical narrative content does not need a destructive sibling restore');
    assert.equal(restored.invalidated, false);
    assert.equal(restored.state.npcs.length, 0, 'an old sibling snapshot cannot resurrect a dossier explicitly deleted in the UI');
    assert.ok(!restored.state.dismissed.includes('brina hael'), 'modern ID tombstones must not globally suppress future homonyms by label');

    const cleared = clearUserDismissedGroupsFor(restored.state.userDismissedGroups, brina, { modernByIdOnly: true });
    assert.equal(cleared.groups.length, 0);
    assert.ok(cleared.removedLabels.includes('brina hael'));
    assert.ok(cleared.removedLabels.includes('the innkeeper'));
});

test('v0.2.12 exact sibling restore includes hidden social graph and unresolved family slots', () => {
    const swipe0 = [user('Continue.'), assistant('Brina mentions her daughters.', 0)];
    const state = baseState();
    const brina = createNpcRecord('Brina');
    const liza = createNpcRecord('Liza', [brina.id]);
    state.npcs = [brina, liza];
    ensureBranchParentAnchor(state, swipe0, 1, 'assistant-parent');
    state.socialGraph = normalizeSocialGraph({
        edges: [{ aId: brina.id, bId: liza.id, aToB: 'daughter', bToA: 'parent', confidence: 'explicit' }],
        unresolved: [{ ownerId: brina.id, relation: 'daughter', groupId: 'family_brina', descriptor: 'younger', confidence: 'explicit' }],
    });
    recordBranchCheckpoint(state, swipe0, 1, 'scan');

    const swipe1 = [user('Continue.'), assistant('Brina says she never had children.', 1)];
    const switched = reconcileBranchState(state, swipe1, { explicitDivergence: 1 });
    switched.state.socialGraph = normalizeSocialGraph();
    recordBranchCheckpoint(switched.state, swipe1, 1, 'scan');

    const back = reconcileBranchState(switched.state, swipe0, { explicitDivergence: 1 });
    assert.equal(back.exactRestored, true);
    assert.equal(back.state.socialGraph.edges.length, 1);
    assert.equal(back.state.socialGraph.unresolved.length, 1);
    assert.equal(back.state.socialGraph.unresolved[0].descriptor, 'younger');
});

test('v0.2.12 permanent dismissal strips restored graph edges and stale structured family references', () => {
    const chat = [user('Continue.'), assistant('Brina and Liza speak.', 0)];
    const state = baseState();
    const brina = createNpcRecord('Brina');
    const liza = createNpcRecord('Liza', [brina.id]);
    brina.keyRelationships = ['Liza — daughter'];
    state.npcs = [brina, liza];
    state.socialGraph = normalizeSocialGraph({ edges: [{ aId: brina.id, bId: liza.id, aToB: 'daughter', bToA: 'parent', confidence: 'explicit' }] });
    ensureBranchParentAnchor(state, chat, 1, 'assistant-parent');
    recordBranchCheckpoint(state, chat, 1, 'scan');
    state.userDismissedGroups = addUserDismissedGroup([], liza);

    const changed = [user('Continue.'), assistant('Brina and Liza speak differently.', 1)];
    const restored = reconcileBranchState(state, changed, { explicitDivergence: 1 });
    assert.equal(restored.state.npcs.some(npc => npc.id === liza.id), false);
    assert.equal(restored.state.socialGraph.edges.some(edge => edge.aId === liza.id || edge.bId === liza.id), false);
    const savedBrina = restored.state.npcs.find(npc => npc.id === brina.id);
    assert.equal(savedBrina.keyRelationships.some(entry => /Liza/.test(entry)), false);
});

test('a fail-closed restore (an edit of an old reply, a middle delete) leaves the next scan reading the latest reply only', () => {
    const u = t => ({ is_user: true, is_system: false, name: 'User', mes: `user-${t}`, send_date: `ud${t}` });
    const b = (t, v = 'A') => ({ is_user: false, is_system: false, name: 'Narrator', mes: `assistant-${t}-${v}`, send_date: `ad${t}${v}`, extra: { gen_id: `g${t}${v}` } });
    const original = [];
    for (let t = 0; t < 10; t += 1) { original.push(u(t)); original.push(b(t)); }
    const makeState = () => {
        const state = baseState();
        state.npcs = [createNpcRecord('Seren Lowen')];
        state.turn = 10; state.lastScannedMessageId = 19; state.scanCount = 4;
        state.lineage = chatLineage(original);
        state.rollbackHead = { seq: 0, messageId: 19, lineageKey: lineageCheckpointKey(state.lineage, 19), snapshot: structuredClone({ ...state, checkpoints: [], rollbackJournal: [] }) };
        return state;
    };
    for (const [mutate, opts] of [
        [c => { c[5] = { ...c[5], mes: 'assistant-2-EDITED' }; return c; }, { operation: 'auto' }],
        [c => { c[5] = { ...c[5], mes: 'assistant-2-EDITED' }; return c; }, { explicitDivergence: 5, operation: 'edit' }],
        [c => { c.splice(4, 2); return c; }, { explicitDivergence: 4, operation: 'delete' }],
    ]) {
        const next = mutate(original.slice());
        const restored = reconcileBranchState(makeState(), next, opts);
        useTranscriptSource({ context: () => ({ chat: next, name1: 'User', name2: 'Narrator' }), scanDepth: () => 6 });
        const last = next.length - 1;
        const marker = restored.state.lastScannedMessageId;
        const window = skippedExchangesWindow(last, { afterId: marker, replies: 1, limit: 6, fresh: false });
        const reread = window ? [...window.transcript.matchAll(/assistant-(\d+)-A/g)].map(m => Number(m[1])) : [];
        assert.ok(!reread.length || marker === null || reread.every(t => t >= 9), `the next scan re-reads applied replies: ${reread}`);
        assert.ok(marker === null || marker >= last - 1 || restored.exactRestored, `marker ${marker}`);
    }
});

test('1.10.0 an edit of an old reply forgets the replies read ahead from it on, and keeps the ones before it', () => {
    const u = t => ({ is_user: true, is_system: false, name: 'User', mes: `user-${t}`, send_date: `ud${t}` });
    const b = (t, v = 'A') => ({ is_user: false, is_system: false, name: 'Narrator', mes: `assistant-${t}-${v}`, send_date: `ad${t}${v}`, extra: { gen_id: `g${t}${v}` } });
    const original = [];
    for (let t = 0; t < 10; t += 1) { original.push(u(t)); original.push(b(t)); }
    const state = baseState();
    state.npcs = [createNpcRecord('Seren Lowen')];
    state.turn = 10; state.lastScannedMessageId = 3; state.readAhead = [7, 13, 17]; state.scanCount = 4;
    state.lineage = chatLineage(original);
    state.rollbackHead = { seq: 0, messageId: 19, lineageKey: lineageCheckpointKey(state.lineage, 19), snapshot: structuredClone({ ...state, checkpoints: [], rollbackJournal: [] }) };
    const edited = original.slice();
    edited[11] = { ...edited[11], mes: 'assistant-5-EDITED' };
    const restored = reconcileBranchState(state, edited, { explicitDivergence: 11, operation: 'edit' });
    assert.equal(restored.exactRestored, false, 'a fail-closed restore');
    // 1.10.0 review: the fail-closed restore keeps the current state, which already holds the replies read ahead past the edit, so the
    // marker and the read-ahead list are reset as in 1.9.0 (the next scan reads the latest reply only; nothing is read a second time).
    assert.equal(restored.state.lastScannedMessageId, null, 'the marker is reset');
    assert.deepEqual(restored.state.readAhead, [], 'the replies read ahead are not read again');
});

test('1.10.0 a fail-closed restore after a manual scan read ahead: the next scan does not read the read-ahead replies again', () => {
    const u = t => ({ is_user: true, is_system: false, name: 'User', mes: `user-${t}`, send_date: `ud${t}` });
    const b = (t, v = 'A') => ({ is_user: false, is_system: false, name: 'Narrator', mes: `assistant-${t}-${v}`, send_date: `ad${t}${v}`, extra: { gen_id: `g${t}${v}` } });
    const original = [];
    for (let t = 0; t < 10; t += 1) { original.push(u(t)); original.push(b(t)); }
    // Replies 2..5 waited; a manual scan read 6..9 (messages 13..19): marker 3, read ahead [13,15,17,19].
    const makeState = () => {
        const state = baseState();
        state.turn = 10; state.scanCount = 4; state.lastScannedMessageId = 3; state.readAhead = [13, 15, 17, 19];
        state.lineage = chatLineage(original);
        state.rollbackHead = { seq: 0, messageId: 19, lineageKey: lineageCheckpointKey(state.lineage, 19), snapshot: structuredClone({ ...state, checkpoints: [], rollbackJournal: [] }) };
        return state;
    };
    for (const [label, mutate, opts] of [
        ['edit of a waiting reply', c => { c[9] = { ...c[9], mes: 'assistant-4-EDITED' }; return c; }, { explicitDivergence: 9, operation: 'edit' }],
        ['edit of a read-ahead reply', c => { c[13] = { ...c[13], mes: 'assistant-6-EDITED' }; return c; }, { explicitDivergence: 13, operation: 'edit' }],
        ['delete of a middle user message', c => { c.splice(8, 1); return c; }, { explicitDivergence: 8, operation: 'delete' }],
    ]) {
        const next = mutate(original.slice());
        const restored = reconcileBranchState(makeState(), next, opts);
        assert.equal(restored.exactRestored, false, `${label}: fail-closed`);
        useTranscriptSource({ context: () => ({ chat: next, name1: 'User', name2: 'Narrator' }), scanDepth: () => 6 });
        const window = skippedExchangesWindow(next.length - 1, { afterId: restored.state.lastScannedMessageId, replies: 1, limit: 6, fresh: false, skip: readAheadOf(restored.state) });
        const reread = window ? [...window.transcript.matchAll(/assistant-(\d+)-A/g)].map(m => Number(m[1])).filter(t => t >= 6 && t < 9) : [];
        assert.deepEqual(reread, [], `${label}: reads applied replies again: ${reread} (marker ${restored.state.lastScannedMessageId}, readAhead ${JSON.stringify(restored.state.readAhead)})`);
    }
});
