// Every notice that tells the reader to discard a fight also says where the button is.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WHERE = '(Fight tab, Discard fight)';
// The held-board helpers are gone; the fight's own notices live in these files now.
const FILES = ['lean-rpg/precall.js', 'lean-rpg/board/view.js', 'lean-rpg/board/commit.js', 'lean-rpg/board/port-session.js',
    'lean-rpg/board/start-controller.js', 'lean-rpg/board/engine.js', 'lean-rpg/board/engine-parts/play.js'];

test('the fight notices that tell the reader to discard name the Fight tab button', () => {
    const text = readFileSync(new URL('../../../src/v2/lean-rpg/board/commit.js', import.meta.url), 'utf8');
    assert.ok(text.includes(`discard the fight ${WHERE}.`));
});

test('no shipped string tells the reader to discard without saying where', () => {
    for (const file of FILES) {
        const text = readFileSync(new URL(`../../../src/v2/${file}`, import.meta.url), 'utf8');
        for (const m of text.matchAll(/[Dd]iscard (the fight|it)(?! \(Fight tab, Discard fight\))[^'`\n]*['`]/g)) {
            assert.fail(`${file}: "${m[0]}" does not say where`);
        }
    }
});
