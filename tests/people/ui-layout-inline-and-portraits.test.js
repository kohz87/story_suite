import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotNpc } from '../../modules/people/fields/registry.js';
import { index, css } from './ui-layout.helpers.js';

test('the settings roster editor uses direct mobile-safe binding', () => {
    assert.match(index, /function wireSettingsRosterEditor/);
    assert.match(index, /querySelectorAll\('\.ppl-roster-edit'\)/);
    assert.match(index, /addEventListener\?\.\('pointerup'/);
    assert.match(index, /document\.addEventListener\('touchend'/);
    assert.match(index, /event\.stopImmediatePropagation\?\.\(\)/);
    assert.match(index, /role="button" tabindex="0"[^>]*ppl-roster-edit|ppl-roster-edit" role="button" tabindex="0"/);
    assert.match(index, /const Popup = ctx\.Popup/);
    assert.match(index, /new Popup\(content, POPUP_TYPE\.TEXT/);
    assert.match(index, /large: true/);
    assert.match(index, /allowVerticalScrolling: true/);
    assert.doesNotMatch(index, /overlay\.style\.zIndex = '2147483000'/);
    assert.match(css, /ppl-editor-popup/);
    assert.equal((index.match(/id="people_edit_personality"/g) || []).length, 1, 'editor must not render duplicate Personality controls');
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
    assert.match(index, /eventTargetClosest\(event, '\.ppl-roster-edit'\)/);
    assert.match(index, /class="menu_button ppl-roster-edit"/);
    assert.match(index, /\$\(document\)\.on\('click\.ppl', '\.ppl-roster-edit'/);
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
    assert.match(index, /ppl-scan-dossier/);
    assert.match(index, /Scan dossier/);
    assert.match(index, /ppl-refresh-chat/);
    assert.match(index, /Refresh from Chat/);
    assert.match(index, /async function refreshNpcFromChat/);
    assert.match(index, /recentTranscript\(settings\.scanDepth\)/);
    assert.match(index, /skipRelationshipUpdate: true/);
    assert.match(index, /no matching Megumin dossier block found.*scanning recent story context instead/i);
    assert.match(index, /dossier-import/);
    assert.match(index, /people_edit_key_relationships/);
    assert.match(index, /Key relationships/);
    assert.match(index, /editorList\('keyRelationships', KEY_RELATIONSHIP_LIMIT\)/);
    assert.deepEqual(snapshotNpc({ id: 'npc_x', keyRelationships: ['Ilse — sister'] }).keyRelationships, ['Ilse — sister'], 'the inline snapshot copies the bonds');
});

test('stale NPC lifecycle is configurable and recurring NPCs can be protected', () => {
    assert.match(index, /people_auto_prune_stale/);
    assert.match(index, /Auto-manage stale NPCs/);
    assert.match(index, /people_stale_archive_after/);
    assert.match(index, /people_stale_delete_after/);
    assert.match(index, /staleArchiveAfter:\s*30/);
    assert.match(index, /staleDeleteAfter:\s*50/);
    assert.match(index, /applyStaleLifecycleAfterScan/);
    assert.match(index, /Archived dossiers do not use an active slot/);
    // P6: no retention flag any more; a quiet dossier that matters is kept by the stale pass itself.
    assert.doesNotMatch(index, /people_edit_retention_protected/);
    assert.match(index, /Deleted stale NPCs can be rediscovered if they return/);
});

test('minor NPC toggle hides portrait cards without disabling dossier tracking', () => {
    assert.match(index, /people_edit_minor/);
    assert.match(index, /Hide present-NPC card/);
    assert.match(index, /!npc\.minor/);
    assert.match(index, /next\.minor = Boolean/);
    assert.match(index, /still scans, updates, stores memories\/relationships, and injects when present/);
});

test('v0.2 portrait generation settings expose theme, positive/negative prompts, and backend-neutral controls', () => {
    for (const id of [
        'people_portrait_generation_enabled',
        'people_portrait_theme_preset',
        'people_portrait_style_positive',
        'people_portrait_style_negative',
        'people_portrait_composition',
        'people_portrait_prompt_format',
        'people_portrait_use_mood',
        'people_portrait_use_location',
        'people_portrait_save_gallery',
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
    assert.match(index, /ppl-portrait-generator-preview/);
    assert.match(index, /id="people_portrait_positive"/);
    assert.match(index, /id="people_portrait_negative"/);
    assert.match(index, /Reset from dossier/);
    assert.match(index, /> Generate</);
    assert.match(index, /Use as Portrait/);
    assert.match(index, /people_edit_portrait_positive/);
    assert.match(index, /people_edit_portrait_negative/);
    assert.match(index, /people_edit_portrait_replace/);
    assert.match(index, /portraitPromptPositive/);
    assert.match(index, /portraitPromptNegative/);
    assert.match(index, /portraitPromptReplace/);
    assert.match(css, /\.ppl-portrait-generator-overlay\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
    assert.match(css, /@media \(max-width: 1180px\)[\s\S]*?\.ppl-portrait-generator-dialog\s*\{[^}]*width:\s*100vw;[^}]*height:\s*100dvh/s);
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
    assert.match(css, /\.delta-settings-quick-actions \.menu_button,\n#people_settings \.ppl-custom-preset-actions \.menu_button,\n#people_settings \.delta-settings-maintenance-actions > \.menu_button \{ width: 100%; \}/);
    assert.match(css, /\.ppl-calendar-actions > \.menu_button,\n#people_settings \.delta-settings-danger > \.menu_button \{ width: auto; white-space: nowrap; \}/);
});

test('switching NPC State on or off refreshes the cast panes; nothing is drawn in the chat (B4-6)', () => {
    assert.match(index, /function afterEnabledChange\(\) \{[\s\S]*renderDossier\(\);[\s\S]*queueCastRefresh\(0\);/);
    assert.doesNotMatch(index, /ppl-inline-anchor|renderInline\b/, 'no in-chat card mount is left');
});
