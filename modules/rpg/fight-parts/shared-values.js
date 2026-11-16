// Small readers and the claim pattern shared by the fight's parts.

// The claim of a board resolve (board/commit.js claim): a cleared fight's step names it.
// (the claim of the resolve that settled a fight: a board `rpg.resolve` from before the port, or the fight kind's settle)
export const CLAIM = /^(?:rpg:resolve|ia:story-block\/fight):[^\s]{1,450}$/u;

export const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const whole = value => Number.isSafeInteger(value);

export const slotsOf = value => (Array.isArray(value) ? [...new Set(value.filter(slot => whole(slot) && slot >= 1 && slot <= 99))].sort((a, b) => a - b) : []);
