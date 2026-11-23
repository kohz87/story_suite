// A plug-in's long text (a `text` field with form 'prompt', Text RPG's Narrator rules): its Rules row, the editor it draws, the write the port accepts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';
import { BUILTIN_MODULES } from '../../../core/modules-list.js';
import { installFakeDom } from '../../helpers/ui-fake-dom.js';
import { renderRow } from '../../../ui/settings/fields.js';
import { selectPluginPages } from '../../../ui/select/plugin-pages.js';
import { pluginCommand } from '../../../ui/port/plugin-settings.js';
import { textRpgModule } from '../../../examples/text-rpg/src/module.js';
import { STATIC_TEXT } from '../../../examples/text-rpg/src/module-parts/static-text.js';

const base = { key: 'plugin.text-rpg.rules', group: 'Text RPG', label: 'Narrator rules', hint: 'A note.', type: 'prompt', wide: true, default: '', builtin: 'BUILT-IN RULES', max: 2000, options: null, unit: null, tags: [] };

test('the page gives the rules field a prompt row with the built-in text, the stored text and the note', async t => {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    host = await createHost({ core: true, modules: [...BUILTIN_MODULES, textRpgModule({ feature: id => host.sdk.feature(id) })] });
    t.after(() => host.close());
    host.features.set('text-rpg.on', true);
    const rowOf = values => selectPluginPages(host.sdk.modules(), host.sdk.features(), { 'text-rpg': values })[0].rows.find(r => r.key === 'plugin.text-rpg.rules');
    const empty = rowOf({});
    assert.deepEqual([empty.type, empty.label, empty.value, empty.builtin, empty.max], ['prompt', 'Narrator rules', '', STATIC_TEXT, 2000]);
    assert.match(empty.hint, /The dice and the \? try line are the code's: if the rules stop asking for \? try, rolls stop changing the sheet\./);
    assert.equal(rowOf({ rules: 'Mine.' }).value, 'Mine.');
});

test('the prompt row draws a box prefilled with the built-in text, Save writes, Reset clears', async () => {
    installFakeDom();
    const got = [];
    const el = renderRow(base, { onChange: (key, value) => { got.push([key, value]); return { ok: true }; } });
    const box = el.querySelector('textarea');
    assert.equal(box.value, 'BUILT-IN RULES');
    assert.equal(box.getAttribute('maxlength'), '2000');
    const save = el.querySelector('[data-act="save"]');
    const reset = el.querySelector('[data-act="reset"]');
    assert.equal(reset.disabled, true, 'nothing to reset while the built-in text shows');
    save.click();
    assert.deepEqual(got.pop(), ['plugin.text-rpg.rules', ''], 'unchanged built-in text stays "use the built-in"');
    box.value = 'My own rules.';
    save.click();
    assert.deepEqual(got.pop(), ['plugin.text-rpg.rules', 'My own rules.']);
    assert.equal(reset.disabled, false);
    reset.click();
    assert.deepEqual(got.pop(), ['plugin.text-rpg.rules', '']);
    assert.equal(box.value, 'BUILT-IN RULES');
    assert.equal(reset.disabled, true);
});

test('a stored text shows in the box and Reset is on', () => {
    installFakeDom();
    const el = renderRow({ ...base, value: 'Stored.' }, {});
    assert.equal(el.querySelector('textarea').value, 'Stored.');
    assert.equal(el.querySelector('[data-act="reset"]').disabled, false);
});

test('the port stores a prompt text up to 2,000 characters and refuses more', async t => {
    t.mock.method(console, 'warn', () => {});
    let host = null;
    host = await createHost({ core: true, modules: [...BUILTIN_MODULES, textRpgModule({ feature: id => host.sdk.feature(id) })] });
    t.after(() => host.close());
    const set = value => pluginCommand('settings.set', { key: 'plugin.text-rpg.rules', value }, { settings: host.settings }, () => host.sdk.modules());
    assert.equal(set('x'.repeat(2001)).ok, false);
    assert.match(set('x'.repeat(2001)).message, /2,000/);
    for (const bad of [5, null, { a: 1 }]) assert.equal(set(bad).ok, false);
    assert.equal(set('x'.repeat(2000)).ok, true);
    assert.equal(host.sdk.settings('text-rpg').rules.length, 2000);
    assert.equal(set('').ok, true);
    assert.equal(host.sdk.settings('text-rpg').rules, '');
});
