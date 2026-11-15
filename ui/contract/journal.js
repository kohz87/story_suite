// Defines the view-model shape for the Journal tab (quests, calendar, days, coming up).

import { SHAPE_TYPES as T } from './shapes.js';

const DUE = {
  date: T.STRING,
  rel: T.STRING,
  state: { $enum: ['', 'soon', 'late'] },
};

const STAGE_MOVE = { who: T.STRING, meter: T.STRING, from: T.STRING, to: T.STRING };

export const JOURNAL_SHAPE = {
  rpg: T.BOOLEAN,
  quests: [
    {
      id: T.STRING,
      title: T.STRING,
      summary: T.STRING,
      step: T.STRING,
      stepIndex: T.NUMBER,
      stepCount: T.NUMBER,
      steps: [T.STRING],
      giver: { personId: { $nullable: T.STRING }, name: T.STRING, portrait: { $optional: { $nullable: T.STRING } } },
      due: { $nullable: DUE },
      place: { $nullable: T.STRING },
      trip: { $optional: { $nullable: T.STRING } },
      reward: { $nullable: T.STRING },
      xp: { $nullable: T.STRING },
      difficulty: { $nullable: { $enum: ['easy', 'normal', 'hard'] } },
    },
  ],
  focusId: { $nullable: T.STRING },
  leads: [{ title: T.STRING, from: T.STRING, where: T.STRING, lapses: T.STRING }],
  closed: [
    {
      title: T.STRING,
      outcome: { $enum: ['done', 'failed', 'gaveup', 'declined', 'lapsed'] },
      detail: T.STRING,
      paid: { $nullable: T.STRING },
    },
  ],
  calendar: {
    months: [{ name: T.STRING, length: T.NUMBER, firstWeekday: T.NUMBER, year: T.NUMBER }],
    weekdays: [{ short: T.STRING, name: T.STRING }],
    era: T.STRING,
    today: { month: T.NUMBER, day: T.NUMBER },
    start: { $nullable: { month: T.NUMBER, day: T.NUMBER } },
  },
  days: [
    {
      month: T.NUMBER,
      day: T.NUMBER,
      date: T.STRING,
      line: T.STRING,
      happened: [T.STRING],
      places: [T.STRING],
      quests: { taken: [T.STRING], done: [T.STRING], failed: [T.STRING], dropped: [T.STRING] },
      fights: T.NUMBER,
      money: { in: { $nullable: T.STRING }, out: { $nullable: T.STRING } },
      stageMoves: [STAGE_MOVE],
      met: [T.STRING],
      world: [T.STRING],
    },
  ],
  planned: [{ glyph: T.STRING, title: T.STRING, detail: T.STRING }],
  upcoming: [
    {
      group: { $enum: ['late', 'soon', 'week', 'later'] },
      name: T.STRING,
      date: T.STRING,
      month: T.NUMBER,
      day: T.NUMBER,
      rel: T.STRING,
      kind: T.STRING,
      glyph: T.STRING,
      tone: { $enum: ['bad', 'warn', 'info'] },
    },
  ],
};
