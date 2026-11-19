// Defines the view-model shape for the chat surfaces: one card per reply, the newest reply's action line, the tab order, the modules' cards and the ✦ sheet.

import { SHAPE_TYPES as T } from './shapes.js';
import { LOOT_OFFER_SHAPE } from './loot.js';

// One reply's change line (as the ✦ sheet listed them): its glyph, words, detail (a held-back move's why) and whether it was applied.
const LINE = { glyph: T.STRING, line: T.STRING, detail: { $nullable: T.STRING }, applied: T.BOOLEAN, assist: T.BOOLEAN };

export const CHAT_SHAPE = {
  // One card per story reply drawn (ui/select/reply-log.js), each from the state at that reply.
  replies: [
    {
      index: T.NUMBER,
      top: {
        date: T.STRING,
        time: T.STRING,
        place: T.STRING,
        weather: { $nullable: T.STRING },
        // HP, MP and SP at that reply; `before` is the value before it when this reply moved it.
        pools: [{ kind: { $enum: ['hp', 'mp', 'sp'] }, value: T.NUMBER, max: T.NUMBER, before: { $nullable: T.NUMBER } }],
        condition: { $nullable: T.STRING },
      },
      changes: [LINE],
      chatter: [{ name: T.STRING, text: T.STRING }],
      here: [{ personId: T.STRING, name: T.STRING, portrait: { $nullable: T.STRING }, meters: { trust: T.NUMBER, affection: T.NUMBER, desire: T.NUMBER, tension: T.NUMBER } }],
      choices: [T.STRING],
    },
  ],
  // The newest reply (its index) and its action line (ui/select/reply-actions.js); null while the chat has no reply.
  head: {
    $nullable: {
      index: T.NUMBER,
      actions: {
        fight: T.BOOLEAN,
        loot: [LOOT_OFFER_SHAPE],
        points: { $nullable: { n: T.NUMBER, who: [T.STRING] } },
        overdue: { $nullable: { n: T.NUMBER, names: [T.STRING] } },
        joins: [T.STRING],
        offers: T.NUMBER,
        unrecorded: T.BOOLEAN,
      },
    },
  },
  // The tabs' order and which show (Settings › Chat extras › Tabs; ui/select/reply-tabs.js).
  tabs: [{ id: { $enum: ['changes', 'chatter', 'here', 'choices'] }, on: T.BOOLEAN }],
  // The modules' cards under the head reply (ui/select/reply-card.js); absent when none answers.
  replyCards: {
    $optional: {
      index: T.NUMBER,
      list: [
        {
          key: T.STRING,
          card: {
            tone: T.STRING,
            title: T.STRING,
            text: T.STRING,
            rows: [{ text: T.STRING, tag: T.STRING }],
            actions: [{ id: T.STRING, label: T.STRING, primary: T.BOOLEAN, command: T.STRING, open: T.STRING, payload: T.ANY }],
          },
        },
      ],
    },
  },
  // The ✦ sheet's reply (null when it has nothing stored): its actions read `repaired`; its lines are the Changes tab's.
  replyMenu: {
    $nullable: {
      at: T.STRING,
      lines: [LINE],
      repaired: T.BOOLEAN,
      counts: { changes: T.NUMBER, heldBack: T.NUMBER, notApplied: T.NUMBER },
      stateThen: { place: T.STRING, weather: { $nullable: T.STRING } },
    },
  },
};
