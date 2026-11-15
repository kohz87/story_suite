// Renders the Director section: its module switches, then checks, spoilers, the pulse, the planner, the cast and names.
import { sectionFrame } from './start.js';

/** Returns the Director page nodes for `section`; `ctx` is the overlay context. */
export function renderDirectorSection(section, ctx) {
  return sectionFrame(section, ctx, { module: 'director' });
}
