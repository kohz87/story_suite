// What the Soul Class field is called (Settings → Blocks → Edit, or a pack, may rename it: label "Level", names 1–9). Every place of
// the RPG that shows it reads the field's own `label` and `names` from the Character block, and falls back to the template's
// "Soul Class" and I–IX. Pure: it takes the field's schema (`definition.state.soul`, or nothing) and a value 1–9.
// Public face: re-exports its parts.
export { SOUL_LABEL, soulLabelOf, soulIsDefault, soulShortOf } from './soul-parts/label.js';
export { soulWordOf, characterReading, soulReading } from './soul-parts/reading.js';
