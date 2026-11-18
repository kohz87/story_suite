// SFW6 (W8): a new person is taught once, as NPC State's `+ npc` line; the names part still reads `+ person` but teaches nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../../../../modules/cast/names/index-parts/part.js';
import { grammarHeads } from '../../../../core/capture.js';

test('the person kind has no grammar line in the prompt, and its head is still read', () => {
    assert.equal(part.kinds.person.grammar, '');
    assert.ok(grammarHeads([{ kind: 'person', ...part.kinds.person }]).has('+ person'));
});
