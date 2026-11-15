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
  replyMenu: {
    at: T.STRING,
    lines: [
      {
        glyph: T.STRING,
        line: T.STRING,
        detail: { $nullable: T.STRING },
        applied: T.BOOLEAN,
      },
    ],
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
