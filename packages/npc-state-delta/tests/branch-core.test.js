import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcRecord } from '../core.js';
import {
    bestAncestorState,
    chatLineage,
    fingerprintMessage,
    firstLineageDivergence,
    lineageCheckpointKey,
    ensureBranchParentAnchor,
    recordBranchCheckpoint,
    reconcileBranchState,
    setBranchProvenanceHint,
} from '../branch.js';
import { editorProfileLocks } from '../src/dossier-edit.js';
import { assistant, baseState, user } from './branch.helpers.js';

test('message fingerprint follows narrative content and ignores unstable swipe index numbering', () => {
    const a = assistant('Yunyun enters.', 0);
    const b = assistant('Yunyun leaves.', 0);
    const c = assistant('Yunyun enters.', 1);
    assert.notEqual(fingerprintMessage(a), fingerprintMessage(b));
    assert.equal(fingerprintMessage(a), fingerprintMessage(c), 'identical narrative content remains the same branch when swipe indices renumber');
    assert.equal(firstLineageDivergence(chatLineage([user('Hi'), a]), chatLineage([user('Hi'), c])), -1);
});

test('tail deletion restores the latest surviving checkpoint and removes downstream inline state', () => {
    const chat = [user('(OOC: add Yunyun)'), assistant('Yunyun waves.'), user('(OOC: add Wiz)')];
    const state = baseState();
    const yunyun = createNpcRecord('Yunyun');
    state.npcs = [yunyun];
    state.inlineCards = [{ messageId: 0, fingerprint: fingerprintMessage(chat[0]), cards: [{ id: yunyun.id, name: yunyun.name }] }];
    recordBranchCheckpoint(state, chat, 0, 'ooc');
    state.turn = 1;
    recordBranchCheckpoint(state, chat, 1, 'turn');
    const wiz = createNpcRecord('Wiz', state.npcs.map(n => n.id));
    state.npcs.push(wiz);
    state.inlineCards.push({ messageId: 2, fingerprint: fingerprintMessage(chat[2]), cards: [{ id: wiz.id, name: wiz.name }] });
    recordBranchCheckpoint(state, chat, 2, 'ooc');

    const surviving = chat.slice(0, 2);
    const result = reconcileBranchState(state, surviving);
    assert.equal(result.divergence, 2);
    assert.equal(result.restoredFromMessageId, 1);
    assert.deepEqual(result.state.npcs.map(n => n.name), ['Yunyun']);
    assert.deepEqual(result.state.inlineCards.map(entry => entry.messageId), [0, 2], 'sibling/tail inline snapshots remain stored even when inactive');
    const activeKey = lineageCheckpointKey(chatLineage(surviving), 1);
    assert.ok(result.state.checkpoints.some(item => item.lineageKey === activeKey));
});

test('swiping an assistant message rolls back to the checkpoint before that message', () => {
    const original = [user('(OOC: add Yunyun)'), assistant('Yunyun smiles.', 0), user('Continue'), assistant('Wiz appears.', 0)];
    const state = baseState();
    const yunyun = createNpcRecord('Yunyun');
    state.npcs = [yunyun];
    recordBranchCheckpoint(state, original, 0, 'ooc');
    state.turn = 1;
    yunyun.relationship.trust = 61;
    state.npcs = [yunyun];
    recordBranchCheckpoint(state, original, 1, 'scan');
    const wiz = createNpcRecord('Wiz', [yunyun.id]);
    state.npcs.push(wiz);
    state.turn = 2;
    recordBranchCheckpoint(state, original, 3, 'scan');

    const swiped = structuredClone(original);
    swiped[1] = assistant('Yunyun scowls instead.', 1);
    const result = reconcileBranchState(state, swiped, { explicitDivergence: 1 });
    assert.equal(result.divergence, 1);
    assert.equal(result.restoredFromMessageId, 0);
    assert.deepEqual(result.state.npcs.map(n => n.name), ['Yunyun']);
    assert.equal(result.state.npcs[0].relationship.trust, 0, 'old swipe relationship update must be removed');
    const activeKeys = new Set([lineageCheckpointKey(chatLineage(swiped), 0)]);
    assert.deepEqual(result.state.checkpoints.filter(item => activeKeys.has(item.lineageKey)).map(item => item.messageId), [0]);
    assert.ok(result.state.checkpoints.some(item => item.messageId === 1), 'old sibling checkpoint is retained for exact revisit');
});

