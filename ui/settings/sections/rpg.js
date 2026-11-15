// Renders the RPG and fights section: its module switches, then rules, progression and fights, with the Custom-difficulty hint.
import { h } from '../../kit/dom.js';
import { sectionFrame } from './start.js';

/** Returns the RPG page nodes for `section`; a Custom difficulty adds a pointer to the checks' numbers in Director. */
export function renderRpgSection(section, ctx) {
  const custom = (section.rows ?? []).find(r => r.key === 'rpg.difficulty')?.value === 'Custom';
  const after = custom ? [h('p', { class: 'fine custom-note' }, 'Custom difficulty: the checks’ numbers are in Director › Checks.')] : [];
  return sectionFrame(section, ctx, { module: 'rpg', after });
}
