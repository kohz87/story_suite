// Builds the Settings view-model from today's host settings (schema, defaults, stored values), the feature list and the connection profiles; gaps come back empty or null.

import { selectConnections } from './connections.js';
import { selectCalls } from './calls.js';
import { selectDirector } from './settings-director.js';
import { selectMoneyRows } from './money-rows.js';
import { selectProblems, selectSent } from './tools.js';
import { peopleRows } from './people-settings/index.js';
import { selectRpgRows } from './rpg-rows.js';
import { worldRows } from './settings-world.js';
import { extrasRows, withExtras } from './settings-extras.js';
import { selectPacks } from './packs.js';
import { selectAddons } from './addons.js';

// The Settings page a module's feature switches belong to, when it is not the module's own id.
const SECTION_OF = { 'npc-state-delta': 'people', 'story-director': 'director' };
const LOOK = ['panelStyle', 'glassStrength', 'font', 'textSize', 'sendPending'];
const BUDGETS = ['tailBudget', 'contextShare', 'maxChangeLines'];   // callQueue is in the Models page's Calls group
// Skin "Solid" is dropped (decision 36.15), so it is never offered.
const DROPPED = new Set(['solid']);
const SEG_MAX = 3;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const optionOf = o => (isObj(o) ? { value: String(o.value), label: String(o.label ?? o.value) } : { value: String(o), label: String(o) });

// One schema field + stored value + default → one contract row, or null when the field is not a kind the overlay draws.
function rowFor(group, key, field, value, dflt) {
  if (!isObj(field)) return null;
  const base = { key: `host.${key}`, group, label: String(field.label ?? key), hint: field.help ?? null, unit: null, tags: [], wide: false };
  if (field.type === 'bool') return { ...base, type: 'sw', value: Boolean(value), default: dflt === undefined ? null : Boolean(dflt), options: null };
  if (field.type === 'int') {
    const n = Number.isFinite(value) ? value : null;
    const unit = /\((%|tokens)\)\s*$/.exec(base.label);
    return { ...base, label: unit ? base.label.replace(/\s*\(.*\)\s*$/, '') : base.label, unit: unit ? unit[1] : null, type: 'num', value: n, default: Number.isFinite(dflt) ? dflt : null, options: null };
  }
  if (field.type === 'choice' && Array.isArray(field.options)) {
    const opts = field.options.map(optionOf).filter(o => !DROPPED.has(o.value));
    if (!opts.length) return null;
    const find = v => opts.find(o => o.value === String(v)) ?? null;
    const dl = find(dflt);
    const shown = find(value) ?? dl;
    return {
      ...base, type: field.form === 'segmented' || opts.length <= SEG_MAX ? 'seg' : 'sel',
      value: shown ? shown.label : null, default: dl ? dl.label : null, options: opts.map(o => o.label),
    };
  }
  return null;
}

function rowsOf(group, keys, host, schema, defaults) {
  return keys.map(k => rowFor(group, k, schema[k], host[k], defaults[k])).filter(Boolean);
}

const section = (id, group, name, desc, rows, special = null) => ({ id, group, name, desc, special, rows });

// "Lean/Standard/Full" value of one feature (SB features.js presetValue:200-207): null when outside presets.
function presetValue(f, name) {
  if (f.presets === false) return null;
  const fallback = f.default !== false;
  if (name === 'standard') return fallback;
  const own = isObj(f.presets) ? f.presets[name] : undefined;
  return typeof own === 'boolean' ? own : fallback;
}

// The preset the switches match now (SB features.js selectedPreset:222-226): null when custom or nothing to compare.
function presetOf(list) {
  const own = list.filter(f => f.presets !== false && f.available !== false);
  if (!own.length) return null;
  return ['lean', 'standard', 'full'].find(n => own.every(f => (f.on === true) === presetValue(f, n))) ?? null;
}

