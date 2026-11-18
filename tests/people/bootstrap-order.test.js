// B4-5: what NPC State's start loads once the old dossier panel is gone. The saved calendar is activated before the runtime starts
// (calendar-settings.js activates it when it loads), and the page tools are loaded after it: the settings section's Backup, Restore and
// Diagnostics (settings-actions.js, which also brings the tools dialog styles the portrait manager uses), the NPC editor refinements,
// its appearance part and the Maximum output tokens row. No removed panel file is loaded.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync(new URL('../../modules/people/legacy/bootstrap.js', import.meta.url), 'utf8');
const at = spec => bootstrap.indexOf(`await import('${spec}')`);

test('the saved calendar is activated before the runtime starts', () => {
    assert.ok(at('../settings/calendar-settings.js') > 0);
    assert.ok(at('../settings/calendar-settings.js') < at('./index.js'), 'calendar-settings.js loads before index.js');
});

test('the page tools load after the runtime, and every one exists', () => {
    const tools = ['../tools/settings-actions.js', '../tools/editor-refine.js', '../tools/continuity-ui.js', '../settings/scanner-output.js'];
    for (const spec of tools) {
        assert.ok(at(spec) > at('./index.js'), `${spec} loads after index.js`);
        assert.ok(fs.existsSync(new URL(`../../modules/people/legacy/${spec}`, import.meta.url)), `${spec} exists`);
    }
    assert.match(fs.readFileSync(new URL('../../modules/people/tools/settings-actions.js', import.meta.url), 'utf8'), /from '\.\/data-tools\.js'/, 'the tools dialogs and their styles come with it');
});

test('no removed panel file is loaded', () => {
    assert.doesNotMatch(bootstrap, /dossier-ui|dossier-tools|launcher-ui|dossier-experience|relationship-map|scanner-output-ui|'\.\/calendar-settings/);
});
