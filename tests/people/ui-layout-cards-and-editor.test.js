import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { index, continuityUi, css } from './ui-layout.helpers.js';
import { oldSource } from './helpers/old-source.js';
import { partsSource } from './helpers/parts-source.js';

test('there is no in-chat display choice: the present cards live in the Cast and World panes only (B4-6)', () => {
    assert.doesNotMatch(index, /presentCastDisplay|PRESENT_CAST_DISPLAY_MODES|people_present_cast_display/);
    assert.doesNotMatch(index, /class="ppl-present-chip"/);
    assert.doesNotMatch(css, /ppl-present-chips/);
});

test('relationship tuning exposes baseline, caps, editable rubrics, and delta audit UI', () => {
    for (const id of ['people_base_trust', 'people_base_affection', 'people_base_desire', 'people_base_tension']) assert.match(index, new RegExp(id));
    for (const id of ['people_cap_ordinary', 'people_cap_meaningful', 'people_cap_major', 'people_cap_extreme']) assert.match(index, new RegExp(id));
    assert.match(index, /people_relationship_criteria/);
    assert.match(index, /people_impact_criteria/);
    assert.match(index, /Reset relationship rules/);
    assert.match(css, /ppl-rubric-textarea/);
});

test('important memory criteria are editable and resettable from settings', () => {
    assert.match(index, /<h4>Important memories<\/h4>/);
    assert.match(index, /Important memory criteria/);
    assert.match(index, /people_memory_criteria/);
    assert.match(index, /people_reset_memory_rules/);
    assert.match(index, /Reset memory criteria/);
    assert.match(index, /Existing memories are shown to the scanner/i);
    assert.match(index, /Important memories <small>Max 5/i);
    assert.match(index, /editorList\('memories', IMPORTANT_MEMORY_LIMIT\)/);
});

test('present-only behavior injection and manual dossier editor controls are exposed', () => {
    assert.match(index, /Inject present NPC state/);
    assert.match(index, /people_behavior_criteria/);
    assert.match(index, /Relationship-to-behavior rubric/);
    assert.match(index, /ppl-roster-edit/);
    assert.doesNotMatch(index, /protected from stale lifecycle|retentionProtected/);
    assert.match(index, /Save dossier/);
    assert.match(index, /Protect edited stable profile fields/);
    assert.match(index, /Leave off to use manual edits as an organic baseline/);
    assert.match(index, /\$\{locked\.size \? 'checked' : ''\}/, 'locked is a Set: the protect box shows the existing locks');
    assert.match(index, /people_edit_trust/);
    assert.match(index, /people_edit_affection/);
    assert.match(index, /people_edit_desire/);
    assert.match(index, /people_edit_tension/);
    assert.match(index, /people_edit_behavior_profile/);
    assert.match(index, /Behavioral Levers/);
    assert.match(index, /Max \${BEHAVIOR_PROFILE_LIMIT} compact target-general response\/decision rules/);
    assert.match(index, /Player Dynamic/);
    assert.match(index, /Condition \/ Activity/);
    assert.doesNotMatch(index, /people_edit_importance/);
    assert.match(index, /const Popup = ctx\.Popup/);
    assert.match(index, /allowVerticalScrolling: true/);
    assert.match(css, /ppl-editor-popup/);
});

