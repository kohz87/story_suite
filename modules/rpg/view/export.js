// Export a character (mockup: Export on a Party card): Story Block's own dialog, opened by the Export button next to Spend points and Skills.
// It saves `<name>.character.json` (charfile.js) with what the reader leaves on:
//   Character  always: Soul Class, unspent points, the seven stats and up to five skills (name, what it does, stat, Stamina or Mana, rank)
//   Inventory  a checkbox, on: the things that character carries, as the Inventory tab shows them for that owner (the party's bag for a You,
//              plus the party actor of the same name when a party module lists one; a companion's own actor only)
//   Money      a checkbox, on, and only on the reader's own card: the purse as its value in the currency's smallest unit
// Not saved: the name, XP, Health, Mana and Stamina, skill practice, anything about the story. The window reads the story
// again every time it is drawn, so it shows what is true now. Every node is built with createElement and textContent.
// Public face: re-exports its parts.

export { EXPORT_SCREEN_ID, EXPORT_WIDGET, createExportScreen } from './export-parts/screen.js';
export { characterOfCard } from './export-parts/card.js';
export { createExporter } from './export-parts/dialog.js';
