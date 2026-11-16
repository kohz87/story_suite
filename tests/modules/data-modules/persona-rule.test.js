// The data-modules core reads "is this the reader's own character" through interaction/player.js: one persona rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCore } from '../../../modules/data-modules/part/core.js';
import { isReader } from '../../../core/interaction/player.js';

const CASES = [['Iron-Breath', ' iron breath '], ['ＡＳＴＲＡ', 'Astra'], ['Astra', ''], ['Astra', 'Ren'], ['Astra', undefined], ['Astra', null], ['', '']];

test('createCore.isReader answers exactly as interaction/player.js does for the same name and persona', () => {
    for (const [name, persona] of CASES) {
        const core = createCore({ packs: {}, persona: () => persona });
        assert.equal(core.isReader(name), isReader(name, persona), `${name} / ${persona}`);
    }
    assert.equal(createCore({ packs: {}, persona: () => { throw new Error('no chat'); } }).isReader('Astra'), false);
});

test('core.js imports the rule from interaction/player.js and keeps no folding rule of its own', () => {
    const source = readFileSync(new URL('../../../modules/data-modules/part/core.js', import.meta.url), 'utf8');
    assert.match(source, /from '(\.\.\/){6}core\/interaction\/player\.js'/);
    assert.doesNotMatch(source, /lean-rpg\/read\.js|normalize\('NFKC'\)|\.replace\(\/\\s\+\/g/);
});
