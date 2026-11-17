// The Settings pages' Reset buttons for the port: each puts that page's settings and switches back to their registered defaults (the old view had no page reset; these are the same defaults its controls start from).
import { HOST_SETTINGS_DEFAULTS } from '../../core/sdk/constants.js';
import { BUILTIN_MODULES } from '../../core/modules-list.js';
import { SETTINGS_DEFAULTS as NPC_DEFAULTS } from '../../modules/people/meters/npc-meters-schema.js';
import { CORE_SETTINGS } from '../../modules/scene/domains/core/constants-parts/settings.js';
import { DEFAULT_KINDS } from '../../modules/assist/safety.js';
import { DIRECTOR_ROWS } from '../select/director-rows.js';
import { EXTRAS_FEATURES, EXTRAS_MODULE, EXTRAS_SETTINGS } from '../select/extras-keys.js';
import { BUDGETS, LOOK } from '../select/host-keys.js';
import { WORLD_IDS, WORLD_KEYS } from './world-keys.js';

const D = 'story-director';
const MODULE_DEFAULTS = { [D]: BUILTIN_MODULES.find(m => m.id === D)?.settings?.defaults ?? {}, 'npc-state-delta': NPC_DEFAULTS, [EXTRAS_MODULE]: { ...CORE_SETTINGS.defaults, assistExtractorKinds: DEFAULT_KINDS } };
const FALLBACK = 'story-block.extractor';

/** The label each page's Reset button carries (ui/settings/page.js). */
export const resetLabel = name => `Reset ${name} to defaults`;

// A page → its writes: [module id (null: host), setting, default] and [feature id, default on] (a feature's default is read from the feature list).
const hostPairs = names => names.map(n => [null, n, HOST_SETTINGS_DEFAULTS[n]]);
const PAGES = {
  [resetLabel('Look')]: () => ({ settings: hostPairs(LOOK), features: [] }),
  [resetLabel('Tools')]: () => ({ settings: hostPairs(BUDGETS), features: [] }),
  [resetLabel('World and time')]: () => ({
    settings: Object.values(WORLD_KEYS).filter(d => d.key).map(d => [D, d.key, MODULE_DEFAULTS[D][d.key]]),
    features: [WORLD_IDS.weather],
  }),
  [resetLabel('Director')]: () => ({ settings: DIRECTOR_ROWS.map(r => [r.module, r.field, MODULE_DEFAULTS[r.module]?.[r.field]]), features: [] }),
  [resetLabel('Chat extras')]: () => ({ settings: Object.values(EXTRAS_SETTINGS).map(n => [EXTRAS_MODULE, n, MODULE_DEFAULTS[EXTRAS_MODULE][n]]), features: Object.values(EXTRAS_FEATURES) }),
  [resetLabel('Models')]: () => ({
    settings: [...hostPairs(['quickConnection', 'backgroundConnection', 'callQueue']), [EXTRAS_MODULE, 'assistExtractorKinds', DEFAULT_KINDS]],
    features: [FALLBACK],
  }),
};

/**
 * `settings.action` { key: 'settings.reset', value: 'Reset <page> to defaults' } for World and time, Director, Chat extras, Models, Look or Tools
 * stores that page's defaults through `writes`; `features()` is the feature list (each switch goes back to its `default`, on unless it says false).
 * → { ok: true } or { ok: false, … }. Any other command is not one of these resets: returns null.
 */
export function resetCommand(type, payload, writes = null, features = () => []) {
  const page = type === 'settings.action' && payload?.key === 'settings.reset' ? PAGES[payload.value] : null;
  if (!page) return null;
  const { settings, features: switches } = page();
  const list = features() ?? [];
  const failed = settings.some(([id, name, value]) => value === undefined || writes?.settings?.set?.(id, name, value) === undefined)
    || switches.some(id => writes?.features?.set?.(id, list.find(f => f?.id === id)?.default !== false) === undefined);
  return failed ? { ok: false, code: 'FAILED', message: 'That page was not reset.' } : { ok: true };
}
