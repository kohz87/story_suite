import { manualLifeStateRecord } from '../../modules/people/core/terminal-lifecycle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lifeStateChoice } from '../../modules/people/tools/life-state.js';
import { setNodeTextIfChanged } from '../../modules/people/tools/node-write-guards.js';
import { runtimeSource } from './helpers/runtime-source.js';

// The NPC editor refinements, their styles and the settings section's three tool buttons (moved out of the old dossier panel's code, B4-5).
const read = rel => fs.readFileSync(fileURLToPath(new URL(`../../modules/people/tools/${rel}`, import.meta.url)), 'utf8');
const source = [read('editor-refine.js'), read('editor-styles.js'), read('settings-actions.js')].join('\n');

test('manual life-state projection distinguishes unknown alive terminal death and the short-lived manual dead shape', () => {
    assert.equal(lifeStateChoice({ lifeState: 'unknown' }), 'unknown');
    assert.equal(lifeStateChoice({ lifeState: 'alive' }), 'alive');
    assert.equal(lifeStateChoice({ lifeState: 'deceased', lifeStateCertainty: 'explicit' }), 'deceased');
    assert.equal(lifeStateChoice({ lifeState: 'dead', lifeStateCertainty: 'confirmed' }), 'deceased');
});

test('manual deceased state uses canonical explicit terminal state and removes live presence', () => {
    const next = manualLifeStateRecord({
        id: 'npc-1', name: 'Maren', lifeState: 'alive', present: true, worldActive: true,
        archiveReason: '', relationship: { trust: 12 },
    }, 'deceased', 12345);
    assert.equal(next.lifeState, 'deceased');
    assert.equal(next.lifeStateCertainty, 'explicit');
    assert.equal(next.present, false);
    assert.equal(next.worldActive, false);
    assert.deepEqual(next.relationship, { trust: 12 });
});

test('manual living correction clears only death-owned archive state', () => {
    const corrected = manualLifeStateRecord({
        id: 'npc-1', lifeState: 'deceased', lifeStateCertainty: 'explicit', archived: true,
        archiveReason: 'deceased', archivedAt: 44, archiveSourceMessageId: 9,
    }, 'alive', 99);
    assert.equal(corrected.lifeState, 'alive');
    assert.equal(corrected.lifeStateCertainty, 'explicit');

    const manualArchive = manualLifeStateRecord({
        id: 'npc-2', lifeState: 'unknown', archived: true, archiveReason: 'manual', archivedAt: 55,
    }, 'alive', 99);
    assert.equal(manualArchive.lifeState, 'alive');
});

test('editor synchronization is idempotent so MutationObserver refresh cannot self-loop', () => {
    let writes = 0;
    const node = {
        _text: 'Stable',
        get textContent() { return this._text; },
        set textContent(value) { writes += 1; this._text = value; },
    };
    assert.equal(setNodeTextIfChanged(node, 'Stable'), false);
    assert.equal(writes, 0);
    assert.equal(setNodeTextIfChanged(node, 'Changed'), true);
    assert.equal(writes, 1);
    assert.equal(setNodeTextIfChanged(node, 'Changed'), false);
    assert.equal(writes, 1);
});

test('editor uses one scroll body and task-grouped form sections', () => {
    assert.match(source, /\.ppl-editor-popup \.popup-content\{[^}]*overflow:hidden!important/);
    assert.match(source, /#people_editor_content\{[^}]*overflow-y:auto!important/);
    assert.match(source, /editorSection\('Identity & profile'/);
    assert.match(source, /editorSection\('Current state'/);
    assert.match(source, /editorSection\('Relationships'/);
    assert.match(source, /editorSection\('Continuity'/);
    assert.match(source, /Advanced NPC options/);
    assert.match(source, /ppl-editor-portrait-overrides\{display:none!important/);
    assert.match(source, /data-delta-life-state/);
});

test('settings are grouped by task and extension-wide backup diagnostics live in Settings', () => {
    const index = runtimeSource();
    const html = index.slice(index.indexOf('function buildSettingsHtml()'), index.indexOf('function readOpenSettingsGroups()'));
    const groups = [...html.matchAll(/settingsGroup\('([a-z]+)', '([^']+)'/g)].map(match => match[2]);
    // The rarely needed groups sit inside one closed "Expert" fold (built first in the source, shown last); the rest are the everyday groups.
    assert.deepEqual(groups, ['Calendar & birthdays', 'Scanner rules', 'Advanced', 'Scanning', 'Roster & continuity', 'Meter presets', 'Portrait generation', 'Data & maintenance', 'Expert']);
    assert.match(html, /delta-settings-quickbar[\s\S]*people_enabled[\s\S]*people_auto[\s\S]*people_scan_now[\s\S]*people_add_manual/);
    assert.doesNotMatch(html, /data-delta-settings-open-dossiers|Open dossiers/, 'the old dossier panel and its button are gone (B4-5)');
    assert.match(html, /delta-settings-maintenance-actions[\s\S]*data-delta-settings-backup[\s\S]*data-delta-settings-restore[\s\S]*data-delta-settings-diagnostics/);
    assert.match(html, /people_roster_summary[\s\S]*delta-settings-danger[\s\S]*people_clear_chat/);
    assert.match(html, /native SillyTavern Image Generation handoff/);
    assert.match(html, /people_portrait_generation_enabled/);
    assert.match(html, /people_portrait_save_gallery/);
    assert.match(index, /dispatchEvent\?\.\(new CustomEvent\('people:settings-mounted'/);
    assert.match(source, /data-delta-settings-backup/);
    assert.match(source, /data-delta-settings-restore/);
    assert.match(source, /data-delta-settings-diagnostics/);
    assert.doesNotMatch(source, /data-delta-settings-open-dossiers|people_dossier_root/);
    assert.doesNotMatch(source, /ensureSettingsExperience|moveSettingsRows|#people_settings /, 'the editor refinements never restructure or style the settings panel');
});
