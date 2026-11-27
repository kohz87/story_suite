// A scan row tied to one namesake (settledId) gives its mood numbers to that person only, never to the other one with the shared name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scanMoodNumbers } from '../../modules/people/calls/runtime-scan-helpers-parts/scan-results.js';

const g1 = { id: 'npc_g1', name: 'Guard', aliases: ['the gate guard'] };
const g2 = { id: 'npc_g2', name: 'Guard', aliases: ['Bo'] };
const rows = [
    { name: 'Guard', settledId: 'npc_g2', mood: 'angry', moodV: -3, moodA: 4, moodD: 1 },
    { name: 'Guard', settledId: 'npc_g1', mood: 'calm', moodV: 3, moodA: -2, moodD: 0 },
];
const moodOf = row => row?.mood ?? '';

test('each namesake gets the numbers of its own tied row', () => {
    const one = scanMoodNumbers(rows, g1, moodOf), two = scanMoodNumbers(rows, g2, moodOf);
    assert.notDeepEqual(one, two);
    assert.deepEqual(one, scanMoodNumbers([rows[1]], g1, moodOf));
    assert.deepEqual(two, scanMoodNumbers([rows[0]], g2, moodOf));
});

test('an untied row still matches by name as before', () => {
    const plain = [{ name: 'Guard', mood: 'calm', moodV: 3, moodA: -2, moodD: 0 }];
    assert.notEqual(scanMoodNumbers(plain, g1, moodOf), null);
});
