import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { partsSource } from './helpers/parts-source.js';
import { pruneFormPortraitAssetsForState, prunePortraitAssetsForState } from '../../modules/people/storage/storage.js';
import { buildQualifiedChatKey } from '../../modules/people/core/identity.js';
import { runtimeSource } from './helpers/runtime-source.js';

const index = runtimeSource().replace(/\r\n/g, '\n');
const ci = fs.readFileSync(new URL('../../docs/history/packages/npc-state-delta/.github/workflows/ci.yml', import.meta.url), 'utf8');


// B4-10a: no checkpoints are kept, so a portrait is kept only for a live record (a checkpoint a saved state still carries counts for nothing).
test('portrait GC removes unreachable and manually deleted assets, and keeps only live ones', () => {
    const state = {
        npcs: [{ id: 'live' }, { id: 'deleted' }],
        checkpoints: [{ snapshot: { npcs: [{ id: 'branch-old' }] } }],
        userDismissedGroups: [{ ids: ['deleted'] }],
        portraitAssets: {
            live: { dataUrl: 'data:image/webp;base64,AA==' },
            'branch-old': { dataUrl: 'data:image/webp;base64,AQ==' },
            deleted: { dataUrl: 'data:image/webp;base64,Ag==' },
            orphan: { dataUrl: 'data:image/webp;base64,Aw==' },
        },
    };
    assert.deepEqual(Object.keys(prunePortraitAssetsForState(state)).sort(), ['live']);
});

// While the store holds the chat it can bring back a person the state no longer holds (a swipe back, a delete of the reply that removed them),
// and their form pictures live only in NPC State's memory: noteChatLineage keeps them (keepHeld), a person the reader deleted still loses them.
test('portrait GC while the store holds the chat keeps the pictures of people it can bring back, not of a deleted one', () => {
    const png = 'data:image/webp;base64,AA==';
    const state = {
        npcs: [{ id: 'live' }],
        userDismissedGroups: [{ ids: ['deleted'] }],
        portraitAssets: { live: { dataUrl: png }, gone: { dataUrl: png }, deleted: { dataUrl: png } },
        formPortraitAssets: { gone: { fox: { dataUrl: png } }, deleted: { fox: { dataUrl: png } } },
    };
    assert.deepEqual(Object.keys(prunePortraitAssetsForState(state, { keepHeld: true })).sort(), ['gone', 'live']);
    assert.deepEqual(Object.keys(pruneFormPortraitAssetsForState(state, { keepHeld: true })), ['gone']);
    assert.deepEqual(Object.keys(pruneFormPortraitAssetsForState(state)), [], 'without the store only live people keep them');
    const runtime = runtimeSource();
    assert.match(runtime, /prunePortraitAssetsInPlace\(state, \{ keepHeld: storeOwnsState\(\) === 'hosted' \}\);/);
});

test('tombstones override stale live pointers before hydration', () => {
    assert.match(index, /ignored live sidecar pointer for tombstoned/);
    assert.match(index, /delete settings\.dataFiles\[key\];\r?\n\s*pointer = null/);
});

test('durable hydration starts clean while an undurable recovery remains pending', () => {
    assert.match(index, /if \(loaded && !loadedUndurable\) persistedVersions\.set/);
});

test('chat cache has bounded eviction and refuses to evict active work', () => {
    assert.match(index, /const CHAT_CACHE_LIMIT = 6/);
    assert.match(index, /function evictDormantChatStates/);
    assert.match(index, /if \(chatStateCache\.size <= cap\) break/);
    assert.doesNotMatch(index, /chatStateCache\.size - removed <= cap/);
    assert.match(index, /stateWriteTimers\.has\(key\) \|\| stateWritePromises\.has\(key\) \|\| loadingChatStates\.has\(key\) \|\| isScanBusy\(key\)/);
});

test('lifecycle lookup prefers known owner state and fails closed on ambiguous suffixes', () => {
    assert.match(index, /resolveOwnedLifecycleKey\(candidates, kind, id, resolvedOwner, ownerWasProvided\)/);
    const ownershipCore = partsSource('hardening-core.js');
    assert.match(ownershipCore, /if \(ownerWasProvided\) return direct && unique\.includes\(direct\) \? direct : ''/);
    assert.match(index, /refused ambiguous/);
});


test('high-value manual mutations use immediate persistence', () => {
    assert.match(index, /function persistCritical/);
    assert.match(index, /persistCriticalDurable\(originChatKey\)/);
    assert.match(index, /function reportDurableOutcome[\s\S]*persistCriticalDurable\(key\)/, 'archive/restore/delete persist immediately and announce the durable outcome');
});


test('same chat filename for two owners produces distinct canonical keys', () => {
    assert.notEqual(buildQualifiedChatKey('chat', 'a.png', 'save'), buildQualifiedChatKey('chat', 'b.png', 'save'));
});

test('production CI is read-only and version-neutral', () => {
    assert.match(ci, /contents: read/);
    assert.doesNotMatch(ci, /v0\.2\.15-release-hardening-10x|apply_v0215_release|Commit verified v0\.2\.16/);
});
