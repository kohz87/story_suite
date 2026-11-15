// Defines the view-model shape for the Now tab.

import { SHAPE_TYPES as T } from './shapes.js';

const SUMMARY_ROW = {
  title: T.STRING,
  detail: { $optional: { $nullable: T.STRING } },
};

export const NOW_SHAPE = {
  needsYou: [
    {
      kind: { $enum: ['fight', 'overdue', 'points'] },
      title: T.STRING,
      detail: { $nullable: T.STRING },
      go: { $nullable: T.STRING },
    },
  ],
  today: {
    focus: { $nullable: { $oneOf: [T.STRING, SUMMARY_ROW] } },
    trip: {
      $nullable: {
        state: { $enum: ['planned', 'road', 'arrived'] },
        title: { $optional: T.STRING },
        detail: { $optional: T.STRING },
        progressPct: { $optional: { $nullable: T.NUMBER } },
      },
    },
    dueSoon: { $nullable: { $oneOf: [T.STRING, SUMMARY_ROW, [SUMMARY_ROW]] } },
    torn: [
      {
        stack: T.STRING,
        name: T.STRING,
        detail: { $optional: { $nullable: T.STRING } },
      },
    ],
  },
  here: [
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
      followed: T.BOOLEAN,
      inParty: T.BOOLEAN,
      doing: { $nullable: T.STRING },
      wearing: { $nullable: T.STRING },
      scene: {
        $nullable: {
          wants: { $nullable: T.STRING },
          hiding: { $nullable: T.STRING },
        },
      },
    },
  ],
  thisTurn: {
    count: T.NUMBER,
    items: [
      {
        glyph: T.STRING,
        line: T.STRING,
        detail: { $nullable: T.STRING },
        applied: T.BOOLEAN,
        heldBack: {
          $nullable: {
            asked: T.STRING,
            why: T.STRING,
          },
        },
      },
    ],
  },
  you: {
    look: { $nullable: T.STRING },
    position: { $nullable: T.STRING },
    condition: { $nullable: T.STRING },
  },
  pinned: [
    {
      trackerId: T.STRING,
      name: T.STRING,
      fields: [
        {
          label: T.STRING,
          value: T.STRING,
          pct: { $optional: { $nullable: T.NUMBER } },
          tone: { $optional: { $nullable: T.STRING } },
        },
      ],
    },
  ],
};
