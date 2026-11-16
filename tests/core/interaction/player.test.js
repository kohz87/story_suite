// The persona rule marks exactly one reader actor and supplies the default when a kind has no roster.

import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultActors, isReader, markPlayer, playerOf } from '../../../src/v2/interaction/player.js';

test('the persona rule folds case, width, spaces and hyphens', () => {
    assert.equal(isReader('  Iron-Breath ', 'iron breath'), true);
    assert.equal(isReader('ＡＳＴＲＡ', 'astra'), true);
    assert.equal(isReader('Astra', ''), false);
    assert.equal(isReader('Ren', 'Astra'), false);
});

test('markPlayer sets one player flag without changing the roster and playerOf reads it', () => {
    const actors = [{ id: 'a', name: 'Ren', party: true }, { id: 'b', name: 'Astra', party: true, player: true }];
    const marked = markPlayer(actors, 'ASTRA');
    assert.equal(playerOf(marked).id, 'b');
    assert.equal(marked.filter(actor => actor.player).length, 1);
    assert.equal(actors[0].player, undefined, 'the input roster was not changed');
    assert.deepEqual(defaultActors('Astra'), [{ id: 'player', name: 'Astra', party: true, player: true }]);
});
