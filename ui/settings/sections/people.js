// Renders the People section: its module switches, then the feelings, pacing, stages, dossier, Refresh, portraits and map groups.
import { sectionFrame } from './start.js';

/** Returns the People page nodes for `section`; `ctx` is the overlay context. */
export function renderPeopleSection(section, ctx) {
  return sectionFrame(section, ctx);
}
