import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { standInTree } from './helpers/temp-tree.js';
import { snapshotNpc } from '../../modules/people/fields/registry.js';
import path from 'node:path';
import { root, index, css, dossierUi } from './ui-layout.helpers.js';

test('inline card truth follows merged presence and settings roster editor uses direct mobile-safe binding', () => {
    assert.match(index, /function scanInlineNpcIds\(_parsed, merged\)/);
    assert.doesNotMatch(index, /const touched = new Set/);
    assert.match(index, /recordInlineCardsInState\(nextState, targetMessageId, \[finalNpc\.id\], 'dossier-backfill'\)/);
    assert.match(index, /removeNpcInlineCardAtMessage/);
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


test('UI integration remounts inline cards on SillyTavern render lifecycle and captures roster editor clicks', () => {
    assert.match(index, /CHARACTER_MESSAGE_RENDERED/);
    assert.match(index, /MORE_MESSAGES_LOADED/);
    assert.match(index, /MESSAGE_UPDATED/);
    assert.match(index, /INLINE_RENDER_RETRY_DELAYS/);
    assert.match(index, /function inlineEntriesForRender/);
    assert.match(index, /live-present-grid/);
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

test('visible inline rendering is latest-scene present cast only while historical snapshots remain internal', () => {
    assert.match(index, /Visible NPC State Delta is a live present-cast view, not a historical dossier timeline/);
    assert.match(index, /const latestAssistantId = latestMessageId\(true\)/);
    assert.match(index, /return \[\{[\s\S]*reason: 'live-present-grid'/s);
    assert.doesNotMatch(index, /function inlineEntriesForRender\(state\) \{[\s\S]*state\.inlineCards\.map/s);
});

test('inline renderer self-heals host redraws without destructive full remounts', () => {
    assert.match(index, /new globalThis\.MutationObserver/);
    assert.match(index, /inlineMountNeedsRepair/);
    assert.match(index, /startInlineWatchdog/);
    assert.match(index, /existingById/);
    assert.match(index, /if \(!anchor\) \{/);
    // Filled now/chatter text makes innerHTML differ from the markup, so the last written markup decides.
    assert.match(index, /else if \(anchor\.innerHTML !== html && \(anchor\.__npcStateDeltaHtml !== html \|\| !String\(anchor\.innerHTML \|\| ''\)\.trim\(\)\)\)/);
    assert.doesNotMatch(index, /querySelectorAll\?\.\('\.npc-state-delta-inline-anchor'\)\.forEach\(node => node\.remove\(\)\)/);
});

test('Megumin master block receives Present NPCs as an in-card tab with standalone fallback preserved', () => {
    assert.match(index, /function mountNpcStateInsideMeguminBlock/);
    assert.match(index, /querySelector\?\.\('\.meg-blocks'\)|querySelector\('\.meg-blocks'\)/);
    assert.match(index, /\.meg-blocks-tabs/);
    assert.match(index, /\.meg-blocks-panel/);
    assert.match(index, /className = 'meg-blocks-tab npc-state-delta-megumin-tab'/);
    assert.match(index, /className = 'meg-block-body npc-state-delta-megumin-pane'/);
    assert.match(index, /pane\.dataset\.key = button\.dataset\.key/);
    assert.match(index, /npcStateDeltaSnapshotSignature/);
    assert.match(index, /closest\('\.npc-state-delta-inline-anchor, \.npc-state-delta-megumin-pane'\)/);
    assert.match(index, /<span class="meg-blocks-tab-label">Present NPCs<\/span>/);
    assert.match(index, /button\.title = 'Present NPCs'/);
    assert.match(index, /mountNpcStateInsideMeguminBlock\(message, messageId, html\)/);
    assert.match(index, /anchor\?\.remove\?\.\(\)/, 'successful Megumin integration should remove the duplicate standalone card');
    assert.match(index, /className = 'npc-state-delta-inline-anchor'/, 'standalone rendering remains the fallback when no Megumin block exists');
    assert.match(index, /cleanupStaleMeguminIntegrations/);
    assert.match(index, /integratedMeguminBlocks:/);
    assert.match(css, /\.npc-state-delta-megumin-pane\s*\{/);
    assert.match(css, /\.npc-state-delta-megumin-tab\s*\{/);
});

test('Megumin integration never rewrites canonical message text and reattaches through the existing render watchdog', () => {
    assert.doesNotMatch(index, /message\.mes\s*=.*NPC_State|\.mes\s*\+=.*NPC_State|<NPC_State>/s);
    assert.match(index, /new globalThis\.MutationObserver/);
    assert.match(index, /\.npc-state-delta-megumin-pane/);
    assert.match(index, /inlineMountNeedsRepair/);
    assert.match(index, /CHARACTER_MESSAGE_RENDERED/);
    assert.match(index, /MESSAGE_UPDATED/);
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
    assert.match(dossierUi, /No important ties recorded yet/);
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


test('portrait generator top layer stays above the full-screen dossier on tablet and mobile', () => {
    const dossier = dossierUi.match(/\.delta-panel \{\s*position: fixed; z-index: (\d+)/);
    const generator = css.match(/\.npc-state-delta-portrait-generator-overlay\s*\{[\s\S]*?z-index:\s*(\d+)/);
    assert.ok(dossier, 'dossier panel z-index should be explicit');
    assert.ok(generator, 'portrait generator z-index should be explicit');
    assert.ok(Number(generator[1]) > Number(dossier[1]), `portrait generator (${generator[1]}) must sit above dossier (${dossier[1]})`);
    assert.match(index, /overlay\.style\.zIndex\s*=\s*'2147483600'/);
});
test('settings panel buttons override the host min-content button width', () => {
    // SillyTavern's .menu_button is width:min-content, which stacks each word of a label inside a grid cell.
    assert.match(css, /\.delta-settings-quick-actions \.menu_button,\n#npc_state_delta_settings \.npc-state-delta-custom-preset-actions \.menu_button,\n#npc_state_delta_settings \.delta-settings-maintenance-actions > \.menu_button \{ width: 100%; \}/);
    assert.match(css, /\.npc-state-delta-calendar-actions > \.menu_button,\n#npc_state_delta_settings \.delta-settings-danger > \.menu_button \{ width: auto; white-space: nowrap; \}/);
});

test('opening the dossier never focuses the search box (no phone/tablet keyboard)', () => {
    const open = dossierUi.slice(dossierUi.indexOf('    async open() {'), dossierUi.indexOf('    async openNpc('));
    assert.ok(open.length > 0, 'open() was not found');
    assert.doesNotMatch(open, /delta-search/);
    assert.match(open, /querySelector\('\.delta-panel'\)\?\.focus\?\.\(\{ preventScroll: true \}\)/);
    assert.doesNotMatch(dossierUi, /focusSearch/);
});

test('switched off, Delta renders no in-chat cards, and the Enable switch redraws them (BH2, 12 Nov)', async () => {
    assert.match(index, /function afterEnabledChange\(\) \{[\s\S]*renderDossier\(\);[\s\S]*globalThis\.NPCStateDelta\?\.renderInline\?\.\(\);/);
    // The real part, beside a stub of the host's extensions.js (as the other runtime-copy tests do).
    const os = await import('node:os');
    const { pathToFileURL } = await import('node:url');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'delta-enabled-cards-'));
    const ext = path.join(temp, 'a', 'b', 'ext');
    fs.mkdirSync(ext, { recursive: true });
    standInTree(ext);   // old names, stand-ins for the real files; the host's extensions.js is the shared stub reading __npcMock
    globalThis.__npcMock = { extensionSettings: {}, context: { chat: [] }, saveSettingsCalls: 0 };
    const savedDocument = globalThis.document;
    globalThis.document = { documentElement: { dataset: {} } };
    try {
        const { createInlineCardsModePart } = await import(pathToFileURL(path.join(ext, 'runtime-inline-cards-mode.js')).href);
        const extension_settings = globalThis.__npcMock.extensionSettings;
        const state = { npcs: [{ id: 'n1', name: 'Mira', present: true }] };
        const part = createInlineCardsModePart({
            chatHydrationStatus: () => 'ready', getChatKey: () => 'k', getChatState: () => state, latestMessageId: () => 4,
            scenePresenceView: npcs => npcs, storyBlockV2Hosted: () => false,
        }, () => '');
        extension_settings.npc_state_delta = { enabled: true };
        assert.equal(part.inlineEntriesForRender(state).length, 1, 'on: the latest reply gets the live present grid');
        extension_settings.npc_state_delta.enabled = false;
        assert.deepEqual(part.inlineEntriesForRender(state), [], 'off: no cards');
        extension_settings.npc_state_delta.enabled = true;
        assert.equal(part.inlineEntriesForRender(state).length, 1, 'on again: they come back');
    } finally {
        if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument;
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
