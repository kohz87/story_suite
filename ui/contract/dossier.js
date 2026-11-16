// Defines the view-model shape for one person's dossier page, including the Death card.

import { SHAPE_TYPES as T } from './shapes.js';

const BAR = [-3, -2, -1, 0, 1, 2, 3];
const NULL_STR = { $nullable: T.STRING };

export const DOSSIER_SHAPE = {
  id: T.STRING,
  name: T.STRING,
  portrait: NULL_STR,
  idLine: T.STRING,
  life: { $enum: ['alive', 'deceased', 'presumed'] },
  genderUnknown: T.BOOLEAN,
  following: T.BOOLEAN,
  inParty: T.BOOLEAN,
  meters: { trust: T.NUMBER, affection: T.NUMBER, desire: T.NUMBER, tension: T.NUMBER },
  stage: { $nullable: { now: T.STRING, next: NULL_STR, needs: NULL_STR } },
  changes: [{ date: T.STRING, meter: T.STRING, delta: T.NUMBER, why: T.STRING, heldBack: T.BOOLEAN }],
  mood: NULL_STR,
  // Mood meters on NPC State's -3..+3 scale (whole numbers); absent when it has no mood numbers.
  moodBars: { $optional: { feeling: { $enum: BAR }, energy: { $enum: BAR }, control: { $enum: BAR } } },
  now: {
    $oneOf: [
      { where: NULL_STR, doing: NULL_STR, wearing: NULL_STR, thought: NULL_STR },
      { lastPlace: NULL_STR, lastSeen: NULL_STR, said: NULL_STR },
    ],
  },
  scene: { $nullable: { wants: T.STRING, hiding: T.STRING } },
  ties: [{ personId: { $nullable: T.STRING }, name: T.STRING, line: T.STRING }],
  past: [{ date: T.STRING, text: T.STRING, dayRef: NULL_STR }],
  secrets: {
    opened: T.NUMBER,
    total: T.NUMBER,
    items: [{ open: T.BOOLEAN, title: NULL_STR, rule: NULL_STR, text: NULL_STR }],
  },
  profile: {
    gender: NULL_STR,
    species: NULL_STR,
    age: NULL_STR,
    home: NULL_STR,
    aliases: NULL_STR,
    looks: NULL_STR,
    personality: NULL_STR,
    speech: NULL_STR,
    background: NULL_STR,
    habits: [T.STRING],
  },
  death: {
    $nullable: {
      how: T.STRING,
      when: T.STRING,
      where: NULL_STR,
      certainty: { $enum: ['confirmed', 'presumed'] },
      referenceLine: T.STRING,
    },
  },
};
