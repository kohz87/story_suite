// The three bag switches that live on Settings › RPG and fights (not on the Story Block card): their rows, their feature ids and the card without them.
import { FEATURE } from '../../modules/inventory/state-parts/features.js';

/** The page's switch rows: the row key → the feature the old Features page switches (the ids and stored values are unchanged). */
export const RPG_FEATURE_ROWS = Object.freeze({ 'rpg.pickWhatYouTake': FEATURE.loot, 'rpg.encumbered': FEATURE.encumbrance, 'rpg.gearInFights': FEATURE.gear });
const ids = new Set(Object.values(RPG_FEATURE_ROWS));

/** Returns the page's rows (group "Bag and gear") for the feature list `features`: one switch each, as the list says (none without the list). */
export function rpgFeatureRows(features) {
  const list = Array.isArray(features) ? features : [];
  return Object.entries(RPG_FEATURE_ROWS).flatMap(([key, id]) => {
    const f = list.find(x => x && x.id === id);
    return f ? [{ key, group: 'Bag and gear', type: 'sw', label: String(f.label ?? id), hint: f.describe ? String(f.describe) : null, value: f.on === true, default: f.default !== false, options: null, unit: null, tags: [], wide: false }] : [];
  });
}

/** Takes the three switches off the Story Block card: `parts` = { defList, set } (moduleParts). The card's count follows. */
export function withoutRpgFeatures(parts) {
  const defList = parts.defList.map(d => ({ ...d, subs: d.subs.filter(s => !ids.has(s.key)) })).filter(d => d.subs.length);
  const set = { ...parts.set };
  for (const d of parts.defList) {
    const kept = defList.find(x => x.id === d.id);
    if (kept) set[d.id] = { on: kept.subs.some(x => x.on), subs: Object.fromEntries(kept.subs.map(x => [x.key, x.on])) };
    else delete set[d.id];
  }
  return { defList, set };
}

/** Whether `id` is one of the three. */
export const isRpgFeature = id => ids.has(id);
