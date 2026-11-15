// Defines the view-model shape for the World tab (places, routes, trip, news, factions).

import { SHAPE_TYPES as T } from './shapes.js';

const NULL_STR = { $nullable: T.STRING };

export const WORLD_SHAPE = {
  places: [
    {
      id: T.STRING,
      name: T.STRING,
      kind: T.STRING,
      region: NULL_STR,
      x: T.NUMBER,
      y: T.NUMBER,
      visited: T.BOOLEAN,
      here: T.BOOLEAN,
      danger: { $enum: ['safe', 'risky', 'dangerous'] },
      people: { $optional: [T.STRING] },
      quests: { $optional: [T.STRING] },
    },
  ],
  routes: [{ kind: { $enum: ['road', 'track'] }, a: T.STRING, b: T.STRING }],
  trip: {
    $nullable: {
      state: { $enum: ['planned', 'road', 'arrived'] },
      placeIds: [T.STRING],
      legs: [{ from: T.STRING, to: T.STRING, km: { $nullable: T.NUMBER }, minutes: T.NUMBER, note: NULL_STR }],
      leave: NULL_STR,
      arrive: NULL_STR,
    },
  },
  news: [
    {
      id: T.STRING,
      title: T.STRING,
      state: { $enum: ['looming', 'ongoing', 'rumour', 'resolved'] },
      summary: T.STRING,
      placeId: NULL_STR,
      factionId: { $optional: NULL_STR },
      heard: [{ where: T.STRING, when: T.STRING, from: NULL_STR }],
    },
  ],
  factions: [
    {
      id: T.STRING,
      name: T.STRING,
      stance: { $enum: ['friendly', 'warm', 'neutral', 'unfriendly', 'hostile'] },
      summary: T.STRING,
      areaPlaceIds: [T.STRING],
      members: [{ personId: NULL_STR, name: T.STRING }],
    },
  ],
};
