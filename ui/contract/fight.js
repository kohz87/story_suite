// Defines the view-model shape for the Fight tab (board state, foes, party strip, actions, log, end).

import { SHAPE_TYPES as T } from './shapes.js';

const ODDS = ['likely', 'even', 'long shot'];

const ACTION = {
  id: T.STRING,
  label: T.STRING,
  cost: T.STRING,
  target: { $enum: ['member', 'group', 'ally', 'none'] },
  damage: { $nullable: T.STRING },
  odds: { $nullable: { $enum: ODDS } },
  enabled: T.BOOLEAN,
};

export const FIGHT_SHAPE = {
  state: { $enum: ['offer', 'choose', 'target', 'ally', 'after', 'end'] },
  title: T.STRING,
  subtitle: { $nullable: T.STRING },
  exchange: T.NUMBER,
  foeGroups: [
    {
      name: T.STRING,
      tier: { $enum: ['Mob', 'Minion', 'Standard', 'Elite', 'Boss', 'Apex'] },
      lv: T.NUMBER,
      odds: { word: { $enum: ODDS } },
      members: [{ id: T.STRING, name: T.STRING, hp: T.NUMBER, max: T.NUMBER }],
    },
  ],
  party: [
    {
      id: T.STRING, name: T.STRING, portrait: { $nullable: T.STRING },
      hp: T.NUMBER, hpMax: T.NUMBER, mp: T.NUMBER, mpMax: T.NUMBER, sp: T.NUMBER, spMax: T.NUMBER,
      chosen: { $nullable: T.STRING },
    },
  ],
  actor: {
    $nullable: {
      id: T.STRING,
      stance: { $nullable: { name: T.STRING, on: T.BOOLEAN, soakOn: T.NUMBER, soakOff: T.NUMBER, paid: { $nullable: [T.NUMBER] } } },
      groups: { Attack: [ACTION], Magic: [ACTION], Item: [ACTION], Flee: [ACTION] },
    },
  },
  order: [T.STRING],
  bonuses: { $nullable: [{ label: { $nullable: T.STRING }, text: T.STRING }] },
  log: [
    {
      n: T.NUMBER,
      summary: T.STRING,
      rows: [{ who: T.STRING, what: T.STRING, outcome: T.STRING, math: T.STRING }],
    },
  ],
  narratorTold: { $nullable: T.STRING },
  end: {
    $nullable: {
      outcome: { $enum: ['won', 'fled', 'lost'] },
      xpEach: T.NUMBER,
      exchanges: T.NUMBER,
      members: [{ id: T.STRING, hp: T.NUMBER, hpMax: T.NUMBER, practice: [{ skill: T.STRING, gain: T.NUMBER }] }],
    },
  },
};
