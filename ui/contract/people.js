// Defines the view-model shape for the People tab (here, elsewhere, deceased, ties for the map).

import { SHAPE_TYPES as T } from './shapes.js';

const METERS = { trust: T.NUMBER, affection: T.NUMBER, desire: T.NUMBER, tension: T.NUMBER };

const PERSON_CARD = {
  personId: T.STRING,
  name: T.STRING,
  portrait: { $nullable: T.STRING },
  role: { $optional: { $nullable: T.STRING } },
  followed: T.BOOLEAN,
  inParty: T.BOOLEAN,
  mood: { $nullable: T.STRING },
  meters: METERS,
  where: { $nullable: T.STRING },
};

const ELSEWHERE_CARD = {
  ...PERSON_CARD,
  lastPlace: { $nullable: T.STRING },
  lastSeen: { $nullable: T.STRING },
  said: { $nullable: T.STRING },
};

const DECEASED_CARD = {
  ...PERSON_CARD,
  death: { how: T.STRING, when: T.STRING, where: { $nullable: T.STRING }, presumed: T.BOOLEAN },
};

export const PEOPLE_SHAPE = {
  filter: { $enum: ['all', 'party', 'followed', 'deceased', 'dormant'] },
  counts: {
    all: T.NUMBER,
    party: T.NUMBER,
    followed: T.NUMBER,
    deceased: T.NUMBER,
    notSeenLately: T.NUMBER,
  },
  here: [PERSON_CARD],
  elsewhere: [ELSEWHERE_CARD],
  notSeenLately: T.NUMBER,
  // The dormant people themselves (36.12), optional: the fixtures send only the count.
  dormant: { $optional: [ELSEWHERE_CARD] },
  deceased: [DECEASED_CARD],
  ties: {
    $optional: [{ a: T.STRING, b: T.STRING, kind: { $enum: ['friend', 'kin', 'rival', 'owes'] } }],
  },
};
