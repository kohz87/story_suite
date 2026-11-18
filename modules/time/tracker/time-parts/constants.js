// The story clock's calendar preset names and the pack-seed claim.

/** The calendar preset that defers to the game's calendar (the chat's frame, else the selected game; Gregorian without one). */
export const GAME_PRESET = 'game';
/** What format 3 stored for it; read as `game`. */
export const LEGACY_PACK_PRESET = 'pack';
export const PRESET_CHOICES = Object.freeze([GAME_PRESET, 'gregorian', 'custom']);
/** The claim that keeps the clock from being seeded from a pack twice. */
export const SEED_CLAIM = 'clock:seed';
