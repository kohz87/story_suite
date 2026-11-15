import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';

function makeChatVm() {
  return {
    inlineRow: {
      date: 'Goldwane 13',
      time: '9:30 am',
      place: 'Guild Office, Bluewatch',
      weather: 'cold drizzle',
      money: { short: '2g 14s 6c', full: '2 gold 14 silver 6 copper' },
      changes: 10,
      notApplied: 0,
      needsYou: { n: 2, title: "Brann's overdue smith bill · 1 point to spend" },
      fightOpen: false,
    },
    drawer: [
      {
        personId: 'temiwa',
        name: 'Sister Temiwa',
        portrait: 'img/temiwa.webp',
        meters: { trust: 22, affection: 9, desire: 0, tension: -4 },
        mood: 'wary hope',
        where: 'by the notice board',
        thought: 'She came back. That counts for something.',
      },
      {
        personId: 'oyla',
        name: 'Oyla',
        portrait: null,
        meters: { trust: 8, affection: 2, desire: 0, tension: 15 },
        mood: 'flustered',
        where: 'behind the counter',
        thought: null,
      },
    ],
    replyMenu: {
      at: 'Goldwane 13, 9:30 am',
      lines: [
        {
          glyph: 'heart',
          line: 'Sister Temiwa: Trust +2',
          detail: 'you handed back the offering coin she dropped',
          applied: true,
        },
        {
          glyph: 'clock',
          line: 'Time 9:10 → 9:30 am',
          detail: null,
          applied: true,
        },
      ],
      counts: { changes: 10, heldBack: 1, notApplied: 0 },
      stateThen: { place: 'Guild Office, Bluewatch', weather: 'cold drizzle' },
    },
  };
}

describe('CHAT_SHAPE', () => {
  it('accepts a valid chat view-model and an empty drawer', () => {
    const vm = makeChatVm();
    assert.deepEqual(checkShape(vm, CHAT_SHAPE), []);

    vm.drawer = [];
    vm.inlineRow.needsYou = null;
    assert.deepEqual(checkShape(vm, CHAT_SHAPE), []);
  });

  it('rejects overlong drawer where strings and non-boolean fightOpen', () => {
    const vm = makeChatVm();
    vm.inlineRow.fightOpen = 'no';
    vm.drawer[0].where = 'a'.repeat(45);
    delete vm.replyMenu.stateThen.place;

    const errors = checkShape(vm, CHAT_SHAPE);
    assert.deepEqual(errors, [
      'inlineRow.fightOpen: expected boolean, got string',
      'drawer[0].where: string length 45 > maxLength 40',
      'replyMenu.stateThen.place: expected string, got undefined',
    ]);
  });
});
