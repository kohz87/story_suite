import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runtimeSource } from './helpers/runtime-source.js';

const source=runtimeSource();
const runtimeState=readFileSync(new URL('../../modules/people/runtime/runtime-state.js',import.meta.url),'utf8');

test('runtime integration uses per-chat scan operations and no legacy global scanBusy flag',()=>{
  assert.match(source,/createScanOperationRegistry/);
  assert.match(source,/beginScanOperation\(scanChatKey/);
  assert.match(source,/scanOperationCurrent\(scanChatKey, operation\)/);
  assert.doesNotMatch(source,/\bscanBusy\b/);
});

test('filename-only chat deletion fails closed instead of borrowing an unrelated active owner',()=>{
  assert.match(source,/removeDeletedChatState\(chatId, 'chat', ''\)/);
  assert.match(source,/removeDeletedChatState\(chatId, 'group', ''\)/);
  assert.doesNotMatch(source,/removeDeletedChatState\(chatId, 'chat', getCharacterOwnerId\(getContext\(\)\)\)/);
  assert.doesNotMatch(source,/for \(const key of \[`chat:\$\{id\}`, `group:\$\{id\}`\]\)/);
});

test('bundle import reports skipped capacity and only clears deletion state for accepted imports',()=>{
  assert.match(source,/report: importReport/);
  assert.match(source,/for \(const accepted of importReport\.accepted \|\| \[\]\)/);
  const tools = readFileSync(new URL('../../modules/people/tools/data-tools.js', import.meta.url), 'utf8');
  assert.match(tools,/existing active dossiers were preserved/);
  assert.match(tools,/nativeImportResultSummary\(result\)/);
});

test('manual trash removes narrative name suppression',()=>{
  assert.match(source,/const permanentLabels = new Set/);
  assert.match(source,/working\.dismissed = .*?working\.dismissed/s);
});

// B4-10a: a branch no longer inherits its parent chat's dossiers (the store's timeline carries the people). The wait for a new chat's state file
// stays as it was while hosted (a hosted chat is never decided; B4-10b removes the wait with the sidecar); without the store a chat is decided
// when it opens, as the inheritance did when it found nothing to inherit.
test('no branch inheritance: no parent dossiers and no inheritance hook; the wait is decided only without the store', () => {
  assert.doesNotMatch(source, /maybeInheritKnownBranch|inheritBranch:/);
  assert.match(source, /function decideBranch\(key = getChatKey\(\)\) \{\n\s+if \(isCanonicalChatKey\(key\) && storeOwnsState\(\) !== 'hosted'\) branchInheritanceChecked\.add\(key\);/);
  assert.match(source, /if \(!isCanonicalChatKey\(key\) \|\| branchInheritanceChecked\.has\(key\)\) return false;\n\s+if \(!missingSidecarChats\.has\(key\) \|\| getSettings\(\)\.dataFiles\?\.\[key\]\?\.path\) return false;/);
  assert.match(source, /return branchInheritancePending\(key\) \|\| rt\.openingHostChats\.has\(key\)/);
  assert.match(source, /branchPending: \(\) => branchInheritancePending\(\),/);
  assert.match(runtimeState, /branchInheritanceChecked: new Set\(\)/);
});

test('deep hardening gates rendering and injection on hydration readiness',()=>{
  assert.match(source,/chatHydrationStatus\(chatKey\) !== 'ready'/);
  assert.match(source,/chatHydrationStatus\(injectionKey\) !== 'ready'/);
});

test('busy automatic scans coalesce instead of being silently dropped',()=>{
  assert.match(runtimeState,/pendingAutoScans: new Map\(\)/);
  assert.match(source,/queuePendingAutoScan\(scanChatKey, messageId, 'busy-auto-scan'\)/);
  assert.match(source,/drainPendingAutoScan\(scanChatKey\)/);
  assert.doesNotMatch(source,/attempt < 250/);
});

test('chat change hydration is chat-affine and stale async completion is rejected',()=>{
  assert.match(source,/if \(getChatKey\(\) !== key\) return;/);
  assert.match(source,/queueBranchReconcile\(\{ chatKey: key,/);
});

test('manual dossier editor validates birthday corrections through the canonical birthday engine',()=>{
  assert.match(source,/npc_state_delta_edit_birthday/);
  assert.match(source,/normalizeBirthDate\(birthdayInput\)/);
  assert.match(source,/applyNpcBirthdayUpdate\(next,/);
  assert.match(source,/birthDateState: 'correct'/);
  assert.match(source,/Manual dossier birthday correction\./);
  assert.match(source,/correctedBirthday\.birthDateSourceMessageId = null/);
  assert.match(source,/set\('npc_state_delta_edit_birthday', npc\.birthDateDisplay \|\| ''\)/);
});
