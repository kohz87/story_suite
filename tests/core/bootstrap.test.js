// core/boot/boot.js on the testkit's fake SillyTavern and the fake DOM: the global host, the interceptor named in manifest.json,
// the stylesheet list, no old view on the page, a reply's change lines in the story, the Tools handle (report, Inspector), a canGenerate
// hook that holds a reply back, and sdk.dialog with no dialog mount.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDom } from '../ui/view/mounts/helpers.js';
import { createFakeContext } from '../../testkit/index.js';

const doc = setupDom();
doc.head = doc.createElement('head');
for (const id of ['sheld', 'extensions_settings2', 'extensionsMenu']) {
    const node = doc.createElement('div');
    node.id = id;
    doc.body.appendChild(node);
}
const sendForm = doc.createElement('form');
sendForm.id = 'send_form';
doc.querySelector('#sheld').appendChild(sendForm);
const st = createFakeContext();
globalThis.SillyTavern = { getContext: () => st.ctx };
const warned = [];
globalThis.toastr = { warning(text) { warned.push(String(text)); }, info() {}, error() {} };

const { boot } = await import('../../core/boot/boot.js');
assert.equal(await boot(), true);
const sdk = await globalThis.StoryBlock.ready;

test('the global host and the manifest agree: v2, the interceptor, the CSS; the host compatibility number stays 2.33.0', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../manifest.json', import.meta.url), 'utf8'));
    assert.equal(manifest.version, '0.1.1');
    assert.equal(globalThis.StoryBlock.version, '2.33.0');
    assert.equal(manifest.css, 'suite.css');
    assert.equal(manifest.js, 'index.js');
    const css = readFileSync(new URL('../../suite.css', import.meta.url), 'utf8');
    assert.match(css, /@import url\('\.\/ui\/css\/fonts\.css'\)/, 'the bundled font is declared');
    assert.doesNotMatch(css, /ui\/legacy|next-hide/, 'no old view sheet');
    assert.equal(typeof globalThis[manifest.generate_interceptor], 'function');
    assert.equal(globalThis.StoryBlock.apiVersion, 2);
    assert.equal(globalThis.StoryBlock.sdk, sdk);
    assert.deepEqual(sdk.modules().map(module => module.id), ['people', 'story-block', 'story-director']);
    assert.ok(!/import[^;]*index\.v1\.js|from '\.\/src\/(?!v2\/)/.test(readFileSync(new URL('../../core/boot/boot.js', import.meta.url), 'utf8')), 'v1 is not loaded');
});

test('boot puts no old view on the page: no bar, story panel, wand entry, hud strip, cards or dialog', () => {
    for (const selector of ['#story_suite_v2_bar', '#story_suite_v2_panel', '#story_suite_v2_menu', '.ss-hud', '.ss-cards', '.ss-dialog', '.ss-gameview', '.story-suite-notice']) {
        assert.equal(doc.querySelector(selector), null, selector);
    }
    assert.equal(doc.querySelector('#send_form'), sendForm);
    assert.equal(doc.querySelector('#sheld').children.length, 1, 'nothing is put next to the message box');
});

test('a reply\'s change lines reach the story', async () => {
    await st.send('I take the rope.', { reply: 'You coil the rope.\n<Changes>\n+ item Rope | qty: 2\n+ coin 7 | from: the ferryman\n</Changes>' });
    assert.match(st.ctx.chat.at(-1).mes, /^You coil the rope\.\n\n<!-- STORY_SUITE_V2/, 'the block is hidden');
    assert.match(JSON.stringify(sdk.query('inventory.items', {})), /Rope/);
    assert.match(JSON.stringify(sdk.query('inventory.wallet', {})), /7/);
});

test('the Tools handle answers without a view: the Diagnostics report and the Inspector\'s replies are built at boot', async () => {
    const tools = globalThis.StoryBlock.tools;
    const report = await tools.report();
    assert.match(report, /Story Suite|story-block/);
    const replies = tools.replies();
    assert.ok(Array.isArray(replies) && replies.length > 0, 'the Inspector lists the reply');
    const index = st.ctx.chat.length - 1;
    assert.ok(tools.reply(index), 'one reply\'s detail');
});

test('a canGenerate hook that says no stops the reply and says why (the toast); the next reply goes', async () => {
    let ready = false;
    await sdk.registerModule({ id: 'gate', name: 'Gate', hooks: { canGenerate: () => (ready ? true : { ok: false, reason: 'Make your character first.' }) } });
    const before = st.ctx.chat.length;
    const out = await st.send('Onward.', { reply: 'Never sent.' });
    assert.equal(out.aborted, true);
    assert.equal(st.ctx.chat.length, before + 1, 'only the reader\'s message');
    assert.ok(warned.some(text => /Make your character first\./.test(text)), 'the reader is told');
    ready = true;
    await st.generate('normal', { reply: 'Now it goes.' });
    assert.equal(st.ctx.chat.at(-1).mes.startsWith('Now it goes.'), true);
});

test('sdk.dialog.open answers null: there is no dialog mount without the old view', async () => {
    await sdk.registerModule({ id: 'maker', name: 'Maker', screens: [{ id: 'maker/create', title: 'New character', mounts: ['dialog'], template: '<p>x</p>' }] });
    assert.equal(sdk.dialog.open('maker/create', { draft: {} }), null);
    assert.equal(doc.querySelector('.ss-dialog'), null);
});
