// The Extensions drawer: one Story Suite drawer reading "Story Suite <version>", NPC State's panel inside it, no old headers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './ux.helpers.js';

test('after boot there is exactly one drawer header, "Story Suite 2.0.0-test", and none of the old names', async () => {
    const { doc } = await page();
    const headers = doc.querySelectorAll('.inline-drawer-header');
    assert.equal(headers.length, 1);
    assert.equal(headers[0].textContent.trim(), 'Story Suite 2.0.0-test');
    for (const header of headers) assert.doesNotMatch(header.textContent, /Story Block|NPC State Delta/);
});

test('NPC State settings that mounted before the drawer move into the one drawer', async () => {
    const { doc, ui } = await page();
    doc.querySelector('#story_suite_v2_drawer').remove();
    const npc = doc.createElement('div');
    npc.id = 'npc_state_delta_settings';
    doc.querySelector('#extensions_settings').appendChild(npc);
    ui.refresh();
    const content = doc.querySelector('#story_suite_v2_drawer .inline-drawer-content');
    assert.ok(content.contains(doc.querySelector('#npc_state_delta_settings')));
    assert.equal(doc.querySelectorAll('.inline-drawer-header').length, 1);
});
