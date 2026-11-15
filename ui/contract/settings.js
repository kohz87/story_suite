// Defines the view-model shape for the Settings overlay (schema rows, module sets, connections).

import { SHAPE_TYPES as T } from './shapes.js';

const SCALAR = { $oneOf: [T.STRING, T.NUMBER, T.BOOLEAN, T.NULL] };
const MODULE_SET = { $objectOf: { on: T.BOOLEAN, subs: { $objectOf: T.BOOLEAN } } };

export const SETTINGS_ROW_TYPES = ['sw', 'seg', 'num', 'multi', 'sel', 'txt', 'chips', 'btn', 'info'];

export const SETTINGS_SHAPE = {
  sections: [
    {
      id: T.STRING,
      group: { $enum: ['Play', 'Rules', 'Setup', 'Tools'] },
      name: T.STRING,
      desc: T.STRING,
      special: { $nullable: { $enum: ['start', 'models', 'packs', 'tools'] } },
      rows: [
        {
          key: T.STRING,
          group: T.STRING,
          type: { $enum: SETTINGS_ROW_TYPES },
          label: T.STRING,
          hint: { $nullable: T.STRING },
          value: { $oneOf: [SCALAR, [SCALAR], { $objectOf: SCALAR }] },
          default: { $oneOf: [SCALAR, [SCALAR], { $objectOf: SCALAR }] },
          options: { $nullable: [T.STRING] },
          unit: { $nullable: T.STRING },
          tags: [{ $enum: ['merged', 'replaced', 'cost', 'chat'] }],
        },
      ],
    },
  ],
  modules: {
    scope: { $enum: ['chat', 'newChats'] },
    chat: MODULE_SET,
    newChats: MODULE_SET,
    preset: { $nullable: { $enum: ['lean', 'standard', 'full'] } },
  },
  connections: [
    {
      id: { $enum: ['story', 'quick', 'background'] },
      name: T.STRING,
      desc: T.STRING,
      choice: T.STRING,
      readOnly: T.BOOLEAN,
      usedFor: [T.STRING],
    },
  ],
};
