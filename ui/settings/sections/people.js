// Renders the People section: its module switches, then the feelings, pacing, stages, dossier, Refresh, portraits and map groups,
// with the list editors (custom meters, per-meter stages, the stage ladder) under their rows.
import { sectionFrame } from './start.js';
import { attachPeopleLists } from './people-lists.js';

/** Returns the People page nodes for `section`; `ctx` is the overlay context. */
export function renderPeopleSection(section, ctx) {
  return attachPeopleLists(sectionFrame(section, ctx), section, ctx);
}
