// Renders the World and time section: its module switches, then calendar, weather, map and time rules.
import { sectionFrame } from './start.js';

/** Returns the World and time page nodes for `section`; `ctx` is the overlay context. */
export function renderWorldSection(section, ctx) {
  return sectionFrame(section, ctx, { module: 'world' });
}
