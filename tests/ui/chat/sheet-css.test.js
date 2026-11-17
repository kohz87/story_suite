// The "This reply" sheet and the ✦ button are styled by the mock's own rules (they had no CSS before).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../../ui/css/chat.css', import.meta.url), 'utf8');

test('chat.css styles the reply sheet, its action row and the ✦ button as the mock does', () => {
    assert.match(css, /\.trsheet\{margin:6px 0;padding:8px 10px;border:1px solid var\(--SmartThemeBorderColor\);border-radius:10px;font-size:\.88em;display:flex;flex-direction:column;gap:4px\}/);
    assert.match(css, /\.tra\{display:flex;gap:6px;flex-wrap:wrap\}/);
    assert.match(css, /\.trsheet ul\{margin:0;padding-left:18px\}/);
    assert.match(css, /\.xbt\.ss\{outline:1px solid var\(--SmartThemeBorderColor\)\}/);
});
