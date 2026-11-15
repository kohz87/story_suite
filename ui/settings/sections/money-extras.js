// Renders the two small Rules pages, Money (coins and prices) and Chat extras (its module switches and inner chatter).
import { sectionFrame } from './start.js';

/** Returns the Money page nodes for `section`. */
export function renderMoneySection(section, ctx) {
  return sectionFrame(section, ctx);
}

/** Returns the Chat extras page nodes for `section`, headed by its module switches. */
export function renderExtrasSection(section, ctx) {
  return sectionFrame(section, ctx, { module: 'extras' });
}
