// Marker lines: one word per kind, dropped from the prompt history under the kind's own feature; `[battle]` stays byte for byte as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry } from '../../../core/registry.js';
import { stripMarkers } from '../../../core/interaction/markers.js';
import { stripBattleMarker } from '../../../core/turn/text.js';
import { PROBE_KIND } from './helpers/probe-kind.js';

const LEGACY = /^[ \t]*\[battle\][ \t]*(?:\r?\n|$)(?:[ \t]*\r?\n)?/gim;
const TEXTS = ['The fight.\n[battle]\n\nAfter it.', '[battle]', 'a\r\n[BATTLE]  \r\n\r\nb', 'inline [battle] stays', 'two\n[battle]\nx\n[battle]\n', 'none', ''];

test('the battle word strips exactly what the old marker regex stripped', () => {
    for (const text of TEXTS) {
        const old = /\[battle\]/i.test(text) ? text.replace(LEGACY, '') : text;
        assert.equal(stripBattleMarker(text), old, JSON.stringify(text));
        assert.equal(stripMarkers(text, ['battle']), old);
    }
    assert.equal(stripBattleMarker(7), 7);
});

test('several words are stripped together, none strips nothing, a word is not a pattern', () => {
    assert.equal(stripMarkers('a\n[scene]\n\nb\n[battle]\nc', ['battle', 'scene']), 'a\nb\nc');
    assert.equal(stripMarkers('a\n[scene]\nb', []), 'a\n[scene]\nb');
    assert.equal(stripMarkers('a\n[a.c]\nb\n[abc]\n', ['a.c']), 'a\nb\n[abc]\n');
});

const kindOf = (marker, feature = null) => { const { marker: _gone, ...rest } = PROBE_KIND; return { ...rest, feature, ...(marker ? { marker } : {}) }; };
function registryWith(kinds, on = {}) {
    const registry = createRegistry({ featureValue: id => on[id] });
    const features = ['mod.beta', 'mod.delta'].map(id => ({ id, label: id, describe: id, default: true }));
    registry.register({ id: 'mod', name: 'Mod', features, interactions: kinds });
    return registry;
}

test('markerWords lists the words of kinds whose marker feature is on', () => {
    const kinds = { a: kindOf({ word: 'alpha' }), b: kindOf({ word: 'beta', feature: 'mod.beta' }), c: kindOf(null), d: kindOf({ word: 'delta' }, 'mod.delta') };
    const words = on => registryWith(kinds, on).markerWords();
    assert.deepEqual(words({ 'mod.beta': true, 'mod.delta': true }), ['alpha', 'beta', 'delta']);
    assert.deepEqual(words({ 'mod.beta': false, 'mod.delta': false }), ['alpha'], 'a marker feature off, or the kind feature when none is named, hides the word');
    assert.deepEqual(words({ 'mod.beta': true, 'mod.delta': false }), ['alpha', 'beta']);
});

test('a registered kind\'s marker word leaves the prompt history; with RPG off and no kind the history is untouched', async t => {
    const { createHost } = await import('../../../packages/story-block/testkit/index.js');
    const seen = async (host, mainApi) => {
        await host.send('One.', 'The quay.\n\n[probe]\n\n[battle]\n\nAfter.');
        const second = await host.send('Two.', 'Reply two.');
        return second.request.chat.filter(item => item.role === 'assistant').map(item => item.content).join('\n');
    };
    const withKind = await createHost({ modules: [{ id: 'test', name: 'Test', interactions: { probe: PROBE_KIND } }] });
    t.after(() => withKind.close());
    const text = await seen(withKind);
    assert.ok(text.includes('The quay.') && text.includes('After.'));
    assert.ok(!/\[probe\]/.test(text), 'the kind word is dropped');
    assert.ok(/\[battle\]/.test(text), 'the RPG is off: [battle] stays as it always did');
    const plain = await createHost({});
    t.after(() => plain.close());
    assert.ok(/\[probe\]/.test(await seen(plain)), 'no kind registered: nothing stripped');
});
