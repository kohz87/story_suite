import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotNpc } from '../../modules/people/fields/registry.js';
import { index, css } from './ui-layout.helpers.js';

test('the settings roster editor uses direct mobile-safe binding', () => {
    assert.match(index, /function wireSettingsRosterEditor/);
    assert.match(index, /querySelectorAll\('\.npc-state-delta-roster-edit'\)/);
    assert.match(index, /addEventListener\?\.\('pointerup'/);
    assert.match(index, /document\.addEventListener\('touchend'/);
    assert.match(index, /event\.stopImmediatePropagation\?\.\(\)/);
    assert.match(index, /role="button" tabindex="0"[^>]*npc-state-delta-roster-edit|npc-state-delta-roster-edit" role="button" tabindex="0"/);
    assert.match(index, /const Popup = ctx\.Popup/);
    assert.match(index, /new Popup\(content, POPUP_TYPE\.TEXT/);
    assert.match(index, /large: true/);
    assert.match(index, /allowVerticalScrolling: true/);
    assert.doesNotMatch(index, /overlay\.style\.zIndex = '2147483000'/);
    assert.match(css, /npc-state-delta-editor-popup/);
    assert.equal((index.match(/id="npc_state_delta_edit_personality"/g) || []).length, 1, 'editor must not render duplicate Personality controls');
});

test('UI integration refreshes the cast panes on SillyTavern render lifecycle and captures roster editor clicks', () => {
    assert.match(index, /CHARACTER_MESSAGE_RENDERED/);
    assert.match(index, /MORE_MESSAGES_LOADED/);
    assert.match(index, /MESSAGE_UPDATED/);
    assert.match(index, /function installUiCaptureBridge/);
    assert.match(index, /document\.addEventListener\('pointerup', activatePresentCardFromEvent, true\);/);
    assert.match(index, /document\.addEventListener\('pointerup', activateNpcEditorFromEvent, true\);/);
    assert.match(index, /document\.addEventListener\('click', activatePresentCardFromEvent, true\);/);
    assert.match(index, /document\.addEventListener\('click', activateNpcEditorFromEvent, true\);/);
    assert.match(index, /document\.addEventListener\('touchend'/);
    assert.match(index, /eventTargetClosest\(event, '\.npc-state-delta-roster-edit'\)/);
    assert.match(index, /class="menu_button npc-state-delta-roster-edit"/);
    assert.match(index, /\$\(document\)\.on\('click\.npcStateDelta', '\.npc-state-delta-roster-edit'/);
    assert.match(index, /uiStatus:/);
});

test('compact Megumin World State preserves omitted off-screen activity while still resetting physical presence', () => {
    assert.match(index, /hasCompactMeguminWorldState/);
    assert.match(index, /if \(!compactWorldStateTurn\) npc\.worldActive = false/);
    assert.match(index, /preserveWorldActive: compactWorldStateTurn/);
});

test('per-NPC Scan dossier workflow and Key Relationships controls are exposed', () => {
    assert.match(index, /function findMeguminDossierSources/);
    assert.match(index, /async function scanNpcDossier/);
    assert.match(index, /<\(New_NPC\|NPC_Update\)/);
    assert.match(index, /npc-state-delta-scan-dossier/);
    assert.match(index, /Scan dossier/);
    assert.match(index, /npc-state-delta-refresh-chat/);
    assert.match(index, /Refresh from Chat/);
    assert.match(index, /async function refreshNpcFromChat/);
    assert.match(index, /recentTranscript\(settings\.scanDepth\)/);
    assert.match(index, /skipRelationshipUpdate: true/);
    assert.match(index, /no matching Megumin dossier block found.*scanning recent story context instead/i);
    assert.match(index, /dossier-import/);
    assert.match(index, /npc_state_delta_edit_key_relationships/);
    assert.match(index, /Key relationships/);
    assert.match(index, /editorList\('keyRelationships', KEY_RELATIONSHIP_LIMIT\)/);
    assert.deepEqual(snapshotNpc({ id: 'npc_x', keyRelationships: ['Ilse — sister'] }).keyRelationships, ['Ilse — sister'], 'the inline snapshot copies the bonds');
});

test('stale NPC lifecycle is configurable and recurring NPCs can be protected', () => {
    assert.match(index, /npc_state_delta_auto_prune_stale/);
    assert.match(index, /Auto-manage stale NPCs/);
    assert.match(index, /npc_state_delta_stale_archive_after/);
    assert.match(index, /npc_state_delta_stale_delete_after/);
    assert.match(index, /staleArchiveAfter:\s*30/);
    assert.match(index, /staleDeleteAfter:\s*50/);
    assert.match(index, /applyStaleLifecycleAfterScan/);
    assert.match(index, /Archived dossiers do not use an active slot/);
    // P6: no retention flag any more; a quiet dossier that matters is kept by the stale pass itself.
    assert.doesNotMatch(index, /npc_state_delta_edit_retention_protected/);
    assert.match(index, /Deleted stale NPCs can be rediscovered if they return/);
});

test('minor NPC toggle hides portrait cards without disabling dossier tracking', () => {
    assert.match(index, /npc_state_delta_edit_minor/);
    assert.match(index, /Hide present-NPC card/);
    assert.match(index, /!npc\.minor/);
    assert.match(index, /next\.minor = Boolean/);
    assert.match(index, /still scans, updates, stores memories\/relationships, and injects when present/);
});

test('v0.2 portrait generation settings expose theme, positive/negative prompts, and backend-neutral controls', () => {
    for (const id of [
        'npc_state_delta_portrait_generation_enabled',
        'npc_state_delta_portrait_theme_preset',
        'npc_state_delta_portrait_style_positive',
        'npc_state_delta_portrait_style_negative',
        'npc_state_delta_portrait_composition',
        'npc_state_delta_portrait_prompt_format',
        'npc_state_delta_portrait_use_mood',
        'npc_state_delta_portrait_use_location',
        'npc_state_delta_portrait_save_gallery',
    ]) assert.match(index, new RegExp(id));
    assert.match(index, /SillyTavern Image Generation/i);
    assert.match(index, /Fantasy Anime/);
    assert.match(index, /Anime Key Visual/);
    assert.match(index, /Painterly Fantasy/);
    assert.match(index, /Dark Medieval/);
    assert.match(index, /Semi-Realistic/);
    assert.doesNotMatch(index, /sampler[^\n]*<select|checkpoint[^\n]*<select|cfg[^\n]*<input/i, 'NPC State Delta should not duplicate native backend controls');
});

test('portrait generator is a review-before-apply workflow with per-NPC prompt overrides', () => {
    assert.match(index, /function portraitGeneratorHtml/);
    assert.match(index, /npc-state-delta-portrait-generator-preview/);
    assert.match(index, /id="npc_state_delta_portrait_positive"/);
    assert.match(index, /id="npc_state_delta_portrait_negative"/);
    assert.match(index, /Reset from dossier/);
    assert.match(index, /> Generate</);
    assert.match(index, /Use as Portrait/);
    assert.match(index, /npc_state_delta_edit_portrait_positive/);
    assert.match(index, /npc_state_delta_edit_portrait_negative/);
    assert.match(index, /npc_state_delta_edit_portrait_replace/);
    assert.match(index, /portraitPromptPositive/);
    assert.match(index, /portraitPromptNegative/);
    assert.match(index, /portraitPromptReplace/);
    assert.match(css, /\.npc-state-delta-portrait-generator-overlay\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
    assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.npc-state-delta-portrait-generator-dialog\s*\{[^}]*width:\s*100vw;[^}]*height:\s*100dvh/s);
});

test('native portrait bridge uses quiet SillyTavern imagine command and separate negative prompt', () => {
    assert.match(index, /executeSlashCommandsWithOptions/);
    assert.match(index, /'\/imagine'/);
    assert.match(index, /'quiet=true'/);
    assert.match(index, /gallery=\$\{settings\.portraitSaveToGallery/);
    assert.match(index, /negative=\$\{slashQuoted\(negative\)\}/);
    assert.match(index, /result\?\.pipe/);
    assert.match(index, /portraitFileFromGeneratedUrl/);
    assert.match(index, /compressPortrait\(file\)/);
});

test('settings panel buttons override the host min-content button width', () => {
    // SillyTavern's .menu_button is width:min-content, which stacks each word of a label inside a grid cell.
    assert.match(css, /\.delta-settings-quick-actions \.menu_button,\n#npc_state_delta_settings \.npc-state-delta-custom-preset-actions \.menu_button,\n#npc_state_delta_settings \.delta-settings-maintenance-actions > \.menu_button \{ width: 100%; \}/);
    assert.match(css, /\.npc-state-delta-calendar-actions > \.menu_button,\n#npc_state_delta_settings \.delta-settings-danger > \.menu_button \{ width: auto; white-space: nowrap; \}/);
});

test('switching NPC State on or off refreshes the cast panes; nothing is drawn in the chat (B4-6)', () => {
    assert.match(index, /function afterEnabledChange\(\) \{[\s\S]*renderDossier\(\);[\s\S]*queueCastRefresh\(0\);/);
    assert.doesNotMatch(index, /npc-state-delta-inline-anchor|renderInline\b/, 'no in-chat card mount is left');
});
