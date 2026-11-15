// Defines the view-model shape for the Settings overlay (schema rows, module sets, connections).

import { SHAPE_TYPES as T } from './shapes.js';

const SCALAR = { $oneOf: [T.STRING, T.NUMBER, T.BOOLEAN, T.NULL] };
const MODULE_SET = { $objectOf: { on: T.BOOLEAN, subs: { $objectOf: T.BOOLEAN } } };

export const SETTINGS_ROW_TYPES = ['sw', 'seg', 'num', 'multi', 'sel', 'txt', 'chips', 'btn', 'info'];

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
    packs: [{ name: T.STRING, desc: T.STRING, on: T.BOOLEAN }],
    modules: [{ name: T.STRING, desc: T.STRING, on: T.BOOLEAN }],
    trackers: { cap: T.NUMBER, items: [{ name: T.STRING, desc: T.STRING }] },
  },
  sections: [
    {
      id: T.STRING,
      group: { $enum: ['Play', 'Rules', 'Setup', 'Tools'] },
      name: T.STRING,
      desc: T.STRING,
      special: { $nullable: { $enum: ['start', 'models', 'packs', 'tools'] } },
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
    presets: [{ id: T.STRING, name: T.STRING, desc: T.STRING, tokens: T.NUMBER }],
    defs: [
      {
        id: T.STRING, name: T.STRING, icon: T.STRING, section: T.STRING, desc: T.STRING, off: T.STRING, tokens: T.NUMBER,
        subs: [{ key: T.STRING, label: T.STRING, hint: T.STRING, on: T.BOOLEAN, tags: { $optional: [T.STRING] }, needs: { $optional: T.STRING } }],
      },
    ],
  },
  connections: [
    {
      id: { $enum: ['story', 'quick', 'background'] },
      name: T.STRING,
      desc: T.STRING,
      choice: T.STRING,
      readOnly: T.BOOLEAN,
      usedFor: [T.STRING],
      testSeconds: { $optional: T.NUMBER },
    },
  ],
};
