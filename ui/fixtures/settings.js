// Builds the Settings overlay fixture (schema rows per section, module sets, three connections) at code defaults.

import { SECTION_ROWS } from './settings-rows.js';
import { MODULE_DEFS, PRESETS, REMOVED, PANELS } from './settings-extra.js';

// row(group, key, type, label, value, extra): one schema row; default equals value unless extra.default says otherwise.
function row(group, key, type, label, value, extra = {}) {
  return {
    key, group, type, label,
    hint: extra.hint ?? null,
    value,
    default: 'default' in extra ? extra.default : value,
    options: extra.options ?? null,
    unit: extra.unit ?? null,
    tags: extra.tags ?? [],
    wide: Boolean(extra.wide),
  };
}

const sec = (id, group, name, desc, rows, special = null) => ({ id, group, name, desc, special, rows });

function buildSections() {
  const R = (...args) => row(...args);
  const rows = id => (SECTION_ROWS[id] ? SECTION_ROWS[id](R) : []);
  return [
    sec('start', 'Play', 'Start', 'How much the suite tracks, and the modules with their features.', [], 'start'),
    sec('look', 'Play', 'Look', 'Skin and text.', rows('look')),
    sec('people', 'Rules', 'People', 'Feelings and their pacing, stages, who gets a dossier, Refresh, portraits and the map.', rows('people')),
    sec('rpg', 'Rules', 'RPG and fights', 'Combat Rules v1, progression and fights. The checks’ numbers are in Director.', rows('rpg')),
    sec('world', 'Rules', 'World and time', 'One calendar, one weather, the map and time rules.', rows('world')),
    sec('director', 'Rules', 'Director', 'Checks, spoilers, the pulse, one planner for arcs and the cast, names.', rows('director')),
    sec('money', 'Rules', 'Money', 'Coins and prices.', rows('money')),
    sec('extras', 'Rules', 'Chat extras', 'Choices, inner chatter, your look and trackers.', rows('extras')),
    sec('models', 'Setup', 'Models', 'Three connections instead of five pickers, and the one fallback call.', rows('models'), 'models'),
    sec('packs', 'Setup', 'Packs and trackers', 'Content packs, data modules and your trackers.', [], 'packs'),
    sec('addons', 'Setup', 'Add-ons', 'Modules, custom views and skins from packs.', rows('addons')),
    sec('tools', 'Tools', 'Tools', 'What is sent, the budgets, prompts, Inspector, problems, diagnostics and chat data.', rows('tools'), 'tools'),
  ];
}

function buildModuleSet(rpg) {
  const set = {};
  for (const m of MODULE_DEFS) {
    set[m.id] = { on: m.id === 'rpg' ? rpg : true, subs: Object.fromEntries(m.subs.map(x => [x.key, x.on])) };
  }
  return set;
}

const CONNECTIONS = [
  { id: 'story', name: 'Story', desc: 'Follows the chat’s connection; change it in SillyTavern', choice: 'The chat’s own', readOnly: true, testSeconds: 2.4, usedFor: ['narration', 'change lines', 'pulse ideas (inside the reply)'] },
  { id: 'quick', name: 'Quick helpers', desc: 'Short calls the reply waits for: keep this fast', choice: 'Fast helper', readOnly: false, testSeconds: 1.1, usedFor: ['checks rolled before the reply (up to 20 s)', 'fight set-up from your attack (up to 20 s)', 'cast moves (waits up to 15 s)'] },
  { id: 'background', name: 'Background', desc: 'Calls nobody waits on; they run behind the others', choice: 'Background helper', readOnly: false, testSeconds: 3.0, usedFor: ['new-person fill-in (with hidden notes)', 'Refresh', 'the fallback call', 'arc plans (never started while a reply is sent)'] },
];

export function buildSettings(opts = {}) {
  const rpg = opts.rpg !== false;
  return {
    subtitle: 'this chat: Ersveil · Astra',
    sections: buildSections(),
    modules: {
      scope: 'chat',
      chat: buildModuleSet(rpg),
      newChats: buildModuleSet(true),
      preset: 'full',
      defs: MODULE_DEFS.map(m => ({ ...m, subs: m.subs.map(x => ({ ...x })) })),
      presets: PRESETS.map(p => ({ ...p })),
    },
    removed: [...REMOVED],
    packs: structuredClone(PANELS.packs),
    sent: {
      ...PANELS.sent, used: 551, cap: 1500, total: 8447,
      limits: [
        row('', 'tools.notesBudget', 'num', 'Notes per reply', 1500, { hint: 'Story Block’s notes; the People block keeps its own budget (People section)', unit: 'tokens' }),
        row('', 'tools.contextShare', 'num', 'Most of the context the suite may use', 40, { unit: '%' }),
        row('', 'tools.changeLines', 'num', 'Change lines per reply', 150),
      ],
    },
    connections: CONNECTIONS.map(c => ({ ...c, usedFor: [...c.usedFor] })),
  };
}
