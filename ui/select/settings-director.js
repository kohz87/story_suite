// Builds the Director section of the Settings view-model from the live module settings: each row reads the stored value (over the default)
// of the same setting the old view's page writes, and a row whose feature is off is left out (its stored value is kept), as the old page does.
import { BUILTIN_MODULES } from '../../core/modules-list.js';
import { SETTINGS_SCHEMA as NPC_SCHEMA, SETTINGS_DEFAULTS as NPC_DEFAULTS } from '../../modules/people/meters/npc-meters-schema.js';
import { DIRECTOR_ROWS } from './director-rows.js';

const SCHEMAS = { 'story-director': BUILTIN_MODULES.find(m => m.id === 'story-director')?.settings?.schema ?? {}, 'npc-state-delta': NPC_SCHEMA };
const DEFAULTS = { 'story-director': BUILTIN_MODULES.find(m => m.id === 'story-director')?.settings?.defaults ?? {}, 'npc-state-delta': NPC_DEFAULTS };
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The schema field a Director row is backed by, or null. */
export function fieldOf(spec) { return SCHEMAS[spec.module]?.[spec.field] ?? null; }

function viewRow(spec, field, value, dflt) {
  const base = { key: spec.key, group: spec.group, label: spec.label, hint: spec.hint ?? null, unit: spec.unit ?? null, tags: spec.tags ?? [], wide: false };
  if (field.type === 'bool') return { ...base, type: 'sw', value: Boolean(value), default: Boolean(dflt), options: null };
  if (field.type === 'int') return { ...base, type: 'num', value: Number.isFinite(value) ? value : null, default: Number.isFinite(dflt) ? dflt : null, options: null };
  if (field.type === 'text') return { ...base, type: 'txt', value: typeof value === 'string' ? value : '', default: typeof dflt === 'string' ? dflt : '', options: null };
  if (field.type === 'choice') {
    const labels = spec.labels ?? {};
    return { ...base, type: 'seg', value: labels[value] ?? labels[dflt] ?? null, default: labels[dflt] ?? null, options: Object.values(labels) };
  }
  return null;
}

/**
 * `answers` = { values: { [moduleId]: settings(moduleId) }, features: the feature list }.
 * Returns the Director section ({ id: 'director', rows }), or null when the host holds none of its settings.
 */
export function selectDirector(answers) {
  const a = isObj(answers) ? answers : {};
  const on = new Set((Array.isArray(a.features) ? a.features : []).filter(f => f?.on === true).map(f => f.id));
  const rows = [];
  for (const spec of DIRECTOR_ROWS) {
    const field = fieldOf(spec);
    const values = a.values?.[spec.module];
    if (!field || !isObj(values) || (field.feature && !on.has(field.feature))) continue;
    const made = viewRow(spec, field, values[spec.field], DEFAULTS[spec.module]?.[spec.field]);
    if (made) rows.push(made);
  }
  if (!rows.length) return null;
  return { id: 'director', group: 'Rules', name: 'Director', desc: 'Checks, spoilers, the pulse, one planner for arcs and the cast, names.', special: null, rows };
}
