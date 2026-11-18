// Builds the Settings overlay fixture (schema rows per section, module sets, three connections) at code defaults.

import { MOCK_ONLY } from './settings-rows.js';
import { REAL_ROWS } from './settings-real.js';
import { worldEventsRows } from './world-events.js';
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

// With World events on, the real switch row reads on and the two rows that only exist then carry the harness's sample values (tempo 2, 3 Director calls).
function worldRowsOf(rows, on) {
  if (!on) return rows;
  const sample = worldEventsRows();
  return rows.filter(r => r.key !== 'world.eventsOff').map(r => (r.key === 'world.worldEvents' ? { ...r, value: true } : r)).concat(sample.filter(r => !rows.some(w => w.key === r.key)));
}

function buildSections(worldEvents = false, rpg = true) {
  const R = (...args) => row(...args);
  // The real selectors' rows (settings-real.js), then the mock-only ones (settings-rows.js).
  const rows = id => [...(REAL_ROWS[id] ?? []).filter(r => id !== 'tools').map(r => structuredClone(r)), ...(MOCK_ONLY[id] ? MOCK_ONLY[id](R) : [])];
  return [
    sec('start', 'Play', 'Start', 'How much the suite tracks, and the modules with their features.', [], 'start'),
    sec('look', 'Play', 'Look', 'Skin and text.', rows('look')),
    sec('people', 'Rules', 'People', 'Feelings and their pacing, stages, who gets a dossier, Refresh, portraits and the map.', rows('people')),
    ...(rpg ? [sec('rpg', 'Rules', 'RPG and fights', 'Combat Rules v1, progression and fights. The checks’ numbers are in Director.', rows('rpg'))] : []), // the page only while the RPG is on
    sec('world', 'Rules', 'World and time', 'One calendar, one weather, the map and time rules.', worldRowsOf(rows('world'), worldEvents)),
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
  { id: 'quick', name: 'Quick helpers', desc: 'Short calls the reply waits for: keep this fast', choice: 'Fast helper', readOnly: false, testSeconds: 1.1, usedFor: ['checks rolled before the reply (up to 20 s)', 'fight set-up from your attack: the pre-check (up to 20 s)', 'cast moves (waits up to 15 s)'] },
  { id: 'background', name: 'Background', desc: 'Calls nobody waits on; they run behind the others', choice: 'Background helper', readOnly: false, testSeconds: 3.0, usedFor: ['new-person fill-in (with hidden notes)', 'Refresh', 'the fallback call', 'arc plans (never started while a reply is sent)'] },
];

export function buildSettings(opts = {}) {
  const rpg = opts.rpg !== false;
  return {
    subtitle: 'this chat: Ersveil · Astra',
    sections: buildSections(opts.worldEvents === true, rpg),
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
      limits: REAL_ROWS.tools.map(r => structuredClone(r)),
    },
    connections: CONNECTIONS.map(c => ({ ...c, usedFor: [...c.usedFor] })),
  };
}
