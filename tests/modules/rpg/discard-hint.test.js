// Every notice that tells the reader to discard a fight also says where the button is.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardFailure, restoreHint } from '../../../core/turn/held-board.js';

const WHERE = '(Fight tab, Discard fight)';
const FILES = ['modules/rpg/precall.js', 'modules/rpg/board/view.js', 'modules/rpg/board/commit.js', 'modules/rpg/board/session.js',
    'modules/rpg/board/start-controller.js', 'modules/rpg/board/engine.js', 'core/turn/held-board.js', 'core/turn/held-board-parts/failure.js', 'core/turn/held-board-parts/held.js', 'core/turn/held-board-parts/board-state.js', 'core/turn/reread.js', 'core/turn/events.js', 'core/turn/prompt-build.js'];

test('discard advice in held-board helpers names the Fight tab button', () => {
    assert.ok(restoreHint('x').includes(`discard the fight ${WHERE}.`));
    assert.ok(restoreHint('x', ' before retrying.').includes(`${WHERE} before retrying.`));
    assert.equal(restoreHint('Discard it and start again'), '');
    assert.ok(boardFailure('Could not save:', 'sheet moved').endsWith(`discard the fight ${WHERE}.`));
});

test('no shipped string tells the reader to discard without saying where', () => {
    for (const file of FILES) {
        const text = readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8');
        for (const m of text.matchAll(/[Dd]iscard (the fight|it)(?! \(Fight tab, Discard fight\))[^'`\n]*['`]/g)) {
            assert.fail(`${file}: "${m[0]}" does not say where`);
        }
    }
});