test('v0.2.11 revisiting a previously scanned sibling swipe restores its exact snapshot without reconstruction', () => {
    const swipe0 = [user('Choose.'), assistant('Myla smiles and accepts the promise.', 0)];
    const state = baseState();
    const myla = createNpcRecord('Myla');
    state.npcs = [myla];
    ensureBranchParentAnchor(state, swipe0, 1, 'assistant-parent');
    state.npcs[0].relationship.trust = 61;
    state.npcs[0].relationshipProgress.trust = 0.65;
    state.lastScannedMessageId = 1;
    recordBranchCheckpoint(state, swipe0, 1, 'scan');

    const swipe1 = [user('Choose.'), assistant('Myla refuses and walks away.', 1)];
    const firstSwitch = reconcileBranchState(state, swipe1, { explicitDivergence: 1 });
    assert.equal(firstSwitch.exactRestored, false);
    firstSwitch.state.npcs[0].relationship.trust = 12;
    firstSwitch.state.npcs[0].relationshipProgress.trust = -0.4;
    firstSwitch.state.lastScannedMessageId = 1;
    recordBranchCheckpoint(firstSwitch.state, swipe1, 1, 'scan');

    const back = reconcileBranchState(firstSwitch.state, swipe0, { explicitDivergence: 1 });
    assert.equal(back.exactRestored, true);
    assert.equal(back.restoredFromMessageId, 1);
    assert.equal(back.state.npcs[0].relationship.trust, 61);
    assert.equal(back.state.npcs[0].relationshipProgress.trust, 0.65);

    const again = reconcileBranchState(back.state, swipe1, { explicitDivergence: 1 });
    assert.equal(again.exactRestored, true);
    assert.equal(again.state.npcs[0].relationship.trust, 12);
    assert.equal(again.state.npcs[0].relationshipProgress.trust, -0.4);
});

test('v0.2.11 sibling identity survives swipe-index renumbering after an alternate is deleted', () => {
    const original = [user('Choose.'), assistant('Myla nods.', 2)];
    const state = baseState();
    const myla = createNpcRecord('Myla');
    state.npcs = [myla];
    ensureBranchParentAnchor(state, original, 1, 'assistant-parent');
    state.npcs[0].relationship.affection = 44;
    state.lastScannedMessageId = 1;
    recordBranchCheckpoint(state, original, 1, 'scan');

    const renumbered = [user('Choose.'), assistant('Myla nods.', 0)];
    const restored = reconcileBranchState(state, renumbered, { explicitDivergence: 1, operation: 'swipe' });
    assert.equal(restored.exactRestored, false, 'identical narrative content needs no destructive sibling restore');
    assert.equal(restored.invalidated, false);
    assert.equal(restored.recoveryAction, 'content-unchanged');
    assert.equal(restored.state.npcs[0].relationship.affection, 44);
});

test('v0.2.11 branch restore overlays user-owned portrait/profile metadata without contaminating narrative relationship state', () => {
    const chat = [user('Wait.'), assistant('Myla agrees.', 0)];
    const state = baseState();
    const myla = createNpcRecord('Myla');
    myla.personality = 'Reserved.';
    state.npcs = [myla];
    ensureBranchParentAnchor(state, chat, 1, 'assistant-parent');
    state.npcs[0].relationship.trust = 20;
    recordBranchCheckpoint(state, chat, 1, 'scan');

    state.npcs[0].portraitPromptPositive = 'custom portrait override';
    state.npcs[0].retentionProtected = true;
    state.npcs[0].minor = true;
    state.npcs[0].importance = 77;
    state.npcs[0].manual = true;
    // The personality edit and its lock are written by the editor's own Save logic, not by hand.
    const edited = { ...structuredClone(state.npcs[0]), personality: 'Reserved and dryly humorous.' };
    Object.assign(state.npcs[0], { personality: edited.personality }, editorProfileLocks(state.npcs[0], edited, { protect: true }));
    state.npcs[0].relationship.trust = 88;

    const sibling = [user('Wait.'), assistant('Myla refuses.', 1)];
    const result = reconcileBranchState(state, sibling, { explicitDivergence: 1 });
    assert.equal(result.state.npcs[0].portraitPromptPositive, 'custom portrait override');
    assert.equal(result.state.npcs[0].minor, true);
    assert.equal(Object.prototype.hasOwnProperty.call(result.state.npcs[0], 'importance'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.state.npcs[0], 'manual'), false);
    assert.equal(result.state.npcs[0].personality, 'Reserved and dryly humorous.');
    assert.deepEqual(result.state.npcs[0].manualProfileFields, ['personality'], 'the lock itself survives the restore');
    assert.equal(result.state.npcs[0].relationship.trust, 0, 'relationship remains narrative branch state rather than user-metadata overlay');
});

