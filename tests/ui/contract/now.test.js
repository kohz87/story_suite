import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { NOW_SHAPE } from '../../../ui/contract/now.js';

function makeNowVm() {
  return {
    needsYou: [
      {
        kind: 'overdue',
        title: "Overdue: Brann's smith bill",
        detail: 'Goldwane 12 · 1 day late',
        go: 'journal',
      },
      {
        kind: 'points',
        title: '1 point to spend',
        detail: 'Astra · level 14',
        go: 'party',
      },
    ],
    today: {
      focus: { title: 'Missing boatman', detail: 'next: reach Auvoth and ask at the docks' },
      trip: {
        state: 'planned',
        title: 'Trip to Auvoth · planned',
        detail: 'leave about 10:00 am · 3 legs on foot · arrive about 3:18 pm',
        progressPct: 0,
      },
      dueSoon: { title: 'Due tomorrow: Word to the harbour', detail: 'Goldwane 14, evening' },
      torn: [{ stack: 'oak-shield', name: 'Oak round shield', detail: 'repair 6 silver here' }],
    },
    here: [
      {
        personId: 'torka',
        name: 'Torka',
        portrait: 'img/torka.webp',
        meters: { trust: 41, affection: 28, desire: 6, tension: 12 },
        mood: 'restless',
        where: 'leaning on the counter',
        thought: 'Five silver. An insult.',
        followed: true,
        inParty: true,
        doing: 'Arguing about the contract pay',
        wearing: 'Brigandine, red scarf, hob boots',
        scene: {
          wants: 'A bigger cut of the harbour job.',
          hiding: 'The Red Cord is looking for her.',
        },
      },
      {
        personId: 'oyla',
        name: 'Oyla',
        portrait: null,
        meters: { trust: 8, affection: 2, desire: 0, tension: 15 },
        mood: 'flustered',
        where: 'behind the counter',
        thought: null,
        followed: false,
        inParty: false,
        doing: 'Stamping papers',
        wearing: null,
        scene: null,
      },
    ],
    thisTurn: {
      count: 2,
      items: [
        {
          glyph: 'heart',
          line: 'Torka: Affection +1',
          detail: 'ordinary moment cap',
          applied: true,
          heldBack: { asked: '+8', why: 'an ordinary moment moves a feeling at most 1' },
        },
        {
          glyph: 'clock',
          line: '+20 minutes',
          detail: 'now 9:30 am',
          applied: true,
          heldBack: null,
        },
      ],
    },
    you: {
      look: 'Travel leathers under a grey wool cloak.',
      position: 'At the counter, half-turned toward Torka',
      condition: 'Damp from the drizzle and cold to the bone',
    },
    pinned: [
      {
        trackerId: 'chapel-debt',
        name: 'Chapel debt',
        fields: [
          { label: 'Owed', value: '120 silver', pct: 83, tone: 'bad' },
          { label: 'Due', value: 'Goldwane 30 · in 17 days', pct: null },
        ],
      },
    ],
  };
}

describe('NOW_SHAPE', () => {
  it('accepts a valid Now tab view-model', () => {
    assert.deepEqual(checkShape(makeNowVm(), NOW_SHAPE), []);
  });

  it('rejects overlong where strings, invalid needsYou kinds, and bad trip states', () => {
    const vm = makeNowVm();
    vm.needsYou[0].kind = 'other';
    vm.today.trip.state = 'paused';
    vm.here[0].where = 'x'.repeat(41);

    const errors = checkShape(vm, NOW_SHAPE);
    assert.deepEqual(errors, [
      'needsYou[0].kind: expected one of [fight, overdue, points], got "other"',
      'today.trip.state: expected one of [planned, road, arrived], got "paused"',
      'here[0].where: string length 41 > maxLength 40',
    ]);
  });
});
