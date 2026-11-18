import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeSource } from './helpers/runtime-source.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const index = runtimeSource();

test('swipe branch handling waits for SillyTavern swipe idle before dossier generation', () => {
    assert.match(index, /function hostSwipeState\(\)[\s\S]*?getContext\(\)\.swipe\?\.state\?\.\(\)/);
    assert.match(index, /function isHostSwipeActive\(\)[\s\S]*?hostSwipeState\(\) !== 'none'/);
    assert.match(index, /events\.MESSAGE_SWIPED[\s\S]*?queueSettledSwipeReconcile/);
    assert.doesNotMatch(index, /events\.MESSAGE_SWIPED[\s\S]{0,450}?queueBranchReconcile/);
    assert.match(index, /if \(!allowDuringSwipe && isHostSwipeActive\(\)\)/, 'scanNow must refuse hidden generation during host swipe');
    assert.match(index, /MESSAGE_RECEIVED while swipeState is still SWIPING[\s\S]*?queueSettledSwipeReconcile/, 'early MESSAGE_RECEIVED must be deferred');
    assert.match(index, /rt\.deferredSwipeMessageId = null;\n\s+try \{\n\s+await reconcileCurrentBranch\(/, 'the settled swipe only settles: the swiped reply is read again through the store head, not here');
    assert.match(index, /lineageMoved\(scanLineage, currentLineage, messageId\) \|\| Number\(stateVersions\.get\(scanChatKey\)[\s\S]*?stale result was discarded/, 'async scan results must be invalidated by either branch lineage or dossier-state changes');
    assert.match(index, /const scanExpected = autoScanDue \|\| captureDue;[\s\S]*?noteChatLineage\(state\)/, 'the assistant receipt notes the lineage whether or not its scan succeeds');
});

test('a reply rewritten in place by another extension is still the same reply (1.2.9)', () => {
    // Story Block, RPG Battle and Story Director write into a reply just after it arrives; the
    // receipt and the scan (and the one-pass capture it merges) must not take that for a new branch.
    assert.match(index, /function sameReplyRewritten\(chatKey, messageId, parentKey\)[\s\S]*?replyParentKey\(messageId\) === parentKey/);
    assert.match(index, /function lineageMoved\(previous, current, messageId\)[\s\S]*?at !== messageId \|\| previous\.length !== current\.length/);
    assert.match(index, /const sourceStillHere = \(\) => \{[\s\S]*?sameReplyRewritten\(eventChatKey, messageId, eventParent\)[\s\S]*?eventSourceKey = now;/);
    assert.match(index, /if \(!sourceStillHere\(\)\) return;\n\n        \/\/ SillyTavern 1\.18 emits MESSAGE_SWIPED/);
    assert.match(index, /const sourceMoved = \(\) => getChatKey\(\) !== scanChatKey \|\| \(sourceFingerprint !== null[\s\S]*?!sameReplyRewritten\(scanChatKey, messageId, sourceParent\)\)/);
    assert.match(index, /operation\.sourceMessageId = Number\.isInteger\(messageId\) \? messageId : null;/);
    const scanNowBody = index.slice(index.indexOf('async function scanNow('), index.indexOf('\nasync function ', index.indexOf('async function scanNow(') + 10));
    assert.doesNotMatch(scanNowBody, /firstLineageDivergence\(scanLineage, currentLineage\) !== -1/, 'no scanNow stale check ignores in-place rewrites');
});
