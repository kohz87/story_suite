// SFW6 (W24): NPC State's own upkeep receipts ("Joris Veen: meters started.") are bookkeeping, never a line of a day's digest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isBookkeeping } from '../../../../modules/world/chronicle/days/shared.js';

const receipt = summary => ({ type: 'npc.meters', module: 'npc-state', cause: 'story', narrate: false, summary, data: {} });

test('"meters started", "nothing moved" and "nothing changed" receipts are bookkeeping; a real change is not', () => {
    for (const summary of ['Joris Veen: meters started.', 'Joris Veen: nothing moved', 'Mira: nothing changed.']) assert.equal(isBookkeeping(receipt(summary)), true, summary);
    assert.equal(isBookkeeping(receipt('Joris Veen: trust +4 (3 → 7).')), false);
});
