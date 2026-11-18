// The Start page's token figures: what each module card's switches add to the fixed prompt, and the fixed prompt under each preset, counted by the engine without switching anything.

import { presetSwitches } from '../../core/features.js';

const count = (tokensWith, switches) => {
  let n = null;
  try { n = tokensWith(switches); } catch { n = null; }
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * `features`: the feature store's list; `defs`: the cards ({ id, subs: [{ key }] }, keys = feature ids); `tokensWith(switches)`: the
 * fixed prompt's tokens with other switches (a Map feature id → on; the tools handle's `staticTokens`), or null/absent when the engine
 * cannot say. → { cards: { [module id]: number | null }, presets: { lean, standard, full: number | null } }. A card's figure is the
 * prompt now less the prompt with that card's switches off; null wherever no count was given (the page then shows no figure).
 */
export function moduleCosts(features, defs, tokensWith) {
  const list = Array.isArray(features) ? features : [];
  const ask = typeof tokensWith === 'function' ? switches => count(tokensWith, switches) : () => null;
  const now = ask(new Map());
  const cards = {};
  for (const def of Array.isArray(defs) ? defs : []) {
    const off = ask(new Map(def.subs.map(s => [s.key, false])));
    cards[def.id] = now === null || off === null ? null : Math.max(0, now - off);
  }
  const presets = Object.fromEntries(['lean', 'standard', 'full'].map(name => [name, ask(presetSwitches(list, name))]));
  return { cards, presets };
}
