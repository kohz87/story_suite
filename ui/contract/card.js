// Defines the view-model shape for the shared character card.

import { SHAPE_TYPES as T } from './shapes.js';

export const CARD_SHAPE = {
  rpg: T.BOOLEAN,
  scene: {
    date: T.STRING,
    weekday: { $nullable: T.STRING },
    time: T.STRING,
    place: T.STRING,
    region: { $nullable: T.STRING },
    weather: { $nullable: T.STRING },
  },
  you: {
    portrait: { $nullable: T.STRING },
    name: T.STRING,
    levelText: { $optional: { $nullable: T.STRING } },
    className: { $optional: { $nullable: T.STRING } },
  },
  chips: {
    soakPct: { $optional: { $nullable: T.NUMBER } },
    party: {
      $optional: {
        $nullable: {
          n: T.NUMBER,
          max: T.NUMBER,
        },
      },
    },
    pace: {
      $optional: {
        $nullable: {
          kmDay: T.NUMBER,
          by: T.STRING,
          slowed: T.BOOLEAN,
          why: { $nullable: T.STRING },
        },
      },
    },
  },
  bars: {
    $optional: {
      $nullable: [
        {
          kind: { $enum: ['hp', 'mp', 'sp'] },
          value: T.NUMBER,
          max: T.NUMBER,
        },
      ],
    },
  },
  exp: {
    $optional: {
      $nullable: {
        value: T.NUMBER,
        max: T.NUMBER,
      },
    },
  },
  statuses: [
    {
      id: T.STRING,
      label: T.STRING,
      note: { $nullable: T.STRING },
      tone: { $enum: ['buff', 'debuff'] },
    },
  ],
};