test('branch checkpoints do not duplicate portrait binary data', () => {
    const chat = [user('(OOC: add Yunyun)')];
    const state = baseState();
    const yunyun = createNpcRecord('Yunyun');
    yunyun.portrait = { dataUrl: 'data:image/webp;base64,AAAA', mime: 'image/webp' };
    state.npcs = [yunyun];
    recordBranchCheckpoint(state, chat, 0, 'ooc');
    assert.equal(state.checkpoints[0].snapshot.npcs[0].portrait, null);
});

test('portrait attachment survives branch rollback when the NPC still exists', () => {
    const chat = [user('(OOC: add Yunyun)'), assistant('Yunyun smiles.', 0)];
    const state = baseState();
    const yunyun = createNpcRecord('Yunyun');
    state.npcs = [yunyun];
    recordBranchCheckpoint(state, chat, 0, 'ooc');
    state.npcs[0].portrait = { dataUrl: 'data:image/webp;base64,AAAA', mime: 'image/webp' };
    recordBranchCheckpoint(state, chat, 1, 'scan');

    const swiped = structuredClone(chat);
    swiped[1] = assistant('Yunyun looks away.', 1);
    const result = reconcileBranchState(state, swiped, { explicitDivergence: 1 });
    assert.equal(result.state.npcs[0].portrait.dataUrl, 'data:image/webp;base64,AAAA');
});


test('new chat branch can inherit the nearest checkpoint from a strongly verified common prefix', () => {
    const parentChat = [user('A'), assistant('B'), user('C'), assistant('D'), user('E')];
    const parent = baseState();
    parent.npcs = [createNpcRecord('Yunyun')];
    recordBranchCheckpoint(parent, parentChat, 1, 'scan');
    parent.lineage = chatLineage(parentChat);
    const branchChat = [user('A'), assistant('B'), user('C'), assistant('D'), user('Different continuation')];
    const parentKey = 'chat:card.png:parent';
    const childKey = 'chat:card.png:branch';
    setBranchProvenanceHint({ mainChat: 'parent', currentKey: childKey });
    const inherited = bestAncestorState({ [parentKey]: parent }, childKey, branchChat);
    setBranchProvenanceHint({});
    assert.ok(inherited);
    assert.equal(inherited.branchParent, parentKey);
    assert.equal(inherited.branchForkMessageId, 1);
    assert.deepEqual(inherited.npcs.map(n => n.name), ['Yunyun']);
});


test('branch rollback restores active state when a later death archive is reverted', () => {
    const chat = [user('Stay close.'), assistant('Luna nods.'), user('Continue'), assistant('Luna dies from her wounds.')];
    const state = baseState();
    const luna = createNpcRecord('Luna');
    luna.present = true;
    state.npcs = [luna];
    recordBranchCheckpoint(state, chat, 1, 'scan');
    state.npcs[0].archived = true;
    state.npcs[0].archiveReason = 'deceased';
    state.npcs[0].lifeState = 'deceased';
    state.npcs[0].lifeStateCertainty = 'explicit';
    state.npcs[0].present = false;
    recordBranchCheckpoint(state, chat, 3, 'scan');

    const reverted = chat.slice(0, 3);
    const result = reconcileBranchState(state, reverted, { explicitDivergence: 3 });
    assert.notEqual(result.state.npcs[0].lifeState, 'deceased');
    assert.equal(result.state.npcs[0].present, true);
});

test('branch checkpoints preserve and roll back lightweight NPC candidates', () => {
    const chat = [user('Enter the guild.'), assistant('A guild boy checks the side dock.'), user('Continue'), assistant('The same guild boy returns.')];
    const state = baseState();
    state.candidates = [{ id: 'candidate_guild-boy', name: 'Guild Boy', aliases: [], identityKind: 'role_label', dossierSignal: 'incidental', dossierReason: '', seenCount: 1, firstSeenTurn: 1, lastSeenTurn: 1, importance: 0 }];
    state.pendingBackfills = [{ npcId: 'npc_marris', label: 'receptionist', requestedMessageId: 1, requestedAt: 1 }];
    recordBranchCheckpoint(state, chat, 1, 'scan');
    state.candidates[0].seenCount = 2;
    state.pendingBackfills = [];
    state.candidates[0].lastSeenTurn = 2;
    recordBranchCheckpoint(state, chat, 3, 'scan');

    const reverted = chat.slice(0, 3);
    const result = reconcileBranchState(state, reverted, { explicitDivergence: 3 });
    assert.equal(result.state.candidates.length, 1);
    assert.equal(result.state.candidates[0].seenCount, 1);
    assert.equal(result.state.candidates[0].lastSeenTurn, 1);
    assert.equal(result.state.pendingBackfills.length, 1);
    assert.equal(result.state.pendingBackfills[0].label, 'receptionist');
});
