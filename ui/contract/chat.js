// Defines the view-model shape for the chat inline row, people drawer, and reply menu.

import { SHAPE_TYPES as T } from './shapes.js';

export const CHAT_SHAPE = {
  inlineRow: {
    date: T.STRING,
    time: T.STRING,
    place: T.STRING,
    weather: { $nullable: T.STRING },
    money: {
      $nullable: {
        short: T.STRING,
        full: { $optional: T.STRING },
      },
    },
    changes: T.NUMBER,
    notApplied: T.NUMBER,
    needsYou: {
      $nullable: {
        n: T.NUMBER,
        title: T.STRING,
      },
    },
    fightOpen: T.BOOLEAN,
    // The latest reply came with no change block and holds nothing stored for it: the row says so, with a Re-read button.
    unrecorded: { $optional: T.BOOLEAN },
  },
  drawer: [
    {
      personId: T.STRING,
      name: T.STRING,
      portrait: { $nullable: T.STRING },
      meters: {
        trust: T.NUMBER,
        affection: T.NUMBER,
        desire: T.NUMBER,
        tension: T.NUMBER,
      },
      mood: T.STRING,
      where: { $string: { maxLength: 40 } },
      thought: { $nullable: T.STRING },
    },
  ],
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
  replyMenu: {
    at: T.STRING,
    lines: [
      {
        glyph: T.STRING,
        line: T.STRING,
        detail: { $nullable: T.STRING },
        applied: T.BOOLEAN,
        assist: T.BOOLEAN,
      },
    ],
    repaired: T.BOOLEAN,
    counts: {
      changes: T.NUMBER,
      heldBack: T.NUMBER,
      notApplied: T.NUMBER,
    },
    stateThen: {
      place: T.STRING,
      weather: { $nullable: T.STRING },
    },
  },
};
