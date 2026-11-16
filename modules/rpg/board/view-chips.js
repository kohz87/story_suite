// The fight board's compact status chips and its choosing-member strips: foe groups and the party as chips with a 4-segment
// Health mini-bar, the Mana and Stamina strip above the skills, and a skill button with its cost and a "not enough" state.
// Pure render helpers: each takes a document and plain numbers and strings, and returns a DOM node. They keep no state and attach
// no clicks; view.js attaches the press (pressButton) and passes the affordability reason from plan.js actionSkills.
// Text goes in as textContent only, never as markup; names are flattened to one line by text().
// Public face: re-exports its parts.
export { SEGMENTS, litSegments, healthMiniBar } from './view-chips-parts/bars.js';
export { foeGroupChip, partyChip, statusChips } from './view-chips-parts/chips.js';
export { resourceStrip, skillButton, targetButton, NOT_ENOUGH } from './view-chips-parts/skills.js';
