// DOSSFIX2 item 5 (REV-dossa F3): a scan's retention request names a stored memory by memorySimilarity, as every other memory match does, so a request for one
// event (Colvin) no longer counts another that shares a phrase (the granary, 0.62 under the old shared-cluster rule) as requested and keeps it over a newer one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeImportantMemories } from '../../modules/people/core/core-record-merge.js';
import { mergeFactMemories } from '../../modules/people/memory/memory-fact-store.js';

const GRANARY = "Astra kept the murdered keeper's granary sealed and brought her quietly without raising a panic";
const COLVIN = 'Astra recovered dead runner Colvin and his intact sealed dispatch from the northern alders without raising a panic';
const OTHERS = [
    'Shared bread and salt with the ferryman at dusk',
    'Watched the abbey bells crack in the frost',
    'Lost a wager over dice to the quartermaster',
    'Mended a torn sail through a long night of rain',
    'Sang the old harvest song at the miller\'s wedding',
];

test('selectCanonical: a request for an event the list no longer holds does not take another that shares a phrase', () => {
    const out = mergeImportantMemories([GRANARY, ...OTHERS], [], [COLVIN]);
    assert.deepEqual(out, OTHERS, 'no request matched: the newest five are kept, the oldest (the granary) goes');
    assert.deepEqual(mergeImportantMemories([GRANARY, ...OTHERS], [], [GRANARY]).slice(0, 1), [GRANARY], 'a request for the granary itself still keeps it');
});

test('chooseOrdinary: a request for one event does not count another sharing a phrase as requested', () => {
    const pin = 'Swore an oath on the old bridge';
    const memories = [pin, GRANARY, ...OTHERS.slice(0, 3)];
    // A new memory makes five ordinary ones for the four slots the pin leaves.
    const out = mergeFactMemories({ memories, manual: [pin], incoming: [OTHERS[3]], retention: [COLVIN] });
    assert.ok(out.memories.includes(pin));
    assert.equal(out.memories.includes(GRANARY), false, 'the granary is not requested, so the four newest ordinary memories take the slots');
    assert.deepEqual(out.memories.filter(text => text !== pin), OTHERS.slice(0, 4));
    const asked = mergeFactMemories({ memories, manual: [pin], incoming: [OTHERS[3]], retention: [GRANARY] });
    assert.ok(asked.memories.includes(GRANARY), 'a request for the granary itself still keeps it');
});
