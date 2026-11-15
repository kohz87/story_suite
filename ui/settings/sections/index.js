// Maps each settings section id to its page renderer for the overlay's `renderSection` hook.
import { renderStartSection } from './start.js';
import { renderLookSection } from './look.js';
import { renderPeopleSection } from './people.js';
import { renderRpgSection } from './rpg.js';
import { renderWorldSection } from './world.js';
import { renderDirectorSection } from './director.js';
import { renderMoneySection, renderExtrasSection } from './money-extras.js';
const RENDERERS = {
  start: renderStartSection,
  look: renderLookSection,
  people: renderPeopleSection,
  rpg: renderRpgSection,
  world: renderWorldSection,
  director: renderDirectorSection,
  money: renderMoneySection,
  extras: renderExtrasSection,
};

/** Returns the page nodes for a section id, or null (the overlay then draws the default rows, as for Add-ons). */
export function renderSettingsSection(section, ctx) {
  const fn = RENDERERS[section?.id];
  return fn ? fn(section, ctx) : null;
}
