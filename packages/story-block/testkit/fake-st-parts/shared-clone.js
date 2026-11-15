// The one deep-copy helper the fake SillyTavern parts share.

export const clone = value => (value === undefined ? undefined : structuredClone(value));
