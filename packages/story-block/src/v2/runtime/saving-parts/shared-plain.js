// The test for a plain object, shared by the saving helpers.

export const isPlain = value => !!value && typeof value === 'object' && !Array.isArray(value);