function moduleParts(features) {
  const defs = new Map();
  for (const f of features) {
    if (!isObj(f) || typeof f.id !== 'string') continue;
    const id = String(f.moduleId ?? 'story-block');
    if (!defs.has(id)) defs.set(id, { id, name: String(f.moduleName ?? id), icon: '', section: SECTION_OF[id] ?? id, desc: '', off: '', tokens: 0, subs: [] });
    const sub = { key: f.id, label: String(f.label ?? f.id), hint: String(f.describe ?? ''), on: f.on === true };
    if (f.available === false && typeof f.why === 'string') sub.needs = f.why;
    defs.get(id).subs.push(sub);
  }
  const defList = [...defs.values()];
  const set = {};
  for (const d of defList) set[d.id] = { on: d.subs.some(s => s.on), subs: Object.fromEntries(d.subs.map(s => [s.key, s.on])) };
  return { defList, set };
}

/**
 * `answers`: { host: settings() (SB sdk/settings.js:74, stored over defaults), defaults: HOST_SETTINGS_DEFAULTS (sdk/constants.js:10),
 * schema: HOST_SETTINGS_SCHEMA (:11), features: feature store list() (SB features.js:303), profiles?: listProfiles() (the Models page's dropdowns), modules?: sdk.modules() (the Add-ons page's installed list), subtitle?, people?: the NPC State settings (sdk.settings('npc-state-delta')), director?: settings('story-director') (the World page's values), directorPage?: { values: settings per module id, features } (the Director page), tools?: { sent: the handle's sent(), problems, blocked, nameOf } }.
 * → the settings view-model (contract/settings.js), or null when neither host settings nor a feature list was read.
 * Gaps (packs, presets, per-chat module sets) are empty or null.
 */
export function selectSettings(answers) {
  const a = isObj(answers) ? answers : {};
  const hasHost = isObj(a.host) && isObj(a.schema);
  const hasFeatures = Array.isArray(a.features);
  if (!hasHost && !hasFeatures) return null;
  const host = hasHost ? a.host : {};
  const schema = hasHost ? a.schema : {};
  const defaults = isObj(a.defaults) ? a.defaults : {};
  const budgetRows = rowsOf('Budgets', BUDGETS, host, schema, defaults);
  const t = isObj(a.tools) ? a.tools : {};
  const sent = selectSent(t.sent ?? null, selectProblems(t), budgetRows);
  const { defList, set } = withExtras(moduleParts(hasFeatures ? a.features : []), hasFeatures ? a.features : []);
  const sections = [
    section('start', 'Play', 'Start', 'How much the suite tracks, and the modules with their features.', [], 'start'),
    section('look', 'Play', 'Look', 'Skin and text.', rowsOf('Skin', LOOK, host, schema, defaults)),
    section('people', 'Rules', 'People', 'Feelings and their pacing, stages, who gets a dossier, Refresh, portraits and the map.', peopleRows(a.people)),
    section('rpg', 'Rules', 'RPG and fights', 'Combat Rules v1, progression and fights. The checks’ numbers are in Director.', selectRpgRows(a.rpg)),
    section('world', 'Rules', 'World and time', 'One calendar, one weather, the map and time rules.', worldRows(a.director, hasFeatures ? a.features : [])),
    ...[selectDirector(a.directorPage)].filter(Boolean),
    section('money', 'Rules', 'Money', 'Coins and prices.', selectMoneyRows(a.money)),
    section('extras', 'Rules', 'Chat extras', 'Choices, inner chatter, your look and trackers.', extrasRows(a.extras)),
    section('models', 'Setup', 'Models', 'Three connections instead of five pickers, and the one fallback call.', selectCalls({ queue: host.callQueue, ...(isObj(a.calls) ? a.calls : {}) }, a.features), 'models'),
    section('packs', 'Setup', 'Packs and trackers', 'Content packs, data modules and your trackers.', [], 'packs'),
    section('addons', 'Setup', 'Add-ons', 'Modules, custom views and skins from packs.', selectAddons(a.modules)),
    section('tools', 'Tools', 'Tools', 'What is sent, the budgets, prompts, Inspector, problems, diagnostics and chat data.', sent ? [] : budgetRows, 'tools'),
  ];
  return {
    subtitle: typeof a.subtitle === 'string' ? a.subtitle : null,
    sent,
    removed: [],
    packs: selectPacks(a.packsAnswers),
    sections,
    modules: { scope: 'chat', chat: set, newChats: {}, preset: hasFeatures ? presetOf(a.features) : null, presets: [], defs: defList },
    connections: selectConnections(host, isObj(a.profiles) ? a.profiles : null),
  };
}
