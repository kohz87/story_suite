// Two different events that share a phrase are two memories (owner's chat, 21 Nov): Rorke's #14 memory of Colvin's recovery replaced her #8 memory of the
// granary (and its stamp) because both end "... without raising a panic"; a rewording of the same event is still one memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeScanResult, normalizeNpcRecord } from '../../modules/people/core/core.js';
import { normalizeStoredMemories } from '../../modules/people/core/core-record-shared.js';
import { mergeImportantMemories } from '../../modules/people/core/core-record-merge-parts/memories.js';
import { memorySimilarity } from '../../modules/people/core/core-relationship.js';
import { normalizeName } from '../../modules/people/core/core-text.js';

const REGISTERED = 'Astra signed the ledger and paid the registry fee in copper';
const GRANARY = "Astra kept the murdered keeper's granary sealed and brought her quietly without raising a panic";
const STRAIGHT = 'Astra described every barrel moved in the cellar to the clerk';
const COLVIN = 'Astra recovered dead runner Colvin and his intact sealed dispatch from the northern alders without raising a panic';
const stamps = { [normalizeName(REGISTERED)]: { m: 4, d: 'October 1' }, [normalizeName(GRANARY)]: { m: 8, d: 'October 1' }, [normalizeName(STRAIGHT)]: { m: 10, d: 'October 1' }, [normalizeName(COLVIN)]: { m: 14, d: 'October 1' } };
const rorke = () => normalizeNpcRecord({ id: 'npc_rorke', name: 'Watch-Captain Edda Rorke', present: true, memories: [REGISTERED, GRANARY, STRAIGHT, COLVIN], memoryStamps: stamps });

test('two events sharing a tail are both kept by the stored-list rule and the merge, in their own order', () => {
    assert.ok(memorySimilarity(GRANARY, COLVIN) < 0.58, 'the shared "without raising a panic" does not make them one event');
    assert.deepEqual(normalizeStoredMemories([REGISTERED, GRANARY, STRAIGHT, COLVIN]), [REGISTERED, GRANARY, STRAIGHT, COLVIN]);
    assert.deepEqual(mergeImportantMemories([REGISTERED, GRANARY, STRAIGHT], [COLVIN]), [REGISTERED, GRANARY, STRAIGHT, COLVIN]);
});

test('a later scan of the reply keeps the #8 memory and its stamp: the stamps run 4, 8, 10, 14', () => {
    const before = rorke();
    assert.deepEqual(before.memories, [REGISTERED, GRANARY, STRAIGHT, COLVIN], 'reading the record keeps all four');
    const after = mergeScanResult({ turn: 6, npcs: [before], candidates: [] }, { npcs: [{ id: 'npc_rorke', name: 'Watch-Captain Edda Rorke', present: true, memories: [COLVIN] }] },
        { turn: 7, sourceMessageId: 14, developmentContext: `${COLVIN}. ${GRANARY}.` }).state.npcs[0];
    assert.deepEqual(after.memories, [REGISTERED, GRANARY, STRAIGHT, COLVIN]);
    assert.deepEqual(after.memories.map(text => after.memoryStamps[normalizeName(text)]?.m), [4, 8, 10, 14]);
});

test('a rewording of the same event is still one memory', () => {
    const short = 'Astra kept the granary sealed without raising a panic';
    assert.ok(memorySimilarity(short, GRANARY) >= 0.58, 'one holds the other');
    assert.equal(normalizeStoredMemories([GRANARY, short]).length, 1);
    assert.equal(normalizeStoredMemories([GRANARY, GRANARY.toUpperCase()]).length, 1);
});
