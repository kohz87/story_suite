// N8: the "NPCs refreshed per reply" setting (K, 1-3, default 1) sits beside the catch-up setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { npcBucket } = await import('../../modules/people/settings/bucket.js');
const { getSettings } = await import('../../modules/people/settings/runtime-settings.js');
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('default 1, the getter clamps to 1-3 and rounds, junk falls back to 1', () => {
    assert.equal(getSettings().narrationCaptureCatchUpPeople, 1);
    const bucket = npcBucket(globalThis.__npcMock.extensionSettings, { create: true });
    for (const [given, expected] of [[0, 1], [-4, 1], [2, 2], [2.6, 3], [9, 3], ['abc', 1], [undefined, 1]]) {
        bucket.narrationCaptureCatchUpPeople = given;
        assert.equal(getSettings().narrationCaptureCatchUpPeople, expected, `${given}`);
    }
});

test('the control, its binder and its help text are wired, and the catch-up help says each person waits N replies', () => {
    const html = read('modules/people/settings/runtime-settings-html.js');
    assert.match(html, /settingRow\('npc_state_delta_narration_capture_catch_up_people', 'NPCs refreshed per reply', numberControl\('npc_state_delta_narration_capture_catch_up_people', 1, 3,/);
    assert.match(html, /\$\('#npc_state_delta_narration_capture_catch_up_people'\)\.val\(s\.narrationCaptureCatchUpPeople\)/);
    assert.match(html, /Each person waits this many replies between Refreshes/);
    assert.match(read('modules/people/settings/runtime-settings-bind.js'), /bindSettingsNumber\('#npc_state_delta_narration_capture_catch_up_people', 'narrationCaptureCatchUpPeople', 1, 3, 1\)/);
});
