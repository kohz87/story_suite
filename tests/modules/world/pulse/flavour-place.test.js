// The pulse's fixed fallback lines never ask the way to the place the party stands in (SFF4 #6: "A messenger asks you where Bluewatch Village /
// Guild Office is, standing in front of it."); every line still fits the slot rules (one sentence, under 128 characters filled).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAVOUR_MORE } from '../../../../modules/world/pulse/flavour-more.js';
import { FLAVOUR } from '../../../../modules/world/pulse/tables.js';

const lines = table => Object.values(table).flat().map(row => row.text);

test('no fallback line asks where the scene\'s own place is', () => {
    for (const text of [...lines(FLAVOUR_MORE), ...lines(FLAVOUR)]) assert.doesNotMatch(text, /\bwhere \{place\} is\b|\bway to \{place\}/, text);
});

test('the town interruptions keep their count, so a roll picks the same slot it did', () => {
    assert.equal(FLAVOUR_MORE.MUNDANE_INTERRUPTION.filter(row => row.group === 'town').length, 4);
    assert.ok(lines(FLAVOUR_MORE.MUNDANE_INTERRUPTION).includes('A messenger asks you the way to the nearest inn, then hurries off before you finish.'));
});
