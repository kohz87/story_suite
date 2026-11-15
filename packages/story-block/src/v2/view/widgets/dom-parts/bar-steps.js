// The fill-step thresholds of a Health, Stamina or Mana strip.

/**
 * The shade step of a Health, Stamina or Mana strip by how full it is (the one place the thresholds are): 'full' from three quarters up, 'mid' above a third,
 * else 'low' (an empty strip too). The colour is dulled by step in lean-rpg/view/bars.css; the length of the strip follows the value itself.
 */
export const BAR_STEPS = Object.freeze(['full', 'mid', 'low']);
export const barStep = ratio => (ratio >= 0.75 ? 'full' : ratio > 1 / 3 ? 'mid' : 'low');
