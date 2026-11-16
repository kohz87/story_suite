// Small readers and the claim pattern shared by the fight's parts.

// The claim of a board resolve (board/commit.js claim): a cleared fight's step names it.
export const CLAIM = /^rpg:resolve:[^\s]{1,450}$/u;

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const whole = value => Number.isSafeInteger(value);

export const slotsOf = value => (Array.isArray(value) ? [...new Set(value.filter(slot => whole(slot) && slot >= 1 && slot <= 99))].sort((a, b) => a - b) : []);
