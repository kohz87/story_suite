// Builds a Rules page for each plug-in module (not a built-in) that has a feature on and a settings schema: the page is named by the module's settings `section`.
import { BUILTIN_MODULES } from '../../core/modules-list.js';
import { rpgFeatureRows } from './rpg-features.js';
import { replacedRows } from './replaced.js';
import { LEAN_RPG_FEATURE } from '../../modules/rpg/names-parts/feature.js';

// Story Block's own module and the built-ins keep their pages (and the Start cards' links) as they are.
const BUILT_IN = new Set(['story-block', ...BUILTIN_MODULES.map(m => m.id)]);
const SEG_MAX = 3;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The page id of a plug-in's Rules page: `plugin-<module id>`, so it never clashes with a built-in section id. */
export const pluginPageId = moduleId => `plugin-${moduleId}`;
/** True for Story Block's own module and the built-in modules (they have no plug-in page). */
export const isBuiltInModule = moduleId => BUILT_IN.has(moduleId);

/** The row key of one plug-in setting: `plugin.<module id>.<field>` (ui/port/plugin-settings.js writes it). */
export const pluginKey = (moduleId, field) => `plugin.${moduleId}.${field}`;

// One schema field with its stored value and default → one contract row, or null for a kind the page does not draw. The schema's "<section>: " label prefix is dropped (the page is already named so).
function rowFor(section, moduleId, name, field, value, dflt) {
  if (!isObj(field)) return null;
  const prefix = `${section}: `;
  const raw = String(field.label ?? name);
  const base = { key: pluginKey(moduleId, name), group: typeof field.group === 'string' ? field.group : section, label: raw.startsWith(prefix) ? raw.slice(prefix.length) : raw, hint: field.help ?? null, unit: null, tags: [], wide: false };
  if (field.type === 'bool') return { ...base, type: 'sw', value: value === undefined ? dflt === true : value === true, default: dflt === true, options: null };
  if (field.type === 'int') return { ...base, type: 'num', value: Number.isFinite(value) ? value : Number.isFinite(dflt) ? dflt : null, default: Number.isFinite(dflt) ? dflt : null, options: null };
  if (field.type === 'text' && field.form === 'prompt') return { ...base, type: 'prompt', wide: true, value: typeof value === 'string' ? value : '', default: '', builtin: typeof field.builtin === 'string' ? field.builtin : '', ...(Number.isFinite(field.max) ? { max: field.max } : {}), options: null };
  if (field.type === 'text') return { ...base, type: 'txt', value: typeof value === 'string' ? value : typeof dflt === 'string' ? dflt : '', default: typeof dflt === 'string' ? dflt : '', options: null };
  if (field.type === 'choice' && Array.isArray(field.options) && field.options.length) {
    const opts = field.options.map(o => (isObj(o) ? { value: String(o.value), label: String(o.label ?? o.value) } : { value: String(o), label: String(o) }));
    const find = v => opts.find(o => o.value === String(v)) ?? null;
    const shown = find(value) ?? find(dflt);
    return { ...base, type: field.form === 'segmented' || opts.length <= SEG_MAX ? 'seg' : 'sel', value: shown ? shown.label : null, default: find(dflt)?.label ?? null, options: opts.map(o => o.label) };
  }
  return null;
}

/**
 * `modules`: sdk.modules() (a module's `settingsPage` is { section, schema, defaults }), `features`: the feature list, `values`: { [module id]: that module's stored settings }.
 * → one Rules section per plug-in whose feature is on, with a row for each schema field whose own feature (if it names one) is on. Built-ins and plug-ins without a section give none.
 */
export function selectPluginPages(modules, features, values) {
  const list = Array.isArray(features) ? features : [];
  return (Array.isArray(modules) ? modules : []).flatMap(m => {
    const page = m?.settingsPage;
    if (!isObj(m) || BUILT_IN.has(m.id) || !isObj(page) || !isObj(page.schema)) return [];
    const mine = list.filter(f => f?.moduleId === m.id);
    if (!mine.some(f => f.on === true)) return [];
    const stored = isObj(values?.[m.id]) ? values[m.id] : {};
    const own = Object.entries(page.schema).flatMap(([name, field]) => {
      if (isObj(field) && field.feature && list.find(f => f?.id === field.feature)?.on !== true) return [];
      return [rowFor(page.section, m.id, name, field, stored[name], page.defaults?.[name])].filter(Boolean);
    });
    // The features a module's feature replaces get a switch at the top ("Instead of this plug-in"). A module whose feature replaces the RPG also keeps the RPG page's three bag switches on its own page (the RPG and fights page is hidden while the RPG is off).
    const instead = replacedRows(list, m.id);
    const rows = mine.some(f => Array.isArray(f.replaces) && f.replaces.includes(LEAN_RPG_FEATURE)) ? [...instead, ...own, ...rpgFeatureRows(list).map(row => (row.key === 'rpg.gearInFights' ? { ...row, label: 'Gear' } : row))] : [...instead, ...own];
    return rows.length ? [{ id: pluginPageId(m.id), group: 'Rules', name: page.section, desc: `The ${String(m.name ?? m.id)} plug-in.`, ...(typeof m.icon === 'string' && /^fa-[a-z0-9-]+$/.test(m.icon) ? { icon: m.icon } : {}), special: null, rows }] : [];
  });
}
