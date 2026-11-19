import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('the portrait dialog is glass in the suite look, not the flat host tint', async () => {
    const css = await read('modules/people/tools/data-tools.js');
    const dialog = css.match(/\.delta-tools-dialog\{[^}]*\}/)[0];
    assert.match(dialog, /var\(--su-panel2/);
    assert.match(dialog, /backdrop-filter:blur\(/);
    assert.doesNotMatch(dialog, /SmartThemeBlurTintColor/);
});

test('the dialog takes the suite view theme values (dark or light) from the page', async () => {
    const source = await read('modules/people/tools/tools-core-parts/overlay.js');
    assert.match(source, /carryTheme\(overlay\)/);
    assert.match(source, /startsWith\('--su-'\)/);
});

test('portrait toasts say NPC State, never NPC State', async () => {
    for (const path of ['modules/people/portrait/portrait-tools.js', 'modules/people/portrait/runtime-portrait.js', 'modules/people/portrait/portrait-tools-actions-parts/upload-remove.js']) {
        const source = await read(path);
        assert.doesNotMatch(source, /toast[^\n]*NPC State Delta|`NPC State Delta/, path);
    }
});
