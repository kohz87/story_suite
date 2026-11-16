// The story clock's calendar preset names and the pack-seed claim.

/** The calendar preset that defers to the enabled packs' calendar (Gregorian without one). */
export const PACK_PRESET = 'pack';
export const PRESET_CHOICES = Object.freeze([PACK_PRESET, 'gregorian', 'custom']);
/** The claim that keeps the clock from being seeded from a pack twice. */
export const SEED_CLAIM = 'clock:seed';
