import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectCard } from '../../../ui/select/card.js';
import { CARD_SHAPE } from '../../../ui/contract/card.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { ANSWERS } from './recorded.js';

describe('selectCard', () => {
  it('builds an RPG card that matches the contract', () => {
    const card = selectCard(ANSWERS, { rpg: true, persona: 'Astra', portrait: 'astra.webp' });
    assert.deepEqual(checkShape(card, CARD_SHAPE), []);
    assert.equal(card.scene.date, 'Goldwane 13, 611');
    assert.equal(card.scene.time, '9:30 am');
    assert.equal(card.scene.place, 'Bluewatch · Guild Office');
    assert.equal(card.scene.weekday, null);
    assert.equal(card.you.levelText, 'Level 14');
    assert.deepEqual(card.bars.map(bar => bar.kind), ['hp', 'mp', 'sp']);
    assert.deepEqual(card.chips.party, { n: 2, max: 4 });
    assert.deepEqual(card.chips.pace, { kmDay: 25, by: 'Burr', slowed: true, why: '1 on foot' });
    assert.equal(card.statuses[0].id, 'encumbered');
  });

  it('returns null for what no query answers yet', () => {
    const card = selectCard(ANSWERS, { rpg: true });
    assert.equal(card.chips.soakPct, null);
    assert.equal(card.exp, null);
    assert.equal(card.you.name, 'Astra');
  });

  it('leaves the RPG parts out of a Story-only card', () => {
    const card = selectCard(ANSWERS, { rpg: false, persona: 'Astra' });
    assert.deepEqual(checkShape(card, CARD_SHAPE), []);
    assert.equal('bars' in card, false);
    assert.deepEqual(card.chips, {});
  });

  it('falls back to the scene place and survives an empty answer set', () => {
    const card = selectCard({ 'scene.place': { name: 'Gate', region: 'North' } });
    assert.equal(card.scene.place, 'Gate');
    assert.equal(card.scene.region, 'North');
    const empty = selectCard();
    assert.deepEqual(checkShape(empty, CARD_SHAPE), []);
    assert.equal(empty.scene.time, '');
    assert.equal(empty.you.portrait, null);
  });

  it('uses the level from party.levels when the lead has none, and the default word', () => {
    const answers = { 'party.pc': { id: 'a1' }, 'party.levels': [{ id: 'a1', name: 'Astra', level: 3, left: false }] };
    assert.equal(selectCard(answers, { rpg: true }).you.levelText, 'Lv 3');
    assert.equal(selectCard({ 'party.pc': { id: 'a1' } }, { rpg: true }).you.levelText, null);
  });
});
