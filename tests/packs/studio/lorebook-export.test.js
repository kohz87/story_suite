// Export lorebook's pure side: the file is the converter's book, holds no hidden text, and the note and the off reasons say the right thing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { exportLorebook, loreState } from '../../../studio/lorebook-export.js';
import { lorebookFromPack } from '../../../packs/lorebook-make/convert.js';

const ERSVEIL = JSON.parse(fs.readFileSync(new URL('../../../examples/packs/ersveil/pack.json', import.meta.url)));
const world = doc => ({ doc, kind: 'world', legacy: false });

test('the file is the converter\'s book, named for the pack id, and no hidden entry\'s text is in it', () => {
    const doc = structuredClone(ERSVEIL);
    doc.content.lore.push({ title: 'Secret door', keys: ['door'], text: 'HIDDEN-SECRET-TEXT-42', hidden: true });
    const file = exportLorebook(world(doc));
    assert.equal(file.name, 'ersveil-lorebook.json');
    const text = new TextDecoder().decode(file.bytes);
    assert.deepEqual(JSON.parse(text), lorebookFromPack(doc, { packName: doc.name }).book);
    assert.equal(text.includes('HIDDEN-SECRET-TEXT-42'), false);
    assert.equal(text.includes('Secret door'), false);
    const { counts } = lorebookFromPack(doc);
    assert.equal(loreState(world(doc)).note, `${counts.entries} entries; ${counts.hidden} hidden entries kept out.`);
    assert.ok(counts.hidden >= 6);
});

test('it is off, with the reason, for a game pack, a world with no lore and a world whose lore is all hidden', () => {
    assert.deepEqual(exportLorebook({ doc: {}, kind: 'game' }), null);
    assert.match(loreState({ doc: {}, kind: 'game' }).note, /game pack has no lore/);
    const none = { id: 'w', name: 'W', content: { lore: [] } };
    assert.equal(loreState(world(none)).on, false);
    assert.match(loreState(world(none)).note, /no lore/);
    const hidden = { id: 'w', name: 'W', content: { lore: [{ title: 'A', keys: ['a'], text: 'x', hidden: true }] } };
    assert.equal(loreState(world(hidden)).on, false);
    assert.match(loreState(world(hidden)).note, /its one lore entry is hidden/);
    assert.deepEqual(loreState(null), { on: false, note: null });
    assert.deepEqual(loreState({ doc: ERSVEIL, kind: 'world', legacy: true }), { on: false, note: null });
});
