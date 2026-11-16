// The plain-object test and the held fight's board step that the held-board parts share.

export const object = value => value && typeof value === 'object' && !Array.isArray(value);
export const boardStep = current => current?.prechecks?.find(step => step?.type === 'rpg.resolve' && step.payload?.board);
