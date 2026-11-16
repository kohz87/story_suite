// The RPG's screens, mounted by ui-host.js only while the feature `story-block.rpg` is on (a dynamic import(),
// so with the feature off none of this file or its siblings is ever loaded). One call wires everything:
//   * the stylesheet (lean-rpg.css), added to the page's head;
//   * the Party tab and its widget, with the Spend points sheet, the Skills view, the New character wizard (a dialog) and Export character (a dialog);
//   * the "Your character" card on Home and the dialog that holds the first Send until there is a character (start.js);
//   * the Fight tab (the Foes block's tab, on while a foe slot is filled);
//   * the battle log in the replies (at the narrator's `[battle]` marker, else a card under the reply);
//   * the "Changed this reply" lines (`cardLines`) and the RPG page of the settings window, after Features (`settingsSections`).
// `destroy()` takes all of it away again (the feature was switched off).
// Public face: re-exports its parts.

export { PARTY_SCREEN_ID, PARTY_WIDGET } from './party.js';
export { WIZARD_SCREEN_ID, WIZARD_WIDGET } from './wizard.js';
export { EXPORT_SCREEN_ID, EXPORT_WIDGET } from './export.js';
export { HOLD_SCREEN_ID, HOLD_WIDGET, START_WIDGET } from './start.js';
export { FIGHT_SCREEN_ID, FIGHT_WIDGET } from './fight.js';
export { rpgReplyLines } from './changes-lines.js';
export { heroLead } from './hero-data.js';
export { PACK, mountLeanRpg } from './index-parts/mount.js';
