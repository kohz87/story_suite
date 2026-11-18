// Pack format 4, the game pack's `start` (the player's money and items) and `pacing`.

export const GAME_START_FIELDS = Object.freeze(['money', 'items']);
export const GAME_START_LIMITS = Object.freeze({ money: 1000000000, items: 24, name: 80, qty: 9999, note: 500 });
// `pacing.tempo`: how fast the world moves (the same 0.25-4 range as the Settings row).
export const GAME_PACING_LIMITS = Object.freeze({ min: 0.25, max: 4 });
