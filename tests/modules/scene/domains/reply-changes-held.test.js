// reply.changes (modules/scene/domains/core/reply-changes.js): a feeling move NPC State held back is a `held` line whose detail is why: a cap stopped
// it ("held at 22, at the <stop>"), or the day's allowance cut it or moved nothing (the pacing words NPC State put in the receipt's summary).
import test from 'node:test';
import assert from 'node:assert/strict';
import { replyChanges } from '../../../../modules/scene/domains/core/reply-changes.js';

const npc = (summary, name, changes) => ({ index: 3, receipt: { type: 'capture.npc', summary, data: { name, changes } } });
const linesOf = receipts => replyChanges({ domains: { scene: {} } }, { index: 3 }, { receipts: () => receipts }, () => 3).lines.map(l => [l.line, l.detail, l.held === true]);

test('a capped move, a cut move and a move the day\'s allowance stopped are held, each with its why; a plain move is not', () => {
  assert.deepEqual(linesOf([
    npc('Pella: trust 20 → 22 (held at 22; +3 asked).', 'Pella', [{ meter: 'trust', before: 20, after: 22, held: true, stop: 'stage Friendly' }]),
    npc('Edda: trust 1 → 2 (major counted as minor: today\'s major is used on October 2).', 'Edda', [{ meter: 'trust', before: 1, after: 2, held: false }]),
    npc('Rorke: nothing changed (today\'s major is used on October 2).', 'Rorke', []),
    npc('Bo: trust 1 → 2.', 'Bo', [{ meter: 'trust', before: 1, after: 2, held: false }]),
    npc('Ana: nothing moved.', 'Ana', []),
  ]), [
    ['Pella: trust 20 → 22', 'held at 22, at the stage Friendly', true],
    ['Edda: trust 1 → 2', 'major counted as minor: today\'s major is used on October 2', true],
    ['Rorke: nothing moved', 'today\'s major is used on October 2', true],
    ['Bo: trust 1 → 2', null, false],
  ]);
});

test('a name with regex characters is matched as written', () => {
  assert.deepEqual(linesOf([npc('Sister (Old) Ma: nothing changed (today\'s minor is used on story day 3).', 'Sister (Old) Ma', [])]), [['Sister (Old) Ma: nothing moved', 'today\'s minor is used on story day 3', true]]);
});
