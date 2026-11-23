// The `rules` setting: the reader's own narrator rules replace the built-in rules paragraph only; empty gives the built-in text; the grammar lines stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATIC_TEXT, narratorRules } from '../src/module-parts/static-text.js';
import { SETTINGS } from '../src/module-parts/settings.js';
import { withAstra, sent, reply } from './helpers/host.js';

test('narratorRules: the built-in text unless the setting has text once trimmed', () => {
    for (const none of [undefined, {}, { rules: '' }, { rules: '  \n ' }, { rules: 5 }]) assert.equal(narratorRules(none), STATIC_TEXT);
    assert.equal(narratorRules({ rules: '  Be brief.\n' }), 'Be brief.');
});

test('the rules setting is a prompt-form text of at most 2,000 characters, default empty', () => {
    assert.equal(SETTINGS.defaults.rules, '');
    assert.deepEqual([SETTINGS.schema.rules.type, SETTINGS.schema.rules.form, SETTINGS.schema.rules.max], ['text', 'prompt', 2000]);
    assert.equal(SETTINGS.schema.rules.label, 'Text RPG: Narrator rules');
    assert.equal(SETTINGS.schema.rules.builtin, STATIC_TEXT);
    assert.ok(STATIC_TEXT.length <= 2000);
});

test('on the host: own rules replace only the rules paragraph; the grammar lines stay; empty gives the built-in text back', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await withAstra();
    try {
        await host.send('One.', reply('A.'));
        const [builtIn] = sent(host, 'story_suite_static');
        assert.ok(builtIn.includes(STATIC_TEXT));
        assert.equal(host.settings.set('text-rpg', 'rules', 'Narrate short.\nAlways ask for ? try when it matters.'), 'Narrate short.\nAlways ask for ? try when it matters.');
        await host.send('Two.', reply('B.'));
        const own = sent(host, 'story_suite_static').at(-1);
        assert.ok(own.includes('Narrate short.\nAlways ask for ? try when it matters.'));
        assert.ok(!own.includes('Never write numbers, dice or luck.'));
        assert.match(own, /^\? try Who \| skill or stat \| easy\|normal\|hard\|very hard/m);
        assert.equal(own.replace('Narrate short.\nAlways ask for ? try when it matters.', STATIC_TEXT), builtIn);
        host.settings.set('text-rpg', 'rules', '');
        await host.send('Three.', reply('C.'));
        assert.equal(sent(host, 'story_suite_static').at(-1), builtIn);
        assert.equal(host.settings.set('text-rpg', 'rules', 'x'.repeat(2500)).length, 2000, 'a longer text is cut at 2,000 by the store');
    } finally {
        host.close();
    }
});
