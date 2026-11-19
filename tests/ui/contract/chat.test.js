import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from '../../../ui/contract/shapes.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';

function makeChatVm() {
  return {
    replies: [
      {
        index: 3,
        top: { date: 'Goldwane 13', time: '9:30 am', place: 'Guild Office, Bluewatch', weather: 'cold drizzle', pools: [{ kind: 'hp', value: 1, max: 8, before: 8 }], condition: 'tired' },
        changes: [{ glyph: 'heart', line: 'Sister Temiwa: Trust +2', detail: null, applied: true, assist: false }],
        chatter: [{ name: 'Oyla', text: 'Not again.' }],
        here: [{ personId: 'temiwa', name: 'Sister Temiwa', portrait: 'img/temiwa.webp', meters: { trust: 22, affection: 9, desire: 0, tension: -4 } }],
        choices: ['Wait'],
      },
    ],
    head: { index: 3, actions: { fight: false, loot: [], points: null, overdue: { n: 1, names: ['the bill'] }, joins: [], offers: 0, unrecorded: false } },
    tabs: [{ id: 'changes', on: true }, { id: 'chatter', on: true }, { id: 'here', on: false }, { id: 'choices', on: true }],
    replyMenu: {
      at: 'Goldwane 13, 9:30 am',
      lines: [
        {
          glyph: 'heart',
          line: 'Sister Temiwa: Trust +2',
          detail: 'you handed back the offering coin she dropped',
          applied: true,
          assist: false,
        },
        {
          glyph: 'clock',
          line: 'Time 9:10 → 9:30 am',
          detail: null,
          applied: true,
          assist: false,
        },
      ],
      repaired: false,
      counts: { changes: 10, heldBack: 1, notApplied: 0 },
      stateThen: { place: 'Guild Office, Bluewatch', weather: 'cold drizzle' },
    },
  };
}

describe('CHAT_SHAPE', () => {
  it('accepts a valid chat view-model, no head and no sheet', () => {
    const vm = makeChatVm();
    assert.deepEqual(checkShape(vm, CHAT_SHAPE), []);
    vm.head = null;
    vm.replyMenu = null;
    vm.replies = [];
    assert.deepEqual(checkShape(vm, CHAT_SHAPE), []);
  });

  it('rejects a bad pool kind, a non-boolean fight and a missing sheet place', () => {
    const vm = makeChatVm();
    vm.replies[0].top.pools[0].kind = 'xp';
    vm.head.actions.fight = 'no';
    delete vm.replyMenu.stateThen.place;
    const errors = checkShape(vm, CHAT_SHAPE);
    assert.equal(errors.length, 3);
    assert.match(errors.join('\n'), /replies\[0\]\.top\.pools\[0\]\.kind/u);
    assert.match(errors.join('\n'), /head\.actions\.fight: expected boolean, got string/u);
    assert.match(errors.join('\n'), /replyMenu\.stateThen\.place: expected string, got undefined/u);
  });
});
