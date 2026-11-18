// Builds the Director section of the Settings view-model from the live module settings: each row reads the stored value (over the default)
// of the same setting the old view's page writes, and a row whose feature is off is left out (its stored value is kept), as the old page does.
import { BUILTIN_MODULES } from '../../core/modules-list.js';
import { SETTINGS_SCHEMA as NPC_SCHEMA, SETTINGS_DEFAULTS as NPC_DEFAULTS } from '../../modules/people/meters/npc-meters-schema.js';
import { DIRECTOR_ROWS, SCENE_SPOILERS } from './director-rows.js';

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

const infoRow = (group, feature, label, hidden) => ({ key: `director.off.${feature}`, group, type: 'info', label: `Turn on ${label} to see these`, hint: `Hidden now: ${hidden.join(', ')}`, value: null, default: null, options: null, unit: null, tags: [], wide: false });
const sceneRow = shown => ({ key: SCENE_SPOILERS.key, group: SCENE_SPOILERS.group, label: SCENE_SPOILERS.label, hint: SCENE_SPOILERS.hint, unit: null, tags: SCENE_SPOILERS.tags, wide: false, type: 'sw', value: shown !== true, default: true, options: null });

/**
 * `answers` = { values: { [moduleId]: settings(moduleId) }, features: the feature list, sceneShown: this chat's Scene spoilers choice (true = shown) }.
 * Returns the Director section ({ id: 'director', rows }); a module the host holds no settings for shows its defaults (the mock always lists the page),
 * and with no feature list read no row is left out for its feature. A row whose feature is off is left out, and its group says which feature to turn on.
 */
export function selectDirector(answers) {
  const a = isObj(answers) ? answers : {};
  const known = Array.isArray(a.features) && a.features.length > 0;
  const byId = new Map((known ? a.features : []).map(f => [f?.id, f]));
  const groups = new Map();
  const bucket = group => { if (!groups.has(group)) groups.set(group, { rows: group === SCENE_SPOILERS.group ? [sceneRow(a.sceneShown)] : [], off: new Map() }); return groups.get(group); };
  for (const spec of DIRECTOR_ROWS) {
    const field = fieldOf(spec);
    const dflt = DEFAULTS[spec.module]?.[spec.field];
    const slot = bucket(spec.group);
    if (!field) continue;
    if (known && field.feature && byId.get(field.feature)?.on !== true) {
      if (byId.has(field.feature)) slot.off.set(field.feature, [...(slot.off.get(field.feature) ?? []), spec.label]); // a feature this host does not have has no switch to turn on
      continue;
    }
    const made = viewRow(spec, field, isObj(a.values?.[spec.module]) ? a.values[spec.module][spec.field] ?? dflt : dflt, dflt);
    if (made) slot.rows.push(made);
  }
  const rows = [];
  for (const [group, { rows: own, off }] of groups) {
    rows.push(...own);
    for (const [feature, hidden] of off) rows.push(infoRow(group, feature, byId.get(feature).label, hidden));
  }
  return { id: 'director', group: 'Rules', name: 'Director', desc: 'Checks, spoilers, the pulse, one planner for arcs and the cast, names.', special: null, rows };
}