test('the settings roster has no archive control; restore (a death correction) and confirmed hard delete stay', () => {
    assert.match(index, /Archive confirmed deaths/);
    assert.match(index, /Reactivate on clear return/);
    assert.doesNotMatch(index, /ppl-archive-npc/);
    assert.match(index, /ppl-restore-npc/);
    assert.match(index, /ppl-roster-delete ppl-delete-npc/);
    assert.match(index, /Delete \${escapeHtml\(npc\.name\)} dossier/);
    assert.match(index, /function deleteNpcById/);
    assert.match(index, /window\.confirm\(message\)/);
    assert.match(index, /if \(targetMessageId >= 0\) noteChatLineage\(working\);/);
    assert.match(index, /click\.ppl', '\.ppl-delete-npc'/);
    assert.match(index, /keydown\.ppl', '\.ppl-delete-npc'/);
    assert.doesNotMatch(index, /ppl-inline-delete-npc/);
    assert.match(css, /ppl-roster-delete/);
    assert.match(css, /ppl-editor-lifecycle/);
});

test('roster exposes present versus current off-screen World State activity', () => {
    assert.match(index, /npc\.worldActive \? '◌ '/);
    assert.match(index, /current off-screen activity from World State/);
    assert.match(index, /Present Minor NPCs still update and remain eligible for generation injection/);
    assert.match(index, /Active · Off-screen/);
});

test('generation injection budget is player-configurable in settings', () => {
    assert.match(index, /people_inject_budget/);
    assert.match(index, /Injection budget/);
    assert.match(index, /Upper limit; only what the present NPCs need is used/);
});

test('relationship UI is bipolar around neutral zero and legacy audit values are finite-filtered', () => {
    for (const id of ['people_base_trust', 'people_base_affection', 'people_base_desire', 'people_base_tension']) {
        assert.match(index, new RegExp(`${id}[^>]*min=\"-100\"[^>]*max=\"100\"`));
    }
    for (const id of ['people_edit_trust', 'people_edit_affection', 'people_edit_desire', 'people_edit_tension']) {
        assert.match(index, new RegExp(`${id}[^>]*min=\"-100\"[^>]*max=\"100\"`));
    }
    assert.match(index, /Number\.isFinite\(value\)/);
});

test('dossier exposes species/race, age, form-owned appearance, and portrait generation controls', () => {
    assert.match(index, /people_edit_species/);
    assert.match(index, /Species \/ Race/);
    assert.match(index, /people_edit_home_base/);
    assert.match(index, /Home Base \/ Usual Location/);
    assert.match(index, /people_edit_age/);
    assert.match(index, /people_edit_apparent_age/);
    assert.match(index, /Apparent age/);
    assert.doesNotMatch(index, /people_edit_appearance/);
    assert.match(continuityUi, /Named forms/);
    assert.match(continuityUi, /Apply appearance</);
    assert.match(continuityUi, /Physical features \(enduring\)/);
    assert.match(continuityUi, /Current outfit &amp; presentation/);
    assert.match(continuityUi, /Current form/);
    assert.match(index, /Age:/);
    assert.match(index, /buildNpcPortraitPrompts/);
    assert.match(index, /people_portrait_style_positive[^\n]+maxlength=\"\$\{PORTRAIT_STYLE_PROMPT_LIMIT\}\"/);
    assert.match(index, /people_portrait_style_negative[^\n]+maxlength=\"\$\{PORTRAIT_STYLE_PROMPT_LIMIT\}\"/);
    assert.match(index, /people_portrait_composition[^\n]+maxlength=\"\$\{PORTRAIT_COMPOSITION_PROMPT_LIMIT\}\"/);
    assert.match(index, /people_edit_portrait_positive[^\n]+maxlength=\"\$\{PORTRAIT_NPC_PROMPT_LIMIT\}\"/);
    assert.match(index, /people_edit_portrait_negative[^\n]+maxlength=\"\$\{PORTRAIT_NPC_PROMPT_LIMIT\}\"/);
    assert.doesNotMatch(index, /people_portrait_style_(?:positive|negative)[^\n]+maxlength=\"2400\"/);
    assert.match(oldSource('portrait-tools.js'), />Generate Portrait<\/button>/);
    assert.doesNotMatch(index, /<b>Current thoughts<\/b>|Thought basis|people_edit_thought/i);
});

test('scanner uses current-exchange auto context and keeps wider history for manual scans', () => {
    assert.match(oldSource('src/transcript-parts/exchange-text.js'), /export function currentExchangeTranscript/);
    assert.match(index, /const fullWindowScan = Boolean\(!savedCapture && !manual && settings\.fullScanEveryTurn\)/);
    assert.match(index, /\(manual \|\| fullWindowScan\) \? recentTranscript\(settings\.scanDepth\) : \(skippedWindow\?\.transcript \|\| currentTranscript\)/);
    assert.match(oldSource('src/transcript-parts/skipped.js'), /export function skippedExchangesWindow/);
    assert.match(partsSource('src/scanner-request.js'), /SCAN_RESPONSE_LENGTH = 1800/);
    assert.match(partsSource('src/scanner-request.js'), /FULL_SCAN_RESPONSE_LENGTH = 3200/);
    assert.match(index, /fullWindowScan \? FULL_SCAN_RESPONSE_LENGTH : SCAN_RESPONSE_LENGTH/);
    assert.match(partsSource('src/scanner-request.js'), /BACKFILL_RESPONSE_LENGTH = 3200/);
    assert.match(partsSource('src/scanner-request.js'), /JSON_RETRY_RESPONSE_LENGTH = 5200/);
    assert.match(partsSource('src/scanner-request.js'), /CRITICAL COMPACT JSON RETRY/);
    assert.match(index, /'Scan context'/);
    assert.match(index, /Full scan every turn/);
    assert.match(index, /Quick automatic scans read every reply since the last scan/);
    assert.match(index, /autoScanDueAfterReply\(\{\s*autoScan: settings\.autoScan,\s*full: settings\.fullScanEveryTurn,\s*sinceScan: state\.assistantSinceScan,\s*scanEvery: settings\.scanEvery,/);
    assert.match(index, /prepareFullWindowRelationshipPayload\(resolvedParsed, state\.npcs\)/);
    assert.match(index, /runFocusedRelationshipPass\(\s*ctx,\s*fullWindowRelationship\.evaluation,\s*state\.npcs,\s*skippedWindow \? transcript : \(currentTranscript \|\| transcript\),\s*settings,\s*\{\s*currentExchangeOnly: manual \|\| fullWindowScan,\s*requestScope: operation\.requestScope,\s*prose: skippedWindow \? skippedWindow\.prose : currentProse,/);
    assert.match(index, /people_admission_mode/);
    assert.match(index, /Conservative/);
    assert.match(index, /Balanced/);
    assert.match(index, /Manual only/);
    assert.match(index, /processPendingBackfills/);
    assert.match(index, /targeted dossier backfill extractor|dossier backfill scanner/);
});
