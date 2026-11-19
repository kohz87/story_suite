import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { partsSource } from './helpers/parts-source.js';
import { encodeRetiredStateFilePayload, decodeStateFilePayload, makeNpcStateRecoveryFileName } from '../../modules/people/storage/storage.js';
import { runtimeSource } from './helpers/runtime-source.js';

const index = runtimeSource();
const runtimeState = fs.readFileSync(new URL('../../modules/people/runtime/runtime-state.js', import.meta.url), 'utf8');
const identity = partsSource('identity.js');
const ci = fs.readFileSync(new URL('../../docs/history/packages/npc-state-delta/.github/workflows/ci.yml', import.meta.url), 'utf8');

test('group identity takes precedence over host chatId and pending identities are noncanonical', () => {
    assert.match(identity, /if \(hasGroup\)/);
    assert.match(identity, /buildQualifiedChatKey\('group', ownerId, raw\)/);
    assert.match(identity, /group-pending:/);
    assert.match(index, /return isQualifiedChatKey\(key\)/);
});

test('delete and hydration use ownership epochs and stale loader cannot clear a newer promise', () => {
    assert.match(runtimeState, /ownershipEpochs: new Map\(\)/);
    const lifecycleCache = index.slice(index.indexOf('function clearLifecycleCacheKey'), index.indexOf('async function loadLatestLifecycleState'));
    assert.match(lifecycleCache, /bumpOwnershipEpoch\(key\)/);
    assert.match(lifecycleCache, /cancelScanOperation\(key, reason\)/);
    assert.match(index, /clearLifecycleCacheKey\(key, 'chat-deleted'\)/);
    assert.match(index, /assertOwnershipEpoch\(key, epoch\)/);
    assert.match(index, /if \(loadingChatStates\.get\(key\) === task\) loadingChatStates\.delete\(key\)/);
    assert.match(index, /if \(!ownershipEpochCurrent\(key, epoch\)\) return written/);
});

test('retired sidecars are explicit durable tombstones', () => {
    const payload = decodeStateFilePayload(encodeRetiredStateFilePayload('chat:x', 'deleted', '0.2.15'));
    assert.equal(payload.retired, true);
    assert.equal(payload.chatKey, 'chat:x');
    assert.equal(payload.retireReason, 'deleted');
    assert.match(makeNpcStateRecoveryFileName('chat:x', 123), /^ppl-recovery-/);
    assert.match(index, /retireNpcStateDataFile\(\{ chatKey: key, pointer, reason: 'chat-deleted'/);
});

test('rename uses event groupId and writes a recovery backup before retiring predecessor', () => {
    const fn = index.slice(index.indexOf('async function moveRenamedChatState'), index.indexOf('function flushCurrentChatOnPageHide'));
    assert.match(fn, /eventData\.groupId/);
    const recovery = fn.indexOf('makeNpcStateRecoveryFileName(oldKey)');
    const retire = fn.indexOf('retireNpcStateDataFile');
    const switchOwnership = fn.indexOf('settings.dataFiles[newKey] = newPointer');
    assert.ok(recovery >= 0 && retire > recovery && switchOwnership > retire);
});

test('broken sidecar recovery is explicit rather than silently destructive', () => {
    assert.match(index, /async function detachBrokenSidecar/);
    assert.match(index, /Detach Broken Sidecar/);
    assert.match(index, /settings\.recoveryFiles\[key\]/);
    assert.match(index, /settings\.sidecarTombstones\[key\]/);
});

test('CI is version-neutral and uses Node 24 actions', () => {
    assert.match(ci, /actions\/checkout@v5/);
    assert.match(ci, /actions\/setup-node@v5/);
    assert.match(ci, /node-version: 24/);
    assert.doesNotMatch(ci, /apply_v0214_hardening|v0\.2\.14 hardening|Sync v0\.2\.14/);
});
