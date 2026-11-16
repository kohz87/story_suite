// Defines the view-model shape for the Story tab (Director screen and trackers).

import { SHAPE_TYPES as T } from './shapes.js';

// Plan-gated lists: counts always show, items are [] while the plan is hidden.
const gated = item => ({ count: T.NUMBER, items: [item] });

export const STORY_SHAPE = {
  plan: { shown: T.BOOLEAN },
  pulse: {
    mode: { $enum: ['off', 'quiet', 'lively'] },
    quiet: T.BOOLEAN,
    latest: {
      $nullable: {
        roll: { $nullable: T.NUMBER },
        kind: { $nullable: T.STRING },
        cause: { $nullable: T.STRING },
      },
    },
    recent: [
      {
        skipped: T.BOOLEAN,
        roll: { $nullable: T.STRING },
        kind: T.STRING,
        text: T.STRING,
        effect: { $nullable: T.STRING },
      },
    ],
  },
  arc: {
    accepted: { $nullable: T.STRING },
    plan: { $nullable: { title: T.STRING, text: T.STRING, summary: T.STRING } },
  },
  beats: gated({
    title: T.STRING,
    state: { $enum: ['ready', 'wait'] },
    text: T.STRING,
    when: T.STRING,
    personId: { $nullable: T.STRING },
  }),
  clocks: gated({
    title: T.STRING,
    text: T.STRING,
    due: T.STRING,
    shown: { $enum: ['none', 'sign', 'warning'] },
  }),
  hooks: gated({ title: T.STRING, text: T.STRING, when: T.STRING }),
  newsOnWay: gated({ title: T.STRING, text: T.STRING, reaches: T.STRING, how: T.STRING }),
  agendas: gated({
    title: T.STRING,
    who: T.STRING,
    whoId: { $nullable: T.STRING },
    text: T.STRING,
    step: T.NUMBER,
    of: T.NUMBER,
    since: T.STRING,
    place: T.STRING,
    next: T.STRING,
    why: T.STRING,
    toldThisReply: T.BOOLEAN,
  }),
  cast: { total: T.NUMBER, met: T.NUMBER, unmet: T.NUMBER, lastMoved: { $nullable: T.STRING } },
  secrets: gated({
    title: T.STRING,
    text: T.STRING,
    state: T.STRING,
    personId: { $nullable: T.STRING },
    // The person's name for "in <name>'s dossier ›"; optional, the selector leaves it out until there is a data source (owner question).
    person: { $optional: { $nullable: T.STRING } },
  }),
  ripples: gated({ name: T.STRING, sway: T.NUMBER }),
  trackers: [
    {
      id: T.STRING,
      name: T.STRING,
      showOnNow: T.BOOLEAN,
      fields: [
        {
          label: T.STRING,
          value: T.STRING,
          kind: { $enum: ['bar', 'number', 'text'] },
          pct: { $optional: { $nullable: T.NUMBER } },
          tone: { $optional: { $nullable: T.STRING } },
        },
      ],
    },
  ],
  trackersHidden: T.NUMBER,
};
