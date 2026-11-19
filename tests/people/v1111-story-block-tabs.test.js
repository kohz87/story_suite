import test from 'node:test';
import assert from 'node:assert/strict';
import { dossierRowNodes, emptyCastHtml } from '../../modules/people/dossier-rows.js';
import { fakeDocument } from './helpers/fake-dom.js';
import { runtimeSource } from './helpers/runtime-source.js';
import { styleSource } from './helpers/shipped-modules.js';

// Story Block list helpers: the dossier rows and the empty-cast line (the v1 tab registration was removed 12 Nov).

test('v1.1.11 dossier rows: names are text (never markup), and an initial stands in without a portrait', () => {
    const markup = (rows, opts) => dossierRowNodes(rows, fakeDocument(), opts).map(node => node.serialize()).join('');
    const html = markup([{ id: 'x"1', name: '<Ilsa>', role: 'a & b', statusLabel: 'Off-screen', portrait: '' }]);
    assert.match(html, /data-npc-id="x&quot;1"/);
    assert.match(html, /&lt;Ilsa&gt;/);
    assert.match(html, /a &amp; b · Off-screen/);
    assert.match(html, /<span class="ppl-story-thumb ss-listcard-icon"><span class="">&lt;<\/span><\/span>|<span>&lt;<\/span>/);
    assert.match(markup([]), /No dossier matches\./);
    // (1.2.13) With no dossier at all: say so, and offer Add NPC and Scan now; a search says what it searched.
    assert.match(markup([], { total: 0 }), /No dossiers yet\.[\s\S]*data-ppl-action="add"[\s\S]*data-ppl-action="scan"/);
    assert.match(markup([], { query: 'Ly<ra', total: 3 }), /No dossier matches “Ly&lt;ra”/);
});

test('v1.1.12 the Story Block pane is padded; the in-chat display choice is gone', () => {
    const index = runtimeSource();
    const css = styleSource();
    assert.doesNotMatch(index, /presentCastDisplay|present_cast_display/, 'B4-6: no in-chat cards, so no choice for them');
    assert.match(css, /\.ppl-story-pane \{ padding: 8px 12px 12px;/);
});

test('1.2.13 an empty Present NPCs tab says why, and offers Scan now when a scan could help', () => {
    const html = emptyCastHtml({ text: 'No NPC has a dossier in this chat yet <b>', scan: true });
    assert.match(html, /No NPC has a dossier in this chat yet &lt;b&gt;/);
    assert.match(html, /data-ppl-action="scan"/);
    assert.doesNotMatch(emptyCastHtml({ text: 'No chat is open.', scan: false }), /data-ppl-action/);
    assert.match(emptyCastHtml(), /No NPC is present in the latest scene\./);
});
