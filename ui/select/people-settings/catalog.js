// What the People page's list rows need beside the stored settings: the meter presets the reader may pick (built-in and the packs') and which NPC State features are on.
import { presetCatalog } from '../../../modules/people/meters/npc-meters-presets.js';

// The content kind a pack's meter presets come under (modules/people/storysuite-v2.js PRESET_KIND).
const PRESET_KIND = 'meterPresets';

/** The enabled packs' meter preset records, as NPC State reads them (`packs.content` of kind meterPresets); [] when the host cannot answer. */
export function packPresets(sdk) {
  try {
    const list = sdk?.query?.('packs.content', { kind: PRESET_KIND });
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/**
 * `{ presets, features }` (pack preset records, the feature store's list) → `{ catalog, on(id) }`: the presets in the order NPC State offers
 * them (built-in first, at most twelve), and whether a feature is on (a feature the list does not name counts as on, its default).
 */
export function peopleEnv({ presets = [], features = null } = {}) {
  const list = Array.isArray(features) ? features : [];
  return {
    catalog: presetCatalog(Array.isArray(presets) ? presets : []),
    on: id => { const f = list.find(x => x?.id === id); return f ? f.on === true : true; },
  };
}
