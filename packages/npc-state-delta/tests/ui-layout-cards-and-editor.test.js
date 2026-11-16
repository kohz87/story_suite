import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { root, index, continuityUi, css, dossierUi } from './ui-layout.helpers.js';
import { partsSource } from './helpers/parts-source.js';

test('present NPC pane uses portrait-first cards that open the launcher dossier', () => {
    assert.match(index, /function inlineRosterHtml/);
    assert.match(index, /class="npc-state-delta-present-grid"/);
    assert.match(index, /class="npc-state-delta-present-card"/);
    assert.match(index, /class="npc-state-delta-present-card-portrait"/);
    assert.match(index, /class="npc-state-delta-present-card-text"/);
    assert.match(index, /<b class="npc-state-delta-present-card-name" title="\$\{escapeHtml\(displayName\)\}">/);
    assert.doesNotMatch(index, /npc-state-delta-present-card-relation/);
    // One dossier page: cards hand off to the launcher instead of a separate quick viewer.
    assert.doesNotMatch(index + css, /npc-state-delta-viewer|function openNpcViewer|openViewer:/);
    assert.match(index, /function openLauncherDossier\(npcId\)[\s\S]*new CustomEvent\('npc-state-delta:open-dossier', \{ detail: request \}\)/);
    assert.match(index, /eventTargetClosest\(event, '\.npc-state-delta-present-card, \.npc-state-delta-present-chip, \.npc-state-delta-present-cell'\)/);
    assert.match(index, /openDossier: value =>/);
    assert.match(dossierUi, /addEventListener\('npc-state-delta:open-dossier'[\s\S]*event\.detail\.handled = true;[\s\S]*ui\.openNpc\(npcId\)/);
    assert.match(dossierUi, /if \(this\.pendingNpcId\) \{[^}]*this\.screen = openNpc\(createScreenState\(\), this\.pendingNpcId\);[\s\S]*this\.filter = 'all';/, 'the requested NPC survives the chat-change reset, opens its board and is not hidden by a filter');
    // UI 4c: one compact row per person, full width at every size: a 44px portrait on the left, the name on one
    // line (an unbroken name is cut with an ellipsis, never pushes the row wider), the stage line under it.
    assert.match(css, /\.npc-state-delta-present-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
    assert.match(css, /\.npc-state-delta-present-card\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*44px minmax\(0, 1fr\)/s);
    assert.match(css, /\.npc-state-delta-present-card-portrait\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
    assert.match(css, /\.npc-state-delta-present-card-name\s*\{[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*ellipsis/s);
    assert.doesNotMatch(css, /present-card-overlay/);
});

test('present NPCs in chat support Full, Compact, Only in Story Block and Off display modes', () => {
    assert.match(index, /presentCastDisplay: 'full'/);
    assert.match(index, /PRESENT_CAST_DISPLAY_MODES = Object\.freeze\(\['full', 'compact', 'storyblock', 'off'\]\)/);
    assert.match(index, /assign\('presentCastDisplay', normalizePresentCastDisplay\(settings\.presentCastDisplay\)\)/);
    assert.match(index, /id="npc_state_delta_present_cast_display"[^>]*><option value="full">Full cards<\/option><option value="compact">Compact strip<\/option><option value="storyblock">Only in Story Block<\/option><option value="off">Off<\/option>/);
    assert.match(index, /function inlineEntriesForRender\(state\) \{\s*\/\/[^\n]*\n\s*if \(getSettings\(\)\.enabled === false \|\| inChatCastMode\(\) === 'off'\) return \[\];/);
    assert.match(index, /function startInlineWatchdog\(\) \{[\s\S]*?if \(inChatCastMode\(\) === 'off'\) return stopInlineWatchdog\(\);/);
    assert.match(index, /class="npc-state-delta-present-chip"/);
    assert.match(css, /\.npc-state-delta-present-chips \{ display: flex;[^}]*overflow-x: auto;/);
});


test('present cards are one full-width row at every size: no tablet or phone grid of tall cards', () => {
    // UI 4c: the grid is a single column from the widest pane to the narrowest, so a card never stretches to a
    // block or shrinks to a tile on a phone; the row is what the reader asked for (beta feedback).
    assert.match(css, /\.npc-state-delta-present-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
    assert.doesNotMatch(css, /present-grid[^{]*\{[^}]*repeat\(/s, 'no repeat() columns for the cards');
    assert.doesNotMatch(css, /@media[^{]*\{[^@]*?\.npc-state-delta-present-grid \{[^}]*repeat\(2/s, 'no two-column phone grid');
    assert.doesNotMatch(css, /@container npc-present/, 'the old container split for the card row is gone');
});

test('present cards resolve the current canonical NPC name after identity promotion', () => {
    assert.match(index, /const displayName = npc\.name \|\| 'NPC'/);
    assert.match(index, /Open \$\{escapeHtml\(displayName\)\} dossier/);
});

test('dossier uses trust affection desire tension and strict presence wording', () => {
    assert.match(dossierUi, /RELATIONSHIP_AXES = Object\.freeze\(\[\['trust', 'Trust'\], \['affection', 'Affection'\], \['desire', 'Desire'\], \['tension', 'Tension'\]\]\)/);
    assert.doesNotMatch(dossierUi, /'Respect'/);
    assert.match(index, /Only active NPCs present in the latest scanned scene/);
});

test('relationship tuning exposes baseline, caps, editable rubrics, and delta audit UI', () => {
    for (const id of ['npc_state_delta_base_trust', 'npc_state_delta_base_affection', 'npc_state_delta_base_desire', 'npc_state_delta_base_tension']) assert.match(index, new RegExp(id));
    for (const id of ['npc_state_delta_cap_ordinary', 'npc_state_delta_cap_meaningful', 'npc_state_delta_cap_major', 'npc_state_delta_cap_extreme']) assert.match(index, new RegExp(id));
    assert.match(index, /npc_state_delta_relationship_criteria/);
    assert.match(index, /npc_state_delta_impact_criteria/);
    assert.match(index, /Reset relationship rules/);
    assert.match(dossierUi, /Last relationship change/);
    assert.match(css, /npc-state-delta-rubric-textarea/);
});

test('important memory criteria are editable and resettable from settings', () => {
    assert.match(index, /<h4>Important memories<\/h4>/);
    assert.match(index, /Important memory criteria/);
    assert.match(index, /npc_state_delta_memory_criteria/);
    assert.match(index, /npc_state_delta_reset_memory_rules/);
    assert.match(index, /Reset memory criteria/);
    assert.match(index, /Existing memories are shown to the scanner/i);
    assert.match(index, /Important memories <small>Max 5/i);
    assert.match(index, /editorList\('memories', IMPORTANT_MEMORY_LIMIT\)/);
});


test('present-only behavior injection and manual dossier editor controls are exposed', () => {
    assert.match(index, /Inject present NPC state/);
    assert.match(index, /npc_state_delta_behavior_criteria/);
    assert.match(index, /Relationship-to-behavior rubric/);
    assert.match(index, /npc-state-delta-roster-edit/);
    assert.match(index, /Save dossier/);
    assert.match(index, /Protect edited stable profile fields/);
    assert.match(index, /Leave off to use manual edits as an organic baseline/);
    assert.match(index, /\$\{locked\.size \? 'checked' : ''\}/, 'locked is a Set: the protect box shows the existing locks');
    assert.match(index, /npc_state_delta_edit_trust/);
    assert.match(index, /npc_state_delta_edit_affection/);
    assert.match(index, /npc_state_delta_edit_desire/);
    assert.match(index, /npc_state_delta_edit_tension/);
    assert.match(index, /npc_state_delta_edit_behavior_profile/);
    assert.match(index, /Behavioral Levers/);
    assert.match(index, /Max \${BEHAVIOR_PROFILE_LIMIT} compact target-general response\/decision rules/);
    assert.match(index, /Player Dynamic/);
    assert.match(index, /Condition \/ Activity/);
    assert.doesNotMatch(index, /npc_state_delta_edit_importance/);
    assert.match(index, /const Popup = ctx\.Popup/);
    assert.match(index, /allowVerticalScrolling: true/);
    assert.match(css, /npc-state-delta-editor-popup/);
});


test('archive lifecycle controls stay reversible while settings roster exposes confirmed hard delete', () => {
    assert.match(index, /Archive confirmed deaths/);
    assert.match(index, /Reactivate on clear return/);
    assert.match(index, /npc-state-delta-archive-npc/);
    assert.match(index, /npc-state-delta-restore-npc/);
    assert.match(index, /npc-state-delta-roster-delete npc-state-delta-delete-npc/);
    assert.match(index, /Delete \${escapeHtml\(npc\.name\)} dossier/);
    assert.match(index, /function deleteNpcById/);
    assert.match(index, /window\.confirm\(message\)/);
    assert.match(index, /commitBranchCheckpoint\(working, targetMessageId, 'manual-delete'\)/);
    assert.match(index, /click\.npcStateDelta', '\.npc-state-delta-delete-npc'/);
    assert.match(index, /keydown\.npcStateDelta', '\.npc-state-delta-delete-npc'/);
    assert.doesNotMatch(index, /npc-state-delta-inline-delete-npc/);
    assert.match(css, /npc-state-delta-roster-delete/);
    assert.match(css, /npc-state-delta-editor-lifecycle/);
});

test('roster exposes present versus current off-screen World State activity', () => {
    assert.match(index, /npc\.worldActive \? '◌ '/);
    assert.match(index, /current off-screen activity from World State/);
    assert.match(index, /Present Minor NPCs still update and remain eligible for generation injection/);
    assert.match(index, /Active · Off-screen/);
});


test('generation injection budget is player-configurable in settings', () => {
    assert.match(index, /npc_state_delta_inject_budget/);
    assert.match(index, /Injection budget/);
    assert.match(index, /Upper limit; only what the present NPCs need is used/);
});


test('relationship UI is bipolar around neutral zero and legacy audit values are finite-filtered', () => {
    for (const id of ['npc_state_delta_base_trust', 'npc_state_delta_base_affection', 'npc_state_delta_base_desire', 'npc_state_delta_base_tension']) {
        assert.match(index, new RegExp(`${id}[^>]*min=\"-100\"[^>]*max=\"100\"`));
    }
    for (const id of ['npc_state_delta_edit_trust', 'npc_state_delta_edit_affection', 'npc_state_delta_edit_desire', 'npc_state_delta_edit_tension']) {
        assert.match(index, new RegExp(`${id}[^>]*min=\"-100\"[^>]*max=\"100\"`));
    }
    assert.match(index, /Number\.isFinite\(value\)/);
});


test('dossier exposes species/race, age, form-owned appearance, and portrait generation controls', () => {
    assert.match(index, /npc_state_delta_edit_species/);
    assert.match(index, /Species \/ Race/);
    assert.match(index, /npc_state_delta_edit_home_base/);
    assert.match(index, /Home Base \/ Usual Location/);
    assert.match(index, /npc_state_delta_edit_age/);
    assert.match(index, /npc_state_delta_edit_apparent_age/);
    assert.match(index, /Apparent age/);
    assert.doesNotMatch(index, /npc_state_delta_edit_appearance/);
    assert.match(continuityUi, /Named forms/);
    assert.match(continuityUi, /Apply appearance</);
    assert.match(continuityUi, /Physical features \(enduring\)/);
    assert.match(continuityUi, /Current outfit &amp; presentation/);
    assert.match(continuityUi, /Current form/);
    assert.match(index, /Age:/);
    assert.match(index, /buildNpcPortraitPrompts/);
    assert.match(index, /npc_state_delta_portrait_style_positive[^\n]+maxlength=\"\$\{PORTRAIT_STYLE_PROMPT_LIMIT\}\"/);
    assert.match(index, /npc_state_delta_portrait_style_negative[^\n]+maxlength=\"\$\{PORTRAIT_STYLE_PROMPT_LIMIT\}\"/);
    assert.match(index, /npc_state_delta_portrait_composition[^\n]+maxlength=\"\$\{PORTRAIT_COMPOSITION_PROMPT_LIMIT\}\"/);
    assert.match(index, /npc_state_delta_edit_portrait_positive[^\n]+maxlength=\"\$\{PORTRAIT_NPC_PROMPT_LIMIT\}\"/);
    assert.match(index, /npc_state_delta_edit_portrait_negative[^\n]+maxlength=\"\$\{PORTRAIT_NPC_PROMPT_LIMIT\}\"/);
    assert.doesNotMatch(index, /npc_state_delta_portrait_style_(?:positive|negative)[^\n]+maxlength=\"2400\"/);
    assert.match(fs.readFileSync(path.join(root, 'portrait-tools.js'), 'utf8'), />Generate Portrait<\/button>/);
    assert.doesNotMatch(index, /<b>Current thoughts<\/b>|Thought basis|npc_state_delta_edit_thought/i);
});

test('scanner uses current-exchange auto context and keeps wider history for manual scans', () => {
    assert.match(fs.readFileSync(path.join(root, 'src', 'transcript-parts', 'exchange-text.js'), 'utf8'), /export function currentExchangeTranscript/);
    assert.match(index, /const fullWindowScan = Boolean\(!savedCapture && !manual && settings\.fullScanEveryTurn\)/);
    assert.match(index, /\(manual \|\| fullWindowScan\) \? recentTranscript\(settings\.scanDepth\) : \(skippedWindow\?\.transcript \|\| currentTranscript\)/);
    assert.match(fs.readFileSync(path.join(root, 'src', 'transcript-parts', 'skipped.js'), 'utf8'), /export function skippedExchangesWindow/);
    assert.match(partsSource(path.join(root, 'src', 'scanner-request.js')), /SCAN_RESPONSE_LENGTH = 1800/);
    assert.match(partsSource(path.join(root, 'src', 'scanner-request.js')), /FULL_SCAN_RESPONSE_LENGTH = 3200/);
    assert.match(index, /fullWindowScan \? FULL_SCAN_RESPONSE_LENGTH : SCAN_RESPONSE_LENGTH/);
    assert.match(partsSource(path.join(root, 'src', 'scanner-request.js')), /BACKFILL_RESPONSE_LENGTH = 3200/);
    assert.match(partsSource(path.join(root, 'src', 'scanner-request.js')), /JSON_RETRY_RESPONSE_LENGTH = 5200/);
    assert.match(partsSource(path.join(root, 'src', 'scanner-request.js')), /CRITICAL COMPACT JSON RETRY/);
    assert.match(index, /'Scan context'/);
    assert.match(index, /Full scan every turn/);
    assert.match(index, /Quick automatic scans read every reply since the last scan/);
    assert.match(index, /autoScanDueAfterReply\(\{\s*autoScan: settings\.autoScan,\s*full: settings\.fullScanEveryTurn,\s*sinceScan: state\.assistantSinceScan,\s*scanEvery: settings\.scanEvery,/);
    assert.match(index, /prepareFullWindowRelationshipPayload\(resolvedParsed, state\.npcs\)/);
    assert.match(index, /runFocusedRelationshipPass\(\s*ctx,\s*fullWindowRelationship\.evaluation,\s*state\.npcs,\s*skippedWindow \? transcript : \(currentTranscript \|\| transcript\),\s*settings,\s*\{\s*currentExchangeOnly: manual \|\| fullWindowScan,\s*requestScope: operation\.requestScope,\s*prose: skippedWindow \? skippedWindow\.prose : currentProse,/);
    assert.match(index, /npc_state_delta_admission_mode/);
    assert.match(index, /Conservative/);
    assert.match(index, /Balanced/);
    assert.match(index, /Manual only/);
    assert.match(index, /processPendingBackfills/);
    assert.match(index, /targeted dossier backfill extractor|dossier backfill scanner/);
});
