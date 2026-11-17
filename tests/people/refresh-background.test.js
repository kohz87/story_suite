// N8 part 3: rule 3 asks for a `background` quote; it is stored like the other slow fields' evidence, and a background with no grounded quote is left out.
import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__npcMock = { extensionSettings: {}, context: {}, saveSettingsCalls: 0 };
const { applyBackgroundRule, groundedBackgroundQuotes } = await import('../../modules/people/calls/refresh-background.js');
const { mergeScanResult, normalizeNpcRecord } = await import('../../modules/people/core/core.js');
const { normalizeProfileEvidence, promptProfileEvidence, emptyProfileEvidence } = await import('../../modules/people/core/core-evidence.js');

const window = '[m3] Myla grew up in the salt flats and sold ledgers to the caravans.\n[m4] She nods.';
const row = { id: 'myla', name: 'Myla Venn', background: 'Raised in the salt flats; sold ledgers to caravans.', backgroundState: 'update', backgroundReason: 'told' };

test('a background update with a quote of the window is kept', () => {
    const profile = { id: 'myla', evidence: { background: ['[m3] grew up in the salt flats and sold ledgers'] } };
    const ruled = applyBackgroundRule(row, profile, window);
    assert.equal(ruled.row.background, row.background);
    assert.deepEqual(ruled.profile.evidence.background, ['[m3] grew up in the salt flats and sold ledgers']);
});

test('a background update with no quote, or a quote the window does not hold, is dropped', () => {
    for (const profile of [undefined, { id: 'myla', evidence: {} }, { id: 'myla', evidence: { background: [] } }, { id: 'myla', evidence: { background: ['[m9] a harbour fire that never happened'] } }]) {
        const ruled = applyBackgroundRule(row, profile, window);
        assert.equal(ruled.row.background, undefined);
        assert.equal(ruled.row.backgroundState, undefined);
        assert.equal(ruled.row.name, 'Myla Venn', 'the rest of the row stays');
        if (profile?.evidence?.background) assert.deepEqual(ruled.profile.evidence.background, []);
    }
    assert.deepEqual(groundedBackgroundQuotes({ evidence: { background: ['[m3] salt flats'] } }, window), ['[m3] salt flats']);
});

test('background evidence is stored like the other slow fields: same caps, merged into the record, never sent in a scan prompt', () => {
    assert.equal(emptyProfileEvidence().background, undefined, 'a record with no quote reads as before');
    const items = Array.from({ length: 12 }, (_, i) => `[m${i}] fact ${i} about ${['harbours', 'salt', 'caravans', 'ledgers', 'storms', 'orchards', 'forges', 'tides', 'bridges', 'wells', 'kilns', 'mills'][i]}`);
    const evidence = normalizeProfileEvidence({ background: items, speech: items });
    assert.ok(evidence.background.length > 0 && evidence.background.length < items.length, 'capped');
    assert.deepEqual(evidence.background, evidence.speech, 'the same caps as the other slow fields');
    assert.equal(promptProfileEvidence({ background: ['[m1] salt flats'], speech: ['[m2] dry'] }).background, undefined);
    const base = normalizeNpcRecord({ id: 'myla', name: 'Myla Venn', role: 'clerk' });
    const { state } = mergeScanResult({ npcs: [base], candidates: [], turn: 1 }, { npcs: [], profileUpdates: [{ id: 'myla', name: 'Myla Venn', evidence: { background: ['[m3] grew up in the salt flats'] } }] }, { skipRelationshipUpdate: true, preservePresence: true });
    assert.deepEqual(state.npcs.find(npc => npc.id === 'myla').profileEvidence.background, ['[m3] grew up in the salt flats']);
});
