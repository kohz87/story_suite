// Defines the view-model shape for the Settings overlay (schema rows, module sets, connections).

import { SHAPE_TYPES as T } from './shapes.js';

const SCALAR = { $oneOf: [T.STRING, T.NUMBER, T.BOOLEAN, T.NULL] };
const MODULE_SET = { $objectOf: { on: T.BOOLEAN, subs: { $objectOf: T.BOOLEAN } } };

export const SETTINGS_ROW_TYPES = ['sw', 'seg', 'num', 'multi', 'sel', 'txt', 'area', 'chips', 'btn', 'info', 'lines']; // area: several lines of text

const ROW = {
  key: T.STRING,
  group: T.STRING,
  type: { $enum: SETTINGS_ROW_TYPES },
  label: T.STRING,
  hint: { $nullable: T.STRING },
  value: { $oneOf: [SCALAR, [SCALAR], { $objectOf: SCALAR }] },
  default: { $oneOf: [SCALAR, [SCALAR], { $objectOf: SCALAR }] },
  options: { $nullable: [T.STRING] },
  unit: { $nullable: T.STRING },
  tags: [T.STRING],
  wide: T.BOOLEAN,
  list: { $optional: { items: [{ $objectOf: SCALAR }], unused: [T.NUMBER], note: { $nullable: T.STRING }, meters: { $optional: [T.STRING] } } },
};

// The world-and-game page (format 4): present only when a format 4 pack is installed.
const PICKER = { value: T.STRING, options: [{ value: T.STRING, label: T.STRING }] };
// (a world pack with lore carries its lorebook row: ui/select/packs-lorebook.js)
const LOREBOOK_ROW = { id: T.STRING, name: T.STRING, state: { $enum: ['create', 'update', 'current'] }, button: T.STRING, desc: T.STRING, upToDate: T.BOOLEAN, attach: T.BOOLEAN, linked: T.BOOLEAN, move: T.BOOLEAN, use: { on: T.BOOLEAN, disabled: T.BOOLEAN, note: T.STRING } };
const PACK_ROW = { id: T.STRING, name: T.STRING, tag: T.STRING, desc: T.STRING, problem: { $optional: T.STRING }, lorebook: { $optional: LOREBOOK_ROW } };
const PACKS_V4 = {
  world: PICKER,
  game: PICKER,
  worldName: T.STRING,
  gameName: T.STRING,
  suggest: { $nullable: { id: T.STRING, game: T.STRING, installed: T.BOOLEAN } },
  lines: [{ level: { $enum: ['error', 'warning'] }, text: T.STRING }],
  installed: [PACK_ROW],
  addOns: [PACK_ROW],
};

export const SETTINGS_SHAPE = {
  subtitle: { $nullable: T.STRING },
  sent: {
    $nullable: {
      used: T.NUMBER,
      cap: T.NUMBER,
      total: { $nullable: T.NUMBER },
      budget: [{ name: T.STRING, used: T.NUMBER, cap: { $nullable: T.NUMBER }, color: T.STRING }],
      text: T.STRING,
      tools: [{ label: T.STRING, hint: T.STRING, button: T.STRING }],
      limits: [ROW],
    },
  },
  removed: [T.STRING],
  packs: {
    packs: [{ id: { $optional: T.STRING }, name: T.STRING, desc: T.STRING, on: T.BOOLEAN, problem: { $optional: T.STRING } }],
    v4: { $optional: PACKS_V4 },
    modules: [{ id: { $optional: T.STRING }, name: T.STRING, desc: T.STRING, on: T.BOOLEAN, locked: { $optional: T.BOOLEAN } }],
    trackers: { cap: T.NUMBER, items: [{ id: { $optional: T.STRING }, name: T.STRING, desc: T.STRING }], rpgOwned: { $optional: [T.STRING] } },
  },
  sections: [
    {
      id: T.STRING,
      group: { $enum: ['Play', 'Rules', 'Setup', 'Tools'] },
      name: T.STRING,
      desc: T.STRING,
      special: { $nullable: { $enum: ['start', 'models', 'packs', 'tools', 'help'] } },
      rows: [
        ROW,
      ],
    },
  ],
  modules: {
    scope: { $enum: ['chat', 'newChats'] },
    chat: MODULE_SET,
    newChats: MODULE_SET,
    preset: { $nullable: { $enum: ['lean', 'standard', 'full'] } },
    presets: [{ id: T.STRING, name: T.STRING, desc: T.STRING, tokens: { $nullable: T.NUMBER } }],
    defs: [
      {
        id: T.STRING, name: T.STRING, icon: T.STRING, section: T.STRING, desc: T.STRING, off: T.STRING, tokens: { $nullable: T.NUMBER },
        subs: [{ key: T.STRING, label: T.STRING, hint: T.STRING, on: T.BOOLEAN, tags: { $optional: [T.STRING] }, needs: { $optional: T.STRING }, locked: { $optional: T.BOOLEAN }, lockWhy: { $optional: T.STRING } }],
      },
    ],
  },
  // The tabs under each reply, in order (Settings › Chat extras › Tabs).
  replyTabs: { $optional: [{ id: { $enum: ['changes', 'chatter', 'here', 'choices'] }, on: T.BOOLEAN }] },
  connections: [
    {
      id: { $enum: ['story', 'quick', 'background'] },
      name: T.STRING,
      desc: T.STRING,
      choice: T.STRING,
      value: { $optional: T.STRING },
      options: { $optional: [{ value: T.STRING, label: T.STRING }] },
      note: { $optional: T.STRING },
      readOnly: T.BOOLEAN,
      usedFor: [T.STRING],
      testSeconds: { $optional: T.NUMBER },
    },
  ],
};
