import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { CARD_SHAPE } from '../../../ui/contract/card.js';

function makeRpgCard() {
  return {
    rpg: true,
    scene: {
      date: 'Goldwane 13',
      weekday: 'Fourthday',
      time: '9:30 am',
      place: 'Guild Office',
      region: 'Bluewatch',
      weather: 'cold drizzle',
    },
    you: {
      portrait: 'img/astra.webp',
      name: 'Astra',
      levelText: 'Level 14',
      className: 'Sellsword',
    },
    chips: {
      soakPct: 24,
      party: { n: 4, max: 4 },
      pace: { kmDay: 20, by: 'foot', slowed: false, why: null },
    },
    bars: [
      { kind: 'hp', value: 42, max: 48 },
      { kind: 'mp', value: 12, max: 18 },
      { kind: 'sp', value: 30, max: 35 },
    ],
    exp: { value: 640, max: 1000 },
    statuses: [
      { id: 'damp', label: 'Damp', note: 'cold drizzle', tone: 'debuff' },
    ],
  };
}

describe('CARD_SHAPE', () => {
  it('accepts a full RPG character card view-model', () => {
    assert.deepEqual(checkShape(makeRpgCard(), CARD_SHAPE), []);
  });

  it('accepts a Story-only card without level, bars, exp, soak, or party', () => {
    const storyCard = {
      rpg: false,
      scene: {
        date: 'Goldwane 13',
        weekday: null,
        time: '9:30 am',
        place: 'Guild Office',
        region: null,
        weather: null,
      },
      you: {
        portrait: null,
        name: 'Astra',
      },
      chips: {
        pace: { kmDay: 20, by: 'foot', slowed: false, why: null },
      },
      statuses: [],
    };
    assert.deepEqual(checkShape(storyCard, CARD_SHAPE), []);
  });

  it('rejects invalid bar kinds, status tones, and missing required scene fields', () => {
    const card = makeRpgCard();
    card.bars[1].kind = 'xp';
    card.statuses[0].tone = 'neutral';
    delete card.scene.time;

    const errors = checkShape(card, CARD_SHAPE);
    assert.deepEqual(errors, [
      'scene.time: expected string, got undefined',
      'bars[1].kind: expected one of [hp, mp, sp], got "xp"',
      'statuses[0].tone: expected one of [buff, debuff], got "neutral"',
    ]);
  });
});
