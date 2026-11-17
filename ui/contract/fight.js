// Defines the view-model shape for the Fight tab and the fight scene renderer (board state, foes, party strip, actions per member, log, end).

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
  // The input this action stands for, as the kind stages it: `choice` is the kind's choice id, `args` the rest of the action (`who` and so on).
  // Targets: 'member' = a single-target foe, adds that member's `arg`; 'group' = an area skill that needs a group, adds that group's `arg`;
  // 'none' = no target (also an area skill that needs no group); 'ally' = a party member, adds that member's `arg`.
  // Every area action's `pick.args` carries `area: true` ('group' and 'none' alike): without it the kind treats a group pick as single-target.
  // `alone` = the pick is staged by itself, at once (Flee is the whole exchange).
  pick: { choice: T.STRING, args: T.ANY, alone: { $optional: T.BOOLEAN } },
};

// The stance the acting member owns: `on` is whether it was up in the last exchange (the switch's start), `soakOn` / `soakOff` the soak with and without it (null for a stance that does not soak), `paid` the Stamina move the mock's note names (null from the engine).
const STANCE = { $nullable: { name: T.STRING, on: T.BOOLEAN, soakOn: { $nullable: T.NUMBER }, soakOff: { $nullable: T.NUMBER }, paid: { $nullable: [T.NUMBER] } } };

export const FIGHT_SHAPE = {
  state: { $enum: ['offer', 'choose', 'target', 'ally', 'after', 'end'] },
  title: T.STRING,
  subtitle: { $nullable: T.STRING },
  exchange: T.NUMBER,
  foeGroups: [
    {
      id: T.STRING,
      arg: T.ANY, // the args tapping this group adds to a pick (area skill)
      name: T.STRING,
      // the odds word is null while the v1 engine has no source for it (open owner question); a card with a null shows no odds. (tier is the foe group's own tier word.)
      tier: { $nullable: { $enum: ['Mob', 'Minion', 'Standard', 'Elite', 'Boss', 'Apex'] } },
      lv: T.NUMBER,
      odds: { word: { $nullable: { $enum: ODDS } } },
      members: [{ id: T.STRING, arg: T.ANY, name: T.STRING, hp: T.NUMBER, max: T.NUMBER }],
    },
  ],
  party: [
    {
      id: T.STRING, arg: T.ANY, actorId: T.STRING, name: T.STRING, portrait: { $nullable: T.STRING },
      hp: T.NUMBER, hpMax: T.NUMBER, mp: T.NUMBER, mpMax: T.NUMBER, sp: T.NUMBER, spMax: T.NUMBER,
      chosen: { $nullable: T.STRING },
    },
  ],
  actor: {
    $nullable: {
      id: T.STRING,
      stance: STANCE,
      groups: { Attack: [ACTION], Magic: [ACTION], Item: [ACTION], Flee: [ACTION] },
    },
  },
  // Every standing member's actions, in the order the picks are asked; `id` is the party member's `actorId` (the input's `actor`). The scene renderer reads these, not `actor`; a member's `stance` (when they own one) rides on each.
  actors: [{ id: T.STRING, stance: { $optional: STANCE }, groups: { Attack: [ACTION], Magic: [ACTION], Item: [ACTION], Flee: [ACTION] } }],
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
      xpEach: { $nullable: T.NUMBER }, // the one figure when every paid hero got the same, else null (v1 pays by each hero's level); the end card then shows no XP figure
      exchanges: T.NUMBER,
      members: [{ id: T.STRING, hp: T.NUMBER, hpMax: T.NUMBER, practice: [{ skill: T.STRING, gain: T.NUMBER }] }],
    },
  },
};
